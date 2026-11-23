import { describe, it, expect } from 'vitest';
import { EdiFarmaService } from '../../../src/modules/b2b/edi-farma.service';
import type { EdiQuotationLine } from '../../../src/modules/b2b/b2b.types';

describe('EdiFarmaService (Layout Padrão Distribuidoras Farmacêuticas - Santa Cruz, Panpharma, Profarma)', () => {
  it('should generate standardized EDI Farma quotation file formatted for distributors', () => {
    const lines: EdiQuotationLine[] = [
      {
        ean: '7891234567890',
        description: 'Dipirona 500mg Gotas 20ml',
        quantityRequested: 30,
        targetPrice: 5.50
      },
      {
        ean: '7899876543210',
        description: 'Amoxicilina 500mg 21 caps',
        quantityRequested: 15,
        targetPrice: 18.00
      }
    ];

    const ediContent = EdiFarmaService.generateEdiQuotationFile({
      campaignCode: 'COT-2026-X1Y2',
      pharmacyCnpj: '12345678000190',
      pharmacyName: 'Drogaria FarmaCore Matriz',
      lines
    });

    expect(ediContent).toContain('HDR|COT-2026-X1Y2|12345678000190|Drogaria FarmaCore Matriz');
    expect(ediContent).toContain('ITM|7891234567890|Dipirona 500mg Gotas 20ml|30|5.50');
    expect(ediContent).toContain('ITM|7899876543210|Amoxicilina 500mg 21 caps|15|18.00');
    expect(ediContent).toContain('TRL|2|45');
  });

  it('should parse distributor response file with offered prices, discounts and stock', () => {
    const rawDistributorResponse = `
HDR|COT-2026-X1Y2|44555666000122|SANTA CRUZ DISTRIBUIDORA
ITM|7891234567890|4.90|5.0|30|1
ITM|7899876543210|17.20|0.0|15|1
TRL|2
    `.trim();

    const parsed = EdiFarmaService.parseEdiProposalResponse(rawDistributorResponse);

    expect(parsed.supplierCnpj).toBe('44555666000122');
    expect(parsed.items.length).toBe(2);
    expect(parsed.items[0]).toEqual({
      ean: '7891234567890',
      offeredPrice: 4.90,
      discountPercent: 5.0,
      availableQuantity: 30,
      stIcmsIncluded: true
    });
    expect(parsed.items[1].offeredPrice).toBe(17.20);
  });
});
