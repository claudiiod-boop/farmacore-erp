import { describe, it, expect } from 'vitest';
import {
  formatExpiryAuditSlip,
  formatRecallPatientReport,
  formatDisposalLaudoSlip,
  type ExpiryAuditSlipData,
  type RecallPatientReportData,
  type DisposalLaudoData,
} from '../../../src/modules/sanitary/sanitary-receipt-formatter';

describe('SanitaryReceiptFormatter - Formatadores Térmicos ESC/POS (48 colunas)', () => {
  it('should format Expiry Audit Slip with headers, audit checkboxes and totals', () => {
    const data: ExpiryAuditSlipData = {
      store: {
        name: 'FarmaCore Drogaria Matriz',
        cnpj: '12.345.678/0001-90',
      },
      category: 'RISK_30_DAYS',
      printedAt: '2026-11-21 15:30:00',
      items: [
        {
          productName: 'Amoxicilina 500mg 21 caps',
          ean: '7891234567890',
          batchNumber: 'LOTE-AMO-01',
          expirationDate: '2026-12-10',
          daysRemaining: 19,
          quantity: 12,
          suggestedAction: 'PROMOTION',
        },
        {
          productName: 'Dipirona Gotas 20ml',
          ean: '7890001112223',
          batchNumber: 'LOTE-DIP-99',
          expirationDate: '2026-12-15',
          daysRemaining: 24,
          quantity: 25,
          suggestedAction: 'PROMOTION',
        },
      ],
    };

    const slip = formatExpiryAuditSlip(data);

    expect(slip).toContain('FarmaCore Drogaria Matriz');
    expect(slip).toContain('CONFERENCIA DE VALIDADES');
    expect(slip).toContain('Amoxicilina 500mg');
    expect(slip).toContain('LOTE-AMO-01');
    expect(slip).toContain('[ ]'); // Checkbox for physical auditor
    expect(slip).toContain('Total de Itens: 2');
    expect(slip).toContain('Assinatura do Conferente');
  });

  it('should format Recall Patient Report with resolution and patient contact list', () => {
    const data: RecallPatientReportData = {
      store: {
        name: 'FarmaCore Centro',
      },
      recall: {
        resolutionNumber: 'RE 1.234/2026',
        publicationDate: '2026-11-20',
        reason: 'Contaminação de lote por impureza elementar',
      },
      affectedPatients: [
        {
          customerName: 'Maria Silva',
          cpf: '123.456.789-00',
          phone: '(11) 98888-7777',
          saleId: 1042,
          saleDate: '2026-11-18 10:20',
          quantity: 2,
          hasPrescription: true,
          prescriptionDoctor: 'Dr. Roberto Santos (CRM 12345/SP)',
        },
      ],
    };

    const slip = formatRecallPatientReport(data);

    expect(slip).toContain('RECALL SANITARIO ANVISA');
    expect(slip).toContain('RE 1.234/2026');
    expect(slip).toContain('Maria Silva');
    expect(slip).toContain('(11) 98888-7777');
    expect(slip).toContain('Dr. Roberto Santos');
    expect(slip).toContain('URGENTE: Notificar o paciente');
  });

  it('should format Disposal Laudo Slip for VISA inspection with MTR and pharmacist signature', () => {
    const data: DisposalLaudoData = {
      store: {
        name: 'FarmaCore Filial Paulista',
        cnpj: '12.345.678/0002-71',
        address: 'Av. Paulista, 1500 - Bela Vista - São Paulo/SP',
      },
      loss: {
        lossNumber: 'PER-202611-0001',
        reason: 'EXPIRED',
        status: 'DISPOSED',
        totalCostAmount: 185.5,
        responsiblePharmacistName: 'Dra. Patricia Lima',
        pharmacistCrf: '67890',
        pharmacistCrfUf: 'SP',
        laudoNumber: 'LAUDO-VISA-2026/001',
        disposalCompanyName: 'EcoMed Soluções Ambientais Ltda',
        disposalCertificateNumber: 'CDF-2026-8877',
        mtrNumber: 'MTR-SP-2026-990011',
        disposedAt: '2026-11-21 16:00:00',
        items: [
          {
            productName: 'Ibuprofeno 600mg',
            batchNumber: 'LOTE-IBU-05',
            expirationDate: '2026-10-31',
            quantity: 10,
            unitCost: 18.55,
            totalCost: 185.5,
          },
        ],
      },
    };

    const slip = formatDisposalLaudoSlip(data);

    expect(slip).toContain('LAUDO OFICIAL DE DESCARTE SANITARIO');
    expect(slip).toContain('PER-202611-0001');
    expect(slip).toContain('Dra. Patricia Lima');
    expect(slip).toContain('CRF/SP 67890');
    expect(slip).toContain('EcoMed Soluções Ambientais');
    expect(slip).toContain('CDF-2026-8877');
    expect(slip).toContain('MTR-SP-2026-990011');
    expect(slip).toContain('RDC 306/2004');
    expect(slip).toContain('Assinatura e Carimbo do RT');
  });
});
