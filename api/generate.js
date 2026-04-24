export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Metoda nepovolena' });
    const { description } = req.body;

    const styles = [
        "Ultra-minimalist monochrome gradient, smooth surface, soft fog",
        "Single line geometric art, vast negative space, white-on-white aesthetic",
        "Subtle grainy texture, zen-like simple composition, muted earthy tones",
        "Soft focused blurred aura, single color palette, extremely clean"
    ];

    const randomStyle = styles[Math.floor(Math.random() * styles.length)];
    // Přidali jsme "vast negative space" a "ultra-minimal"
    const prompt = `Ultra-minimalist professional graphic design. ${description}. Visuals: ${randomStyle}. Vast negative space, very simple composition. NO details, NO busy patterns, NO text, NO objects.`;

    try {
        const seed = Math.floor(Math.random() * 1000000);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1200&height=500&nologo=true&seed=${seed}`;
        
        const imageResponse = await fetch(imageUrl);
        const arrayBuffer = await imageResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        res.status(200).json({ 
            imageUrl: `data:image/jpeg;base64,${buffer.toString('base64')}`,
            styleName: randomStyle.split(',')[0]
        });
    } catch (error) { res.status(500).json({ error: error.message }); }
}
