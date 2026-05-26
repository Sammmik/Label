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

async function fetchWithRetry(url, options, maxRetries = 2, timeoutMs = 55000) {
    for (let i = 0; i <= maxRetries; i++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (i === maxRetries) throw error;
            console.log(`Zkouším znovu (${i + 1}) pro ${url}...`);
            await new Promise(resolve => setTimeout(resolve, 2500 * (i + 1)));
        }
    }
}

// ─── CHYTRÁ ANALÝZA ZNAČKY A VÝBĚR KONCEPTŮ ───
app.post('/api/analyze-brand', async (req, res) => {
    const { name, description, color } = req.body;
    const primaryColor = color || "#1d4ed8";
    const brandContext = description ? description : name;
    const descLower = brandContext.toLowerCase();

    // 1. Matematika barvy (Výpočet jasu pro zajištění dokonalé čitelnosti)
    const hex = primaryColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    const isLight = brightness > 130;

    // 2. Analýza oboru a výběr 3 vizuálních motivů
    let themes = [];
    let industry = "Corporate & Business";

    if (descLower.includes('tech') || descLower.includes('data') || descLower.includes('software') || descLower.includes('smart') || descLower.includes('it') || descLower.includes('electric')) {
        industry = "Technology & Digital";
        themes = ['Cybernetic Wireframe', 'Digital Network Nodes', 'Clean Tech Geometric'];
    } else if (descLower.includes('water') || descLower.includes('nature') || descLower.includes('eco') || descLower.includes('bio') || descLower.includes('health')) {
        industry = "Eco & Health";
        themes = ['Organic Fluid Waves', 'Topographic Contour Lines', 'Minimalist Botanical'];
    } else if (descLower.includes('sport') || descLower.includes('active') || descLower.includes('run') || descLower.includes('fitness')) {
        industry = "Sports & Active";
        themes = ['Dynamic Action Lines', 'Bold Angular Shapes', 'Speed & Motion Vectors'];
    } else if (descLower.includes('food') || descLower.includes('cafe') || descLower.includes('coffee') || descLower.includes('drink')) {
        industry = "Food & Beverage";
        themes = ['Liquid Flow Abstract', 'Smooth Minimalist Forms', 'Vibrant Geometric'];
    } else {
        themes = ['Abstract Corporate Silhouette', 'Swiss Geometric Poster', 'Minimalist Flat Monoline'];
    }

    // Pomocné barvy pozadí
    const darkBg = "#0a0d18";
    const lightBg = "#f8f9fa";
    const darkText = "#0f172a";
    const lightText = "#ffffff";

    // 3. Sestavení 3 unikátních designů na základě analýzy
    const parsed = {
        slogan: "Custom Brand Collection",
        industry: industry,
        companyColor: primaryColor,
        designs: [
            {
                id: 1,
                name: "Concept: " + themes[0],
                styleDesc: "Hlavní vizuální směr",
                bg: isLight ? darkBg : lightBg, // Dáme kontrastní pozadí
                primary: primaryColor,
                text: isLight ? lightText : darkText,
                accent: isLight ? "#1e293b" : "#e2e8f0",
                tagline: "CONCEPT 01",
                imagePrompt: `Flat 2D vector illustration: ${themes[0]} representing ${brandContext}. Background color: ${isLight ? 'Dark slate' : 'Off-white'}. Flat cell-shaded vector art, limited color palette using ${primaryColor}. NO text, NO photorealism. Landscape 4:3.`
            },
            {
                id: 2,
                name: "Concept: " + themes[1],
                styleDesc: "Alternativní geometrie",
                bg: primaryColor, // Pozadí v barvě značky
                primary: isLight ? darkText : lightText,
                text: isLight ? darkText : lightText,
                accent: isLight ? lightBg : darkBg,
                tagline: "CONCEPT 02",
                imagePrompt: `Flat 2D vector illustration: ${themes[1]} representing ${brandContext}. Solid ${primaryColor} background. White and dark flat vector art, bold silhouette style. Dynamic composition. NO text, NO photorealism. Landscape 4:3.`
            },
            {
                id: 3,
                name: "Concept: " + themes[2],
                styleDesc: "Minimalistický přístup",
                bg: isLight ? lightBg : darkBg, // Opačné pozadí než koncept 1
                primary: primaryColor,
                text: isLight ? darkText : lightText,
                accent: isLight ? "#e2e8f0" : "#1e293b",
                tagline: "CONCEPT 03",
                imagePrompt: `Flat 2D vector illustration: ${themes[2]} representing ${brandContext}. Background color: ${isLight ? 'Off-white' : 'Dark slate'}. Clean minimal vector art, brand color ${primaryColor} as main accent. Crisp outlines. NO text, NO photorealism. Landscape 4:3.`
            }
        ]
    };

    setTimeout(() => { res.json(parsed); }, 800);
});

// ─── GENERATOR OBRÁZKŮ (FAL.ai) ───
app.post('/api/generate-image', async (req, res) => {
    const { prompt, designIndex } = req.body;
    if (!process.env.FAL_KEY) return res.status(500).json({ error: "Chybí FAL_KEY." });

    const enforcedStyle = "flat 2D vector graphic, bold outlines, clean cell-shaded illustration, professional brand packaging art, NO photorealism, NO gradients, NO text in image, landscape 4:3 aspect ratio";
    const finalPrompt = `${prompt} Style enforcement: ${enforcedStyle}`;

    try {
        const falResponse = await fetchWithRetry("https://fal.run/fal-ai/flux/schnell", {
            method: "POST", headers: { "Authorization": `Key ${process.env.FAL_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: finalPrompt, image_size: "landscape_4_3", num_inference_steps: 8, guidance_scale: 4.5, num_images: 1 })
        }, 2, 55000);

        const rawText = await falResponse.text();
        if (!falResponse.ok) throw new Error(`FAL.ai chyba: ${rawText.substring(0, 150)}`);

        let falData;
        try { falData = JSON.parse(rawText); } catch(e) { throw new Error("FAL.ai má výpadek."); }
        if (!falData.images || !falData.images[0]) throw new Error("FAL nevygeneroval obrázek.");

        const imageRes = await fetch(falData.images[0].url);
        const buffer = Buffer.from(await imageRes.arrayBuffer());
        res.json({ imageUrl: `data:image/jpeg;base64,${buffer.toString('base64')}`, designIndex });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/qr', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).send("Chybí URL");
    try {
        const qrRes = await fetch(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}&bgcolor=ffffff&color=000000&margin=8`);
        const buf = Buffer.from(await qrRes.arrayBuffer());
        res.set("Content-Type", "image/png"); res.send(buf);
    } catch (e) { res.status(500).send("QR chyba"); }
});

app.use('/api', (req, res) => { res.status(404).json({ error: "Cesta nenalezena." }); });
app.listen(PORT, () => console.log(`🚀 Label Studio běží na portu ${PORT}`));