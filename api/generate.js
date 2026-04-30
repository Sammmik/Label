export default async function handler(req, res) {
    // 1. Ochrana proti špatným metodám
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Povoleny jsou pouze POST požadavky.' });
    }

    const { description, companyName } = req.body;

    // 2. DEFINICE TVÉHO STYLU (Vzorová DNA)
    // AI dostane jasný povel, jak má vypadat kompozice
    const patternDNA = "Minimalist layout inspired by high-end tech labels. Thin geometric silver lines, precise grid alignment, vast white negative space, subtle grainy paper texture, professional industrial aesthetic.";

    // 3. Tři mírně odlišné interpretace tvého stylu
    const variations = [
        { name: "LINEAR STRUCTURAL", prompt: `Linear and structural. ${patternDNA}` },
        { name: "ABSTRACT FLUID", prompt: `Abstract and fluid. ${patternDNA}` },
        { name: "ARCHITECTURAL", prompt: `Monochromatic and architectural. ${patternDNA}` }
    ];

    // Náhodný výběr jedné varianty
    const selectedVariation = variations[Math.floor(Math.random() * variations.length)];

    // Finální zadání pro AI (zakazujeme text a konkrétní objekty)
    const prompt = `Premium product label for ${companyName}. Theme: ${description}. Visuals: ${selectedVariation.prompt}. NO text, NO products, NO objects. Ultra-minimalist 8k graphic design.`;

    try {
        // Náhodný seed pro unikátnost
        const seed = Math.floor(Math.random() * 1000000);
        const encodedPrompt = encodeURIComponent(prompt);

        // 4. BEZPEČNÉ VOLÁNÍ POLLINATIONS (Žádné POST chyby, žádné klíče)
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1200&height=500&nologo=true&seed=${seed}`;

        // Vercel server stáhne obrázek k sobě
        const response = await fetch(imageUrl);
        if (!response.ok) {
            throw new Error("Generátor obrázků neodpovídá. Zkuste to za okamžik.");
        }

        // 5. Převod obrázku na Base64 pro snadný a bezpečný přenos do mobilu
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