export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Povoleny jsou pouze POST požadavky.' });

    const { description, companyName } = req.body;

    if (!process.env.HF_TOKEN) {
        return res.status(500).json({ error: 'Chybí HF_TOKEN na Vercelu!' });
    }

    const prompt = `Premium product label design for ${companyName}, featuring ${description}. Professional 3D isometric illustration, minimal vector aesthetic, clean white background, studio lighting, 8k resolution, highly detailed.`;

    try {
        const response = await fetch("https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.HF_TOKEN}`,
                "Content-Type": "application/json",
                // ZDE JE OPRAVA TÉ VERCEL CHYBY:
                "X-Forwarded-Host": "api-inference.huggingface.co"
            },
            body: JSON.stringify({ inputs: prompt }),
        });

        if (!response.ok) {
            const errText = await response.text();
            if (response.status === 503) {
                return res.status(503).json({ error: 'Hugging Face model se právě probouzí (studený start). Zkus to znovu za 20 vteřin!' });
            }
            return res.status(response.status).json({ error: `Chyba z Hugging Face: ${errText}` });
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Image = buffer.toString('base64');

        res.status(200).json({ imageUrl: `data:image/jpeg;base64,${base64Image}` });

    } catch (error) {
        res.status(500).json({ error: `Chyba Vercel serveru: ${error.message}` });
    }
}
