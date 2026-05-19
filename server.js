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
        model: "claude-sonnet-4-20250514",
        max_tokens: 1600,
        messages: [{
            role: "user",
            content: `You are a world-class packaging designer specializing in custom PET bottle labels (200mm × 50mm wrap-around format).

COMPANY: ${name}
DESCRIPTION: ${description || "Not provided"}
WEBSITE: ${url || "Not provided"}
BRAND COLOR HINT: ${color || "#1d4ed8"}

${url ? `IMPORTANT: Use web search to find "${name}" online. Detect their real logo colors, brand style, industry, and visual identity.` : ""}

Your job: Design parameters for 3 bottle label variations + FAL.ai illustration prompts.

The illustration (AI-generated) fills the LEFT 70% of the label. It should look like the illustrated graphics on professional branded bottle labels — think flat vector mascots, product silhouettes, bold brand art.

Return ONLY a raw JSON object, no markdown, no explanation:
{
  "slogan": "max 5 word punchy brand slogan",
  "industry": "specific industry name",
  "companyColor": "#actual detected hex color",
  "designs": [
    {
      "id": 1,
      "name": "Signature Dark",
      "styleDesc": "Premium dark edition",
      "bg": "#0a0d18",
      "primary": "#brand_color_hex",
      "text": "#ffffff",
      "accent": "#accent_hex",
      "tagline": "short 3-5 word tagline",
      "imagePrompt": "Flat 2D vector illustration: [brand-specific graphic matching their industry and logo style]. Dark navy background #0a0d18. Flat cell-shaded vector art, bold outlines, limited color palette using [brand_color]. NO text, NO photorealism, NO gradients. Clean digital illustration in landscape 4:3 ratio."
    },
    {
      "id": 2,
      "name": "Clean White",
      "styleDesc": "Professional minimal white",
      "bg": "#f8f8f8",
      "primary": "#brand_color_hex",
      "text": "#111111",
      "accent": "#light_accent_hex",
      "tagline": "short 3-5 word tagline",
      "imagePrompt": "Flat 2D vector illustration: [brand-specific graphic]. White/light grey background. Clean minimal vector art, brand color [brand_color] as main accent. Bold flat shapes, crisp outlines. NO text, NO photorealism. Landscape 4:3."
    },
    {
      "id": 3,
      "name": "Bold Brand",
      "styleDesc": "Full brand color statement",
      "bg": "#brand_color_as_bg",
      "primary": "#ffffff",
      "text": "#ffffff",
      "accent": "#contrasting_accent",
      "tagline": "short 3-5 word tagline",
      "imagePrompt": "Flat 2D vector illustration: [brand-specific graphic]. Solid [brand_color] background. White and light-colored flat vector art, bold silhouette style. Dynamic composition. NO text, NO photorealism. Landscape 4:3."
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

    // Enforce bottle-label-appropriate style
    const enforcedStyle = [
        "flat 2D vector graphic",
        "bold outlines",
        "clean cell-shaded illustration",
        "professional brand packaging art",
        "NO photorealism",
        "NO 3D rendering",
        "NO gradients",
        "NO text in image",
        "NO typography",
        "landscape 4:3 aspect ratio"
    ].join(", ");

    const finalPrompt = `${prompt} Style enforcement: ${enforcedStyle}`;

    try {
        const falResponse = await fetchWithRetry("https://fal.run/fal-ai/flux/schnell", {
            method: "POST",
            headers: {
                "Authorization": `Key ${process.env.FAL_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                prompt: finalPrompt,
                image_size: "landscape_4_3",
                num_inference_steps: 8,   // More steps = higher quality
                guidance_scale: 4.5,
                num_images: 1
            })
        }, 2, 55000);

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