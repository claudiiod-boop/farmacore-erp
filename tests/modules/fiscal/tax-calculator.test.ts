import { describe, it, expect } from 'vitest';
import { calculateItemTax, calculateSaleTaxes } from '../../../src/modules/fiscal/tax-calculator';
import type { ProductFiscalData } from '../../../src/modules/fiscal/types';

describe('Pharmaceutical Tax Calculator', () => {
  const dipironaMed: ProductFiscalData = {
    ncm: '3004.90.99',
    cest: '13.001.00',
    cfop: '5405',
    csosnIcms: '500',
    cstPis: '04',
    cstCofins: '04',
    origin: 0,
  };

  const amoxicilinaMed: ProductFiscalData = {
    ncm: '3003.20.00',
    cest: '13.001.00',
    cfop: '5405',
    csosnIcms: '500',
    cstPis: '04',
    cstCofins: '04',
    origin: 0,
  };

  const shampooPerfumery: ProductFiscalData = {
    ncm: '3305.10.00',
    cest: '20.019.00',
    cfop: '5102',
    csosnIcms: '102',
    cstPis: '49',
    cstCofins: '49',
    origin: 0,
  };

  describe('Simples Nacional (CRT = 1)', () => {
    it('should calculate monofasic PIS/COFINS and ICMS-ST for medication (NCM 3004.90.99)', () => {
      // 2 units * R$ 10.00 = R$ 20.00
      const result = calculateItemTax(dipironaMed, 2, 10.0, 1);

      // PIS/COFINS Monofásico (Lei 10.147/2000): CST 04, base zero, alíquota zero
      expect(result.cstPis).toBe('04');
      expect(result.vBCPis).toBe(0.0);
      expect(result.pPis).toBe(0.0);
      expect(result.vPis).toBe(0.0);

      expect(result.cstCofins).toBe('04');
      expect(result.vBCCofins).toBe(0.0);
      expect(result.pCofins).toBe(0.0);
      expect(result.vCofins).toBe(0.0);

      // ICMS-ST Simples Nacional: CSOSN 500, CFOP 5405
      expect(result.csosn).toBe('500');
      expect(result.cfop).toBe('5405');
      expect(result.vBC).toBe(0.0);
      expect(result.pICMS).toBe(0.0);
      expect(result.vICMS).toBe(0.0);
      expect(result.vBCST).toBe(0.0);
      expect(result.vICMSST).toBe(0.0);

      // IBPT (Lei 12.741/2012): 33.45% of 20.00 = 6.69
      expect(result.vTotTrib).toBe(6.69);
    });

    it('should calculate regular convenience item taxes under Simples Nacional (NCM 3305.10.00)', () => {
      // 1 unit * R$ 50.00 = R$ 50.00
      const result = calculateItemTax(shampooPerfumery, 1, 50.0, 1);

      // PIS/COFINS: CST 49, zerados no Simples
      expect(result.cstPis).toBe('49');
      expect(result.vPis).toBe(0.0);
      expect(result.cstCofins).toBe('49');
      expect(result.vCofins).toBe(0.0);

      // ICMS Simples Nacional: CSOSN 102, CFOP 5102
      expect(result.csosn).toBe('102');
      expect(result.cfop).toBe('5102');
      expect(result.vICMS).toBe(0.0);

      // IBPT: 38.25% of 50.00 = 19.13
      expect(result.vTotTrib).toBe(19.13);
    });
  });

  describe('Regime Normal (CRT = 3)', () => {
    it('should calculate medication with CST 060 and monofasic PIS/COFINS (NCM 3003.20.00)', () => {
      // 1 unit * R$ 100.00 = R$ 100.00
      const result = calculateItemTax(amoxicilinaMed, 1, 100.0, 3);

      // CST 060 (ICMS cobrado anteriormente por ST)
      expect(result.csosn).toBe('060');
      expect(result.cfop).toBe('5405');
      expect(result.vICMS).toBe(0.0);

      // PIS/COFINS Monofásico continua CST 04
      expect(result.cstPis).toBe('04');
      expect(result.vPis).toBe(0.0);
      expect(result.cstCofins).toBe('04');
      expect(result.vCofins).toBe(0.0);

      // IBPT: 33.45% of 100.00 = 33.45
      expect(result.vTotTrib).toBe(33.45);
    });

    it('should calculate convenience item with full ICMS, PIS and COFINS under Regime Normal', () => {
      // 2 units * R$ 50.00 = R$ 100.00
      const result = calculateItemTax(shampooPerfumery, 2, 50.0, 3);

      // CST 000 (Tributada integralmente), CFOP 5102
      expect(result.csosn).toBe('000');
      expect(result.cfop).toBe('5102');
      expect(result.vBC).toBe(100.0);
      expect(result.pICMS).toBe(18.0);
      expect(result.vICMS).toBe(18.0);

      // PIS: CST 01, 1.65%
      expect(result.cstPis).toBe('01');
      expect(result.vBCPis).toBe(100.0);
      expect(result.pPis).toBe(1.65);
      expect(result.vPis).toBe(1.65);

      // COFINS: CST 01, 7.60%
      expect(result.cstCofins).toBe('01');
      expect(result.vBCCofins).toBe(100.0);
      expect(result.pCofins).toBe(7.6);
      expect(result.vCofins).toBe(7.6);

      // IBPT: 38.25% of 100.00 = 38.25
      expect(result.vTotTrib).toBe(38.25);
    });
  });

  describe('Sale Taxes Aggregator (calculateSaleTaxes)', () => {
    it('should aggregate taxes correctly for multi-item sale under Simples Nacional', () => {
      const items = [
        { product: dipironaMed, quantity: 2, unitPrice: 10.0 }, // vProd = 20.00, vTotTrib = 6.69
        { product: shampooPerfumery, quantity: 1, unitPrice: 50.0 }, // vProd = 50.00, vTotTrib = 19.13
      ];

      const saleTaxes = calculateSaleTaxes(items, 1);

      expect(saleTaxes.items).toHaveLength(2);
      expect(saleTaxes.vTotTrib).toBe(25.82); // 6.69 + 19.13
      expect(saleTaxes.vICMS).toBe(0.0);
      expect(saleTaxes.vICMSST).toBe(0.0);
      expect(saleTaxes.vPIS).toBe(0.0);
      expect(saleTaxes.vCOFINS).toBe(0.0);
    });

    it('should aggregate taxes correctly for multi-item sale under Regime Normal', () => {
      const items = [
        { product: dipironaMed, quantity: 1, unitPrice: 40.0 }, // Med: vTotTrib = 13.38, vICMS = 0, vPIS = 0, vCOF = 0
        { product: shampooPerfumery, quantity: 1, unitPrice: 100.0 }, // Perfumery: vTotTrib = 38.25, vICMS = 18.00, vPIS = 1.65, vCOF = 7.60
      ];

      const saleTaxes = calculateSaleTaxes(items, 3);

      expect(saleTaxes.items).toHaveLength(2);
      expect(saleTaxes.vTotTrib).toBe(51.63); // 13.38 + 38.25
      expect(saleTaxes.vICMS).toBe(18.0);
      expect(saleTaxes.vICMSST).toBe(0.0);
      expect(saleTaxes.vPIS).toBe(1.65);
      expect(saleTaxes.vCOFINS).toBe(7.6);
    });
  });
});
