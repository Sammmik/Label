import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 💡 VYLEPŠENÁ FUNKCE: Přidali jsme parametr 'options', abychom mohli poslat tajný klíč
async function fetchWithRetry(url, options, maxRetries = 2, timeoutMs = 45000) {
    for (let i = 0; i <= maxRetries; i++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            console.log(`⏳ [Pokus ${i + 1}/${maxRetries + 1}] Volám API Fal.ai...`);
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
    console.log("➡️ Přijat nový požadavek z frontendu...");
    const { description, companyName } = req.body;

    // 🔒 BEZPEČNOSTNÍ POJISTKA: Kontrola, zda je nastavený API klíč
    if (!process.env.FAL_KEY) {
        return res.status(500).json({ error: "Kritická chyba: Chybí tajný klíč FAL_KEY na serveru." });
    }

    const patternDNA = "Minimalist layout inspired by high-end tech labels. Thin geometric silver lines, precise grid alignment, vast white negative space, subtle grainy paper texture, professional industrial aesthetic.";
    const variations = [
        { name: "LINEAR STRUCTURAL", prompt: `Linear and structural. ${patternDNA}` },
        { name: "ABSTRACT FLUID", prompt: `Abstract and fluid. ${patternDNA}` },
        { name: "ARCHITECTURAL", prompt: `Monochromatic and architectural. ${patternDNA}` }
    ];

    const selectedVariation = variations[Math.floor(Math.random() * variations.length)];
    const prompt = `Premium product label for ${companyName}. Theme: ${description}. Visuals: ${selectedVariation.prompt}. NO text, NO products, NO objects. Ultra-minimalist 8k graphic design.`;

    try {
        console.log(`🎯 Vybrán styl: ${selectedVariation.name}`);

        // 💡 NASTAVENÍ PRO FAL.AI: Používáme nejrychlejší model FLUX.1 Schnell
        const falOptions = {
            method: "POST",
            headers: {
                "Authorization": `Key ${process.env.FAL_KEY}`, // Tvůj tajný klíč
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                prompt: prompt,
                image_size: "landscape_4_3", // Ideální formát pro tvé etikety
                num_inference_steps: 4       // Rychlejší a levnější generování
            })
        };

        // 1. Voláme Fal.ai API
        const falResponse = await fetchWithRetry("https://fal.run/fal-ai/flux/schnell", falOptions, 2, 45000);
        const falData = await falResponse.json();

        // Fal.ai vrací pole vygenerovaných obrázků, my chceme url prvního
        const imageUrl = falData.images[0].url;
        console.log("✅ Fal.ai úspěšně vygeneroval grafiku. Stahuji k převodu...");

        // 2. Stažení obrázku k nám na server a převod na Base64 pro PDF
        const imageResponse = await fetch(imageUrl);
        const arrayBuffer = await imageResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const dataUrl = `data:image/jpeg;base64,${buffer.toString('base64')}`;

        console.log("📤 Odesílám hotový obrázek do aplikace.\n---");
        res.status(200).json({
            imageUrl: dataUrl,
            styleName: selectedVariation.name
        });

    } catch (error) {
        console.error("❌ Chyba backendu:", error.message);
        res.status(500).json({ error: "Generování přes Fal.ai se nezdařilo. Zkontroluj klíč nebo logy serveru." });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server úspěšně běží na portu ${PORT}`);
});