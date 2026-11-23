import { describe, it, expect } from 'vitest';
import { DsfFormatter } from '../../../src/modules/clinical/dsf-formatter';
import type { ClinicalAttendance } from '../../../src/modules/clinical/clinical.types';

describe('DsfFormatter (Declaração de Serviço Farmacêutico em 2 vias)', () => {
  it('should format patient and pharmacy copies with vital signs, TLR and injectable procedures', () => {
    const mockAttendance: ClinicalAttendance = {
      id: 1,
      attendanceCode: 'AT-2026-X1Y2',
      storeId: 1,
      pharmacistId: 10,
      patientName: 'Ana Beatriz Souza',
      patientCpf: '11122233344',
      patientBirthDate: '1990-05-12',
      patientPhone: '11988887777',
      bloodPressureSystolic: 120,
      bloodPressureDiastolic: 80,
      heartRate: 75,
      temperature: 36.5,
      oxygenSaturation: 99,
      anamnesisNotes: 'Paciente assintomática, realizando triagem glicêmica e aplicação de vitamina',
      status: 'COMPLETED',
      dsfNumber: 'DSF-1-2026-00042',
      totalAmount: 47.00,
      createdAt: '2026-11-23 15:30:00',
      completedAt: '2026-11-23 15:45:00',
      pharmacist: {
        storeId: 1,
        name: 'Dr. Lucas Farmacêutico',
        cpf: '99988877766',
        crfNumber: '12345',
        crfUf: 'SP'
      },
      procedures: [
        {
          procedureType: 'INJECTABLE',
          medicationName: 'Citoneurin 5000',
          medicationBatch: 'LOTE-CIT-01',
          applicationSite: 'GLUTEUS_D',
          prescriberName: 'Dr. Roberto Médico',
          prescriberCrm: 'CRM-SP 99999'
        }
      ],
      rapidTests: [
        {
          testType: 'GLUCOSE',
          reagentName: 'Accu-Chek Guide',
          reagentBatch: 'LOTE-GLU-99',
          reagentExpiration: '2028-12-31',
          reagentMsRegistration: '10287410055',
          resultValue: '92 mg/dL',
          resultInterpretation: 'NORMAL',
          referenceRange: 'Jejum: 70 a 99 mg/dL'
        }
      ]
    };

    const store = {
      name: 'Drogaria FarmaCore Matriz',
      cnpj: '12.345.678/0001-90',
      street: 'Av. Paulista',
      number: '1000',
      city: 'São Paulo',
      state: 'SP',
      phone: '(11) 3333-4444'
    };

    // 1ª Via: Paciente
    const slipPaciente = DsfFormatter.formatDsfSlip(mockAttendance, store, 'PACIENTE');
    expect(slipPaciente).toContain('DECLARACAO DE SERVICO FARMACEUTICO - DSF');
    expect(slipPaciente).toContain('*** 1a VIA: PACIENTE ***');
    expect(slipPaciente).toContain('NUMERO DSF:  DSF-1-2026-00042');
    expect(slipPaciente).toContain('Ana Beatriz Souza');
    expect(slipPaciente).toContain('Dr. Lucas Farmacêutico');
    expect(slipPaciente).toContain('CRF:  12345/SP');
    expect(slipPaciente).toContain('PRESSAO ARTERIAL: 120x80 mmHg');
    expect(slipPaciente).toContain('Citoneurin 5000');
    expect(slipPaciente).toContain('GLUTEUS_D');
    expect(slipPaciente).toContain('Accu-Chek Guide');
    expect(slipPaciente).toContain('RESULTADO:  92 mg/dL [NORMAL]');
    expect(slipPaciente).toContain('ALERTA SANITARIO OBRIGATORIO (RDC 777/2023)');

    // 2ª Via: Estabelecimento
    const slipEstabelecimento = DsfFormatter.formatDsfSlip(mockAttendance, store, 'ESTABELECIMENTO');
    expect(slipEstabelecimento).toContain('*** 2a VIA: ESTABELECIMENTO ***');
  });
});
