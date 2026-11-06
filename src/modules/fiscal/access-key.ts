import type { AccessKeyParams } from './types';

/**
 * Calculates the Modulo 11 check digit (cDV) for a 43-digit base access key.
 * Weights cycle from 2 to 9, right to left.
 * If remainder is 0 or 1, check digit is 0.
 * Otherwise, check digit is 11 - remainder.
 */
export function calculateModulo11(digits43: string): number {
  if (digits43.length !== 43 || !/^\d{43}$/.test(digits43)) {
    throw new Error(`Base key must be exactly 43 digits, received: ${digits43}`);
  }

  let sum = 0;
  let weight = 2;

  // From right to left (index 42 down to 0)
  for (let i = digits43.length - 1; i >= 0; i--) {
    const digit = Number(digits43[i]);
    sum += digit * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }

  const remainder = sum % 11;
  if (remainder === 0 || remainder === 1) {
    return 0;
  }
  return 11 - remainder;
}

/**
 * Generates a standard 44-digit NFC-e / NF-e SEFAZ Access Key.
 * Format: cUF(2) + AAMM(4) + CNPJ(14) + mod(2) + serie(3) + nNF(9) + tpEmis(1) + cNF(8) + cDV(1)
 */
export function generateAccessKey(params: AccessKeyParams): {
  accessKey: string;
  cDv: number;
  cNf: string;
  formattedKey: string;
} {
  const cUfStr = String(params.cUf).padStart(2, '0');
  const yearMonthStr = String(params.yearMonth).replace(/\D/g, '').padStart(4, '0');
  const cnpjClean = String(params.cnpj).replace(/\D/g, '');

  if (cnpjClean.length !== 14) {
    throw new Error(`CNPJ must be exactly 14 digits, received: ${params.cnpj}`);
  }

  const modStr = String(params.mod).padStart(2, '0');
  const serieStr = String(params.serie).padStart(3, '0');
  const nNfStr = String(params.nNF).padStart(9, '0');
  const tpEmisStr = String(params.tpEmis).padStart(1, '0');

  let cNfStr: string;
  if (params.cNF !== undefined && params.cNF !== null && String(params.cNF).trim() !== '') {
    cNfStr = String(params.cNF).replace(/\D/g, '').padStart(8, '0');
  } else {
    // Generate 8-digit random code
    cNfStr = String(Math.floor(Math.random() * 100000000)).padStart(8, '0');
  }

  const base43 = `${cUfStr}${yearMonthStr}${cnpjClean}${modStr}${serieStr}${nNfStr}${tpEmisStr}${cNfStr}`;

  if (base43.length !== 43 || !/^\d{43}$/.test(base43)) {
    throw new Error(`Generated base key is invalid: ${base43}`);
  }

  const cDv = calculateModulo11(base43);
  const accessKey = `${base43}${cDv}`;

  if (accessKey.length !== 44 || !/^\d{44}$/.test(accessKey)) {
    throw new Error(`Generated access key is invalid: ${accessKey}`);
  }

  const formattedKey = accessKey.match(/.{1,4}/g)?.join(' ') ?? accessKey;

  return {
    accessKey,
    cDv,
    cNf: cNfStr,
    formattedKey,
  };
}

/**
 * Validates a 44-digit SEFAZ Access Key by checking its length, format, and Modulo 11 check digit.
 */
export function validateAccessKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  const cleanKey = key.replace(/\s+/g, '');
  if (!/^\d{44}$/.test(cleanKey)) return false;

  const base43 = cleanKey.substring(0, 43);
  const actualDv = Number(cleanKey[43]);

  try {
    const expectedDv = calculateModulo11(base43);
    return expectedDv === actualDv;
  } catch {
    return false;
  }
}
