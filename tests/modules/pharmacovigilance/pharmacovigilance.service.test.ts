import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { PharmacovigilanceService } from '../../../src/modules/pharmacovigilance/pharmacovigilance.service';

describe('PharmacovigilanceService', () => {
  let db: Database;
  let service: PharmacovigilanceService;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new PharmacovigilanceService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('Adverse Drug Reactions (RAM)', () => {
    it('should record an ADR and generate sequential protocol', () => {
      const adr = service.recordAdr({
        storeId: 1,
        patientInitials: 'R.A.M.',
        patientAge: 52,
        patientGender: 'M',
        isPregnant: false,
        suspectedDrugName: 'Enalapril 20mg',
        suspectedDrugBatch: 'L-ENA-2026',
        suspectedDrugManufacturer: 'Medley',
        dailyDose: '1 comprimido pela manhã',
        treatmentStartDate: '2026-11-01',
        therapeuticIndication: 'Hipertensão Arterial',
        reactionDescription: 'Tosse seca persistente com piora noturna e desconforto laríngeo',
        reactionOnsetDate: '2026-11-15',
        severityLevel: 'MODERATE',
        dechallengeStatus: 'IMPROVED',
        rechallengeStatus: 'NOT_REEXPOSED',
        outcome: 'RECOVERED',
        notifierPharmacistName: 'Dr. Roberto Farmacêutico',
        notifierPharmacistCrf: 'CRF-SP 99881',
      });

      expect(adr.id).toBeGreaterThan(0);
      expect(adr.protocol_code).toMatch(/^RAM-\d{4}-0001$/);
      expect(adr.notivisa_submission_status).toBe('DRAFT');

      const byProto = service.getAdrByProtocol(adr.protocol_code);
      expect(byProto?.id).toBe(adr.id);
    });

    it('should list ADRs with severity level filter', () => {
      service.recordAdr({
        patientInitials: 'P.1',
        patientGender: 'F',
        suspectedDrugName: 'Med 1',
        suspectedDrugBatch: 'L1',
        dailyDose: '1x',
        treatmentStartDate: '2026-11-01',
        reactionDescription: 'Desc 1',
        reactionOnsetDate: '2026-11-10',
        severityLevel: 'SEVERE',
        seriousCriteria: 'HOSPITALIZATION',
        dechallengeStatus: 'IMPROVED',
        rechallengeStatus: 'NOT_REEXPOSED',
        outcome: 'RECOVERING',
        notifierPharmacistName: 'Farm',
        notifierPharmacistCrf: 'CRF',
      });

      service.recordAdr({
        patientInitials: 'P.2',
        patientGender: 'M',
        suspectedDrugName: 'Med 2',
        suspectedDrugBatch: 'L2',
        dailyDose: '2x',
        treatmentStartDate: '2026-11-01',
        reactionDescription: 'Desc 2',
        reactionOnsetDate: '2026-11-10',
        severityLevel: 'MILD',
        dechallengeStatus: 'UNKNOWN',
        rechallengeStatus: 'UNKNOWN',
        outcome: 'RECOVERED',
        notifierPharmacistName: 'Farm',
        notifierPharmacistCrf: 'CRF',
      });

      const severeList = service.listAdrs({ severityLevel: 'SEVERE' });
      expect(severeList.length).toBe(1);
      expect(severeList[0].patient_initials).toBe('P.1');
    });
  });

  describe('Technical Complaints (QT)', () => {
    it('should record a technical complaint and allow quarantine auto blocking', () => {
      const complaint = service.recordTechnicalComplaint({
        storeId: 1,
        productName: 'Amoxicilina Suspensão Oral 250mg/5mL',
        productEan: '7891234567890',
        batchNumber: 'L-AMOX-SUSP-99',
        manufacturer: 'EMS S/A',
        expirationDate: '2027-10-31',
        complaintType: 'PACKAGING_OR_SEAL_DEFECT',
        description: 'Frasco com lacre de segurança violado e tampa com rachadura externa',
        sampleAvailableForPickup: true,
        quarantineAutoBlocked: true,
        reporterType: 'CUSTOMER',
        reporterName: 'Carlos Consumidor',
        notifierPharmacistCrf: 'CRF-SP 99881',
      });

      expect(complaint.id).toBeGreaterThan(0);
      expect(complaint.protocol_code).toMatch(/^QT-\d{4}-0001$/);
      expect(complaint.quarantine_auto_blocked).toBe(1);

      const byProto = service.getTechnicalComplaintByProtocol(complaint.protocol_code);
      expect(byProto?.id).toBe(complaint.id);
    });
  });

  describe('NOTIVISA Integration & Summary', () => {
    it('should submit ADR and Complaint to NOTIVISA and generate official protocol', () => {
      const adr = service.recordAdr({
        patientInitials: 'A.B.C.',
        patientGender: 'M',
        suspectedDrugName: 'Med Teste',
        suspectedDrugBatch: 'L99',
        dailyDose: '1x',
        treatmentStartDate: '2026-11-01',
        reactionDescription: 'Urticária generalizada',
        reactionOnsetDate: '2026-11-02',
        severityLevel: 'MODERATE',
        dechallengeStatus: 'IMPROVED',
        rechallengeStatus: 'NOT_REEXPOSED',
        outcome: 'RECOVERED',
        notifierPharmacistName: 'Farm',
        notifierPharmacistCrf: 'CRF-123',
      });

      const submission = service.submitToNotivisa('RAM', adr.id);
      expect(submission.status).toBe('SUBMITTED');
      expect(submission.notivisaProtocol).toMatch(/^NOTIVISA-\d{4}-/);

      const updated = service.getAdrById(adr.id);
      expect(updated.notivisa_submission_status).toBe('SUBMITTED');
      expect(updated.notivisa_protocol).toBe(submission.notivisaProtocol);
    });

    it('should generate accurate summary metrics for dashboard', () => {
      service.recordAdr({
        patientInitials: 'X.Y.Z.',
        patientGender: 'F',
        suspectedDrugName: 'Med Grave',
        suspectedDrugBatch: 'L-SEV',
        dailyDose: '1x',
        treatmentStartDate: '2026-11-01',
        reactionDescription: 'Anafilaxia grave com broncoespasmo',
        reactionOnsetDate: '2026-11-05',
        severityLevel: 'SEVERE',
        seriousCriteria: 'LIFE_THREATENING',
        dechallengeStatus: 'IMPROVED',
        rechallengeStatus: 'NOT_REEXPOSED',
        outcome: 'RECOVERED',
        notifierPharmacistName: 'Farm',
        notifierPharmacistCrf: 'CRF-123',
      });

      service.recordTechnicalComplaint({
        productName: 'Soro Fisiológico 0.9%',
        batchNumber: 'L-SORO-1',
        manufacturer: 'Eurofarma',
        expirationDate: '2028-01-01',
        complaintType: 'FOREIGN_MATTER',
        description: 'Partículas escuras em suspensão',
        reporterType: 'EMPLOYEE',
        notifierPharmacistCrf: 'CRF-123',
      });

      const summary = service.getSummary(1);
      expect(summary.totalRams).toBeGreaterThanOrEqual(1);
      expect(summary.severeRams).toBeGreaterThanOrEqual(1);
      expect(summary.totalComplaints).toBeGreaterThanOrEqual(1);
      expect(summary.pendingSubmissionCount).toBeGreaterThanOrEqual(1);
    });
  });
});
