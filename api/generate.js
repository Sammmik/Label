export default async function handler(req, res) {
    // 1. Povolíme pouze POST požadavky z tvého formuláře
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Metoda nepovolena' });
    }

    const { description, companyName } = req.body;

    // 2. Vytvoříme profi zadání pro AI
    const prompt = `Premium commercial product label background for ${companyName}. Central focus: ${description}. Professional 3D isometric illustration, minimal vector aesthetic, clean white background, studio lighting, highly detailed 8k graphic design.`;

    try {
        // 3. Unikátní číslo, aby každá etiketa byla jiná
        const seed = Math.floor(Math.random() * 1000000);
        
        // 4. Sestavení URL adresy pro Pollinations (zcela zdarma a bez klíčů!)
        const encodedPrompt = encodeURIComponent(prompt);
        // Generujeme obrázek o šířce 1200x500px, což krásně sedne na etiketu
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1200&height=500&nologo=true&seed=${seed}`;

        // 5. Okamžitě vracíme URL adresu do tvého mobilu
        res.status(200).json({ imageUrl: imageUrl });

    } catch (error) {
        res.status(500).json({ error: `Chyba backendu: ${error.message}` });
    }
}
