export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Metoda nepovolena' });

    const { description } = req.body;

    const abstractStyles = [
        "Pure digital liquid gradients, floating silk waves, weightless fluid art",
        "Cybernetic geometric patterns, glowing thin vector lines on pitch black",
        "Ethereal smoke clouds, soft vapor gradients, atmospheric color mist",
        "Macro brushed metal texture, iridescent titanium shimmer, cold industrial steel",
        "Futuristic holographic ripples, refractive light play, prismatic surface",
        "Minimalist generative noise, grainy sand texture, zen-like stone gradients",
        "Deep monochromatic ink flow, matte charcoal and obsidian textures",
        "Clean glassmorphism, blurred organic shapes, translucent depth"
    ];

    const randomStyle = abstractStyles[Math.floor(Math.random() * abstractStyles.length)];
    const seed = Math.floor(Math.random() * 1000000);

    // Prompt striktně zakazuje jakýkoliv náznak interiéru nebo reality
    const prompt = `Pure abstract graphic design. Concept: ${description}. Visuals: ${randomStyle}. Style: Masterpiece digital art, flat lighting, 2D/3D abstract texture. STRICTLY NO interiors, NO rooms, NO walls, NO furniture, NO floors, NO objects, NO products, NO text.`;

    try {
        const encodedPrompt = encodeURIComponent(prompt);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1200&height=500&nologo=true&seed=${seed}`;

        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) throw new Error('AI server neodpovídá');

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
