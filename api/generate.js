export default async function handler(req, res) {
    // 1. Kontrola metody
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Povoleny jsou pouze POST požadavky.' });
    }

    const { description, companyName } = req.body;

    // 2. Kontrola, jestli Vercel vůbec vidí tvůj API klíč!
    if (!process.env.FAL_KEY) {
        return res.status(500).json({ error: 'Kritická chyba: Na Vercelu chybí proměnná FAL_KEY!' });
    }

    const prompt = `Extreme high-end product label design for ${companyName}. Central object: ${description}. Style: Professional 3D isometric illustration, minimal vector aesthetic, clean white background, premium lighting, 8k, sharp details, commercial design.`;

    try {
        // 3. Volání Fal.ai
        const response = await fetch("https://fal.run/fal-ai/flux/schnell", {
            method: "POST",
            headers: {
                "Authorization": `Key ${process.env.FAL_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                prompt: prompt,
                image_size: "landscape_4_3",
                num_inference_steps: 4
            }),
        });

        const data = await response.json();

        // 4. Pokud Fal.ai vrátí chybu (např. špatný klíč), pošleme ji na mobil
        if (!response.ok) {
            return res.status(500).json({ error: `Chyba z Fal.ai: ${JSON.stringify(data)}` });
        }

        // 5. Pokud není obrázek, upozorníme
        if (!data.images || !data.images[0]) {
            return res.status(500).json({ error: 'Fal.ai nevygeneroval žádný obrázek.' });
        }

        // Vše OK, posíláme URL
        res.status(200).json({ imageUrl: data.images[0].url });

    } catch (error) {
        res.status(500).json({ error: `Chyba serveru (Vercel): ${error.message}` });
    }
}
