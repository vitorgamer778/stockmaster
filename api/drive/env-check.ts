export default function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  const keyB64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const folderId = process.env.DRIVE_FOLDER_ID;
  const info: any = { hasKey: !!keyB64, hasFolderId: !!folderId };
  if (keyB64) {
    info.keyLength = keyB64.length;
    try {
      const decoded = Buffer.from(keyB64, 'base64').toString('utf-8');
      info.decodedLength = decoded.length;
      try { info.parsed = !!JSON.parse(decoded); } catch (e: any) { info.parseError = String(e); }
    } catch (e: any) { info.decodeError = String(e); }
  }
  return res.status(200).json({ ok: true, info });
}