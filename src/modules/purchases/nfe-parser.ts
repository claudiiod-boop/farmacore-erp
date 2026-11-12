import type { ParsedNfeInvoice, ParsedNfeItem } from './types';

export class NfeParseError extends Error {
  code: string;

  constructor(message: string, code = 'INVALID_NFE_XML') {
    super(message);
    this.name = 'NfeParseError';
    this.code = code;
  }
}

/**
 * Decodes XML standard entities to normal characters.
 */
function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim();
}

/**
 * Extracts inner content of the first matching XML tag, ignoring namespaces and attributes.
 */
function getTagContent(xml: string, tagName: string): string | null {
  const regex = new RegExp(`<(?:\\w+:)?${tagName}(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/(?:\\w+:)?${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Extracts all blocks matching an XML tag, ignoring namespaces and attributes.
 */
function getAllTagBlocks(xml: string, tagName: string): string[] {
  const regex = new RegExp(`<(?:\\w+:)?${tagName}(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/(?:\\w+:)?${tagName}>`, 'gi');
  const results: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    results.push(match[1]);
  }
  return results;
}

/**
 * Extracts an attribute value from a specific tag or opening tag string.
 */
function getAttributeValue(tagString: string, attrName: string): string | null {
  const regex = new RegExp(`\\b${attrName}\\s*=\\s*["']([^"']*)["']`, 'i');
  const match = tagString.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Normalizes SEFAZ date or datetime strings (e.g. "2023-10-25T14:30:00-03:00" or "2023-10-25")
 * into standard "YYYY-MM-DD" format.
 */
function normalizeDate(rawDate: string | null | undefined): string | null {
  if (!rawDate) return null;
  const match = rawDate.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

/**
 * Safely parses a float number or returns a fallback value.
 */
function parseNumber(rawVal: string | null | undefined, fallback = 0): number {
  if (!rawVal) return fallback;
  const num = parseFloat(rawVal.trim());
  return isNaN(num) ? fallback : num;
}

/**
 * Robust XML parser for Brazilian NF-e Model 55 (Layout SEFAZ 4.00) without external dependencies.
 *
 * Extracts invoice header, supplier info, financial totals, and item details
 * including pharmaceutical traceability (<med>) tags.
 */
export function parseNfeXml(xmlString: string): ParsedNfeInvoice {
  if (!xmlString || !xmlString.trim()) {
    throw new NfeParseError('XML da NF-e está vazio', 'INVALID_NFE_XML');
  }

  // Remove XML comments if any
  const cleanXml = xmlString.replace(/<!--[\s\S]*?-->/g, '');

  // Verify presence of <infNFe> tag and extract its opening tag to get Id attribute
  const infNFeMatch = cleanXml.match(/<(?:\w+:)?infNFe\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?infNFe>/i);
  if (!infNFeMatch) {
    throw new NfeParseError('Tag <infNFe> não encontrada no XML da NF-e', 'INVALID_NFE_XML');
  }

  const infNFeAttrs = infNFeMatch[1];
  const infNFeBody = infNFeMatch[2];

  // Extract access key from Id="NFe..."
  const rawId = getAttributeValue(infNFeAttrs, 'Id');
  if (!rawId) {
    throw new NfeParseError('Atributo Id não encontrado na tag <infNFe>', 'INVALID_NFE_XML');
  }

  const accessKey = rawId.replace(/^NFe/i, '').trim();
  if (!/^\d{44}$/.test(accessKey)) {
    throw new NfeParseError(
      `Chave de acesso da NF-e inválida (esperado 44 dígitos numéricos, obtido: "${accessKey}")`,
      'INVALID_NFE_XML'
    );
  }

  // 1. Tag <ide> (Identificação da NF-e)
  const ideBlock = getTagContent(infNFeBody, 'ide');
  if (!ideBlock) {
    throw new NfeParseError('Bloco <ide> não encontrado na NF-e', 'INVALID_NFE_XML');
  }

  const invoiceNumber = parseInt(getTagContent(ideBlock, 'nNF') || '0', 10);
  const invoiceSeries = parseInt(getTagContent(ideBlock, 'serie') || '0', 10);
  const rawIssueDate = getTagContent(ideBlock, 'dhEmi') || getTagContent(ideBlock, 'dEmi');
  const issueDate = normalizeDate(rawIssueDate);

  if (!invoiceNumber || !issueDate) {
    throw new NfeParseError('Dados de identificação obrigatórios da NF-e ausentes (nNF ou data de emissão)', 'INVALID_NFE_XML');
  }

  // 2. Tag <emit> (Emitente / Distribuidora)
  const emitBlock = getTagContent(infNFeBody, 'emit');
  if (!emitBlock) {
    throw new NfeParseError('Bloco <emit> não encontrado na NF-e', 'INVALID_NFE_XML');
  }

  const supplierCnpj = (getTagContent(emitBlock, 'CNPJ') || getTagContent(emitBlock, 'CPF') || '').trim();
  const rawSupplierName = getTagContent(emitBlock, 'xNome') || '';
  const supplierName = decodeXmlEntities(rawSupplierName);
  const rawIe = getTagContent(emitBlock, 'IE');
  const supplierIe = rawIe && rawIe.trim() !== '' ? rawIe.trim() : null;

  if (!supplierCnpj || !supplierName) {
    throw new NfeParseError('Dados obrigatórios do emitente ausentes (CNPJ ou Razão Social)', 'INVALID_NFE_XML');
  }

  // 3. Tag <total> -> <ICMSTot> (Totais Financeiros)
  const totalBlock = getTagContent(infNFeBody, 'total');
  const icmsTotBlock = totalBlock ? getTagContent(totalBlock, 'ICMSTot') : null;

  const totalInvoiceAmount = parseNumber(icmsTotBlock ? getTagContent(icmsTotBlock, 'vNF') : null);
  const totalProductsAmount = parseNumber(icmsTotBlock ? getTagContent(icmsTotBlock, 'vProd') : null);
  const totalIcmsSt = parseNumber(icmsTotBlock ? getTagContent(icmsTotBlock, 'vST') : null);

  // 4. Tag <det> (Itens da NF-e)
  const detRegex = /<(?:\w+:)?det\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?det>/gi;
  const items: ParsedNfeItem[] = [];
  let detMatch: RegExpExecArray | null;
  let defaultItemIndex = 1;

  while ((detMatch = detRegex.exec(infNFeBody)) !== null) {
    const detAttrs = detMatch[1];
    const detContent = detMatch[2];
    const parsedNItem = parseInt(getAttributeValue(detAttrs, 'nItem') || `${defaultItemIndex}`, 10);
    const itemIndex = isNaN(parsedNItem) ? defaultItemIndex : parsedNItem;

    const prodBlock = getTagContent(detContent, 'prod');
    if (!prodBlock) {
      continue;
    }

    const supplierProductCode = decodeXmlEntities(getTagContent(prodBlock, 'cProd') || '');
    const rawEan = getTagContent(prodBlock, 'cEAN') || '';
    const ean = rawEan.trim() === 'SEM GTIN' ? '' : rawEan.trim();
    const productName = decodeXmlEntities(getTagContent(prodBlock, 'xProd') || '');
    const ncm = (getTagContent(prodBlock, 'NCM') || '').trim();
    const cfop = (getTagContent(prodBlock, 'CFOP') || '').trim();
    const baseQuantity = parseNumber(getTagContent(prodBlock, 'qCom'));
    const unitCost = parseNumber(getTagContent(prodBlock, 'vUnCom'));
    const baseTotalCost = parseNumber(getTagContent(prodBlock, 'vProd'));

    // Check for pharmaceutical <med> block(s)
    const medBlocks = getAllTagBlocks(detContent, 'med');

    if (medBlocks.length === 0) {
      // Common item (cosmetics, hygiene, non-pharma)
      items.push({
        itemIndex,
        supplierProductCode,
        ean,
        productName,
        ncm,
        cfop,
        quantity: baseQuantity,
        unitCost,
        totalCost: baseTotalCost,
        batchNumber: null,
        expirationDate: null,
        manufacturingDate: null,
        anvisaRegistration: null,
        pmc: null,
      });
    } else if (medBlocks.length === 1) {
      // Single batch
      const med = medBlocks[0];
      const batchNumber = getTagContent(med, 'nLote') || null;
      const rawQLote = getTagContent(med, 'qLote');
      const quantity = rawQLote ? parseNumber(rawQLote, baseQuantity) : baseQuantity;
      const manufacturingDate = normalizeDate(getTagContent(med, 'dFab'));
      const expirationDate = normalizeDate(getTagContent(med, 'dVal'));
      const anvisaRegistration = getTagContent(med, 'cProdANVISA') || null;
      const rawPmc = getTagContent(med, 'vPMC');
      const pmc = rawPmc ? parseNumber(rawPmc, 0) : null;

      items.push({
        itemIndex,
        supplierProductCode,
        ean,
        productName,
        ncm,
        cfop,
        quantity,
        unitCost,
        totalCost: baseTotalCost,
        batchNumber,
        expirationDate,
        manufacturingDate,
        anvisaRegistration,
        pmc,
      });
    } else {
      // Multiple batches for the same item (<det>)
      // Split into individual ParsedNfeItem entries with proportional quantity and cost
      for (let mIdx = 0; mIdx < medBlocks.length; mIdx++) {
        const med = medBlocks[mIdx];
        const batchNumber = getTagContent(med, 'nLote') || null;
        const rawQLote = getTagContent(med, 'qLote');
        const quantity = rawQLote ? parseNumber(rawQLote, baseQuantity / medBlocks.length) : baseQuantity / medBlocks.length;
        const batchTotalCost = parseFloat((quantity * unitCost).toFixed(2));
        const manufacturingDate = normalizeDate(getTagContent(med, 'dFab'));
        const expirationDate = normalizeDate(getTagContent(med, 'dVal'));
        const anvisaRegistration = getTagContent(med, 'cProdANVISA') || null;
        const rawPmc = getTagContent(med, 'vPMC');
        const pmc = rawPmc ? parseNumber(rawPmc, 0) : null;

        items.push({
          itemIndex,
          supplierProductCode,
          ean,
          productName,
          ncm,
          cfop,
          quantity,
          unitCost,
          totalCost: batchTotalCost,
          batchNumber,
          expirationDate,
          manufacturingDate,
          anvisaRegistration,
          pmc,
        });
      }
    }

    defaultItemIndex++;
  }

  return {
    accessKey,
    invoiceNumber,
    invoiceSeries,
    issueDate,
    supplierCnpj,
    supplierName,
    supplierIe,
    totalInvoiceAmount,
    totalProductsAmount,
    totalIcmsSt,
    items,
  };
}
