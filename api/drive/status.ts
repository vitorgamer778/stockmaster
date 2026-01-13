import { readDataFile, findDataFile, listFolderFiles } from '../../services/driveService';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY || !process.env.DRIVE_FOLDER_ID) {
    return res.status(500).json({ ok: false, error: 'Missing DRIVE config in environment' });
  }

  try {
    const file = await findDataFile();
    const files = await listFolderFiles();
    const content = file ? await readDataFile() : null;
    return res.status(200).json({ ok: true, file: file ? { id: file.id, name: file.name, size: file.size } : null, files, content });
  } catch (err: any) {
    console.error('drive status error', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Drive error' });
  }
}
