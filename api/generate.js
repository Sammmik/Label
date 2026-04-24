export default async function handler(req, res) {
    // 1. Povolíme pouze POST požadavky
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Metoda nepovolena' });
    }

    const { description } = req.body;

    // 2. NOVÝ ABSTRAKTNÍ PROMPT PRO AI
    // Striktně zakazujeme konkrétní objekty a texty. Žádáme abstraktní texturu, tekuté tvary a luxusní vzhled.
    const prompt = `Premium abstract graphic design background for a product label. Inspiration: ${description}. Style: elegant abstract fluid art, minimalist geometric shapes, smooth modern gradients, high-end corporate identity texture, 8k resolution, purely abstract background, NO text, NO letters, NO concrete objects.`;

    try {
        const seed = Math.floor(Math.random() * 1000000);
        
        const encodedPrompt = encodeURIComponent(prompt);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1200&height=500&nologo=true&seed=${seed}`;

        res.status(200).json({ imageUrl: imageUrl });

    } catch (error) {
        res.status(500).json({ error: `Chyba backendu: ${error.message}` });
    }
}
