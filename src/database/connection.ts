import { DatabaseSync } from 'node:sqlite';

export interface RunResult {
  changes: number | bigint;
  lastInsertRowid: number | bigint;
}

export interface Statement<T = any> {
  run(...params: any[]): RunResult;
  get(...params: any[]): T | undefined;
  all(...params: any[]): T[];
}

export interface Database {
  exec(sql: string): void;
  prepare<T = any>(sql: string): Statement<T>;
  transaction<F extends (...args: any[]) => any>(fn: F): F;
  pragma(pragmaStr: string, options?: { simple?: boolean }): any;
  close(): void;
  readonly raw: DatabaseSync;
}

function normalizeParams(params: any[]): any[] {
  if (params.length === 1 && Array.isArray(params[0])) {
    return params[0];
  }
  return params;
}

export class FarmaDatabase implements Database {
  readonly raw: DatabaseSync;
  private txDepth = 0;

  constructor(dbPath: string = ':memory:') {
    this.raw = new DatabaseSync(dbPath);
    this.initPragmas(dbPath);
  }

  private initPragmas(dbPath: string): void {
    this.exec('PRAGMA foreign_keys = ON;');
    if (dbPath !== ':memory:') {
      this.exec('PRAGMA journal_mode = WAL;');
    }
  }

  exec(sql: string): void {
    this.raw.exec(sql);
  }

  prepare<T = any>(sql: string): Statement<T> {
    const stmt = this.raw.prepare(sql);
    return {
      run: (...params: any[]) => {
        return stmt.run(...normalizeParams(params));
      },
      get: (...params: any[]) => {
        return stmt.get(...normalizeParams(params)) as T | undefined;
      },
      all: (...params: any[]) => {
        return stmt.all(...normalizeParams(params)) as T[];
      },
    };
  }

  transaction<F extends (...args: any[]) => any>(fn: F): F {
    return ((...args: Parameters<F>): ReturnType<F> => {
      const depth = this.txDepth;
      const savepoint = `sp_${depth}`;

      if (depth === 0) {
        this.exec('BEGIN');
      } else {
        this.exec(`SAVEPOINT ${savepoint}`);
      }

      this.txDepth++;

      try {
        const result = fn(...args);
        this.txDepth--;

        if (depth === 0) {
          this.exec('COMMIT');
        } else {
          this.exec(`RELEASE ${savepoint}`);
        }

        return result;
      } catch (error) {
        this.txDepth--;

        if (depth === 0) {
          this.exec('ROLLBACK');
        } else {
          this.exec(`ROLLBACK TO ${savepoint}`);
        }

        throw error;
      }
    }) as F;
  }

  pragma(pragmaStr: string, options?: { simple?: boolean }): any {
    if (pragmaStr.includes('=')) {
      this.exec(`PRAGMA ${pragmaStr};`);
      return;
    }

    const stmt = this.raw.prepare(`PRAGMA ${pragmaStr};`);
    const rows = stmt.all() as Record<string, any>[];

    if (options?.simple) {
      return rows.length > 0 ? Object.values(rows[0])[0] : undefined;
    }

    return rows;
  }

  close(): void {
    this.raw.close();
  }
}

export function getDatabase(dbPath: string = ':memory:'): Database {
  return new FarmaDatabase(dbPath);
}
