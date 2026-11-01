import { describe, it, expect } from 'vitest';
import { getDatabase } from '../../src/database/connection';

describe('Database Connection', () => {
  it('should initialize an in-memory SQLite database with foreign keys enabled', () => {
    const db = getDatabase(':memory:');
    const pragmaFk = db.pragma('foreign_keys', { simple: true });
    expect(pragmaFk).toBe(1);
    db.close();
  });

  it('should enable WAL mode for file-based databases', () => {
    const testDbPath = 'test-wal.db';
    const db = getDatabase(testDbPath);
    const journalMode = db.pragma('journal_mode', { simple: true });
    expect(journalMode).toBe('wal');
    db.close();
    try {
      require('fs').unlinkSync(testDbPath);
    } catch {}
  });
});
