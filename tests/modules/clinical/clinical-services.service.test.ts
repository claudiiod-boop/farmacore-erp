import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { ClinicalServicesService } from '../../../src/modules/clinical/clinical-services.service';

describe('ClinicalServicesService (Consultório Farmacêutico & RDC 777/2023)', () => {
  let db: Database;
  let service: ClinicalServicesService;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new ClinicalServicesService(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should register pharmacist and seed default clinical services', () => {
    const pharm = service.registerPharmacist({
      storeId: 1,
      name: 'Dra. Juliana Farmacêutica',
      cpf: '123.456.789-01',
      crfNumber: '99887',
      crfUf: 'SP',
      email: 'juliana@farmacia.com.br',
      phone: '11999998888'
    });

    expect(pharm.id).toBeGreaterThan(0);
    expect(pharm.cpf).toBe('12345678901');
    expect(pharm.crfNumber).toBe('99887');

    service.seedDefaultServices(1);
    const catalog = service.listServiceCatalog(1);
    expect(catalog.length).toBeGreaterThanOrEqual(10);
    expect(catalog.some((s) => s.code === 'TLR-GLU')).toBe(true);
    expect(catalog.some((s) => s.code === 'PROC-INJ')).toBe(true);
  });

  it('should create attendance, register TLR and injectable procedure, and complete with DSF', () => {
    const pharm = service.registerPharmacist({
      storeId: 1,
      name: 'Dr. Lucas Farmacêutico',
      cpf: '11122233344',
      crfNumber: '12345',
      crfUf: 'SP'
    });

    service.seedDefaultServices(1);
    const gluItem = service.listServiceCatalog(1).find((s) => s.code === 'TLR-GLU')!;
    const injItem = service.listServiceCatalog(1).find((s) => s.code === 'PROC-INJ')!;

    // 1. Criar Atendimento
    const attendance = service.createAttendance({
      storeId: 1,
      pharmacistId: pharm.id!,
      patientName: 'Marcio Silva',
      patientCpf: '987.654.321-00',
      patientBirthDate: '1985-06-15',
      patientGender: 'M',
      patientPhone: '11988887777',
      bloodPressureSystolic: 120,
      bloodPressureDiastolic: 80,
      heartRate: 72,
      temperature: 36.6,
      oxygenSaturation: 98,
      anamnesisNotes: 'Paciente relata cefaleia e busca teste de glicemia de rotina',
      allergies: 'Nenhuma alergia relatada',
      continuousMedications: 'Losartana 50mg'
    });

    expect(attendance.id).toBeGreaterThan(0);
    expect(attendance.status).toBe('IN_PROGRESS');

    // 2. Registrar Teste Rápido TLR
    const testRecord = service.addRapidTest(attendance.id, {
      serviceCatalogId: gluItem.id,
      testType: 'GLUCOSE',
      reagentName: 'Accu-Chek Guide',
      reagentBatch: 'LOTE-GLU-2026',
      reagentExpiration: '2028-12-31',
      reagentMsRegistration: '10287410055',
      resultValue: '95 mg/dL',
      resultInterpretation: 'NORMAL',
      referenceRange: 'Jejum: 70 a 99 mg/dL'
    });

    expect(testRecord.id).toBeGreaterThan(0);

    // 3. Registrar Procedimento (Injetável)
    const procRecord = service.addProcedure(attendance.id, {
      serviceCatalogId: injItem.id,
      procedureType: 'INJECTABLE',
      medicationName: 'Dipirona 500mg/ml',
      medicationBatch: 'LOTE-DIP-45',
      applicationSite: 'GLUTEUS_D',
      prescriberName: 'Dr. Roberto Clínico',
      prescriberCrm: 'CRM-SP 123456'
    });

    expect(procRecord.id).toBeGreaterThan(0);

    // 4. Finalizar Atendimento e emitir DSF
    const completed = service.completeAttendance(attendance.id);
    expect(completed.status).toBe('COMPLETED');
    expect(completed.dsfNumber).toContain('DSF-1-');
    expect(completed.totalAmount).toBe(gluItem.price + injItem.price);
    expect(completed.rapidTests).toHaveLength(1);
    expect(completed.procedures).toHaveLength(1);
  });
});
