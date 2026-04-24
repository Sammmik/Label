export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Metoda nepovolena' });
    }

    const { description, companyName } = req.body;
    const prompt = `Premium abstract graphic design background for a product label. Inspiration: ${description}, ${companyName}. Style: elegant abstract fluid art, minimalist geometric shapes, smooth modern gradients, high-end corporate identity texture, purely abstract background, NO text, NO letters, NO concrete objects.`;

    try {
        const seed = Math.floor(Math.random() * 1000000);
        const encodedPrompt = encodeURIComponent(prompt);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1200&height=500&nologo=true&seed=${seed}`;

        // 1. Vercel stáhne obrázek z AI serveru (obejde tím blokace mobilního prohlížeče)
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) throw new Error('AI server neodpovídá');

        // 2. Převod obrázku na čistá Base64 data
        const arrayBuffer = await imageResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Image = buffer.toString('base64');
        const dataUrl = `data:image/jpeg;base64,${base64Image}`;

        // 3. Pošle hotová data do mobilu
        res.status(200).json({ imageUrl: dataUrl });

    } catch (error) {
        res.status(500).json({ error: `Chyba backendu: ${error.message}` });
    }
}
