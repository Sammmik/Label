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
        max_tokens: 2600,
        messages: [{
            role: "user",
            content: `You are a senior packaging illustrator. You write FAL.ai image generation prompts for bottle label artwork. 

Study these real label examples and how their illustrations work:
- JINA Design (graphic studio): Diagonal arrangement of oversized pink keyboard keys + green pencils on dark background. Background has subtle grid lines and scattered small design elements. Rich, layered composition.
- KP MARK (boiler company): Friendly blue boiler mascot character in foreground. Background has coils of copper pipe, pressure gauges, technical pipe diagrams, steam wisps, workshop tools. Feels like a busy workshop scene.
- YUKI (motorcycle brand): Large motorcycle in foreground at dramatic angle. Background has speed lines radiating outward, subtle road surface below, sparks, motion blur streaks. Feels fast and dynamic.
- Turancar ISUZU (bus dealer): Bus hero shot slightly angled. Ground shadow below bus, subtle road markings, gradient sky. Clean but NOT empty.
- HSH Sport (smartwatch): Smartwatch face dominant, angled slightly. Behind it: subtle fitness graphs/charts as background elements, digital grid lines, small running figure silhouette.

KEY INSIGHT: Every good label illustration has THREE layers:
1. HERO subject (the main product/mascot/symbol)
2. SUPPORTING ELEMENTS (industry-specific objects around the hero)  
3. BACKGROUND TEXTURE (subtle patterns, environment, atmosphere)

COMPANY: ${name}
DESCRIPTION: ${description || "Not provided"}
WEBSITE: ${url || "Not provided"}
BRAND COLOR HINT: ${color || "#1d4ed8"}

${url ? `CRITICAL: Web search "${name}" now. Find exact brand colors, products, visual identity. Use this to make illustrations authentic.` : ""}

Write 3 illustration prompts that describe ALL THREE LAYERS for this specific brand.

RULES:
- Physical product brands → rich product illustration with environmental context
- Service/media brands → abstract brand symbol with decorative graphic elements (NOT empty, never just a logo on a background)
- ZERO text, letters, numbers, words in ANY illustration
- Style: bold graphic illustration, cel-shaded or stylized render

Return ONLY raw JSON, no markdown:
{
  "slogan": "4-6 word brand slogan",
  "industry": "precise industry",
  "companyColor": "#actual_hex",
  "designs": [
    {
      "id": 1,
      "name": "Typography Bold",
      "styleDesc": "Illustrated accent left, bold name right",
      "bg": "#0d0f14",
      "primary": "#ACTUAL_brand_color",
      "text": "#ffffff",
      "accent": "#accent_hex",
      "tagline": "3-5 word tagline",
      "imagePrompt": "Bottle label illustration for ${name} (${description || 'brand'}). HERO: [describe specific main subject]. SUPPORTING ELEMENTS: [list 4-5 brand-specific background objects floating around the hero, e.g. 'scattered copper pipe coils, pressure gauges, wrench tools, steam clouds' or 'speed lines, sparks, asphalt road surface, motion blur streaks']. BACKGROUND: [atmosphere/texture, e.g. 'dark navy background with subtle diagonal grid lines and faint technical diagram patterns']. Color palette: deep dark background, [brand color] as primary accent, white highlights. Bold cel-shaded vector graphic style. Dynamic diagonal composition. STRICTLY NO text, NO letters, NO words, NO numbers anywhere in image. Landscape 4:3."
    },
    {
      "id": 2,
      "name": "Product Hero",
      "styleDesc": "Product illustration on light/white background",
      "bg": "#ffffff",
      "primary": "#ACTUAL_brand_color",
      "text": "#111111",
      "accent": "#accent_hex",
      "tagline": "3-5 word tagline",
      "imagePrompt": "Bottle label illustration for ${name} (${description || 'brand'}). HERO: [same main subject, slightly left-facing, 3/4 angle]. SUPPORTING ELEMENTS: [same 4-5 supporting objects but lighter/outlined versions floating in background]. BACKGROUND: [white or very light background with subtle [brand color] geometric shapes, light shadow under hero subject]. Color palette: white background, [brand color] dominant on hero, black outlines. Clean bold cel-shaded vector art style. STRICTLY NO text, NO letters, NO words, NO numbers. Landscape 4:3."
    },
    {
      "id": 3,
      "name": "Dark Inverted",
      "styleDesc": "Full scene on dark or brand-color background",
      "bg": "#0d0f14",
      "primary": "#ACTUAL_brand_color",
      "text": "#ffffff",
      "accent": "#accent_hex",
      "tagline": "3-5 word tagline",
      "imagePrompt": "Bottle label illustration for ${name} (${description || 'brand'}). HERO: [same main subject rendered in white/pale tones]. SUPPORTING ELEMENTS: [same supporting objects in subtle pale/ghost tones]. BACKGROUND: [dark or solid brand-color background with faint decorative pattern — diagonal lines, dots grid, or subtle industry-relevant texture]. Style: monochromatic white-on-dark illustration, like a premium silkscreen print. Bold graphic shapes. STRICTLY NO text, NO letters, NO words, NO numbers. Landscape 4:3."
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

    // Only enforce what actually matters — no text. Let the illustration be rich.
    const styleEnforcement = "IMPORTANT: absolutely NO text, NO letters, NO words, NO numbers, NO typography anywhere in the image. The illustration should be rich and detailed with background elements.";

    const finalPrompt = `${prompt} ${styleEnforcement}`;

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