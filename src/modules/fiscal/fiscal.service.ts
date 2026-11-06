import type { Database } from '../../database/connection';
import { generateAccessKey } from './access-key';
import { formatDanfeNfce, NfceInvoiceDetails } from './danfe-formatter';
import { generateQrCodeV2 } from './qrcode-generator';
import { signXml } from './signer';
import { calculateSaleTaxes, TaxInputItem } from './tax-calculator';
import type {
  CancellationResult,
  NfceTransmissionProvider,
} from './transmission/provider.interface';
import { SefazMockProvider } from './transmission/sefaz-mock.provider';
import type {
  FiscalProfile,
  NfceInvoice,
  NfceInvoiceStatus,
} from './types';
import { buildNfceXml, NfceItemInput, NfcePaymentInput } from './xml-builder';

export type NfceCancellationResult = CancellationResult;

interface FiscalProfileRow {
  id: number;
  cnpj: string;
  ie: string;
  razao_social: string;
  nome_fantasia: string;
  crt: number;
  c_uf: number;
  municipio: string;
  c_mun: number;
  logradouro: string;
  numero: string;
  bairro: string;
  cep: string;
  serie: number;
  next_nnf: number;
  csc_token: string;
  csc_id: string;
  environment: 'HOMOLOGACAO' | 'PRODUCAO' | 'SIMULADOR';
  cert_pfx_base64: string | null;
  cert_password: string | null;
  updated_at: string;
}

interface NfceInvoiceRow {
  id: number;
  sale_id: number;
  ch_nfe: string;
  n_nf: number;
  serie: number;
  tp_amb: number;
  tp_emis: number;
  status: NfceInvoiceStatus;
  protocol_number: string | null;
  protocol_date: string | null;
  xml_signed: string;
  xml_authorized: string | null;
  qr_code_url: string;
  digest_value: string | null;
  c_stat: number | null;
  x_motivo: string | null;
  cancellation_reason: string | null;
  created_at: string;
}

function mapProfileRow(row: FiscalProfileRow): FiscalProfile {
  return {
    id: row.id,
    cnpj: row.cnpj,
    ie: row.ie,
    razaoSocial: row.razao_social,
    nomeFantasia: row.nome_fantasia,
    crt: row.crt,
    cUf: row.c_uf,
    municipio: row.municipio,
    cMun: row.c_mun,
    logradouro: row.logradouro,
    numero: row.numero,
    bairro: row.bairro,
    cep: row.cep,
    serie: row.serie,
    nextNnf: row.next_nnf,
    cscToken: row.csc_token,
    cscId: row.csc_id,
    environment: row.environment,
    certPfxBase64: row.cert_pfx_base64,
    certPassword: row.cert_password,
    updatedAt: row.updated_at,
  };
}

function mapInvoiceRow(row: NfceInvoiceRow): NfceInvoice {
  return {
    id: row.id,
    saleId: row.sale_id,
    chNFe: row.ch_nfe,
    nNF: row.n_nf,
    serie: row.serie,
    tpAmb: row.tp_amb,
    tpEmis: row.tp_emis,
    status: row.status,
    protocolNumber: row.protocol_number,
    protocolDate: row.protocol_date,
    xmlSigned: row.xml_signed,
    xmlAuthorized: row.xml_authorized,
    qrCodeUrl: row.qr_code_url,
    digestValue: row.digest_value,
    cStat: row.c_stat,
    xMotivo: row.x_motivo,
    cancellationReason: row.cancellation_reason,
    createdAt: row.created_at,
  };
}

export class FiscalService {
  constructor(
    private db: Database,
    private provider: NfceTransmissionProvider = new SefazMockProvider()
  ) {}

  getFiscalProfile(): FiscalProfile | null {
    const row = this.db
      .prepare<FiscalProfileRow>('SELECT * FROM fiscal_profiles LIMIT 1')
      .get();
    return row ? mapProfileRow(row) : null;
  }

