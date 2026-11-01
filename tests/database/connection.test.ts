import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import { getDatabase } from '../../src/database/connection';

describe('Database Connection', () => {
  const cleanupFiles: string[] = [];

  afterEach(() => {
    for (const file of cleanupFiles) {
      try {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      } catch {}
    }
    cleanupFiles.length = 0;
  });

  it('should initialize an in-memory SQLite database with foreign keys enabled', () => {
    const db = getDatabase(':memory:');
    try {
      const pragmaFk = db.pragma('foreign_keys', { simple: true });
      expect(pragmaFk).toBe(1);
    } finally {
      db.close();
    }
  });

  it('should enable WAL mode for file-based databases', () => {
    const testDbPath = 'test-wal.db';
    cleanupFiles.push(testDbPath);
    const db = getDatabase(testDbPath);
    try {
      const journalMode = db.pragma('journal_mode', { simple: true });
      expect(journalMode).toBe('wal');
    } finally {
      db.close();
    }
  });

  it('should return all rows for multi-row pragmas like table_info', () => {
    const db = getDatabase(':memory:');
    try {
      db.exec('CREATE TABLE test_tbl (id INTEGER PRIMARY KEY, name TEXT, price REAL);');
      const tableInfo = db.pragma('table_info(test_tbl)');
      expect(Array.isArray(tableInfo)).toBe(true);
      expect(tableInfo).toHaveLength(3);
      expect(tableInfo.map((col: any) => col.name)).toEqual(['id', 'name', 'price']);
    } finally {
      db.close();
    }
  });
});
