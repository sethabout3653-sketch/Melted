import {
  extractOpenRouterKey,
  runOpenRouterFileAnalysis,
  type OpenRouterFilePayload,
} from '../../../src/utils/openRouterEdgeHelper';

export const config = {
  maxDuration: 60,
  api: { bodyParser: { sizeLimit: '50mb' } },
};

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = (req.body || {}) as OpenRouterFilePayload & { openRouterApiKey?: string };

    const hasFileContent = Boolean(
      body.imageDataUrl ||
        (Array.isArray(body.previewImageUrls) && body.previewImageUrls.length > 0) ||
        body.fileDataUrl ||
        body.extractedText ||
        body.binarySummary ||
        body.fileName
    );

    if (!hasFileContent && !body.prompt?.trim()) {
      return res.status(400).json({ error: 'Attach a file or provide a prompt to analyze.' });
    }

    const openRouterKey = extractOpenRouterKey(
      typeof process !== 'undefined' ? (process.env as Record<string, string | undefined>) : {},
      body.openRouterApiKey
    );

    if (!openRouterKey) {
      return res.status(503).json({
        error: 'OpenRouter API Key is not configured on the server. Add OPENROUTER_API_KEY to your environment secrets.',
      });
    }

    const result = await runOpenRouterFileAnalysis({
      openRouterKey,
      payload: body,
    });

    if (!result.reply) {
      return res.status(502).json({
        error: result.errorDetail || 'OpenRouter could not analyze this file. Please try again.',
      });
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ success: true, reply: result.reply, modelUsed: result.modelUsed });
  } catch (error: any) {
    console.error('AI File Analysis Error:', error?.message || error);
    return res.status(500).json({ error: error?.message || 'File analysis failed.' });
  }
}