  updateFiscalProfile(profile: Partial<FiscalProfile>): FiscalProfile {
    const existing = this.db
      .prepare<FiscalProfileRow>('SELECT * FROM fiscal_profiles LIMIT 1')
      .get();

    if (!existing) {
      this.db
        .prepare(
          `INSERT INTO fiscal_profiles (
            cnpj, ie, razao_social, nome_fantasia, crt, c_uf, municipio, c_mun,
            logradouro, numero, bairro, cep, serie, next_nnf, csc_token, csc_id,
            environment, cert_pfx_base64, cert_password
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          profile.cnpj ?? '00.000.000/0001-00',
          profile.ie ?? 'ISENTO',
          profile.razaoSocial ?? 'FARMACIA FARMACORE LTDA',
          profile.nomeFantasia ?? 'FARMACORE',
          profile.crt ?? 1,
          profile.cUf ?? 35,
          profile.municipio ?? 'São Paulo',
          profile.cMun ?? 3550308,
          profile.logradouro ?? 'Rua Principal',
          profile.numero ?? '100',
          profile.bairro ?? 'Centro',
          profile.cep ?? '01001-000',
          profile.serie ?? 1,
          profile.nextNnf ?? 1,
          profile.cscToken ?? 'TOKEN-DEFAULT-0001',
          profile.cscId ?? '000001',
          profile.environment ?? 'HOMOLOGACAO',
          profile.certPfxBase64 ?? null,
          profile.certPassword ?? null
        );
    } else {
      const merged: FiscalProfile = {
        ...mapProfileRow(existing),
        ...profile,
      };

      this.db
        .prepare(
          `UPDATE fiscal_profiles SET
            cnpj = ?,
            ie = ?,
            razao_social = ?,
            nome_fantasia = ?,
            crt = ?,
            c_uf = ?,
            municipio = ?,
            c_mun = ?,
            logradouro = ?,
            numero = ?,
            bairro = ?,
            cep = ?,
            serie = ?,
            next_nnf = ?,
            csc_token = ?,
            csc_id = ?,
            environment = ?,
            cert_pfx_base64 = ?,
            cert_password = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`
        )
        .run(
          merged.cnpj,
          merged.ie,
          merged.razaoSocial,
          merged.nomeFantasia,
          merged.crt,
          merged.cUf,
          merged.municipio,
          merged.cMun,
          merged.logradouro,
          merged.numero,
          merged.bairro,
          merged.cep,
          merged.serie,
          merged.nextNnf,
          merged.cscToken,
          merged.cscId,
          merged.environment,
          merged.certPfxBase64 ?? null,
          merged.certPassword ?? null,
          existing.id
        );
    }

    const updated = this.getFiscalProfile();
    if (!updated) {
      throw new Error('Failed to retrieve updated fiscal profile');
    }
    return updated;
  }

  async issueNfce(
    saleId: number,
    options?: { offlineContingency?: boolean }
  ): Promise<NfceInvoiceDetails> {
    const profile = this.getFiscalProfile();
    if (!profile) {
      throw new Error('FISCAL_PROFILE_NOT_CONFIGURED');
    }

    const saleRow = this.db
      .prepare<any>('SELECT * FROM sales WHERE id = ?')
      .get(saleId);
    if (!saleRow) {
      throw new Error('SALE_NOT_FOUND');
    }

    const existingInvoice = this.db
      .prepare<NfceInvoiceRow>('SELECT * FROM nfce_invoices WHERE sale_id = ?')
      .get(saleId);

    if (
      existingInvoice &&
      (existingInvoice.status === 'AUTORIZADA' ||
        existingInvoice.status === 'CONTINGENCIA')
    ) {
      throw new Error('NFCE_ALREADY_ISSUED');
    }

    // Customer CPF from pre_sales if exists
    let customerCpf: string | null = null;
    if (saleRow.pre_sale_id) {
      const psRow = this.db
        .prepare<any>('SELECT customer_cpf FROM pre_sales WHERE id = ?')
        .get(saleRow.pre_sale_id);
      if (psRow && psRow.customer_cpf) {
        customerCpf = psRow.customer_cpf;
      }
    }

    // Retrieve sale items with product and batch information
    const itemRows = this.db
      .prepare<any>(
        `SELECT
          si.id,
          si.product_id,
          p.name,
          p.ean,
          p.ncm,
          p.cest,
          p.cfop,
          p.csosn_icms,
          p.cst_pis,
          p.cst_cofins,
          p.origin,
          p.ms_registration,
          p.pmc,
          b.batch_number,
          b.expiration_date,
          si.quantity,
          si.unit_price,
          si.total_price
        FROM sale_items si
        JOIN products p ON p.id = si.product_id
        LEFT JOIN batches b ON b.id = si.batch_id
        WHERE si.sale_id = ?
        ORDER BY si.id ASC`
      )
      .all(saleId);

    const taxInputItems: TaxInputItem[] = itemRows.map((r) => ({
      product: {
        ncm: r.ncm || '30049099',
        cest: r.cest || '1300100',
        cfop: r.cfop || '5405',
        csosnIcms: r.csosn_icms || '500',
        cstPis: r.cst_pis || '04',
        cstCofins: r.cst_cofins || '04',
        origin: r.origin ?? 0,
      },
      quantity: r.quantity,
      unitPrice: r.unit_price,
    }));

    const taxes = calculateSaleTaxes(taxInputItems, profile.crt);

    // Retrieve payments
    const paymentRows = this.db
      .prepare<any>(
        'SELECT method, amount FROM sale_payments WHERE sale_id = ? ORDER BY id ASC'
      )
      .all(saleId);

    const payments: NfcePaymentInput[] = paymentRows.map((p) => ({
      method: p.method,
      amount: p.amount,
    }));

    // Atomically allocate next nNF and update profile
    const nNF = profile.nextNnf;
    const serie = profile.serie;
    this.db
      .prepare('UPDATE fiscal_profiles SET next_nnf = next_nnf + 1 WHERE id = ?')
      .run(profile.id);

    const now = new Date();
    // dhEmi in format YYYY-MM-DDTHH:mm:ss-03:00
    const pad = (n: number) => String(n).padStart(2, '0');
    const dhEmi = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
      now.getDate()
    )}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}-03:00`;

    const yearMonth = `${String(now.getFullYear()).substring(2)}${pad(
      now.getMonth() + 1
    )}`;
    const tpEmis = options?.offlineContingency ? 9 : 1;
    const tpAmb = profile.environment === 'PRODUCAO' ? 1 : 2;

    const accessKeyData = generateAccessKey({
      cUf: profile.cUf,
      yearMonth,
      cnpj: profile.cnpj,
      mod: 65,
      serie,
      nNF,
      tpEmis,
    });
    const accessKey = accessKeyData.accessKey;

    const xmlItems: NfceItemInput[] = itemRows.map((r, idx) => ({
      id: idx + 1,
      productId: r.product_id,
      name: r.name,
      ean: r.ean,
      ncm: r.ncm || '30049099',
      cest: r.cest || '1300100',
      cfop: r.cfop || '5405',
      quantity: r.quantity,
      unitPrice: r.unit_price,
      totalPrice: r.total_price,
      anvisaRegistration: r.ms_registration,
      pmc: r.pmc,
      batchNumber: r.batch_number,
      expirationDate: r.expiration_date,
      tax: taxes.items[idx],
    }));

    const rawXml = buildNfceXml({
      profile,
      accessKey,
      nNF,
      serie,
      dhEmi,
      tpEmis,
      tpAmb,
      items: xmlItems,
      payments,
      taxes,
      customerCpf,
      changeAmount: saleRow.change_amount,
    });

    const signResult = signXml(
      rawXml,
      profile.certPfxBase64,
      profile.certPassword
    );
    const xmlSigned = signResult.xmlSigned;
    const digestValue = signResult.digestValue;

    const qrResult = generateQrCodeV2({
      chNFe: accessKey,
      tpAmb,
      dhEmi,
      vNF: saleRow.total_amount,
      digestValue,
      cscToken: profile.cscToken,
      cscId: profile.cscId,
      tpEmis,
    });
    const qrCodeUrl = qrResult.qrCodeUrl;

    let status: NfceInvoiceStatus = 'AUTORIZADA';
    let protocolNumber: string | null = null;
    let protocolDate: string | null = null;
    let xmlAuthorized: string | null = null;
    let cStat: number | null = null;
    let xMotivo: string | null = null;

    if (options?.offlineContingency) {
      status = 'CONTINGENCIA';
    } else {
      const txResult = await this.provider.transmit(xmlSigned, tpAmb);
      if (txResult.success) {
        status = 'AUTORIZADA';
        protocolNumber = txResult.protocolNumber ?? null;
        protocolDate = txResult.protocolDate ?? new Date().toISOString();
        xmlAuthorized = txResult.xmlAuthorized ?? xmlSigned;
        cStat = txResult.cStat;
        xMotivo = txResult.xMotivo;
      } else {
        status = 'REJEITADA';
        cStat = txResult.cStat;
        xMotivo = txResult.xMotivo;
      }
    }

    const insertResult = this.db
      .prepare(
        `INSERT INTO nfce_invoices (
          sale_id, ch_nfe, n_nf, serie, tp_amb, tp_emis, status,
          protocol_number, protocol_date, xml_signed, xml_authorized,
          qr_code_url, digest_value, c_stat, x_motivo, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        saleId,
        accessKey,
        nNF,
        serie,
        tpAmb,
        tpEmis,
        status,
        protocolNumber,
        protocolDate,
        xmlSigned,
        xmlAuthorized,
        qrCodeUrl,
        digestValue,
        cStat,
        xMotivo,
        dhEmi
      );

    const invoice: NfceInvoice = {
      id: Number(insertResult.lastInsertRowid),
      saleId,
      chNFe: accessKey,
      nNF,
      serie,
      tpAmb,
      tpEmis,
      status,
      protocolNumber,
      protocolDate,
      xmlSigned,
      xmlAuthorized,
      qrCodeUrl,
      digestValue,
      cStat,
      xMotivo,
      cancellationReason: null,
      createdAt: dhEmi,
    };

    const details: NfceInvoiceDetails = {
      invoice,
      profile,
      items: itemRows.map((r) => ({
        name: r.name,
        ean: r.ean,
        quantity: r.quantity,
        unitPrice: r.unit_price,
        totalPrice: r.total_price,
      })),
      payments: paymentRows.map((p) => ({
        method: p.method,
        amount: p.amount,
      })),
      taxes,
      customerCpf,
      changeAmount: saleRow.change_amount,
    };

    details.danfeText = formatDanfeNfce(details);

    return details;
  }

  async cancelNfce(
    saleId: number,
    reason: string
  ): Promise<CancellationResult> {
    const trimmedReason = reason ? reason.trim() : '';
    if (trimmedReason.length < 15) {
      throw new Error('INVALID_CANCELLATION_REASON');
    }

    const invoiceRow = this.db
      .prepare<NfceInvoiceRow>('SELECT * FROM nfce_invoices WHERE sale_id = ?')
      .get(saleId);

    if (!invoiceRow || invoiceRow.status !== 'AUTORIZADA') {
      throw new Error('INVOICE_NOT_CANCELLABLE');
    }

    const cancelResult = await this.provider.cancel(
      invoiceRow.ch_nfe,
      invoiceRow.protocol_number || '',
      trimmedReason,
      invoiceRow.tp_amb
    );

    if (cancelResult.success) {
      this.db
        .prepare(
          `UPDATE nfce_invoices SET
            status = 'CANCELADA',
            cancellation_reason = ?
          WHERE id = ?`
        )
        .run(trimmedReason, invoiceRow.id);
    }

    return cancelResult;
  }

  getNfceBySaleId(saleId: number): NfceInvoiceDetails | null {
    const invoiceRow = this.db
      .prepare<NfceInvoiceRow>('SELECT * FROM nfce_invoices WHERE sale_id = ?')
      .get(saleId);

    if (!invoiceRow) {
      return null;
    }

    const profile = this.getFiscalProfile();
    if (!profile) {
      return null;
    }

    const saleRow = this.db
      .prepare<any>('SELECT * FROM sales WHERE id = ?')
      .get(saleId);

    let customerCpf: string | null = null;
    if (saleRow && saleRow.pre_sale_id) {
      const psRow = this.db
        .prepare<any>('SELECT customer_cpf FROM pre_sales WHERE id = ?')
        .get(saleRow.pre_sale_id);
      if (psRow && psRow.customer_cpf) {
        customerCpf = psRow.customer_cpf;
      }
    }

    const itemRows = this.db
      .prepare<any>(
        `SELECT
          si.id,
          si.product_id,
          p.name,
          p.ean,
          p.ncm,
          p.cest,
          p.cfop,
          p.csosn_icms,
          p.cst_pis,
          p.cst_cofins,
          p.origin,
          si.quantity,
          si.unit_price,
          si.total_price
        FROM sale_items si
        JOIN products p ON p.id = si.product_id
        WHERE si.sale_id = ?
        ORDER BY si.id ASC`
      )
      .all(saleId);

    const taxInputItems: TaxInputItem[] = itemRows.map((r) => ({
      product: {
        ncm: r.ncm || '30049099',
        cest: r.cest || '1300100',
        cfop: r.cfop || '5405',
        csosnIcms: r.csosn_icms || '500',
        cstPis: r.cst_pis || '04',
        cstCofins: r.cst_cofins || '04',
        origin: r.origin ?? 0,
      },
      quantity: r.quantity,
      unitPrice: r.unit_price,
    }));

    const taxes = calculateSaleTaxes(taxInputItems, profile.crt);

    const paymentRows = this.db
      .prepare<any>(
        'SELECT method, amount FROM sale_payments WHERE sale_id = ? ORDER BY id ASC'
      )
      .all(saleId);

    const invoice = mapInvoiceRow(invoiceRow);

    const details: NfceInvoiceDetails = {
      invoice,
      profile,
      items: itemRows.map((r) => ({
        name: r.name,
        ean: r.ean,
        quantity: r.quantity,
        unitPrice: r.unit_price,
        totalPrice: r.total_price,
      })),
      payments: paymentRows.map((p) => ({
        method: p.method,
        amount: p.amount,
      })),
      taxes,
      customerCpf,
      changeAmount: saleRow ? saleRow.change_amount : 0,
    };

    details.danfeText = formatDanfeNfce(details);

    return details;
  }
}
