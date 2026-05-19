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
        max_tokens: 3000,
        messages: [{
            role: "user",
            content: `You are a senior packaging illustrator and brand designer.

═══ VARIATION DIRECTIVE ═══
Creative seed: ${variationSeed}
Even if you've seen this exact company before, you MUST produce a completely different design concept this time. Be surprising. Pick unexpected angles, unusual moods, fresh illustration concepts.

═══ BRAND ═══
Company: ${name}
Description: ${description || "Not provided"}
Website: ${url || "Not provided"}
Brand Color Hint: ${color || "#1d4ed8"}

${url ? `CRITICAL: Web search "${name}" right now. Find exact brand hex colors, logo style, products, mascots, brand personality.` : ""}

═══ DESIGN INSTRUCTIONS ═══
Generate 3 distinct bottle label designs. Each must use:
- A different MOOD direction (pick from): ${moodHints.join(" / ")}
- A different COMPOSITION (pick from): ${compHints.join(" / ")}
- A different DISPLAY FONT (pick 3 different ones from): ${fontsThisRun.join(", ")}

═══ ILLUSTRATION RULES (CRITICAL) ═══
Every illustration MUST have THREE layers explicitly described:
1. HERO — main brand subject (product, mascot, key symbol)
2. SUPPORTING ELEMENTS — 4-6 brand-specific objects floating in scene
3. BACKGROUND — atmospheric gradient, texture, pattern, environment

EXAMPLES of rich illustration concepts:
- Motorcycle brand: HERO motorcycle at low angle / SUPPORTING speed lines, sparks, exhaust trails, scattered helmets, road markings / BACKGROUND gradient sunset sky with distant city silhouette
- Boiler brand: HERO smiling boiler mascot / SUPPORTING copper coils, pressure gauges, wrench, steam wisps / BACKGROUND blueprint grid pattern
- Coffee shop: HERO steaming cup / SUPPORTING coffee beans, latte art swirls, croissant, sugar cubes, leaves / BACKGROUND warm coffee-stain texture
- Design studio: HERO oversized creative tools / SUPPORTING color swatches, paint splashes, geometric shapes / BACKGROUND grainy paper texture
- Outdoor brand: HERO mountain peak / SUPPORTING evergreen trees, climbing gear, compass, trail markers / BACKGROUND gradient sky with clouds

Generic "subject on plain background" is FORBIDDEN. Always rich, layered, atmospheric.

Style: modern editorial illustration with subtle gradients, dimensional shading, depth, atmosphere. NOT flat boring vectors.

ZERO text, ZERO letters, ZERO numbers inside any illustration.

═══ OUTPUT — raw JSON only, no markdown, no backticks ═══
{
  "slogan": "punchy 4-6 word brand slogan",
  "industry": "precise industry",
  "companyColor": "#actual_hex_detected",
  "designs": [
    {
      "id": 1,
      "name": "Creative name for this variation",
      "styleDesc": "one sentence describing the approach",
      "displayFont": "exact font name from list above",
      "bg": "#hex",
      "primary": "#hex",
      "text": "#hex",
      "accent": "#hex",
      "tagline": "3-5 word tagline (different per design)",
      "imagePrompt": "Rich detailed illustration with HERO: [specific]. SUPPORTING: [4-6 brand-specific objects]. BACKGROUND: [gradient/texture/environment]. Color palette: [specific colors]. Style: modern editorial illustration with subtle gradients and depth. STRICTLY NO text NO letters NO words NO numbers. Landscape 4:3."
    },
    { "id": 2, ... different mood, different font, different angle },
    { "id": 3, ... third unique direction }
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

    const finalPrompt = `${prompt} CRITICAL VISUAL REQUIREMENTS: Subject must fill at least 70% of frame, dramatically composed and instantly recognizable. Rich detailed illustration with multiple visual elements, gradients, depth, atmosphere, supporting background objects. Absolutely NO text, NO letters, NO words, NO numbers anywhere. Bold marketing-quality artwork suitable for premium product packaging.`;

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