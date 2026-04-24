// /api/generate.js
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const { description, companyName } = req.body;

    // AGENT: Vytvoření špičkového zadání (Promptu) pro model Flux
    const prompt = `Extreme high-end product label design for ${companyName}. 
    Central object: ${description}. 
    Style: Professional 3D isometric illustration, minimal vector aesthetic, 
    clean white background, premium lighting, 8k, sharp details, commercial design.`;

    try {
        const response = await fetch("https://queue.fal.run/fal-ai/flux/schnell", {
            method: "POST",
            headers: {
                "Authorization": `Key ${process.env.FAL_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                prompt: prompt,
                image_size: "landscape_4_3",
                num_inference_steps: 4 // Schnell je model optimalizovaný na rychlost
            }),
        });

        const data = await response.json();
        
        // Fal.ai vrací URL adresu vygenerovaného obrázku
        res.status(200).json({ imageUrl: data.images[0].url });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
