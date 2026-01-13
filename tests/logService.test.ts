import { clearLogs, getLogs, logEvent } from '../services/logService';
import { describe, expect, it, beforeEach } from 'vitest';

beforeEach(() => clearLogs());

describe('logService', () => {
  it('should start empty and store logs', () => {
    expect(getLogs()).toEqual([]);
    const entry = logEvent('unit_test', { foo: 'bar' }, 'tester');
    const logs = getLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].event).toBe('unit_test');
    expect(logs[0].user).toBe('tester');
    expect(logs[0].payload).toBeDefined();
  });

  it('clearLogs should remove entries', () => {
    logEvent('one');
    expect(getLogs().length).toBeGreaterThan(0);
    clearLogs();
    expect(getLogs().length).toBe(0);
  });
});
