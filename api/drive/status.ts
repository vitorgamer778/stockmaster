import { readDataFile, findDataFile, listFolderFiles } from '../../services/driveService';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY || !process.env.DRIVE_FOLDER_ID) {
    return res.status(500).json({ ok: false, error: 'Missing DRIVE config in environment' });
  }

  try {
    console.log('drive status: starting check');
    const file = await findDataFile();
    console.log('drive status: found file?', !!file);
    const files = await listFolderFiles();
    console.log('drive status: listed files count', files.length);
    const content = file ? await readDataFile() : null;
    console.log('drive status: read content?', !!content);
    return res.status(200).json({ ok: true, file: file ? { id: file.id, name: file.name, size: file.size } : null, files, content });
  } catch (err: any) {
    console.error('drive status error', err?.stack || err?.message || err);
    return res.status(500).json({ ok: false, error: err?.message || 'Drive error', details: String(err) });
  }
}
