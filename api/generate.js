export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Metoda nepovolena' });

    const { description } = req.body;

    // MATICE ČISTĚ ABSTRAKTNÍCH DESIGNŮ (Bez konkrétních produktů)
    const abstractStyles = [
        "Fluid liquid gradients, ethereal waves, soft transitions, silk texture",
        "Geometric deconstructivism, minimal thin lines, architectural grid",
        "Bioluminescent nebulae, organic smoke shapes, deep cinematic colors",
        "Brushed metallic surface, industrial titanium texture, subtle light leaks",
        "Frosted glass morphism, blurry organic shapes behind glass, premium soft focus",
        "Japanese minimalist ink wash, sumi-e aesthetic, vast negative space",
        "Holographic foil ripples, iridescent color shifts, futuristic plastic",
        "Matte clay textures, earthy tones, minimalist sculptural shadows"
    ];

    const randomStyle = abstractStyles[Math.floor(Math.random() * abstractStyles.length)];
    const seed = Math.floor(Math.random() * 1000000);

    // Prompt striktně zakazuje objekty (objektivy, mobily, auta atd.)
    const prompt = `High-end abstract aesthetic background for commercial packaging. Concept: ${description}. Visuals: ${randomStyle}. Style: Masterpiece graphic design, ultra-minimal, professional color palette. NO products, NO objects, NO people, NO text, NO letters.`;

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
