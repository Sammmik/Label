export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Metoda nepovolena' });

    const { description, companyName } = req.body;

    // MATICE NÁHODNÝCH STYLŮ
    const styles = [
        "Photorealistic 3D octane render, studio lighting, hyper-detailed",
        "Abstract fluid art, liquid metal textures, organic flowing shapes",
        "Minimalist flat vector illustration, clean lines, corporate swiss design",
        "Cyberpunk aesthetic, neon glow, futuristic tech textures",
        "Luxury marble and gold leaf texture, elegant sophisticated background",
        "Blueprint technical drawing, architectural lines, engineering style",
        "Macro photography of high-tech materials, bokeh background, sleek",
        "Pop-art vibrant colors, bold graphic shapes, modern contrast"
    ];

    const materials = ["glass", "brushed aluminum", "liquid chrome", "matte carbon", "iridescent silk", "neon gas"];
    const lighting = ["dramatic shadows", "soft studio light", "vibrant neon", "clean minimalist white", "golden hour"];

    // Losování unikátní kombinace
    const randomStyle = styles[Math.floor(Math.random() * styles.length)];
    const randomMat = materials[Math.floor(Math.random() * materials.length)];
    const randomLight = lighting[Math.floor(Math.random() * lighting.length)];

    const prompt = `Premium commercial label for ${companyName}. Topic: ${description}. Style: ${randomStyle}. Material: ${randomMat}. Lighting: ${randomLight}. NO text, NO letters, NO words. High-end graphic design.`;

    try {
        const seed = Math.floor(Math.random() * 1000000);
        const encodedPrompt = encodeURIComponent(prompt);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1200&height=500&nologo=true&seed=${seed}`;

        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) throw new Error('AI server neodpovídá');

        const arrayBuffer = await imageResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const dataUrl = `data:image/jpeg;base64,${buffer.toString('base64')}`;

        // Pošleme zpět i informaci o tom, co jsme vygenerovali (pro popis v PDF)
        res.status(200).json({ 
            imageUrl: dataUrl, 
            styleDescription: `${randomStyle.split(',')[0]} (${randomMat})` 
        });

    } catch (error) {
        res.status(500).json({ error: `Chyba backendu: ${error.message}` });
    }
}
