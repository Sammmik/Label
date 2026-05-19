import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── RETRY FETCH ───────────────────────────────────────────────
async function fetchWithRetry(url, options, maxRetries = 2, timeoutMs = 55000) {
    for (let i = 0; i <= maxRetries; i++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(timeoutId);
            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errText.substring(0, 200)}`);
            }
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (i === maxRetries) throw error;
            console.log(`Retry ${i + 1} for ${url}...`);
            await new Promise(resolve => setTimeout(resolve, 2500 * (i + 1)));
        }
    }
}

// ─── BRAND ANALYSIS via Claude ────────────────────────────────
// Returns brand colors, design params, and FAL.ai image prompts
app.post('/api/analyze-brand', async (req, res) => {
    const { name, description, url, color } = req.body;
    if (!process.env.ANTHROPIC_API_KEY) {
        return res.status(500).json({ error: "Missing ANTHROPIC_API_KEY environment variable." });
    }

    const body = {
        model: "claude-sonnet-4-6",
        max_tokens: 2400,
        messages: [{
            role: "user",
            content: `You are a senior packaging designer at a world-class creative agency. Reference projects: YUKI electric motorcycles label (giant motorcycle hero graphic fills the label), KP MARK boilers (smiling boiler character mascot with tools), JINA Design (oversized keyboard keys arranged as brand art on dark background).

COMPANY: ${name}
DESCRIPTION: ${description || "Not provided"}
WEBSITE: ${url || "Not provided"}
BRAND COLOR HINT: ${color || "#1d4ed8"}

${url ? `CRITICAL: Web search "${name}" right now. Find: exact brand hex colors, logo shape/icon/symbol, key products or services, any mascot, brand personality. Use this to make the illustration concept authentic.` : ""}

ILLUSTRATION RULES — read carefully:
1. The AI illustration IS the entire creative zone of the label. It must be bold, custom, brand-specific art that immediately communicates who this brand is.
2. Identify the brand's key visual symbol (their logo icon, their main product, a mascot). Make THAT the hero of the illustration.
3. All 3 designs use the same core subject — just different color moods (dark / white / brand-color).
4. ABSOLUTELY NO text, letters, words, numbers inside the illustration. Zero.
5. Style: flat vector illustration, cel-shaded, bold outlines, limited 3-4 color palette. Like premium packaging artwork.
6. Composition: subject fills the frame dramatically. For layouts that split, subject is slightly left-biased.

Return ONLY raw JSON — no markdown, no backticks, nothing else:
{
  "slogan": "punchy 4-6 word brand slogan",
  "industry": "precise industry name",
  "companyColor": "#actual_hex_detected",
  "illustrationConcept": "one sentence: what the core brand illustration shows, e.g. 'friendly cartoon boiler mascot with a thumbs-up and wrench'",
  "designs": [
    {
      "id": 1,
      "name": "Dark Edition",
      "styleDesc": "Full-bleed dramatic art on deep dark background",
      "bg": "#0c0e16",
      "primary": "#ACTUAL_brand_color",
      "text": "#ffffff",
      "accent": "#accent_hex",
      "tagline": "3-5 word tagline",
      "imagePrompt": "[Write a precise FAL.ai image prompt: describe the specific brand illustration for ${name}, their industry is ${description || 'unknown'}. Describe the EXACT mascot, product, or symbol from their brand identity. Dark background #0c0e16. Flat cel-shaded vector illustration. Bold outlines. Brand color as hero accent. Subject fills 85% of frame. ZERO text ZERO letters ZERO numbers. Landscape 4:3.]"
    },
    {
      "id": 2,
      "name": "White Hero",
      "styleDesc": "Clean bold graphic on white background",
      "bg": "#ffffff",
      "primary": "#ACTUAL_brand_color",
      "text": "#111111",
      "accent": "#accent_hex",
      "tagline": "3-5 word tagline",
      "imagePrompt": "[Same core brand illustration as design 1 but on pure white background. Flat vector art. Brand color dominant. Bold graphic outlines. Clean modern packaging illustration. ZERO text ZERO letters ZERO numbers. Landscape 4:3.]"
    },
    {
      "id": 3,
      "name": "Brand Color",
      "styleDesc": "Monochromatic mascot on solid brand color",
      "bg": "#ACTUAL_brand_color",
      "primary": "#ffffff",
      "text": "#ffffff",
      "accent": "#contrasting_hex",
      "tagline": "3-5 word tagline",
      "imagePrompt": "[Same brand illustration rendered white/cream on solid brand color background. Monochromatic flat vector style — like an embossed stamp or screen print. High contrast. Bold graphic silhouette. ZERO text ZERO letters ZERO numbers. Landscape 4:3.]"
    }
  ]
}`
        }]
    };

    if (url) {
        body.tools = [{ type: "web_search_20250305", name: "web_search" }];
    }

    try {
        const response = await fetchWithRetry("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": process.env.ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01"
            },
            body: JSON.stringify(body)
        }, 1, 60000);

        const data = await response.json();
        const textContent = data.content.filter(b => b.type === "text").map(b => b.text).join("");
        const match = textContent.match(/\{[\s\S]*\}/);
        if (!match) throw new Error("AI returned unexpected format. Try again.");

        const parsed = JSON.parse(match[0]);
        res.json(parsed);
    } catch (err) {
        console.error("Brand analysis error:", err);
        res.status(500).json({ error: err.message });
    }
});

// ─── IMAGE GENERATION via FAL.ai ─────────────────────────────
// Generates one illustration per design
app.post('/api/generate-image', async (req, res) => {
    const { prompt, designIndex } = req.body;
    if (!process.env.FAL_KEY) {
        return res.status(500).json({ error: "Missing FAL_KEY environment variable." });
    }

    // Enforce bottle-label-appropriate style on top of the custom prompt
    const styleEnforcement = [
        "professional packaging illustration",
        "flat vector art",
        "bold clean outlines",
        "cel-shaded illustration",
        "premium brand label design quality",
        "NO photorealism",
        "NO 3D renders",
        "NO gradients",
        "NO text",
        "NO words",
        "NO typography",
        "NO letters",
        "landscape 4:3"
    ].join(", ");

    const finalPrompt = `${prompt}. Additional style requirements: ${styleEnforcement}`;

    try {
        const falResponse = await fetchWithRetry("https://fal.run/fal-ai/flux/dev", {
            method: "POST",
            headers: {
                "Authorization": `Key ${process.env.FAL_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                prompt: finalPrompt,
                image_size: "landscape_4_3",
                num_inference_steps: 28,
                guidance_scale: 7.5,
                num_images: 1,
                enable_safety_checker: false
            })
        }, 2, 90000);

        const falData = await falResponse.json();
        if (!falData.images || !falData.images[0]) {
            throw new Error("FAL.ai returned no image");
        }

        // Download image and convert to base64 for embedding
        const imageRes = await fetch(falData.images[0].url);
        if (!imageRes.ok) throw new Error("Failed to download generated image");
        const buffer = Buffer.from(await imageRes.arrayBuffer());

        res.json({
            imageUrl: `data:image/jpeg;base64,${buffer.toString('base64')}`,
            designIndex
        });
    } catch (error) {
        console.error("Image generation error:", error);
        res.status(500).json({ error: error.message });
    }
});

// ─── QR CODE PROXY (avoid CORS) ──────────────────────────────
app.get('/api/qr', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).send("Missing url");
    try {
        const qrRes = await fetch(
            `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}&bgcolor=ffffff&color=000000&margin=8`
        );
        const buf = Buffer.from(await qrRes.arrayBuffer());
        res.set("Content-Type", "image/png");
        res.send(buf);
    } catch (e) {
        res.status(500).send("QR error");
    }
});

app.listen(PORT, () => console.log(`🚀 Label Studio running on port ${PORT}`));