import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { CmedParserService } from '../../../src/modules/cmed/cmed-parser.service';

describe('CmedParserService (Parser e Carga da Base Oficial CMED / ANVISA)', () => {
  let db: Database;
  let service: CmedParserService;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new CmedParserService(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should parse and import official CMED CSV format with PF and PMC rates', () => {
    const mockCmedCsv = `
SUBSTANCIA;CNPJ;LABORATORIO;REGISTRO;EAN_1;PRODUTO;APRESENTACAO;CLASSE_TERAPEUTICA;TIPO_PRODUTO;LISTA_CONCESSAO_CREDITO_TRIBUTARIO;PF_18;PF_20;PMC_18;PMC_20
AMOXICILINA;11.222.333/0001-99;EMS S/A;1000000000001;7891234567890;AMOXICILINA;500 MG CAP DURA CT BL AL PLAS INC X 21;ANTIBACTERIANOS SISTEMICOS;GENÉRICO;NEGATIVA;22,50;23,10;34,80;35,90
DIPIRONA MONOIDRATADA;44.555.666/0001-88;MEDLEY S/A;1000000000002;7899876543210;DIPIRONA;500 MG/ML SOL OR CT FR PLAS OPC GOT X 20 ML;ANALGESICOS E ANTITERMICOS;GENÉRICO;POSITIVA;6,20;6,45;9,50;9,90
    `.trim();

    const result = service.importCmedFile(mockCmedCsv, 'CMED-2026-11');

    expect(result.importedCount).toBe(2);
    expect(result.versionCode).toBe('CMED-2026-11');

    // Verifica produto 1 importado
    const amox = db.prepare<any>('SELECT * FROM cmed_products WHERE ean = ?').get('7891234567890');
    expect(amox).toBeDefined();
    expect(amox.product_name).toBe('AMOXICILINA');
    expect(amox.substance_name).toBe('AMOXICILINA');
    expect(amox.laboratory_name).toBe('EMS S/A');
    expect(amox.product_type).toBe('GENERICO');
    expect(amox.list_type).toBe('NEGATIVA');
    expect(amox.pf_18).toBe(22.50);
    expect(amox.pmc_18).toBe(34.80);
    expect(amox.pmc_20).toBe(35.90);

    // Verifica produto 2 importado
    const dip = db.prepare<any>('SELECT * FROM cmed_products WHERE ean = ?').get('7899876543210');
    expect(dip).toBeDefined();
    expect(dip.list_type).toBe('POSITIVA');
    expect(dip.pf_18).toBe(6.20);
    expect(dip.pmc_18).toBe(9.50);
  });

  it('should sanitize Brazilian monetary formatting (comma decimal) and invalid records', () => {
    expect(CmedParserService.parseDecimalBr('1.250,50')).toBe(1250.50);
    expect(CmedParserService.parseDecimalBr('22,50')).toBe(22.50);
    expect(CmedParserService.parseDecimalBr('')).toBe(0.0);
    expect(CmedParserService.parseDecimalBr('N/A')).toBe(0.0);
  });
});
