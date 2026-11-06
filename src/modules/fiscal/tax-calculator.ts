import type {
  CalculatedItemTax,
  CalculatedSaleTaxes,
  ProductFiscalData,
} from './types';

/**
 * Calculates item-level taxes for pharmaceutical and general drugstore retail items.
 *
 * Rules:
 * - PIS / COFINS (Lei 10.147/2000):
 *   - NCM starting with 3003 or 3004 (Medication): CST 04 (Monofásico - Alíquota Zero na Revenda)
 *   - Non-medication (perfumery, cosmetics, convenience):
 *     - Simples Nacional (CRT 1): CST 49, bases and taxes 0.00
 *     - Regime Normal (CRT 3): CST 01, PIS 1.65%, COFINS 7.60%
 *
 * - ICMS / ICMS-ST (Convênio ICMS 142/2018):
 *   - Simples Nacional (CRT 1):
 *     - Medication: CSOSN 500, CFOP 5405
 *     - Non-medication: CSOSN 102, CFOP 5102
 *   - Regime Normal (CRT 3):
 *     - Medication: CSOSN 060 (CST 60), CFOP 5405
 *     - Non-medication: CSOSN 000 (CST 00), CFOP 5102, ICMS 18.00%
 *
 * - IBPT Approximate Fiscal Transparency (Lei 12.741/2012):
 *   - Medication: 33.45% of vProd
 *   - Non-medication: 38.25% of vProd
 */
export function calculateItemTax(
  product: ProductFiscalData,
  quantity: number,
  unitPrice: number,
  crt: number,
): CalculatedItemTax {
  const vProd = Number((quantity * unitPrice).toFixed(2));
  const cleanNcm = (product.ncm || '').replace(/\D/g, '');
  const isMedication = cleanNcm.startsWith('3003') || cleanNcm.startsWith('3004');

  // 1. PIS / COFINS (Lei 10.147/2000)
  let cstPis: string;
  let vBCPis = 0.0;
  let pPis = 0.0;
  let vPis = 0.0;

  let cstCofins: string;
  let vBCCofins = 0.0;
  let pCofins = 0.0;
  let vCofins = 0.0;

  if (isMedication) {
    cstPis = '04';
    cstCofins = '04';
  } else {
    if (crt === 1) {
      cstPis = '49';
      cstCofins = '49';
    } else {
      // Regime Normal (CRT 3)
      cstPis = '01';
      vBCPis = vProd;
      pPis = 1.65;
      vPis = Number((vProd * 0.0165).toFixed(2));

      cstCofins = '01';
      vBCCofins = vProd;
      pCofins = 7.6;
      vCofins = Number((vProd * 0.076).toFixed(2));
    }
  }

  // 2. ICMS / ICMS-ST (Convênio ICMS 142/2018)
  let csosn: string;
  let cfop: string;
  let vBC = 0.0;
  let pICMS = 0.0;
  let vICMS = 0.0;
  const vBCST = 0.0;
  const pICMSST = 0.0;
  const vICMSST = 0.0;

  if (crt === 1) {
    // Simples Nacional
    if (isMedication) {
      csosn = '500';
      cfop = '5405';
    } else {
      csosn = '102';
      cfop = '5102';
    }
  } else {
    // Regime Normal (CRT 3)
    if (isMedication) {
      csosn = '060';
      cfop = '5405';
    } else {
      csosn = '000';
      cfop = '5102';
      vBC = vProd;
      pICMS = 18.0;
      vICMS = Number((vProd * 0.18).toFixed(2));
    }
  }

  // 3. IBPT (Lei 12.741/2012)
  const vTotTrib = isMedication
    ? Number((vProd * 0.3345).toFixed(2))
    : Number((vProd * 0.3825).toFixed(2));

  return {
    vBC,
    pICMS,
    vICMS,
    vBCST,
    pICMSST,
    vICMSST,
    csosn,
    cfop,
    cstPis,
    vBCPis,
    pPis,
    vPis,
    cstCofins,
    vBCCofins,
    pCofins,
    vCofins,
    vTotTrib,
  };
}

export type TaxInputItem =
  | { product: ProductFiscalData; quantity: number; unitPrice: number }
  | (ProductFiscalData & { quantity: number; unitPrice: number });

/**
 * Aggregates item-level taxes for an entire sale.
 */
export function calculateSaleTaxes(
  items: TaxInputItem[],
  crt: number,
): CalculatedSaleTaxes {
  const calculatedItems: CalculatedItemTax[] = [];
  let totalTotTrib = 0;
  let totalICMS = 0;
  let totalICMSST = 0;
  let totalPIS = 0;
  let totalCOFINS = 0;

  for (const item of items) {
    const product: ProductFiscalData =
      'product' in item && item.product ? item.product : (item as ProductFiscalData);
    const quantity = item.quantity;
    const unitPrice = item.unitPrice;

    const itemTax = calculateItemTax(product, quantity, unitPrice, crt);
    calculatedItems.push(itemTax);

    totalTotTrib += itemTax.vTotTrib;
    totalICMS += itemTax.vICMS;
    totalICMSST += itemTax.vICMSST;
    totalPIS += itemTax.vPis;
    totalCOFINS += itemTax.vCofins;
  }

  return {
    vTotTrib: Number(totalTotTrib.toFixed(2)),
    vICMS: Number(totalICMS.toFixed(2)),
    vICMSST: Number(totalICMSST.toFixed(2)),
    vPIS: Number(totalPIS.toFixed(2)),
    vCOFINS: Number(totalCOFINS.toFixed(2)),
    items: calculatedItems,
  };
}
