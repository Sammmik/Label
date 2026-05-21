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

// ─── RETRY FETCH ─────────────────────────────────────────────
async function fetchWithRetry(url, options, maxRetries = 2, timeoutMs = 90000) {
    for (let i = 0; i <= maxRetries; i++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(timeoutId);
            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errText.substring(0, 250)}`);
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

// ─── CREATIVITY POOLS — used for randomization ──────────────
const MOOD_DIRECTIONS = [
    "editorial magazine cover energy",
    "industrial brutalist poster",
    "art deco geometric symmetry",
    "swiss minimal corporate",
    "retro-futurist 1980s",
    "organic naturalistic warmth",
    "bauhaus geometric primary-color",
    "art nouveau ornate flourish",
    "tech sci-fi neon",
    "playful pop-art bold",
    "cinematic noir dramatic",
    "vintage travel poster",
    "japanese minimalism mono-no-aware",
    "memphis design 1980s zigzag",
    "constructivist soviet-poster boldness"
];

const COMPOSITION_HINTS = [
    "diagonal dynamic composition",
    "centered symmetrical formal",
    "rule-of-thirds editorial",
    "asymmetric tension",
    "dutch-angle dramatic tilt",
    "layered foreground-midground-background",
    "isometric 3/4 perspective",
    "frontal poster-style",
    "low-angle hero shot",
    "high-angle environmental"
];

const FONT_POOL = [
    "Anton",
    "Bebas Neue",
    "Oswald",
    "Russo One",
    "Archivo Black",
    "Black Ops One",
    "Bowlby One",
    "Staatliches",
    "Saira Condensed",
    "Bungee",
    "Barlow Condensed",
    "Passion One",
    "Big Shoulders Display"
];

function pickN(arr, n) {
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, n);
}

// ─── BRAND ANALYSIS via Claude ──────────────────────────────
app.post('/api/analyze-brand', async (req, res) => {
    const { name, description, url, color } = req.body;
    if (!process.env.ANTHROPIC_API_KEY) {
        return res.status(500).json({ error: "Missing ANTHROPIC_API_KEY env var." });
    }

    const variationSeed = Math.floor(Math.random() * 99999);
    const moodHints = pickN(MOOD_DIRECTIONS, 3);
    const compHints = pickN(COMPOSITION_HINTS, 3);
    const fontsThisRun = pickN(FONT_POOL, 6);

    const body = {
        model: "claude-sonnet-4-6",
        max_tokens: 2400,
        messages: [{
            role: "user",
            content: `You are a product label illustrator. You design clean, restrained bottle labels for Czech companies.

═══ VARIATION SEED ═══
Creative seed: ${variationSeed}
Even with the same input, produce a different design each run.

═══ BRAND ═══
Company: ${name}
Description: ${description || "Not provided"}
Website: ${url || "Not provided"}
Brand Color Hint: ${color || "#1d4ed8"}

${url ? `Web search "${name}" to find: real brand colors, products, logo style, visual identity.` : ""}

═══ ILLUSTRATION STYLE ═══
Reference style: clean product illustrations on a SINGLE solid background color. Like the bus on the Turancar label, the watch on HSH Sport, the glasses on KA-Glasses. NOT editorial, NOT dramatic, NOT atmospheric. Just a clean product hero illustration on a plain background.

For each design write a SHORT, FOCUSED image prompt:
- The SUBJECT: their main product or brand symbol (e.g. "red and silver electric motorcycle, 3/4 angle view", "smartwatch with metallic bezel facing forward", "stack of leather wallets")
- The BACKGROUND: just specify a solid color (matches design's bg color)
- Style: clean modern illustration, flat shading or subtle vector shading, crisp clean outlines

Keep prompts SHORT (40-60 words max). Don't request "rich atmosphere", "gradients everywhere", "dramatic lighting", "supporting objects scattered around" — those make FAL.ai produce busy AI-looking results.

═══ LANGUAGE — CRITICAL ═══
The "slogan", all "tagline" fields, and all "styleDesc" fields MUST be written in CZECH language (čeština).
The "industry", "name" (design variation name like "Light Edition"), and "imagePrompt" fields stay in English (imagePrompt MUST be English so FAL.ai understands it).
Use natural, punchy Czech marketing language with proper diacritics (á, č, ď, é, ě, í, ň, ó, ř, š, ť, ú, ů, ý, ž).
Examples of good Czech taglines: "Síla z hor", "Čistota každý den", "Pravá česká kvalita", "Vyrobeno s láskou", "Pro každého z nás".
Examples of good Czech styleDesc: "Čistý hrdina produktu na bílém pozadí", "Produkt na firemní barvě", "Hrdina na tmavém pozadí".

═══ FONT VARIETY ═══
Use 3 different fonts from: ${fontsThisRun.join(", ")}

═══ OUTPUT — raw JSON only ═══
{
  "slogan": "punchy 4-6 word slogan",
  "industry": "industry",
  "companyColor": "#actual_hex_from_web",
  "designs": [
    {
      "id": 1,
      "name": "Light Edition",
      "styleDesc": "Čistý hrdina produktu na bílém pozadí",
      "displayFont": "<font from list>",
      "bg": "#ffffff",
      "primary": "#brand_color",
      "text": "#111111",
      "accent": "#accent_hex",
      "tagline": "3-5 word tagline IN CZECH",
      "imagePrompt": "Clean illustration of [SPECIFIC product/symbol for ${name}, e.g. 'silver and red motorcycle in 3/4 view, slightly tilted left']. Solid white background. Modern flat vector style with subtle shading and clean outlines. Brand color [hex] as primary accent. NO text NO letters NO words NO numbers. Landscape 4:3."
    },
    {
      "id": 2,
      "name": "Brand Color",
      "styleDesc": "Produkt na firemní barvě",
      "displayFont": "<different font>",
      "bg": "#brand_color_or_tinted",
      "primary": "#ffffff",
      "text": "#ffffff",
      "accent": "#accent_hex",
      "tagline": "different 3-5 word tagline IN CZECH",
      "imagePrompt": "Clean illustration of [SAME product type, different angle, e.g. 'side profile motorcycle silhouette']. Solid [brand_color] background. White and pale-toned flat vector illustration, clean outlines. NO text NO letters NO words NO numbers. Landscape 4:3."
    },
    {
      "id": 3,
      "name": "Dark Edition",
      "styleDesc": "Hrdina produktu na tmavém pozadí",
      "displayFont": "<third font>",
      "bg": "#0d0e14",
      "primary": "#brand_color",
      "text": "#ffffff",
      "accent": "#accent_hex",
      "tagline": "third 3-5 word tagline IN CZECH",
      "imagePrompt": "Clean illustration of [SAME product type, hero composition]. Solid dark background #0d0e14. Modern flat vector style with [brand_color] accents on the product, clean outlines, subtle shading. NO text NO letters NO words NO numbers. Landscape 4:3."
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
        }, 1, 70000);

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

// ─── IMAGE GENERATION via FAL.ai flux-pro v1.1 ──────────────
app.post('/api/generate-image', async (req, res) => {
    const { prompt, designIndex } = req.body;
    if (!process.env.FAL_KEY) {
        return res.status(500).json({ error: "Missing FAL_KEY env var." });
    }

    if (!prompt || prompt.trim().length < 10) {
        return res.json({ imageUrl: null, designIndex });
    }

    // Keep enforcement minimal — match the clean restrained reference style
    const finalPrompt = `${prompt} Subject is the focal point, fills most of the frame. Clean product illustration style. NO text, NO letters, NO words, NO numbers anywhere in image.`;

    const seed = Math.floor(Math.random() * 1000000);

    try {
        // FAL.ai flux-pro v1.1 — premium quality
        const falResponse = await fetchWithRetry("https://fal.run/fal-ai/flux-pro/v1.1", {
            method: "POST",
            headers: {
                "Authorization": `Key ${process.env.FAL_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                prompt: finalPrompt,
                image_size: "landscape_4_3",
                num_images: 1,
                seed: seed,
                safety_tolerance: 6,
                enable_safety_checker: false,
                output_format: "jpeg"
            })
        }, 2, 90000);

        const falData = await falResponse.json();
        if (!falData.images || !falData.images[0]) {
            throw new Error("FAL.ai returned no image");
        }

        const imageRes = await fetch(falData.images[0].url);
        if (!imageRes.ok) throw new Error("Failed to download generated image");
        const buffer = Buffer.from(await imageRes.arrayBuffer());

        res.json({
            imageUrl: `data:image/jpeg;base64,${buffer.toString('base64')}`,
            designIndex,
            seed
        });
    } catch (error) {
        console.error("Image generation error:", error);
        res.status(500).json({ error: error.message });
    }
});

// ─── QR CODE PROXY ──────────────────────────────────────────
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

app.listen(PORT, () => console.log(`🚀 Label Studio (rich mode) on port ${PORT}`));