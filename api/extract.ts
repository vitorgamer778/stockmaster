import { extractProductsFromDocument } from '../services/geminiService';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Guard early for missing GEMINI_API_KEY to provide clearer error messages in production
  if (!process.env.GEMINI_API_KEY && !process.env.API_KEY) {
    console.error('Missing GEMINI_API_KEY in environment for /api/extract');
    return res.status(500).json({ ok: false, error: 'GEMINI_API_KEY not set in environment' });
  }

  const { base64, mimeType, tabs } = req.body || {};
  if (!base64 || !mimeType) return res.status(400).json({ error: 'base64 and mimeType are required' });

  try {
    // calls the server-side function which uses process.env.GEMINI_API_KEY
    const result = await extractProductsFromDocument(base64, mimeType, tabs || []);
    return res.status(200).json({ ok: true, data: result });
  } catch (err: any) {
    console.error('extract api error', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Internal error' });
  }
}
