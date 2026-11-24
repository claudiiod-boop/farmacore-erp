import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { InjectableVaccinationService } from '../../../src/modules/injectables/injectables.service';

describe('InjectableVaccinationService', () => {
  let db: Database;
  let service: InjectableVaccinationService;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new InjectableVaccinationService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('Injectable Administration (RDC 44/2009)', () => {
    it('should record an injectable administration and generate sequential DSF number', () => {
      const log = service.recordInjectableAdministration({
        storeId: 1,
        patientName: 'Carlos Eduardo',
        patientCpf: '123.456.789-00',
        medicationName: 'Benzetacil (Benzilpenicilina Benzatina)',
        medicationDosage: '1.200.000 UI',
        medicationBatch: 'LOTE-BENZ-2026',
        medicationExpirationDate: '2027-12-31',
        syringeNeedleBatch: 'SER-4455',
        administrationRoute: 'INTRAMUSCULAR',
        anatomicalSite: 'Glúteo Ventro-glúteo',
        prescriberName: 'Dr. Roberto Santos',
        prescriberCrm: '123456',
        prescriberUf: 'SP',
        pharmacistName: 'Dra. Vanessa',
        pharmacistCrf: 'CRF-SP 55443',
        notes: 'Paciente aguardou 15 min sem sinais de anafilaxia',
      });

      expect(log.id).toBeGreaterThan(0);
      expect(log.declaration_number).toMatch(/^DSF-INJ-\d{4}-0001$/);
      expect(log.medication_name).toContain('Benzetacil');

      const byDecl = service.getInjectableLogByDeclaration(log.declaration_number);
      expect(byDecl?.id).toBe(log.id);
    });

    it('should reject administration of expired medication', () => {
      expect(() => {
        service.recordInjectableAdministration({
          storeId: 1,
          patientName: 'Carlos Eduardo',
          patientCpf: '123.456.789-00',
          medicationName: 'Medicamento Vencido',
          medicationDosage: '50mg',
          medicationBatch: 'L-EXP',
          medicationExpirationDate: '2024-01-01',
          syringeNeedleBatch: 'S-1',
          administrationRoute: 'INTRAMUSCULAR',
          anatomicalSite: 'Deltoide',
          prescriberName: 'Dr. Teste',
          prescriberCrm: '111',
          prescriberUf: 'SP',
          pharmacistName: 'Farm',
          pharmacistCrf: 'CRF-123',
        });
      }).toThrow('Medicamento injetável com lote vencido');
    });

    it('should filter injectable logs by patient CPF', () => {
      service.recordInjectableAdministration({
        patientName: 'Paciente A',
        patientCpf: '111.111.111-11',
        medicationName: 'Med A',
        medicationDosage: '10mg',
        medicationBatch: 'L1',
        medicationExpirationDate: '2028-01-01',
        syringeNeedleBatch: 'S1',
        administrationRoute: 'INTRAMUSCULAR',
        anatomicalSite: 'Deltoide',
        prescriberName: 'Dr. A',
        prescriberCrm: '111',
        prescriberUf: 'SP',
        pharmacistName: 'Farm',
        pharmacistCrf: 'CRF-1',
      });

      service.recordInjectableAdministration({
        patientName: 'Paciente B',
        patientCpf: '222.222.222-22',
        medicationName: 'Med B',
        medicationDosage: '20mg',
        medicationBatch: 'L2',
        medicationExpirationDate: '2028-01-01',
        syringeNeedleBatch: 'S2',
        administrationRoute: 'SUBCUTANEA',
        anatomicalSite: 'Abdome',
        prescriberName: 'Dr. B',
        prescriberCrm: '222',
        prescriberUf: 'SP',
        pharmacistName: 'Farm',
        pharmacistCrf: 'CRF-1',
      });

      const listA = service.listInjectableLogs({ patientCpf: '111.111.111-11' });
      expect(listA.length).toBe(1);
      expect(listA[0].patient_name).toBe('Paciente A');
    });
  });

  describe('Vaccination Room & SI-PNI Integration (RDC 197/2017)', () => {
    it('should record vaccination and generate unique certificate code', () => {
      const vac = service.recordVaccination({
        storeId: 1,
        patientName: 'Juliana Lima',
        patientCpf: '333.444.555-66',
        patientBirthDate: '1995-10-20',
        vaccineName: 'Gripe Influenza Tetravalente',
        manufacturer: 'Sanofi Pasteur',
        vaccineBatch: 'VAC-FLU-2026',
        vaccineExpirationDate: '2027-06-30',
        doseType: 'SINGLE_DOSE',
        anatomicalSite: 'Deltoide Esquerdo',
        preTriageFever: false,
        pharmacistName: 'Dra. Vanessa',
        pharmacistCrf: 'CRF-SP 55443',
      });

      expect(vac.id).toBeGreaterThan(0);
      expect(vac.certificate_code).toMatch(/^VAC-\d{4}-/);
      expect(vac.sipni_status).toBe('PENDING');

      const byCert = service.getVaccinationByCertificate(vac.certificate_code);
      expect(byCert?.id).toBe(vac.id);
    });

    it('should export pending vaccination records to SI-PNI batch', () => {
      service.recordVaccination({
        patientName: 'Paciente 1',
        patientCpf: '444.555.666-77',
        patientBirthDate: '1980-01-01',
        vaccineName: 'Hepatite B',
        manufacturer: 'GlaxoSmithKline',
        vaccineBatch: 'VAC-HEP-01',
        vaccineExpirationDate: '2028-01-01',
        doseType: 'DOSE_1',
        anatomicalSite: 'Deltoide',
        pharmacistName: 'Dra. Vanessa',
        pharmacistCrf: 'CRF-SP 55443',
      });

      const batch = service.exportBatchToSipni(1);
      expect(batch.exportedCount).toBe(1);
      expect(batch.records[0].sipni_status).toBe('EXPORTED');
      expect(batch.records[0].sipni_exported_at).toBeDefined();

      // Próxima exportação não deve conter registros pendentes
      const secondBatch = service.exportBatchToSipni(1);
      expect(secondBatch.exportedCount).toBe(0);
    });

    it('should record adverse event following immunization (EAPV)', () => {
      const vac = service.recordVaccination({
        patientName: 'Lucas Castro',
        patientCpf: '777.888.999-00',
        patientBirthDate: '2000-05-12',
        vaccineName: 'Febre Amarela',
        manufacturer: 'Bio-Manguinhos',
        vaccineBatch: 'VAC-FA-99',
        vaccineExpirationDate: '2027-12-31',
        doseType: 'SINGLE_DOSE',
        anatomicalSite: 'Deltoide',
        pharmacistName: 'Dra. Vanessa',
        pharmacistCrf: 'CRF-SP 55443',
      });

      const updated = service.recordEapv(vac.id, 'Paciente relatou cefaleia leve e mialgia 24h após aplicação.');
      expect(updated.eapv_adverse_event).toBe(1);
      expect(updated.eapv_description).toContain('cefaleia leve');
    });
  });

  describe('Consulting Room Summary', () => {
    it('should return month summary statistics', () => {
      service.recordInjectableAdministration({
        patientName: 'Paciente A',
        patientCpf: '111.111.111-11',
        medicationName: 'Med A',
        medicationDosage: '10mg',
        medicationBatch: 'L1',
        medicationExpirationDate: '2028-01-01',
        syringeNeedleBatch: 'S1',
        administrationRoute: 'INTRAMUSCULAR',
        anatomicalSite: 'Deltoide',
        prescriberName: 'Dr. A',
        prescriberCrm: '111',
        prescriberUf: 'SP',
        pharmacistName: 'Farm',
        pharmacistCrf: 'CRF-1',
      });

      service.recordVaccination({
        patientName: 'Paciente V',
        patientCpf: '222.333.444-55',
        patientBirthDate: '1990-01-01',
        vaccineName: 'Gripe Tetravalente',
        manufacturer: 'Sanofi',
        vaccineBatch: 'VAC-01',
        vaccineExpirationDate: '2028-01-01',
        doseType: 'SINGLE_DOSE',
        anatomicalSite: 'Deltoide',
        pharmacistName: 'Farm',
        pharmacistCrf: 'CRF-1',
      });

      const summary = service.getSummary(1);
      expect(summary.totalInjectablesMonth).toBe(1);
      expect(summary.totalVaccinesMonth).toBe(1);
      expect(summary.sipniPendingCount).toBe(1);
      expect(summary.recentInjectables.length).toBe(1);
      expect(summary.recentVaccinations.length).toBe(1);
    });
  });
});
