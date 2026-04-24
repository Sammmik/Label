export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Povoleny jsou pouze POST požadavky.' });
    }

    const { description, companyName } = req.body;

    // Kontrola, zda je klíč nastavený
    if (!process.env.HF_TOKEN) {
        return res.status(500).json({ error: 'Kritická chyba: Na Vercelu chybí proměnná HF_TOKEN!' });
    }

    // Prompt přizpůsobený pro model Stable Diffusion XL
    const prompt = `Premium product label design for ${companyName}, featuring ${description}. Professional 3D isometric illustration, minimal vector aesthetic, clean white background, studio lighting, 8k resolution, highly detailed.`;

    try {
        // Voláme Hugging Face API (model Stable Diffusion XL)
        const response = await fetch("https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.HF_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ inputs: prompt }),
        });

        if (!response.ok) {
            const errText = await response.text();
            
            // SPECIÁLNÍ HF CHYBA: "Model is loading"
            // Hugging Face občas model "uspí", aby šetřil výkon. Pokud se zrovna probouzí, hodí chybu 503.
            if (response.status === 503) {
                return res.status(503).json({ error: 'AI model se právě probouzí (Studený start). Zkus kliknout na generovat znovu za 20 sekund.' });
            }
            
            return res.status(response.status).json({ error: `Chyba z Hugging Face: ${errText}` });
        }

        // Hugging Face vrací přímo binární data (ne URL). Musíme je zpracovat na Vercelu.
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Image = buffer.toString('base64');
        const dataUrl = `data:image/jpeg;base64,${base64Image}`;

        // Odesíláme hotový obrázek (zabalený v Base64 kódu) zpět do mobilu
        res.status(200).json({ imageUrl: dataUrl });

    } catch (error) {
        res.status(500).json({ error: `Chyba Vercel serveru: ${error.message}` });
    }
}
