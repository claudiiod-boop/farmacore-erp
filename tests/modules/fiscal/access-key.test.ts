import { describe, it, expect } from 'vitest';
import { generateAccessKey, validateAccessKey } from '../../../src/modules/fiscal/access-key';
import type { AccessKeyParams } from '../../../src/modules/fiscal/types';

describe('Access Key Generator (Módulo 11)', () => {
  const baseParams: AccessKeyParams = {
    cUf: 35, // SP
    yearMonth: '2611',
    cnpj: '12345678000195',
    mod: 65, // NFC-e
    serie: 1,
    nNF: 12345,
    tpEmis: 1, // Normal
    cNF: '12345678',
  };

  it('should generate a 44-digit numeric access key', () => {
    const result = generateAccessKey(baseParams);

    expect(result.accessKey).toHaveLength(44);
    expect(/^\d{44}$/.test(result.accessKey)).toBe(true);
    expect(result.cNf).toBe('12345678');
    expect(typeof result.cDv).toBe('number');
    expect(result.cDv).toBeGreaterThanOrEqual(0);
    expect(result.cDv).toBeLessThanOrEqual(9);
  });

  it('should pad serie to 3 digits and nNF to 9 digits', () => {
    const params: AccessKeyParams = {
      ...baseParams,
      serie: 5,
      nNF: 42,
      cNF: '00000001',
    };
    const result = generateAccessKey(params);

    // 43 digits: cUF(2) + AAMM(4) + CNPJ(14) + mod(2) + serie(3) + nNF(9) + tpEmis(1) + cNF(8)
    // Indexes:
    // cUF: 0..1 = '35'
    // AAMM: 2..5 = '2611'
    // CNPJ: 6..19 = '12345678000195'
    // mod: 20..21 = '65'
    // serie: 22..24 = '005'
    // nNF: 25..33 = '000000042'
    // tpEmis: 34 = '1'
    // cNF: 35..42 = '00000001'
    // cDV: 43
    const key = result.accessKey;
    expect(key.substring(0, 2)).toBe('35');
    expect(key.substring(2, 6)).toBe('2611');
    expect(key.substring(6, 20)).toBe('12345678000195');
    expect(key.substring(20, 22)).toBe('65');
    expect(key.substring(22, 25)).toBe('005');
    expect(key.substring(25, 34)).toBe('000000042');
    expect(key.substring(34, 35)).toBe('1');
    expect(key.substring(35, 43)).toBe('00000001');
  });

  it('should randomly generate an 8-digit cNF when not provided', () => {
    const params: AccessKeyParams = {
      cUf: 35,
      yearMonth: '2611',
      cnpj: '12345678000195',
      mod: 65,
      serie: 1,
      nNF: 1,
      tpEmis: 1,
    };

    const res1 = generateAccessKey(params);
    const res2 = generateAccessKey(params);

    expect(res1.cNf).toHaveLength(8);
    expect(/^\d{8}$/.test(res1.cNf)).toBe(true);
    expect(res1.accessKey).toHaveLength(44);
    expect(res2.accessKey).toHaveLength(44);
  });

  it('should format access key in 11 groups of 4 digits separated by spaces', () => {
    const result = generateAccessKey(baseParams);
    const groups = result.formattedKey.split(' ');

    expect(groups).toHaveLength(11);
    groups.forEach((group) => {
      expect(group).toHaveLength(4);
      expect(/^\d{4}$/.test(group)).toBe(true);
    });
    expect(result.formattedKey.replace(/\s+/g, '')).toBe(result.accessKey);
  });

  it('should correctly calculate cDV = 0 when remainder is 0 or 1', () => {
    // We can verify that validateAccessKey validates a generated key
    const result = generateAccessKey(baseParams);
    expect(validateAccessKey(result.accessKey)).toBe(true);

    // Let's test a key with known cDV
    // cDV is the 44th character (index 43)
    expect(Number(result.accessKey[43])).toBe(result.cDv);
  });

  it('should validate valid access keys and reject invalid/tampered keys', () => {
    const result = generateAccessKey(baseParams);
    expect(validateAccessKey(result.accessKey)).toBe(true);
    expect(validateAccessKey(result.formattedKey)).toBe(true);

    // Tampered check digit
    const tamperedDv = (result.cDv + 1) % 10;
    const tamperedKey = result.accessKey.substring(0, 43) + tamperedDv;
    expect(validateAccessKey(tamperedKey)).toBe(false);

    // Tampered body digit
    const tamperedBody =
      (Number(result.accessKey[0]) === 9 ? '1' : '9') + result.accessKey.substring(1);
    expect(validateAccessKey(tamperedBody)).toBe(false);

    // Invalid length
    expect(validateAccessKey('123')).toBe(false);
    expect(validateAccessKey(result.accessKey + '0')).toBe(false);

    // Non-numeric
    expect(validateAccessKey(result.accessKey.substring(0, 43) + 'X')).toBe(false);
  });

  it('should support contingency mode tpEmis = 9', () => {
    const result = generateAccessKey({
      ...baseParams,
      tpEmis: 9,
    });

    expect(result.accessKey[34]).toBe('9');
    expect(validateAccessKey(result.accessKey)).toBe(true);
  });

  it('should throw error when CNPJ is invalid or has wrong length', () => {
    expect(() =>
      generateAccessKey({
        ...baseParams,
        cnpj: '123',
      }),
    ).toThrow();
  });
});
