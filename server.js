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

app.post('/api/generate', async (req, res) => {
    // 1. LOGOVÁNÍ: Server hlásí, že přijal úkol z mobilu
    console.log("➡️ Přijat nový požadavek na generování z frontendu...");

    const { description, companyName } = req.body;

    const patternDNA = "Minimalist layout inspired by high-end tech labels. Thin geometric silver lines, precise grid alignment, vast white negative space, subtle grainy paper texture, professional industrial aesthetic.";
    const variations = [
        { name: "LINEAR STRUCTURAL", prompt: `Linear and structural. ${patternDNA}` },
        { name: "ABSTRACT FLUID", prompt: `Abstract and fluid. ${patternDNA}` },
        { name: "ARCHITECTURAL", prompt: `Monochromatic and architectural. ${patternDNA}` }
    ];

    const selectedVariation = variations[Math.floor(Math.random() * variations.length)];
    const prompt = `Premium product label for ${companyName}. Theme: ${description}. Visuals: ${selectedVariation.prompt}. NO text, NO products, NO objects. Ultra-minimalist 8k graphic design.`;

    try {
        const seed = Math.floor(Math.random() * 1000000);
        const encodedPrompt = encodeURIComponent(prompt);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1200&height=500&nologo=true&seed=${seed}`;

        // 2. LOGOVÁNÍ: Vidíme, co se přesně generuje
        console.log(`⏳ Volám AI Pollinations pro styl: ${selectedVariation.name}`);

        // 3. STOPKY (Timeout mechanismus): Dáme AI maximálně 25 sekund
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);

        // Fetch s připojenými stopkami
        const response = await fetch(imageUrl, { signal: controller.signal });

        // Pokud AI stihla odpovědět, stopky vypneme
        clearTimeout(timeoutId);

        if (!response.ok) {
            console.error(`❌ Chyba od Pollinations: HTTP ${response.status}`);
            throw new Error(`Generátor AI neodpovídá (HTTP ${response.status}).`);
        }

        console.log("✅ Obrázek úspěšně vygenerován, stahuji data...");
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const dataUrl = `data:image/jpeg;base64,${buffer.toString('base64')}`;

        console.log("📤 Odesílám hotový obrázek do mobilu.\n---");
        res.status(200).json({
            imageUrl: dataUrl,
            styleName: selectedVariation.name
        });

    } catch (error) {
        // 4. ZPRACOVÁNÍ CHYB
        console.error("❌ Chyba backendu:", error.message);

        // Pokud vypršel náš 25s časovač
        if (error.name === 'AbortError') {
            res.status(504).json({ error: "AI server je přetížen a neodpověděl včas (Timeout). Zkus to znovu." });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server úspěšně běží na portu ${PORT}`);
});