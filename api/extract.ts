import { extractProductsFromDocument } from '../services/geminiService';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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
