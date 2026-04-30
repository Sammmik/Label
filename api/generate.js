export default async function handler(req, res) {
    // 1. Ochrana proti špatným metodám
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Povoleny jsou pouze POST požadavky.' });
    }

    const { description, companyName } = req.body;

    if (!process.env.HF_TOKEN) {
        return res.status(500).json({ error: 'Kritická chyba: Chybí HF_TOKEN na Vercelu.' });
    }

    // 2. DEFINICE TVÉHO STYLU (Vzorová DNA)
    const patternDNA = "Minimalist layout inspired by high-end tech labels. Thin geometric silver lines, precise grid alignment, vast white negative space, subtle grainy paper texture, professional industrial aesthetic.";

    // 3. Tři mírně odlišné interpretace tvého stylu
    const variations = [
        { name: "LINEAR STRUCTURAL", prompt: `Linear and structural. ${patternDNA}` },
        { name: "ABSTRACT FLUID", prompt: `Abstract and fluid. ${patternDNA}` },
        { name: "ARCHITECTURAL", prompt: `Monochromatic and architectural. ${patternDNA}` }
    ];

    // Náhodný výběr jedné varianty
    const selectedVariation = variations[Math.floor(Math.random() * variations.length)];

    // Finální zadání pro AI
    const prompt = `Premium product label for ${companyName}. Theme: ${description}. Visuals: ${selectedVariation.prompt}. NO text, NO products, NO objects. Ultra-minimalist 8k graphic design.`;

    try {
        const seed = Math.floor(Math.random() * 1000000);

        // 4. Komunikace s AI modelem (Hugging Face)
        const response = await fetch("https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.HF_TOKEN}`,
                "Content-Type": "application/json",
                "X-Forwarded-Host": "api-inference.huggingface.co" // Ochrana proti Vercel chybě
            },
            body: JSON.stringify({ inputs: prompt, seed: seed }),
        });

        // 5. Zpracování chyb (např. probouzející se model)
        if (!response.ok) {
            if (response.status === 503) {
                return res.status(503).json({ error: 'AI model se probouzí. Zkuste to prosím znovu za 20 sekund.' });
            }
            const errText = await response.text();
            throw new Error(`Chyba Hugging Face: ${errText}`);
        }

        // 6. Převod obrázku na Base64 pro snadný přenos do mobilu
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const dataUrl = `data:image/jpeg;base64,${buffer.toString('base64')}`;

        // Posíláme zpět obrázek i název stylu pro zobrazení v PDF
        res.status(200).json({
            imageUrl: dataUrl,
            styleName: selectedVariation.name
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}