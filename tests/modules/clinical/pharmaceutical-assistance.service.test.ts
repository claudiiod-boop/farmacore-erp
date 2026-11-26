import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { PharmaceuticalAssistanceService } from '../../../src/modules/clinical/pharmaceutical-assistance.service';

describe('PharmaceuticalAssistanceService', () => {
  let db: Database;
  let service: PharmaceuticalAssistanceService;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new PharmaceuticalAssistanceService(db);

    db.prepare(`
      INSERT OR IGNORE INTO stores (id, name, cnpj)
      VALUES (1, 'Magnos Farma Matriz', '12345678000199')
    `).run();
  });

  afterEach(() => {
    if (db) db.close();
  });

  it('should register staff and ensure only one active RT Titular', () => {
    const rt1 = service.registerStaff({
      store_id: 1,
      name: 'Dra. Roberta CRF/SP',
      cpf: '111.222.333-44',
      crf_number: '12345',
      crf_uf: 'SP',
      role: 'RT_TITULAR',
      crt_certificate_number: 'CRT-2026-001',
      crt_validity_date: '2026-12-31',
    });

    expect(rt1.id).toBeDefined();
    expect(rt1.role).toBe('RT_TITULAR');

    // Registering a second RT_TITULAR should demote first to RT_SUBSTITUTO
    const rt2 = service.registerStaff({
      store_id: 1,
      name: 'Dr. Fernando CRF/SP',
      cpf: '999.888.777-66',
      crf_number: '67890',
      crf_uf: 'SP',
      role: 'RT_TITULAR',
    });

    const staffList = service.listStaff(1);
    expect(staffList.length).toBe(2);

    const updatedRt1 = service.getStaffById(rt1.id);
    expect(updatedRt1?.role).toBe('RT_SUBSTITUTO');
    expect(rt2.role).toBe('RT_TITULAR');
  });

  it('should set shifts and compute total weekly covered hours in KPIs', () => {
    const staff = service.registerStaff({
      store_id: 1,
      name: 'Dra. Beatriz Santos',
      cpf: '555.444.333-22',
      crf_number: '44556',
      crf_uf: 'SP',
      role: 'RT_TITULAR',
      crt_certificate_number: 'CRT-2026-88',
      crt_validity_date: '2027-01-01',
    });

    const shifts = service.setShifts(1, staff.id, [
      { day_of_week: 1, start_time: '08:00', end_time: '17:00' }, // 9h
      { day_of_week: 2, start_time: '08:00', end_time: '17:00' }, // 9h
      { day_of_week: 3, start_time: '08:00', end_time: '17:00' }, // 9h
      { day_of_week: 4, start_time: '08:00', end_time: '17:00' }, // 9h
      { day_of_week: 5, start_time: '08:00', end_time: '16:00' }, // 8h
    ]);

    expect(shifts.length).toBe(5);

    const shiftList = service.listShifts(1);
    expect(shiftList.length).toBe(5);
    expect(shiftList[0].staff_name).toBe('Dra. Beatriz Santos');

    const kpis = service.getAssistanceKpis(1);
    expect(kpis.totalActivePharmacists).toBe(1);
    expect(kpis.hasActiveRT).toBe(true);
    expect(kpis.activeRtName).toBe('Dra. Beatriz Santos');
    expect(kpis.totalWeeklyHoursCovered).toBe(44);
  });

  it('should record logbook entries with valid sha256 hash and generate extract', () => {
    const staff = service.registerStaff({
      store_id: 1,
      name: 'Dr. Lucas Farmacêutico',
      cpf: '777.666.555-44',
      crf_number: '99887',
      crf_uf: 'SP',
      role: 'RT_TITULAR',
    });

    const entry = service.recordLogbookEntry({
      store_id: 1,
      staff_id: staff.id,
      entry_type: 'INSPECTION_CRF',
      title: 'Termo de Inspeção nº 4059/2026',
      description: 'Fiscalização CRF/SP conferiu balcão, armário de controlados e SNGPC sem irregularidades.',
      crf_inspector_name: 'Fiscal Ana Oliveira CRF 11002',
      crf_inspection_term_number: '4059/2026',
      action_taken: 'Ciência assinada no termo fiscalizatório.',
      entry_date: '2026-11-26 10:30:00',
    });

    expect(entry.id).toBeDefined();
    expect(entry.sha256_hash).toBeDefined();
    expect(entry.sha256_hash.length).toBe(64);

    const entries = service.listLogbookEntries(1);
    expect(entries.length).toBe(1);
    expect(entries[0].staff_name).toBe('Dr. Lucas Farmacêutico');
    expect(entries[0].crf).toBe('99887/SP');

    const extract = service.generateLogbookExtract(1);
    expect(extract.store.id).toBe(1);
    expect(extract.store.name).toContain('Matriz');
    expect(extract.rtStaff?.name).toBe('Dr. Lucas Farmacêutico');
    expect(extract.totalEntries).toBe(1);
    expect(extract.extractHash.length).toBe(64);
  });
});
