import { Database } from '../../database/connection';
import {
  MdfeDocument,
  MdfeNfeItem,
  CreateMdfeDraftInput,
  CloseMdfeInput,
  CancelMdfeInput,
  MdfeKpis,
  MdfeStatus,
} from './mdfe.types';

export class MdfeFiscalService {
  constructor(private db: Database) {}

  /**
   * 1. Criar Rascunho de MDF-e agrupando NF-es de transferência
   */
  async createMdfeDraft(input: CreateMdfeDraftInput): Promise<MdfeDocument> {
    const store = this.db.prepare('SELECT * FROM stores WHERE id = ?').get(input.store_id) as any;
    if (!store) {
      throw new Error('STORE_NOT_FOUND');
    }

    if (!input.uf_start || !input.uf_end || !input.driver_name || !input.driver_cpf || !input.vehicle_plate) {
      throw new Error('MISSING_REQUIRED_FIELDS');
    }

    if (!input.items || input.items.length === 0) {
      throw new Error('NO_ITEMS_PROVIDED');
    }

    const series = input.series || 1;
    const lastNumRow = this.db.prepare(`
      SELECT COALESCE(MAX(mdfe_number), 0) as max_num FROM mdfe_documents WHERE store_id = ? AND series = ?
    `).get(input.store_id, series) as any;
    const nextNumber = Number(lastNumRow?.max_num || 0) + 1;

    let totalCargoValue = 0;
    let totalWeight = 0;

    for (const item of input.items) {
      totalCargoValue += Number(item.cargo_value_brl || 0);
      totalWeight += Number(item.weight_kg || 0);
    }

    totalCargoValue = Number(totalCargoValue.toFixed(2));
    totalWeight = Number(totalWeight.toFixed(2));

    // Monta chave de 44 dígitos (Modelo 58): cUF(2) + AAMM(4) + CNPJ(14) + mod(58) + serie(3) + nro(9) + tpEmis(1) + cMDF(8) + cDV(1)
    const ufCode = store.state === 'SP' ? '35' : '33';
    const cleanCnpj = (store.cnpj || '00000000000000').replace(/\D/g, '').padStart(14, '0');
    const aamm = '2611';
    const mod = '58';
    const ser = String(series).padStart(3, '0');
    const nro = String(nextNumber).padStart(9, '0');
    const tpEmis = input.emission_type === 'CONTINGENCY' ? '2' : '1';
    const cMdf = '12345678';
    const dv = '9';
    const accessKey = `${ufCode}${aamm}${cleanCnpj}${mod}${ser}${nro}${tpEmis}${cMdf}${dv}`;

    const ins = this.db.prepare(`
      INSERT INTO mdfe_documents (
        store_id, mdfe_number, series, access_key, emission_type,
        uf_start, uf_end, driver_name, driver_cpf, vehicle_plate,
        vehicle_rntrc, insurance_company_name, insurance_policy_number,
        total_nfe_count, total_cargo_value_brl, total_weight_kg,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT')
    `).run(
      input.store_id,
      nextNumber,
      series,
      accessKey,
      input.emission_type || 'NORMAL',
      input.uf_start,
      input.uf_end,
      input.driver_name,
      input.driver_cpf,
      input.vehicle_plate,
      input.vehicle_rntrc || null,
      input.insurance_company_name || null,
      input.insurance_policy_number || null,
      input.items.length,
      totalCargoValue,
      totalWeight
    );

    const mdfeId = Number(ins.lastInsertRowid);

    const insItemStmt = this.db.prepare(`
      INSERT INTO mdfe_nfe_items (
        mdfe_id, nfe_access_key, nfe_number, transfer_id, destination_store_id,
        cargo_value_brl, weight_kg
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of input.items) {
      insItemStmt.run(
        mdfeId,
        item.nfe_access_key,
        item.nfe_number || null,
        item.transfer_id || null,
        item.destination_store_id || null,
        Number(item.cargo_value_brl || 0),
        Number(item.weight_kg || 0)
      );
    }

    return this.db.prepare('SELECT * FROM mdfe_documents WHERE id = ?').get(mdfeId) as MdfeDocument;
  }

  /**
   * 2. Autorizar MDF-e junto à SEFAZ
   */
  async authorizeMdfe(mdfeId: number): Promise<MdfeDocument> {
    const mdfe = this.db.prepare('SELECT * FROM mdfe_documents WHERE id = ?').get(mdfeId) as MdfeDocument;
    if (!mdfe) {
      throw new Error('MDFE_NOT_FOUND');
    }
    if (mdfe.status !== 'DRAFT') {
      throw new Error('MDFE_ALREADY_PROCESSED');
    }

    const items = this.db.prepare('SELECT * FROM mdfe_nfe_items WHERE mdfe_id = ?').all(mdfeId) as MdfeNfeItem[];
    const protocol = `13526${Date.now()}`;

    // Monta XML e DAMDFE simplificados
    const xml = `<mdfeProc versao="3.00"><MDFe><infMDFe Id="MDFe${mdfe.access_key}"><ide><cUF>35</cUF><nMDF>${mdfe.mdfe_number}</nMDF><serie>${mdfe.series}</serie></ide><emit><CNPJ>12345678000199</CNPJ></emit><infModal><rodo><veicTracao><placa>${mdfe.vehicle_plate}</placa></veicTracao><condutor><CPF>${mdfe.driver_cpf}</CPF><xNome>${mdfe.driver_name}</xNome></condutor></rodo></infModal><tot><qNFe>${mdfe.total_nfe_count}</qNFe><vCarga>${mdfe.total_cargo_value_brl}</vCarga><qCarga>${mdfe.total_weight_kg}</qCarga></tot></infMDFe></MDFe><protMDFe><infProt><nProt>${protocol}</nProt><cStat>100</cStat><xMotivo>Autorizado o uso do MDF-e</xMotivo></infProt></protMDFe></mdfeProc>`;

    const damdfe = [
      '==============================================================',
      '     DAMDFE - DOCUMENTO AUXILIAR DE MANIFESTO FISCAL ELETRÔNICO',
      '                   MODELO 58 - SEFAZ / ANTT',
      '==============================================================',
      `MDF-e Nº: ${String(mdfe.mdfe_number).padStart(9, '0')}   SÉRIE: ${mdfe.series}   TIPO: ${mdfe.emission_type}`,
      `CHAVE DE ACESSO: ${mdfe.access_key}`,
      `PROTOCOLO AUTORIZAÇÃO: ${protocol} - 100 AUTORIZADO`,
      '--------------------------------------------------------------',
      `ORIGEM: ${mdfe.uf_start}  --->  DESTINO: ${mdfe.uf_end}`,
      `CONDUTOR: ${mdfe.driver_name} (CPF: ${mdfe.driver_cpf})`,
      `VEÍCULO PLACA: ${mdfe.vehicle_plate}  RNTRC: ${mdfe.vehicle_rntrc || 'ISENTO'}`,
      `SEGURADORA: ${mdfe.insurance_company_name || 'NÃO INFORMADA'} - APÓLICE: ${mdfe.insurance_policy_number || 'N/A'}`,
      '--------------------------------------------------------------',
      `DOCUMENTOS AGRUPADOS (${mdfe.total_nfe_count} NF-e):`,
      ...items.map((i, idx) => ` [${idx + 1}] NF-e: ${i.nfe_access_key} | R$ ${i.cargo_value_brl.toFixed(2)} | ${i.weight_kg.toFixed(2)} kg`),
      '--------------------------------------------------------------',
      `VALOR TOTAL DA CARGA: R$ ${mdfe.total_cargo_value_brl.toFixed(2)}`,
      `PESO BRUTO TOTAL:     ${mdfe.total_weight_kg.toFixed(2)} kg`,
      '==============================================================',
    ].join('\n');

    this.db.prepare(`
      UPDATE mdfe_documents
      SET status = 'AUTHORIZED',
          sefaz_status_code = '100',
          sefaz_protocol = ?,
          xml_content = ?,
          damdfe_content = ?
      WHERE id = ?
    `).run(protocol, xml, damdfe, mdfeId);

    return this.db.prepare('SELECT * FROM mdfe_documents WHERE id = ?').get(mdfeId) as MdfeDocument;
  }

  /**
   * 3. Encerrar MDF-e no destino
   */
  async closeMdfe(mdfeId: number, input?: CloseMdfeInput): Promise<MdfeDocument> {
    const mdfe = this.db.prepare('SELECT * FROM mdfe_documents WHERE id = ?').get(mdfeId) as MdfeDocument;
    if (!mdfe) {
      throw new Error('MDFE_NOT_FOUND');
    }
    if (mdfe.status !== 'AUTHORIZED') {
      throw new Error('MDFE_NOT_AUTHORIZED_FOR_CLOSURE');
    }

    const reason = input?.closure_reason || 'Descarregamento finalizado e recebimento confirmado na filial';

    this.db.prepare(`
      UPDATE mdfe_documents
      SET status = 'CLOSED',
          closure_reason = ?,
          closed_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(reason, mdfeId);

    return this.db.prepare('SELECT * FROM mdfe_documents WHERE id = ?').get(mdfeId) as MdfeDocument;
  }

  /**
   * 4. Cancelar MDF-e
   */
  async cancelMdfe(mdfeId: number, input: CancelMdfeInput): Promise<MdfeDocument> {
    const mdfe = this.db.prepare('SELECT * FROM mdfe_documents WHERE id = ?').get(mdfeId) as MdfeDocument;
    if (!mdfe) {
      throw new Error('MDFE_NOT_FOUND');
    }
    if (mdfe.status === 'CLOSED') {
      throw new Error('MDFE_ALREADY_CLOSED_CANNOT_CANCEL');
    }
    if (mdfe.status === 'CANCELLED') {
      throw new Error('MDFE_ALREADY_CANCELLED');
    }
    if (mdfe.status !== 'AUTHORIZED') {
      throw new Error('MDFE_CANNOT_BE_CANCELLED');
    }

    if (!input.justification || input.justification.trim().length < 15) {
      throw new Error('JUSTIFICATION_TOO_SHORT');
    }

    this.db.prepare(`
      UPDATE mdfe_documents
      SET status = 'CANCELLED',
          cancellation_reason = ?,
          cancelled_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(input.justification, mdfeId);

    return this.db.prepare('SELECT * FROM mdfe_documents WHERE id = ?').get(mdfeId) as MdfeDocument;
  }

  /**
   * 5. Obter DAMDFE formatado
   */
  async generateDamdfe(mdfeId: number): Promise<{ mdfe_id: number; access_key: string; damdfe_text: string }> {
    const mdfe = this.db.prepare('SELECT * FROM mdfe_documents WHERE id = ?').get(mdfeId) as MdfeDocument;
    if (!mdfe) {
      throw new Error('MDFE_NOT_FOUND');
    }
    if (mdfe.status === 'DRAFT') {
      throw new Error('MDFE_NOT_AUTHORIZED');
    }

    return {
      mdfe_id: mdfe.id,
      access_key: mdfe.access_key,
      damdfe_text: mdfe.damdfe_content || 'DAMDFE indisponível'
    };
  }

  /**
   * 6. Listar MDF-e com filtros
   */
  async listMdfes(filters?: { store_id?: number; status?: MdfeStatus }): Promise<MdfeDocument[]> {
    let sql = 'SELECT * FROM mdfe_documents WHERE 1=1';
    const params: any[] = [];

    if (filters?.store_id) {
      sql += ' AND store_id = ?';
      params.push(filters.store_id);
    }
    if (filters?.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }

    sql += ' ORDER BY id DESC';
    return this.db.prepare(sql).all(...params) as MdfeDocument[];
  }

  /**
   * 7. KPIs consolidados de MDF-e
   */
  async getMdfeKpis(storeId?: number): Promise<MdfeKpis> {
    const storeFilter = storeId ? 'WHERE store_id = ?' : '';
    const params = storeId ? [storeId] : [];

    const stats = this.db.prepare(`
      SELECT
        COUNT(*) as total_manifests,
        SUM(CASE WHEN status = 'AUTHORIZED' THEN 1 ELSE 0 END) as in_transit,
        SUM(CASE WHEN status = 'CLOSED' THEN 1 ELSE 0 END) as closed_count,
        SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled_count,
        COALESCE(SUM(CASE WHEN status IN ('AUTHORIZED', 'CLOSED') THEN total_cargo_value_brl ELSE 0 END), 0) as total_cargo,
        COALESCE(SUM(CASE WHEN status IN ('AUTHORIZED', 'CLOSED') THEN total_weight_kg ELSE 0 END), 0) as total_weight
      FROM mdfe_documents ${storeFilter}
    `).get(...params) as any;

    return {
      total_manifests: Number(stats?.total_manifests || 0),
      authorized_in_transit: Number(stats?.in_transit || 0),
      closed_count: Number(stats?.closed_count || 0),
      cancelled_count: Number(stats?.cancelled_count || 0),
      total_transported_cargo_brl: Number(stats?.total_cargo || 0),
      total_transported_weight_kg: Number(stats?.total_weight || 0)
    };
  }
}
