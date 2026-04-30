export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Pouze POST' });

    const { description, companyName } = req.body;

    // DEFINICE TVÉHO STYLU (Odvozeno z tvých vzorů 23410.png a 1777017900250.png)
    // Tento řetězec zajistí, že AI bude napodobovat tvůj preferovaný design
    const patternDNA = "Minimalist layout inspired by high-end tech labels. Thin geometric silver lines, precise grid alignment, vast white negative space, subtle grainy paper texture, professional industrial aesthetic.";

    // Vytvoříme 3 varianty promptu, aby každý ze 3 návrhů byl unikátní
    const variations = [
        `Style A: Linear and structural. ${patternDNA}`,
        `Style B: Abstract and fluid. ${patternDNA}`,
        `Style C: Monochromatic and architectural. ${patternDNA}`
    ];

    // Náhodný výběr jedné z variant (při každém volání z PDF smyčky)
    const selectedVariation = variations[Math.floor(Math.random() * variations.length)];

    const prompt = `Premium product label for ${companyName}. Theme: ${description}. Visuals: ${selectedVariation}. NO text, NO products, NO objects. Ultra-minimalist 8k graphic design.`;

    try {
        const seed = Math.floor(Math.random() * 1000000);
        const response = await fetch("https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.HF_TOKEN}`,
                "Content-Type": "application/json",
                "X-Forwarded-Host": "api-inference.huggingface.co" // Oprava Vercel bugu
            },
            body: JSON.stringify({ inputs: prompt, seed: seed }),
        });

        if (!response.ok) throw new Error("AI server neodpovídá.");

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const dataUrl = `data:image/jpeg;base64,${buffer.toString('base64')}`;

        res.status(200).json({ imageUrl: dataUrl });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}