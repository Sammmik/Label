import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

async function fetchWithRetry(url, options, maxRetries = 2, timeoutMs = 45000) {
    for (let i = 0; i <= maxRetries; i++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(timeoutId);
            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`HTTP ${response.status} - ${errText}`);
            }
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (i === maxRetries) throw error;
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}

app.post('/api/generate', async (req, res) => {
    const { description } = req.body;
    if (!process.env.FAL_KEY) return res.status(500).json({ error: "Chybí FAL_KEY." });

    // 💡 ZÁSADNÍ ZMĚNA: Přikázali jsme striktně 2D Vektorový, plochý design bez fotorealismu.
    const patternDNA = "Flat 2D vector graphic, clean corporate aesthetic, minimalist silhouette, monochrome or duotone overlay. STRICTLY NO photorealism, NO 3D rendering, NO physical textures.";

    const variations = [
        { name: "VECTOR SILHOUETTE", prompt: `Minimalist wireframe vector line art silhouette on a solid background. ${patternDNA}` },
        { name: "FLAT ICONOGRAPHY", prompt: `Oversized flat 2D silhouette graphic, watermark corporate style. ${patternDNA}` },
        { name: "ABSTRACT GEOMETRIC", prompt: `Clean 2D geometric shapes, flat colors, swiss poster design. ${patternDNA}` }
    ];

    const selectedVariation = variations[Math.floor(Math.random() * variations.length)];
    const prompt = `Minimalist flat vector graphic background. Theme: ${description}. Style: ${selectedVariation.prompt}. NO TEXT. 2D digital art only.`;

    try {
        const falOptions = {
            method: "POST",
            headers: { "Authorization": `Key ${process.env.FAL_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ prompt, image_size: "landscape_4_3", num_inference_steps: 4, guidance_scale: 3.5 })
        };
        const falResponse = await fetchWithRetry("https://fal.run/fal-ai/flux/schnell", falOptions, 2, 45000);
        const falData = await falResponse.json();
        const imageRes = await fetch(falData.images[0].url);
        const buffer = Buffer.from(await imageRes.arrayBuffer());
        res.status(200).json({ imageUrl: `data:image/jpeg;base64,${buffer.toString('base64')}`, styleName: selectedVariation.name });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => console.log(`🚀 Server běží na portu ${PORT}`));