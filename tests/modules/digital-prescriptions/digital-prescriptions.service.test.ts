import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { DigitalPrescriptionService } from '../../../src/modules/digital-prescriptions/digital-prescriptions.service';

describe('DigitalPrescriptionService (Validador ICP-Brasil & Invalidação de Reuso)', () => {
  let db: Database;
  let service: DigitalPrescriptionService;
  let storeId: number;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new DigitalPrescriptionService(db);

    const store = db.prepare('SELECT id FROM stores LIMIT 1').get() as { id: number };
    storeId = store.id;
  });

  afterEach(() => {
    db.close();
  });

  it('registerPrescription cadastra receita digital com itens prescritos', () => {
    const presc = service.registerPrescription({
      prescriptionCode: 'MEM-2026-ABCD',
      prescriberName: 'Dr. Fernando Dias',
      prescriberCrm: '12345',
      prescriberUf: 'SP',
      patientName: 'Mariana Silva',
      patientCpf: '111.222.333-44',
      prescriptionType: 'CONTROLLED_C1',
      items: [
        {
          medicationName: 'Sertralina 50mg',
          dosage: '50mg',
          quantityPrescribed: 2,
          instructions: '1 comprimido pela manhã',
        },
      ],
    });

    expect(presc.id).toBeDefined();
    expect(presc.prescription_code).toBe('MEM-2026-ABCD');
    expect(presc.status).toBe('VALID');
    expect(presc.icp_signature_valid).toBe(true);
    expect(presc.items?.length).toBe(1);
    expect(presc.items![0].medication_name).toBe('Sertralina 50mg');
  });

  it('validatePrescription aprova receita autêntica e dentro do prazo', () => {
    service.registerPrescription({
      prescriptionCode: 'CFM-9988-VALID',
      prescriberName: 'Dra. Camila Rocha',
      prescriberCrm: '54321',
      prescriberUf: 'RJ',
      patientName: 'Lucas Oliveira',
      prescriptionType: 'ANTIMICROBIAL',
      items: [
        {
          medicationName: 'Amoxicilina 500mg',
          quantityPrescribed: 1,
        },
      ],
    });

    const res = service.validatePrescription('CFM-9988-VALID');
    expect(res.isValid).toBe(true);
    expect(res.canDispense).toBe(true);
    expect(res.status).toBe('VALID');
    expect(res.message).toContain('autêntica ICP-Brasil');
  });

  it('validatePrescription bloqueia dispensação se assinatura ICP-Brasil for inválida', () => {
    service.registerPrescription({
      prescriptionCode: 'FRAUD-001',
      prescriberName: 'Médico Falso',
      prescriberCrm: '0000',
      prescriberUf: 'SP',
      patientName: 'Vítima',
      prescriptionType: 'CONTROLLED_B1',
      icpSignatureValid: false, // Assinatura corrompida ou certificado revogado
      items: [
        {
          medicationName: 'Diazepam 10mg',
          quantityPrescribed: 2,
        },
      ],
    });

    const res = service.validatePrescription('FRAUD-001');
    expect(res.isValid).toBe(false);
    expect(res.canDispense).toBe(false);
    expect(res.message).toContain('inválida ou certificado do médico revogado');
  });

  it('validatePrescription bloqueia receita com prazo de validade expirado', () => {
    service.registerPrescription({
      prescriptionCode: 'MEM-EXP-01',
      prescriberName: 'Dr. Santos',
      prescriberCrm: '9999',
      prescriberUf: 'MG',
      patientName: 'Ana Souza',
      prescriptionType: 'ANTIMICROBIAL',
      expiresInDays: -5, // Já vencida há 5 dias
      items: [
        {
          medicationName: 'Azitromicina 500mg',
          quantityPrescribed: 1,
        },
      ],
    });

    const res = service.validatePrescription('MEM-EXP-01');
    expect(res.canDispense).toBe(false);
    expect(res.status).toBe('EXPIRED');
    expect(res.message).toContain('Receita digital vencida');
  });

  it('dispensePrescription realiza a baixa da receita e bloqueia reuso com carimbo digital', () => {
    service.registerPrescription({
      prescriptionCode: 'MEM-DISP-01',
      prescriberName: 'Dra. Beatriz',
      prescriberCrm: '7788',
      prescriberUf: 'SP',
      patientName: 'Paulo Roberto',
      prescriptionType: 'CONTROLLED_C1',
      items: [
        {
          medicationName: 'Pregabalina 75mg',
          quantityPrescribed: 2,
        },
      ],
    });

    // 1. Primeira dispensação com sucesso
    const dispensed = service.dispensePrescription('MEM-DISP-01', {
      storeId,
      pharmacistName: 'Dr. Lucas Farmacêutico RT',
      pharmacistCrf: 'CRF-SP 98765',
    });

    expect(dispensed.status).toBe('DISPENSED');
    expect(dispensed.dispensed_pharmacist_crf).toBe('CRF-SP 98765');
    expect(dispensed.dispensed_at).toBeDefined();
    expect(dispensed.items![0].quantity_dispensed).toBe(2);

    // 2. Segunda tentativa de dispensação da mesma receita deve ser sumariamente bloqueada
    expect(() => {
      service.dispensePrescription('MEM-DISP-01', {
        storeId,
        pharmacistName: 'Outro Farmacêutico',
        pharmacistCrf: 'CRF-RJ 11223',
      });
    }).toThrow(/Receita já dispensada/i);

    // 3. Validação subsequente aponta bloqueio por reuso
    const checkAgain = service.validatePrescription('MEM-DISP-01');
    expect(checkAgain.canDispense).toBe(false);
    expect(checkAgain.status).toBe('DISPENSED');
    expect(checkAgain.message).toContain('Reutilização bloqueada');
  });

  it('dispensePrescription exige o CRF obrigatório do farmacêutico dispensador', () => {
    service.registerPrescription({
      prescriptionCode: 'MEM-NOCRF-01',
      prescriberName: 'Dr. Alberto',
      prescriberCrm: '4455',
      prescriberUf: 'PR',
      patientName: 'Julia Martins',
      prescriptionType: 'REGULAR',
      items: [
        {
          medicationName: 'Losartana 50mg',
          quantityPrescribed: 1,
        },
      ],
    });

    expect(() => {
      service.dispensePrescription('MEM-NOCRF-01', {
        storeId,
        pharmacistName: 'Atendente Sem CRF',
        pharmacistCrf: '',
      });
    }).toThrow(/CRF do Farmacêutico dispensador é obrigatório/i);
  });
});
