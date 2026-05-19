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
        max_tokens: 2200,
        messages: [{
            role: "user",
            content: `You are a senior packaging designer at a top creative agency. You've designed bottle labels for brands like YUKI (electric motorcycles), KP MARK (boiler manufacturer), JINA Design (graphic studio). Each of those had a CUSTOM mascot or hero illustration — not generic stock art.

COMPANY: ${name}
DESCRIPTION: ${description || "Not provided"}
WEBSITE: ${url || "Not provided"}
BRAND COLOR HINT: ${color || "#1d4ed8"}

${url ? `CRITICAL: Web search "${name}" now. Find their real brand colors, actual products, any mascots or characters, visual style, and industry specifics. Use this to make the illustration prompts highly specific and authentic to this exact brand.` : ""}

Create 3 bottle label design variations. For each, write a HIGHLY SPECIFIC FAL.ai image generation prompt that produces a custom brand illustration — the kind you'd see on a premium branded water bottle:
- Electric vehicle brand → dramatic vehicle hero + rider silhouette
- Industrial/manufacturing → friendly product mascot character  
- Design/creative agency → oversized artistic tools arranged as brand art
- Food/beverage → appetizing product hero with vibrant surroundings
- Sports/fitness → athlete in dynamic action pose
- Tech company → abstract circuit/device artwork with brand aesthetic
etc. — ALWAYS match the exact brand, industry, and products.

Return ONLY raw JSON, no markdown, no backticks:
{
  "slogan": "punchy 4-6 word brand slogan",
  "industry": "precise industry",
  "companyColor": "#actual_hex_from_their_website",
  "designs": [
    {
      "id": 1,
      "name": "Cinematic Dark",
      "styleDesc": "Full-bleed dramatic hero on dark",
      "bg": "#0b0e16",
      "primary": "#ACTUAL_brand_color",
      "text": "#ffffff",
      "accent": "#secondary_accent_hex",
      "tagline": "3-5 word tagline",
      "imagePrompt": "Premium bottle label artwork for [${name}]. [WRITE HIGHLY SPECIFIC description: exact subject matter tailored to this brand's products/industry, e.g. 'dynamic low-angle electric motorcycle hero shot, rider in full racing gear silhouette, speed lines radiating outward' OR 'friendly smiling boiler character mascot with wrench and pressure gauge, thumbs up pose']. Dark background #0b0e16. Art style: professional flat vector illustration like premium packaging design, bold cel-shading, crisp clean outlines, 3-color palette dominated by [PRIMARY_COLOR]. Subject fills 80% of frame, slightly left-biased composition leaving right third open. Zero text, zero words, zero typography anywhere in image. Landscape 4:3 aspect ratio. High contrast, print-ready quality."
    },
    {
      "id": 2,
      "name": "Clean Hero",
      "styleDesc": "Product hero on light ground",
      "bg": "#f4f4f4",
      "primary": "#ACTUAL_brand_color",
      "text": "#111111",
      "accent": "#accent_hex",
      "tagline": "3-5 word tagline",
      "imagePrompt": "Premium bottle label artwork for [${name}]. [SAME specific brand subject, adapted for light background]. Pure white background. Art style: clean bold flat vector illustration, packaging design quality — similar to how YUKI motorcycle labels look. [PRIMARY_COLOR] as dominant brand color, bold black outlines, clean flat shapes. Large scale hero composition, dramatic angle, fills frame. Zero text. Landscape 4:3."
    },
    {
      "id": 3,
      "name": "Bold Immersive",
      "styleDesc": "Brand color as the canvas",
      "bg": "#ACTUAL_brand_color_as_bg",
      "primary": "#ffffff",
      "text": "#ffffff",
      "accent": "#contrasting_color",
      "tagline": "3-5 word tagline",
      "imagePrompt": "Premium bottle label artwork for [${name}]. [SAME brand-specific subject rendered as white/light monochromatic illustration on solid [PRIMARY_COLOR] background]. Monochromatic white and light [PRIMARY_COLOR] tones illustration on solid [PRIMARY_COLOR] background. Style: embossed stamp look, flat vector silhouette with subtle detail, bold graphic art. Strong contrast. The subject should look like a premium brand emblem. Zero text. Landscape 4:3."
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