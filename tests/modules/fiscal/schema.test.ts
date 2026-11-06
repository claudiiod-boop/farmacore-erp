import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import type {
  FiscalProfile,
  ProductFiscalData,
  NfceInvoice,
  FiscalEnvironment,
  NfceInvoiceStatus,
} from '../../../src/modules/fiscal/types';

describe('Fiscal Schema 003 & Types', () => {
  let db: Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should apply migration 003 and create fiscal_profiles and nfce_invoices tables', () => {
    const tables = db
      .prepare<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
      )
      .all()
      .map((r) => r.name);

    expect(tables).toContain('fiscal_profiles');
    expect(tables).toContain('nfce_invoices');
  });

  it('should verify products table has ncm, cest, cfop, csosn_icms, cst_pis, cst_cofins, origin columns with defaults', () => {
    const productCols = db
      .pragma('table_info(products)')
      .map((col: any) => col.name);

    expect(productCols).toEqual(
      expect.arrayContaining([
        'ncm',
        'cest',
        'cfop',
        'csosn_icms',
        'cst_pis',
        'cst_cofins',
        'origin',
      ])
    );

    // Test default values when inserting product
    db.prepare(
      `INSERT INTO products (ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      '7891234567890',
      'Dipirona 500mg',
      'Dipirona Monoidratada',
      '1.0000.0001.001-1',
      'SEM_TARJA',
      'COMUM',
      15.0,
      10.0,
      12.0
    );

    const product = db
      .prepare<any>(
        'SELECT ncm, cest, cfop, csosn_icms, cst_pis, cst_cofins, origin FROM products WHERE ean = ?'
      )
      .get('7891234567890');

    expect(product).toEqual({
      ncm: '30049099',
      cest: '1300100',
      cfop: '5405',
      csosn_icms: '500',
      cst_pis: '04',
      cst_cofins: '04',
      origin: 0,
    });
  });

  it('should insert and retrieve a fiscal profile with defaults and constraints', () => {
    const profileCols = db
      .pragma('table_info(fiscal_profiles)')
      .map((col: any) => col.name);

    expect(profileCols).toEqual(
      expect.arrayContaining([
        'id',
        'cnpj',
        'ie',
        'razao_social',
        'nome_fantasia',
        'crt',
        'c_uf',
        'municipio',
        'c_mun',
        'logradouro',
        'numero',
        'bairro',
        'cep',
        'serie',
        'next_nnf',
        'csc_token',
        'csc_id',
        'environment',
        'cert_pfx_base64',
        'cert_password',
        'updated_at',
      ])
    );

    db.prepare(
      `INSERT INTO fiscal_profiles (
        cnpj, ie, razao_social, nome_fantasia, logradouro, numero, bairro, cep, csc_token
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      '12345678000195',
      '123456789111',
      'Farmacia Central LTDA',
      'Farma Central',
      'Av Paulista',
      '1000',
      'Bela Vista',
      '01310100',
      'TOKEN-CSC-HOMOLOG-123'
    );

    const row = db
      .prepare<any>('SELECT * FROM fiscal_profiles WHERE cnpj = ?')
      .get('12345678000195');

    expect(row).toBeDefined();
    expect(row.crt).toBe(1);
    expect(row.c_uf).toBe(35);
    expect(row.municipio).toBe('São Paulo');
    expect(row.c_mun).toBe(3550308);
    expect(row.serie).toBe(1);
    expect(row.next_nnf).toBe(1);
    expect(row.csc_id).toBe('000001');
    expect(row.environment).toBe('HOMOLOGACAO');

    // Invalid CRT check constraint
    expect(() => {
      db.prepare(
        `INSERT INTO fiscal_profiles (
          cnpj, ie, razao_social, nome_fantasia, logradouro, numero, bairro, cep, csc_token, crt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        '98765432000100',
        '987654321',
        'Outra Farmacia',
        'Outra',
        'Rua A',
        '10',
        'Centro',
        '01001000',
        'TOKEN',
        5 // Invalid CRT (allowed: 1, 2, 3)
      );
    }).toThrow();

    // Invalid environment check constraint
    expect(() => {
      db.prepare(
        `INSERT INTO fiscal_profiles (
          cnpj, ie, razao_social, nome_fantasia, logradouro, numero, bairro, cep, csc_token, environment
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        '98765432000100',
        '987654321',
        'Outra Farmacia',
        'Outra',
        'Rua A',
        '10',
        'Centro',
        '01001000',
        'TOKEN',
        'TESTING' // Invalid environment
      );
    }).toThrow();
  });

  it('should enforce unique constraints and foreign keys on nfce_invoices', () => {
    const invoiceCols = db
      .pragma('table_info(nfce_invoices)')
      .map((col: any) => col.name);

    expect(invoiceCols).toEqual(
      expect.arrayContaining([
        'id',
        'sale_id',
        'ch_nfe',
        'n_nf',
        'serie',
        'tp_amb',
        'tp_emis',
        'status',
        'protocol_number',
        'protocol_date',
        'xml_signed',
        'xml_authorized',
        'qr_code_url',
        'digest_value',
        'c_stat',
        'x_motivo',
        'cancellation_reason',
        'created_at',
      ])
    );

    // Create a sale first
    const saleResult = db
      .prepare(
        'INSERT INTO sales (total_amount, status) VALUES (?, ?)'
      )
      .run(50.0, 'COMPLETED');
    const saleId = Number(saleResult.lastInsertRowid);

    const chNFe1 = '35261112345678000195650010000000011000000019';

    db.prepare(
      `INSERT INTO nfce_invoices (
        sale_id, ch_nfe, n_nf, serie, tp_amb, tp_emis, status,
        xml_signed, qr_code_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      saleId,
      chNFe1,
      1,
      1,
      2,
      1,
      'AUTORIZADA',
      '<xml>signed</xml>',
      'http://sefaz.sp.gov.br/qrcode?p=...'
    );

    // Inserting duplicate sale_id must fail (UNIQUE)
    expect(() => {
      db.prepare(
        `INSERT INTO nfce_invoices (
          sale_id, ch_nfe, n_nf, serie, tp_amb, tp_emis, status,
          xml_signed, qr_code_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        saleId,
        '35261112345678000195650010000000021000000025',
        2,
        1,
        2,
        1,
        'AUTORIZADA',
        '<xml>signed2</xml>',
        'http://sefaz.sp.gov.br/qrcode?p=...'
      );
    }).toThrow();

    // Create a second sale
    const sale2Result = db
      .prepare(
        'INSERT INTO sales (total_amount, status) VALUES (?, ?)'
      )
      .run(80.0, 'COMPLETED');
    const saleId2 = Number(sale2Result.lastInsertRowid);

    // Inserting duplicate ch_nfe must fail (UNIQUE)
    expect(() => {
      db.prepare(
        `INSERT INTO nfce_invoices (
          sale_id, ch_nfe, n_nf, serie, tp_amb, tp_emis, status,
          xml_signed, qr_code_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        saleId2,
        chNFe1, // Duplicate ch_nfe
        2,
        1,
        2,
        1,
        'AUTORIZADA',
        '<xml>signed2</xml>',
        'http://sefaz.sp.gov.br/qrcode?p=...'
      );
    }).toThrow();

    // Non-existent sale_id should fail foreign key constraint
    expect(() => {
      db.prepare(
        `INSERT INTO nfce_invoices (
          sale_id, ch_nfe, n_nf, serie, tp_amb, tp_emis, status,
          xml_signed, qr_code_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        99999, // Non-existent sale_id
        '35261112345678000195650010000000031000000030',
        3,
        1,
        2,
        1,
        'AUTORIZADA',
        '<xml>signed3</xml>',
        'http://sefaz.sp.gov.br/qrcode?p=...'
      );
    }).toThrow();

    // Invalid status check constraint
    expect(() => {
      db.prepare(
        `INSERT INTO nfce_invoices (
          sale_id, ch_nfe, n_nf, serie, tp_amb, tp_emis, status,
          xml_signed, qr_code_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        saleId2,
        '35261112345678000195650010000000041000000046',
        4,
        1,
        2,
        1,
        'PENDING', // Invalid status
        '<xml>signed4</xml>',
        'http://sefaz.sp.gov.br/qrcode?p=...'
      );
    }).toThrow();
  });

  it('should compile and validate TypeScript types', () => {
    const env: FiscalEnvironment = 'HOMOLOGACAO';
    const status: NfceInvoiceStatus = 'AUTORIZADA';

    const sampleProfile: FiscalProfile = {
      cnpj: '12345678000195',
      ie: '123456789111',
      razaoSocial: 'Farmacia Modelo',
      nomeFantasia: 'Farma Modelo',
      crt: 1,
      cUf: 35,
      municipio: 'São Paulo',
      cMun: 3550308,
      logradouro: 'Rua das Flores',
      numero: '123',
      bairro: 'Centro',
      cep: '01001000',
      serie: 1,
      nextNnf: 1,
      cscToken: 'TOKEN123',
      cscId: '000001',
      environment: env,
    };

    const sampleProductTax: ProductFiscalData = {
      ncm: '30049099',
      cest: '1300100',
      cfop: '5405',
      csosnIcms: '500',
      cstPis: '04',
      cstCofins: '04',
      origin: 0,
    };

    const sampleInvoice: NfceInvoice = {
      id: 1,
      saleId: 10,
      chNFe: '35261112345678000195650010000000011000000019',
      nNF: 1,
      serie: 1,
      tpAmb: 2,
      tpEmis: 1,
      status: status,
      protocolNumber: '135260000000001',
      protocolDate: '2026-11-06T19:00:00Z',
      xmlSigned: '<xml>signed</xml>',
      xmlAuthorized: '<nfeProc><xml>signed</xml></nfeProc>',
      qrCodeUrl: 'http://sefaz.sp.gov.br/qrcode?p=...',
      digestValue: 'abcdef12345=',
      cStat: 100,
      xMotivo: 'Autorizado o uso da NF-e',
      cancellationReason: null,
      createdAt: '2026-11-06 19:00:00',
    };

    expect(sampleProfile.cnpj).toBe('12345678000195');
    expect(sampleProductTax.ncm).toBe('30049099');
    expect(sampleInvoice.status).toBe('AUTORIZADA');
  });
});
