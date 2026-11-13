import { createHash } from 'node:crypto';

export interface SngpcXmlEntryItem {
  invoiceNumber: string | number;
  issueDate: string; // YYYY-MM-DD
  supplierCnpj: string;
  msRegistration: string;
  batchNumber: string;
  quantity: number;
}

export interface SngpcXmlSaleItem {
  prescriptionType: string;
  notificationNumber: string;
  prescriptionDate: string; // YYYY-MM-DD
  doctorName: string;
  doctorCrm: string;
  doctorUf: string;
  patientName: string;
  buyerName: string;
  buyerCpf: string;
  buyerDocType?: string;
  msRegistration: string;
  batchNumber: string;
  quantity: number;
}

export interface SngpcXmlParams {
  cnpjEmissor: string;
  cpfTransmissor: string;
  startDate: string;
  endDate: string;
  entries: SngpcXmlEntryItem[];
  sales: SngpcXmlSaleItem[];
}

function escapeXml(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function cleanDigits(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).replace(/\D/g, '');
}

function mapPrescriptionType(type: string): string {
  const t = (type || '').trim().toUpperCase();
  if (/^[1-6]$/.test(t)) {
    return t;
  }
  if (t.includes('B2')) {
    return '4';
  }
  if (t.includes('B1') || t.includes('AZUL') || t.includes('B_')) {
    return '3';
  }
  if (t.includes('A1') || t.includes('A2') || t.includes('A3') || t.includes('AMARELA') || t.includes('A_')) {
    return '2';
  }
  if (t.includes('ESPECIAL') || t.includes('RETINOIDE') || t.includes('TALIDOMIDA')) {
    return '5';
  }
  // Default: Receita de Controle Especial em 2 vias (Branca, C1, C5, Antimicrobiano, etc.)
  return '1';
}

export function buildSngpcXml(params: SngpcXmlParams): { xml: string; hash: string } {
  const cnpjEmissor = cleanDigits(params.cnpjEmissor);
  const cpfTransmissor = cleanDigits(params.cpfTransmissor);

  let entriesXml = '';
  if (params.entries && params.entries.length > 0) {
    entriesXml = params.entries
      .map(
        (entry) => `
      <entradaMedicamentos>
        <notaFiscalEntradaMedicamento>
          <numeroNotaFiscal>${escapeXml(entry.invoiceNumber)}</numeroNotaFiscal>
          <tipoOperacaoNotaFiscal>1</tipoOperacaoNotaFiscal>
          <dataNotaFiscal>${escapeXml(entry.issueDate)}</dataNotaFiscal>
          <cnpjOrigem>${cleanDigits(entry.supplierCnpj)}</cnpjOrigem>
          <cnpjDestino>${cnpjEmissor}</cnpjDestino>
          <dadosMedicamento>
            <registroMSMedicamento>${cleanDigits(entry.msRegistration)}</registroMSMedicamento>
            <numeroLoteMedicamento>${escapeXml(entry.batchNumber)}</numeroLoteMedicamento>
            <quantidadeMedicamento>${entry.quantity}</quantidadeMedicamento>
            <unidadeMedidaMedicamento>1</unidadeMedidaMedicamento>
          </dadosMedicamento>
        </notaFiscalEntradaMedicamento>
      </entradaMedicamentos>`
      )
      .join('');
  }

  let salesXml = '';
  if (params.sales && params.sales.length > 0) {
    salesXml = params.sales
      .map(
        (sale) => `
      <saidaMedicamentoVendaAoConsumidor>
        <tipoReceituarioMedicamento>${mapPrescriptionType(sale.prescriptionType)}</tipoReceituarioMedicamento>
        <numeroNotificacaoReceita>${escapeXml(sale.notificationNumber)}</numeroNotificacaoReceita>
        <dataPrescricaoMedicamento>${escapeXml(sale.prescriptionDate)}</dataPrescricaoMedicamento>
        <prescritor>
          <nomePrescritor>${escapeXml(sale.doctorName)}</nomePrescritor>
          <numeroRegistroProfissional>${escapeXml(cleanDigits(sale.doctorCrm) || sale.doctorCrm.trim())}</numeroRegistroProfissional>
          <conselhoProfissional>CRM</conselhoProfissional>
          <ufConselhoProfissional>${escapeXml(sale.doctorUf)}</ufConselhoProfissional>
        </prescritor>
        <usoMedicamento>1</usoMedicamento>
        <comprador>
          <nomeComprador>${escapeXml(sale.buyerName || sale.patientName)}</nomeComprador>
          <tipoDocumento>${escapeXml(sale.buyerDocType || '1')}</tipoDocumento>
          <numeroDocumento>${escapeXml(cleanDigits(sale.buyerCpf))}</numeroDocumento>
          <orgaoExpedidor>SSP</orgaoExpedidor>
          <ufEmissaoDocumento>${escapeXml(sale.doctorUf || 'SP')}</ufEmissaoDocumento>
        </comprador>${
          sale.patientName
            ? `
        <paciente>
          <nome>${escapeXml(sale.patientName)}</nome>
        </paciente>`
            : ''
        }
        <medicamentoVenda>
          <registroMSMedicamento>${cleanDigits(sale.msRegistration)}</registroMSMedicamento>
          <numeroLoteMedicamento>${escapeXml(sale.batchNumber)}</numeroLoteMedicamento>
          <quantidadeMedicamento>${sale.quantity}</quantidadeMedicamento>
          <unidadeMedidaMedicamento>1</unidadeMedidaMedicamento>
        </medicamentoVenda>
      </saidaMedicamentoVendaAoConsumidor>`
      )
      .join('');
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mensagemSNGPC xmlns="urn:sngpc-schema">
  <cabecalho>
    <cnpjEmissor>${cnpjEmissor}</cnpjEmissor>
    <cpfTransmissor>${cpfTransmissor}</cpfTransmissor>
    <dataInicio>${escapeXml(params.startDate)}</dataInicio>
    <dataFim>${escapeXml(params.endDate)}</dataFim>
  </cabecalho>
  <corpo>
    <medicamentos>${entriesXml}${salesXml}
    </medicamentos>
  </corpo>
</mensagemSNGPC>`;

  const hash = createHash('sha1').update(xml, 'utf-8').digest('hex');

  return { xml, hash };
}
