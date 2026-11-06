import { describe, it, expect } from 'vitest';
import { generateQrCodeV2, generateQrCodeSvg } from '../../../src/modules/fiscal/qrcode-generator';
import type { QrCodeParams } from '../../../src/modules/fiscal/qrcode-generator';
import * as crypto from 'node:crypto';

describe('QR Code SEFAZ v2.00 Generator', () => {
  const baseParams: QrCodeParams = {
    chNFe: '35261112345678000195650010000001001123456780',
    tpAmb: 2, // Homologação
    dhEmi: '2026-11-06T15:30:00-03:00',
    vNF: 90.0,
    digestValue: 'y8rF3fL2d6n0q+gX7Z1oP4uY6A=',
    cscToken: 'ABCD1234EFGH5678',
    cscId: '000001',
    tpEmis: 1, // Normal
  };

  it('should generate official SEFAZ v2.00 QR code URL for normal emission (tpEmis = 1)', () => {
    const result = generateQrCodeV2(baseParams);

    const expectedToHash = `${baseParams.chNFe}|2|${baseParams.tpAmb}|${baseParams.cscId}`;
    const expectedHash = crypto
      .createHash('sha1')
      .update(expectedToHash + baseParams.cscToken)
      .digest('hex');

    expect(result.qrCodeHash).toBe(expectedHash);
    expect(result.qrCodeParams).toBe(`${expectedToHash}|${expectedHash}`);
    expect(result.qrCodeUrl).toBe(`https://www.fazenda.sp.gov.br/nfce/qrcode?p=${result.qrCodeParams}`);
  });

  it('should generate contingency offline QR code v2.00 (tpEmis = 9) with date, total and digest', () => {
    const offlineParams: QrCodeParams = {
      ...baseParams,
      tpEmis: 9,
    };

    const result = generateQrCodeV2(offlineParams);

    const dia = '06';
    const vNFStr = '90.00';
    const digValHex = Buffer.from(baseParams.digestValue, 'base64').toString('hex');
    const expectedToHash = `${baseParams.chNFe}|2|${baseParams.tpAmb}|${dia}|${vNFStr}|${digValHex}|${baseParams.cscId}`;
    const expectedHash = crypto
      .createHash('sha1')
      .update(expectedToHash + baseParams.cscToken)
      .digest('hex');

    expect(result.qrCodeHash).toBe(expectedHash);
    expect(result.qrCodeParams).toBe(`${expectedToHash}|${expectedHash}`);
    expect(result.qrCodeUrl).toBe(`https://www.fazenda.sp.gov.br/nfce/qrcode?p=${result.qrCodeParams}`);
  });

  it('should allow custom baseUrl if provided', () => {
    const customParams: QrCodeParams = {
      ...baseParams,
      baseUrl: 'https://nfce.fazenda.mg.gov.br/portal/qrcode',
    };

    const result = generateQrCodeV2(customParams);
    expect(result.qrCodeUrl.startsWith('https://nfce.fazenda.mg.gov.br/portal/qrcode?p=')).toBe(true);
  });

  it('should generate a valid SVG representation for QR Code rendering', () => {
    const url = 'https://www.fazenda.sp.gov.br/nfce/qrcode?p=TEST';
    const svg = generateQrCodeSvg(url);

    expect(typeof svg).toBe('string');
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });
});
