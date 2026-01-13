export type LogEntry = {
  id: string;
  ts: string; // ISO
  user?: string | null;
  event: string;
  payload?: any;
};

const STORAGE_KEY = 'sm_audit_logs';

const readRaw = (): LogEntry[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('failed to read logs', e);
    return [];
  }
};

const writeRaw = (logs: LogEntry[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  } catch (e) {
    console.error('failed to write logs', e);
  }
};

export const logEvent = (event: string, payload?: any, user?: string | null) => {
  const logs = readRaw();
  const entry: LogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    ts: new Date().toISOString(),
    user: user || null,
    event,
    payload: payload === undefined ? null : payload,
  };
  logs.push(entry);
  writeRaw(logs);
  return entry;
};

export const getLogs = () => {
  return readRaw().slice().sort((a,b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
};

export const clearLogs = () => {
  writeRaw([]);
};

export const exportLogsJSON = (filename = `logs_${new Date().toISOString()}.json`) => {
  const data = JSON.stringify(readRaw(), null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
};

export const exportLogsCSV = (filename = `logs_${new Date().toISOString()}.csv`) => {
  const logs = readRaw();
  const rows = logs.map(l => ({ id: l.id, ts: l.ts, user: l.user || '', event: l.event, payload: JSON.stringify(l.payload || '') }));
  const header = Object.keys(rows[0] || {}).join(',') + '\n';
  const body = rows.map(r => `${r.id},"${r.ts}","${r.user}","${r.event}","${r.payload.replace(/"/g, '""')}"`).join('\n');
  const data = header + body;
  const blob = new Blob([data], { type: 'text/csv' });
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
};
