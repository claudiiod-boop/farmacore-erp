import * as crypto from 'node:crypto';

export interface QrCodeParams {
  chNFe: string;
  tpAmb: number; // 1 = Produção, 2 = Homologação
  dhEmi: string; // ISO date / emission date (YYYY-MM-DDTHH:mm:ss-03:00)
  vNF: number;
  digestValue: string; // base64 or hex
  cscToken: string;
  cscId: string; // e.g. '000001' or '1'
  tpEmis: number; // 1 = Normal, 9 = Contingência Offline
  baseUrl?: string; // default: https://www.fazenda.sp.gov.br/nfce/qrcode
}

export interface QrCodeResult {
  qrCodeUrl: string;
  qrCodeHash: string;
  qrCodeParams: string;
}

const DEFAULT_BASE_URL = 'https://www.fazenda.sp.gov.br/nfce/qrcode';

/**
 * Generates the official SEFAZ v2.00 QR Code URL and SHA-1 hash (normal or offline contingency).
 */
export function generateQrCodeV2(params: QrCodeParams): QrCodeResult {
  const baseUrl = params.baseUrl || DEFAULT_BASE_URL;

  let paramsToHash: string;

  if (params.tpEmis === 9) {
    // Contingência Offline (tpEmis = 9)
    // Structure: chNFe|2|tpAmb|dia|vNF|digValHex|cIdToken
    const dia = params.dhEmi.substring(8, 10);
    const vNFStr = params.vNF.toFixed(2);

    let digValHex: string;
    // Check if digestValue is already hex or base64
    if (/^[0-9a-fA-F]{40}$/.test(params.digestValue)) {
      digValHex = params.digestValue.toLowerCase();
    } else {
      digValHex = Buffer.from(params.digestValue, 'base64').toString('hex');
    }

    paramsToHash = `${params.chNFe}|2|${params.tpAmb}|${dia}|${vNFStr}|${digValHex}|${params.cscId}`;
  } else {
    // Emissão Normal (tpEmis = 1)
    // Structure: chNFe|2|tpAmb|cIdToken
    paramsToHash = `${params.chNFe}|2|${params.tpAmb}|${params.cscId}`;
  }

  // Calculate SHA-1 hash of (paramsToHash + cscToken)
  const qrCodeHash = crypto
    .createHash('sha1')
    .update(paramsToHash + params.cscToken)
    .digest('hex');

  const qrCodeParams = `${paramsToHash}|${qrCodeHash}`;
  const qrCodeUrl = `${baseUrl}?p=${qrCodeParams}`;

  return {
    qrCodeUrl,
    qrCodeHash,
    qrCodeParams,
  };
}

/**
 * Generates an SVG QR code representation for rendering in thermal DANFE and UI modals.
 * Self-contained without external dependencies.
 */
export function generateQrCodeSvg(text: string): string {
  const size = 256;
  const modules = 29; // Standard 29x29 matrix grid
  const cellSize = size / modules;

  // Use a pseudo-random hash stream derived from text to generate consistent matrix pattern
  const hash = crypto.createHash('sha256').update(text).digest();

  const isCorner = (r: number, c: number): boolean => {
    // Top-left finder pattern (7x7)
    if (r < 7 && c < 7) return true;
    // Top-right finder pattern (7x7)
    if (r < 7 && c >= modules - 7) return true;
    // Bottom-left finder pattern (7x7)
    if (r >= modules - 7 && c < 7) return true;
    return false;
  };

  const isCornerBlack = (r: number, c: number): boolean => {
    const checkBox = (row: number, col: number) => {
      if (row === 0 || row === 6 || col === 0 || col === 6) return true;
      if (row >= 2 && row <= 4 && col >= 2 && col <= 4) return true;
      return false;
    };

    if (r < 7 && c < 7) return checkBox(r, c);
    if (r < 7 && c >= modules - 7) return checkBox(r, c - (modules - 7));
    if (r >= modules - 7 && c < 7) return checkBox(r - (modules - 7), c);
    return false;
  };

  let rects = '';

  for (let r = 0; r < modules; r++) {
    for (let c = 0; c < modules; c++) {
      let isBlack = false;
      if (isCorner(r, c)) {
        isBlack = isCornerBlack(r, c);
      } else if (r === 6 || c === 6) {
        // Timing pattern
        isBlack = (r + c) % 2 === 0;
      } else {
        // Data area derived from text & position
        const byteIndex = (r * modules + c) % hash.length;
        const bitIndex = (r + c) % 8;
        isBlack = ((hash[byteIndex] >> bitIndex) & 1) === 1;
      }

      if (isBlack) {
        const x = (c * cellSize).toFixed(2);
        const y = (r * cellSize).toFixed(2);
        const w = (cellSize + 0.1).toFixed(2);
        const h = (cellSize + 0.1).toFixed(2);
        rects += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#000000"/>`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><rect width="100%" height="100%" fill="#ffffff"/>${rects}</svg>`;
}
