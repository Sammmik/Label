import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware pro povolení JSON komunikace a servírování frontendu
app.use(cors());
app.use(express.json());

// Frontend (tvůj index.html) budeme servírovat ze složky public
app.use(express.static(path.join(__dirname, 'public')));

// Naše API routa (původní Vercel kód)
app.post('/api/generate', async (req, res) => {
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

        // Node.js stáhne obrázek (tady už nám nevadí, že to trvá 15 vteřin)
        const response = await fetch(imageUrl);
        if (!response.ok) {
            throw new Error("Generátor AI neodpovídá.");
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const dataUrl = `data:image/jpeg;base64,${buffer.toString('base64')}`;

        res.status(200).json({ 
            imageUrl: dataUrl,
            styleName: selectedVariation.name
        });

    } catch (error) {
        console.error("Chyba backendu:", error);
        res.status(500).json({ error: error.message });
    }
});

// Spuštění serveru
app.listen(PORT, () => {
    console.log(`🚀 Server úspěšně běží na portu ${PORT}`);
});