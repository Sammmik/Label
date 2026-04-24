export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Metoda nepovolena' });
    const { description } = req.body;

    // MATICE STYLŮ, KTERÉ NEJSOU JEN BÍLÉ
    const styles = [
        "Minimalist dark slate and silver fluid gradients, deep shadows",
        "Subtle iridescent holographic texture, soft prismatic light refraction",
        "Clean charcoal grey aesthetic with thin glowing cyan vector lines",
        "Premium matte obsidian texture with soft golden hour light leak",
        "Muted sage green and sand organic gradients, grainy film texture",
        "Abstract deep navy blue liquid metal, high-end automotive finish"
    ];

    const randomStyle = styles[Math.floor(Math.random() * styles.length)];
    const seed = Math.floor(Math.random() * 1000000);

    // Prompt nyní výslovně žádá "Visible depth" a "Rich textures"
    const prompt = `High-end professional abstract graphic background. Concept: ${description}. Visuals: ${randomStyle}. Style: Visible depth, rich textures, elegant composition, masterpiece digital art. NO white-out, NO empty space, NO text, NO objects.`;

    try {
        const encodedPrompt = encodeURIComponent(prompt);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1200&height=500&nologo=true&seed=${seed}`;
        
        const imageResponse = await fetch(imageUrl);
        const arrayBuffer = await imageResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        res.status(200).json({ 
            imageUrl: `data:image/jpeg;base64,${buffer.toString('base64')}`,
            styleName: randomStyle.split(',')[0]
        });
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
}
