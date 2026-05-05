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
            console.log(`⏳ [Pokus ${i + 1}/${maxRetries + 1}] Volám API fal.ai...`);
            const response = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`HTTP ${response.status} - ${errText}`);
            }
            return response;

        } catch (error) {
            clearTimeout(timeoutId);
            console.log(`⚠️ Pokus ${i + 1} selhal: ${error.message}`);
            if (i === maxRetries) throw error;

            console.log(`🔄 Čekám 2 vteřiny před dalším pokusem...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}

app.post('/api/generate', async (req, res) => {
    console.log("➡️ Přijat požadavek na generování grafiky...");
    const { description, companyName } = req.body;

    if (!process.env.FAL_KEY) {
        return res.status(500).json({ error: "Kritická chyba serveru: Chybí FAL_KEY." });
    }

    const patternDNA = "Minimalist layout, thin geometric lines, precise grid alignment, vast negative space, subtle professional aesthetic, high-end corporate identity.";

    const variations = [
        { name: "LINEAR STRUCTURAL", prompt: `Linear and structural styling. ${patternDNA}` },
        { name: "ABSTRACT FLUID", prompt: `Soft abstract and fluid styling. ${patternDNA}` },
        { name: "MONOCHROMATIC", prompt: `Monochromatic and architectural styling. ${patternDNA}` }
    ];

    const selectedVariation = variations[Math.floor(Math.random() * variations.length)];

    const prompt = `Premium abstract graphic background for product label. Company focuses on: ${description}. Visuals: ${selectedVariation.prompt}. STRICTLY NO TEXT, NO FONTS, NO LETTERS. NO specific products. Ultra-minimalist 8k digital art.`;

    try {
        console.log(`🎯 Generuji styl: ${selectedVariation.name}`);

        const falOptions = {
            method: "POST",
            headers: {
                "Authorization": `Key ${process.env.FAL_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                prompt: prompt,
                image_size: "landscape_4_3",
                num_inference_steps: 4,
                guidance_scale: 3.5
            })
        };

        const falResponse = await fetchWithRetry("https://fal.run/fal-ai/flux/schnell", falOptions, 2, 45000);
        const falData = await falResponse.json();
        const imageUrl = falData.images[0].url;

        console.log("✅ Grafika vygenerována. Stahuji obrázek na server...");

        const imageResponse = await fetch(imageUrl);
        const arrayBuffer = await imageResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const dataUrl = `data:image/jpeg;base64,${buffer.toString('base64')}`;

        console.log("📤 Odesílám data do frontendu.\n---");
        res.status(200).json({
            imageUrl: dataUrl,
            styleName: selectedVariation.name
        });

    } catch (error) {
        console.error("❌ Chyba backendu:", error.message);
        res.status(500).json({ error: "Generování přes fal.ai selhalo. Zkuste to prosím znovu." });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server aktivní na portu ${PORT}`);
});