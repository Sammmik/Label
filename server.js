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

// ─── BEZPEČNÝ RETRY FETCH ───────────────────────────────────────
async function fetchWithRetry(url, options, maxRetries = 2, timeoutMs = 55000) {
    for (let i = 0; i <= maxRetries; i++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(timeoutId);
            return response; // Záměrně vracíme celý response, abychom ho zkontrolovali níže
        } catch (error) {
            clearTimeout(timeoutId);
            if (i === maxRetries) throw error;
            console.log(`Retry ${i + 1} for ${url}...`);
            await new Promise(resolve => setTimeout(resolve, 2500 * (i + 1)));
        }
    }
}

// ─── BRAND ANALYSIS (Lokální generátor) ───
app.post('/api/analyze-brand', async (req, res) => {
    const { name, description, color } = req.body;
    const primaryColor = color || "#1d4ed8";
    const brandContext = description ? description : name;

    const parsed = {
        slogan: "Premium Quality Edition",
        industry: description ? "Custom Brand" : "Product & Tech",
        companyColor: primaryColor,
        designs: [
            {
                id: 1, name: "Signature Dark", styleDesc: "Premium dark edition",
                bg: "#0a0d18", primary: primaryColor, text: "#ffffff", accent: "#334155", tagline: "Pure & Essential",
                imagePrompt: `Flat 2D vector illustration: abstract graphic representing ${brandContext}. Dark navy background #0a0d18. Flat cell-shaded vector art, bold outlines, limited color palette using ${primaryColor}. NO text, NO photorealism, NO gradients. Clean digital illustration in landscape 4:3 ratio.`
            },
            {
                id: 2, name: "Clean White", styleDesc: "Professional minimal white",
                bg: "#f8f8f8", primary: primaryColor, text: "#111111", accent: "#e2e8f0", tagline: "Refreshingly Simple",
                imagePrompt: `Flat 2D vector illustration: abstract graphic representing ${brandContext}. White/light grey background. Clean minimal vector art, brand color ${primaryColor} as main accent. Bold flat shapes, crisp outlines. NO text, NO photorealism. Landscape 4:3.`
            },
            {
                id: 3, name: "Bold Brand", styleDesc: "Full brand color statement",
                bg: primaryColor, primary: "#ffffff", text: "#ffffff", accent: "#0f172a", tagline: "Stand Out",
                imagePrompt: `Flat 2D vector illustration: abstract graphic representing ${brandContext}. Solid ${primaryColor} background. White and light-colored flat vector art, bold silhouette style. Dynamic composition. NO text, NO photorealism. Landscape 4:3.`
            }
        ]
    };

    setTimeout(() => { res.json(parsed); }, 800);
});

// ─── IMAGE GENERATION via FAL.ai ─────────────────────────────
app.post('/api/generate-image', async (req, res) => {
    const { prompt, designIndex } = req.body;
    if (!process.env.FAL_KEY) {
        return res.status(500).json({ error: "Na serveru chybí FAL_KEY v nastavení prostředí (Environment Variables)." });
    }

    const enforcedStyle = "flat 2D vector graphic, bold outlines, clean cell-shaded illustration, professional brand packaging art, NO photorealism, NO 3D rendering, NO gradients, NO text in image, NO typography, landscape 4:3 aspect ratio";
    const finalPrompt = `${prompt} Style enforcement: ${enforcedStyle}`;

    try {
        const falResponse = await fetchWithRetry("https://fal.run/fal-ai/flux/schnell", {
            method: "POST",
            headers: {
                "Authorization": `Key ${process.env.FAL_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                prompt: finalPrompt, image_size: "landscape_4_3", num_inference_steps: 8, guidance_scale: 4.5, num_images: 1
            })
        }, 2, 55000);

        // BEZPEČNÉ PARSOVÁNÍ ODPOVĚDI OD FAL.AI
        const rawText = await falResponse.text();
        if (!falResponse.ok) {
            throw new Error(`FAL.ai zamítl požadavek (Status ${falResponse.status}): ${rawText.substring(0, 150)}`);
        }

        let falData;
        try {
            falData = JSON.parse(rawText);
        } catch (e) {
            throw new Error(`Služba FAL.ai nevrátila JSON data, ale HTML stránku. Služba má pravděpodobně výpadek.`);
        }

        if (!falData.images || !falData.images[0]) {
            throw new Error("FAL.ai nevygeneroval žádný obrázek.");
        }

        const imageRes = await fetch(falData.images[0].url);
        if (!imageRes.ok) throw new Error("Nepodařilo se stáhnout vygenerovaný obrázek z FAL.ai");
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

// ─── QR CODE PROXY ──────────────────────────────
app.get('/api/qr', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).send("Missing url");
    try {
        const qrRes = await fetch(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}&bgcolor=ffffff&color=000000&margin=8`);
        const buf = Buffer.from(await qrRes.arrayBuffer());
        res.set("Content-Type", "image/png");
        res.send(buf);
    } catch (e) {
        res.status(500).send("QR error");
    }
});

// ─── ZÁCHRANNÁ SÍŤ ──────────────────────────────────────────
app.use('/api', (req, res) => {
    res.status(404).json({ error: `API cesta nenalezena. Ujistěte se, že Render načetl nový server.js!` });
});

app.listen(PORT, () => console.log(`🚀 Label Studio running on port ${PORT}`));