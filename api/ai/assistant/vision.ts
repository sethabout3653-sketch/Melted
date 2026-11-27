import { Buffer } from 'node:buffer';
import { generateText } from 'ai';

export const config = {
  maxDuration: 60,
  api: { bodyParser: { sizeLimit: '15mb' } },
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
    const imageDataUrl = typeof req.body?.imageDataUrl === 'string' ? req.body.imageDataUrl : '';
    const match = imageDataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/i);
    if (!match) return res.status(400).json({ error: 'Attach a valid PNG, JPEG, or WebP image.' });

    const image = Buffer.from(match[2], 'base64');
    if (!image.length || image.length > 10 * 1024 * 1024) {
      return res.status(413).json({ error: 'Images must be 10 MB or smaller.' });
    }

    const { text } = await generateText({
      model: 'google/gemini-3.8-flash',
      messages: [{
        role: 'user',
        content: [
          { type: 'image', image, mediaType: match[1].toLowerCase() },
          { type: 'text', text: prompt || 'Describe this image.' },
        ],
      }],
      maxOutputTokens: 1000,
    });

    const reply = text.trim();
    if (!reply) return res.status(502).json({ error: 'The image model returned an empty response. Please try again.' });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ success: true, reply });
  } catch (error: any) {
    console.error('AI Image Analysis Error:', error?.message || error);
    return res.status(500).json({ error: error?.message || 'Image analysis failed.' });
  }
}
