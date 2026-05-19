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
            content: `You are a senior packaging designer. Reference labels you've created: Turancar ISUZU (bus dealer — huge bold red TURANCAR text on white + detailed bus illustration), HSH Sport (smartwatch brand — large smartwatch photo + HSH SPORT logo), Livesport (media — dark navy bg, logo + pink geometric shapes, no illustration), KA-Glasses (eyewear — giant glasses illustration + KA-GLASSES bold name).

COMPANY: ${name}
DESCRIPTION: ${description || "Not provided"}
WEBSITE: ${url || "Not provided"}
BRAND COLOR HINT: ${color || "#1d4ed8"}

${url ? `CRITICAL: Web search "${name}" now. Find exact brand colors, logo style, main products, brand personality. Use this to write authentic design parameters.` : ""}

Design 3 bottle label variations. Each has a different layout and color mood.

ILLUSTRATION RULES:
- If the brand sells a PHYSICAL PRODUCT (vehicle, device, glasses, food, etc.) → write a prompt for a clean product illustration: the product large on a plain background, slightly angled, like a product hero shot but illustrated/rendered style.
- If the brand is a SERVICE or MEDIA company → no illustration needed, set "imagePrompt" to "" (empty string). The design will use bold typography + geometric shapes.
- ZERO text, letters, or numbers inside any illustration.
- Style: clean flat vector or stylized product render, bold and graphic.

Return ONLY raw JSON, no markdown:
{
  "slogan": "4-6 word brand slogan",
  "industry": "precise industry",
  "companyColor": "#actual_hex",
  "hasProduct": true,
  "designs": [
    {
      "id": 1,
      "name": "Typography Bold",
      "styleDesc": "Geometric accent + bold brand name, like Livesport",
      "bg": "#111111",
      "primary": "#ACTUAL_brand_color",
      "text": "#ffffff",
      "accent": "#accent",
      "tagline": "3-5 word tagline",
      "imagePrompt": "[If hasProduct: 'Clean stylized illustration of [specific product] for ${name}. [Product] centered, slightly angled 3/4 view, [brand color] accents, clean plain background matching bg color. Flat cel-shaded vector art. Bold clean outlines. NO text NO words. Landscape 4:3.' Else: empty string]"
    },
    {
      "id": 2,
      "name": "Product Hero",
      "styleDesc": "Product illustration right, brand name left, like Turancar bus",
      "bg": "#ffffff",
      "primary": "#ACTUAL_brand_color",
      "text": "#111111",
      "accent": "#accent",
      "tagline": "3-5 word tagline",
      "imagePrompt": "[If hasProduct: 'Stylized product illustration for ${name}. [Specific product] on pure white background, dramatic 3/4 angle, facing left, [brand color] accents. Clean bold outlines. Modern flat render style. NO text NO words NO letters. Landscape 4:3.' Else: empty string]"
    },
    {
      "id": 3,
      "name": "Dark Inverted",
      "styleDesc": "Dark/brand color bg, dramatic product or pure typography",
      "bg": "#ACTUAL_brand_color OR #0d0d0d",
      "primary": "#ffffff",
      "text": "#ffffff",
      "accent": "#accent",
      "tagline": "3-5 word tagline",
      "imagePrompt": "[If hasProduct: 'Stylized [product] illustration for ${name} on dark/[brand color] background. White and pale tones, monochromatic, like an embossed stamp. Bold flat silhouette. NO text NO words. Landscape 4:3.' Else: empty string]"
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

    // Empty prompt = typography-only design, no illustration needed
    if (!prompt || prompt.trim().length < 10) {
        return res.json({ imageUrl: null, designIndex });
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