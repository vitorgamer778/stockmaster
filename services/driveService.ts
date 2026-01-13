const getAuthAndDrive = async () => {
  const keyB64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const folderId = process.env.DRIVE_FOLDER_ID;
  if (!keyB64) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not set');
  if (!folderId) throw new Error('DRIVE_FOLDER_ID not set');

  let google: any;
  try {
    const mod = await import('googleapis');
    google = mod.google;
  } catch (e: any) {
    console.error('Failed to dynamically import googleapis:', e);
    throw new Error('googleapis library not available in runtime: ' + (e?.message || String(e)));
  }

  const keyJson = JSON.parse(Buffer.from(keyB64, 'base64').toString('utf-8'));
  const auth = new google.auth.GoogleAuth({
    credentials: keyJson,
    scopes: ['https://www.googleapis.com/auth/drive']
  });
  const drive = google.drive({ version: 'v3', auth });
  return { drive, folderId } as const;
};

export const findDataFile = async (name = 'stockmaster-data.json') => {
  const { drive, folderId } = await getAuthAndDrive();
  const q = `'${folderId}' in parents and name = '${name}' and trashed = false`;
  const res = await drive.files.list({ q, fields: 'files(id, name, size, mimeType)' });
  return res.data.files && res.data.files.length ? res.data.files[0] : null;
};

export const readDataFile = async (name = 'stockmaster-data.json') => {
  const file = await findDataFile(name);
  if (!file) return null;
  const { drive } = await getAuthAndDrive();
  const resp = await drive.files.get({ fileId: file.id!, alt: 'media' }, { responseType: 'stream' });
  const chunks: Buffer[] = [];
  return new Promise<any>((resolve, reject) => {
    (resp.data as any).on('data', (c: any) => chunks.push(Buffer.from(c)));
    (resp.data as any).on('end', () => {
      const txt = Buffer.concat(chunks).toString('utf-8');
      try { resolve(JSON.parse(txt)); } catch (e) { reject(new Error('invalid json in drive file')); }
    });
    (resp.data as any).on('error', (err: any) => reject(err));
  });
};

export const upsertDataFile = async (data: any, name = 'stockmaster-data.json') => {
  const file = await findDataFile(name);
  const { drive, folderId } = getAuthAndDrive();
  const media = { mimeType: 'application/json', body: JSON.stringify(data) };

  if (!file) {
    const created = await drive.files.create({
      requestBody: { name, parents: [folderId], mimeType: 'application/json' },
      media
    });
    return created.data;
  } else {
    const updated = await drive.files.update({ fileId: file.id!, media });
    return updated.data;
  }
};

export const listFolderFiles = async () => {
  const { drive, folderId } = getAuthAndDrive();
  const res = await drive.files.list({ q: `'${folderId}' in parents and trashed = false`, pageSize: 100, fields: 'files(id,name,size,mimeType)' });
  return res.data.files || [];
};
