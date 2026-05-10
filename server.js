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

    const patternDNA = "Ultra-minimalist clean aesthetic. Subtle premium textures, vast negative space, elegant lighting. NO physical objects, NO labels, NO clothing tags.";
    const variations = [
        { name: "LINEAR STRUCTURAL", prompt: `Soft geometric silver lines on a clean background. ${patternDNA}` },
        { name: "ABSTRACT FLUID", prompt: `Smooth fluid ripples, elegant minimalist aesthetic. ${patternDNA}` },
        { name: "ARCHITECTURAL", prompt: `Monochromatic architectural concrete texture, soft lighting. ${patternDNA}` }
    ];
    const selectedVariation = variations[Math.floor(Math.random() * variations.length)];
    const prompt = `Premium abstract digital background wallpaper. Theme: ${description}. Style: ${selectedVariation.prompt}. STRICTLY NO TEXT, NO FONTS, NO LETTERS. NO specific products. Ultra-minimalist 8k digital art.`;

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