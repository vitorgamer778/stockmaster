export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  const debugSteps: string[] = [];
  try {
    const keyB64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    const folderId = process.env.DRIVE_FOLDER_ID;
    debugSteps.push('env-read');
    if (!keyB64 || !folderId) return res.status(400).json({ ok: false, error: 'Missing GOOGLE_SERVICE_ACCOUNT_KEY or DRIVE_FOLDER_ID', debugSteps });

    let google: any;
    try {
      const mod = await import('googleapis');
      google = mod.google;
      debugSteps.push('import-ok');
    } catch (e: any) {
      console.error('dynamic import failed', e?.stack || e?.message || e);
      debugSteps.push('import-failed');
      return res.status(500).json({ ok: false, error: 'dynamic import googleapis failed', details: String(e), debugSteps });
    }

    let keyJson: any;
    try {
      keyJson = JSON.parse(Buffer.from(keyB64, 'base64').toString('utf-8'));
      debugSteps.push('key-json-parsed');
    } catch (e: any) {
      console.error('parse key failed', e?.stack || e?.message || e);
      debugSteps.push('key-parse-failed');
      return res.status(500).json({ ok: false, error: 'parse key failed', details: String(e), debugSteps });
    }

    let auth: any;
    try {
      auth = new google.auth.GoogleAuth({ credentials: keyJson, scopes: ['https://www.googleapis.com/auth/drive'] });
      debugSteps.push('auth-created');
    } catch (e: any) {
      console.error('auth creation failed', e?.stack || e?.message || e);
      debugSteps.push('auth-failed');
      return res.status(500).json({ ok: false, error: 'auth creation failed', details: String(e), debugSteps });
    }

    let drive: any;
    try {
      drive = google.drive({ version: 'v3', auth });
      debugSteps.push('drive-created');
    } catch (e: any) {
      console.error('drive init failed', e?.stack || e?.message || e);
      debugSteps.push('drive-init-failed');
      return res.status(500).json({ ok: false, error: 'drive init failed', details: String(e), debugSteps });
    }

    // Try listing files in folder
    try {
      debugSteps.push('about-to-list');
      const list = await drive.files.list({ q: `'${folderId}' in parents and trashed = false`, pageSize: 5, fields: 'files(id,name)' });
      debugSteps.push('list-ok');
      return res.status(200).json({ ok: true, files: list.data.files || [], debugSteps });
    } catch (e: any) {
      console.error('drive.list failed', e?.stack || e?.message || e);
      debugSteps.push('list-failed');
      return res.status(500).json({ ok: false, error: 'drive.list failed', details: String(e), debugSteps });
    }
  } catch (err: any) {
    console.error('unexpected error', err?.stack || err?.message || err);
    debugSteps.push('unexpected');
    return res.status(500).json({ ok: false, error: 'unexpected', details: String(err), debugSteps });
  }
}
