import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Povolení komunikace a zvětšení limitu pro přenos obrázků
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Funkce pro automatické opakování požadavku (Auto-Retry).
 * Zajišťuje stabilitu, pokud by mělo API fal.ai chvilkový výpadek.
 */
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

// Hlavní API endpoint pro generování
app.post('/api/generate', async (req, res) => {
    // Přijímáme pouze popis, název firmy vynecháváme, aby AI negenerovala texty
    const { description } = req.body;

    // Bezpečnostní kontrola API klíče
    if (!process.env.FAL_KEY) {
        return res.status(500).json({ error: "Kritická chyba serveru: Chybí FAL_KEY." });
    }

    // Definice designu: Striktně tmavé, čisté, bez textu a fyzických objektů
    const patternDNA = "Ultra-minimalist dark aesthetic. Deep obsidian and slate tones, subtle premium textures, vast negative space. NO physical objects, NO labels, NO clothing tags.";

    const variations = [
        { name: "LINEAR STRUCTURAL", prompt: `Soft geometric silver lines on dark background. ${patternDNA}` },
        { name: "ABSTRACT FLUID", prompt: `Smooth dark liquid ripples, matte black aesthetic. ${patternDNA}` },
        { name: "ARCHITECTURAL", prompt: `Monochromatic dark brutalist concrete texture, elegant lighting. ${patternDNA}` }
    ];

    const selectedVariation = variations[Math.floor(Math.random() * variations.length)];

    // Finální prompt pro model
    const prompt = `Premium abstract digital background wallpaper. Theme: ${description}. Style: ${selectedVariation.prompt}. STRICTLY NO TEXT, NO LETTERS, NO LOGOS, NO WATERMARKS. Pure digital canvas.`;

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
                num_inference_steps: 4, // Optimalizace rychlosti pro FLUX.1 Schnell
                guidance_scale: 3.5
            })
        };

        // 1. Získání URL obrázku od AI
        const falResponse = await fetchWithRetry("https://fal.run/fal-ai/flux/schnell", falOptions, 2, 45000);
        const falData = await falResponse.json();
        const imageUrl = falData.images[0].url;

        console.log("✅ Grafika vygenerována. Stahuji obrázek na server...");

        // 2. Stažení obrázku a převod do Base64
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

// Spuštění serveru
app.listen(PORT, () => {
    console.log(`🚀 Server aktivní na portu ${PORT}`);
});