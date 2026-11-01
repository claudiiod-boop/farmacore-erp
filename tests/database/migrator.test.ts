import { describe, it, expect } from 'vitest';
import { getDatabase } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';

describe('Database Migrator', () => {
  it('should create all required FarmaCore tables', () => {
    const db = getDatabase(':memory:');
    try {
      runMigrations(db);

      const tables = db
        .prepare<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        .all()
        .map((r) => r.name);

      const expectedTables = [
        'products',
        'batches',
        'pre_sales',
        'pre_sale_items',
        'prescriptions',
        'cash_sessions',
        'sales',
        'sale_items',
        'sale_payments',
      ];

      for (const expected of expectedTables) {
        expect(tables).toContain(expected);
      }
    } finally {
      db.close();
    }
  });

  it('should be idempotent and not fail when run multiple times', () => {
    const db = getDatabase(':memory:');
    try {
      runMigrations(db);
      expect(() => runMigrations(db)).not.toThrow();

      const migrations = db
        .prepare<{ name: string }>('SELECT name FROM _migrations')
        .all()
        .map((r) => r.name);

      expect(migrations).toContain('001_initial_schema.sql');
      // Should not duplicate migration entries
      const count = migrations.filter((m) => m === '001_initial_schema.sql').length;
      expect(count).toBe(1);
    } finally {
      db.close();
    }
  });

  it('should enforce foreign key constraints', () => {
    const db = getDatabase(':memory:');
    try {
      runMigrations(db);

      // Inserting a batch with non-existent product_id must fail
      expect(() => {
        db.prepare(
          `INSERT INTO batches (product_id, batch_number, manufacturing_date, expiration_date, quantity)
           VALUES (?, ?, ?, ?, ?)`
        ).run(9999, 'LOTE123', '2026-01-01', '2027-01-01', 10);
      }).toThrow();
    } finally {
      db.close();
    }
  });

  it('should enforce unique constraint on product EAN', () => {
    const db = getDatabase(':memory:');
    try {
      runMigrations(db);

      db.prepare(
        `INSERT INTO products (ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        '7891234567890',
        'Amoxicilina 500mg',
        'Amoxicilina',
        '1.0000.0001.001-1',
        'VERMELHA',
        'ANTIMICROBIANO',
        50.0,
        35.0,
        42.5
      );

      // Duplicate EAN must fail
      expect(() => {
        db.prepare(
          `INSERT INTO products (ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          '7891234567890',
          'Amoxicilina Genérica 500mg',
          'Amoxicilina',
          '1.0000.0001.002-2',
          'VERMELHA',
          'ANTIMICROBIANO',
          50.0,
          35.0,
          40.0
        );
      }).toThrow();
    } finally {
      db.close();
    }
  });

  it('should verify schema columns for products and prescriptions', () => {
    const db = getDatabase(':memory:');
    try {
      runMigrations(db);

      const productCols = db.pragma('table_info(products)').map((col: any) => col.name);
      expect(productCols).toEqual(
        expect.arrayContaining([
          'id',
          'ean',
          'name',
          'active_ingredient',
          'ms_registration',
          'stripe',
          'control_type',
          'pmc',
          'pf',
          'price',
          'is_active',
          'created_at',
        ])
      );

      const prescriptionCols = db.pragma('table_info(prescriptions)').map((col: any) => col.name);
      expect(prescriptionCols).toEqual(
        expect.arrayContaining([
          'id',
          'pre_sale_id',
          'doctor_name',
          'doctor_crm',
          'doctor_uf',
          'prescription_type',
          'prescription_date',
          'patient_name',
          'buyer_name',
          'buyer_cpf',
          'created_at',
        ])
      );
    } finally {
      db.close();
    }
  });
});
