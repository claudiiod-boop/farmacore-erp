import { Database } from '../../database/connection';
import {
  PgrssDisposalRecord,
  SegregateWasteDTO,
  WasteRecordFilter,
  PgrssManifest,
  CreateMtrManifestDTO,
  FinalizeCdfDTO,
  PgrssKpis,
} from './pgrss.types';

export class PgrssDisposalService {
  constructor(private db: Database) {}

  /**
   * Segrega produto ou lote de medicamento para o abrigo de resíduos químicos / biológicos
   * Deduz do saldo vendável do lote e gera registro de custódia sanitária.
   */
  segregateWaste(input: SegregateWasteDTO): PgrssDisposalRecord {
    if (input.quantity <= 0) {
      throw new Error('Quantidade para descarte deve ser maior que zero.');
    }
    if (input.weight_kg <= 0) {
      throw new Error('Peso em kg deve ser maior que zero.');
    }

    const product = this.db.prepare('SELECT id, name FROM products WHERE id = ?').get(input.product_id) as
      | { id: number; name: string }
      | undefined;

    if (!product) {
      throw new Error(`Produto com ID ${input.product_id} não encontrado.`);
    }

    // Se lote informado, deduz do saldo vendável
    if (input.batch_id) {
      const batch = this.db.prepare('SELECT id, quantity, batch_number FROM batches WHERE id = ?').get(input.batch_id) as
        | { id: number; quantity: number; batch_number: string }
        | undefined;

      if (!batch) {
        throw new Error(`Lote com ID ${input.batch_id} não encontrado.`);
      }

      if (batch.quantity < input.quantity) {
        throw new Error(
          `Saldo insuficiente no lote ${batch.batch_number} (disponível: ${batch.quantity}, solicitado: ${input.quantity}).`
        );
      }

      this.db.prepare('UPDATE batches SET quantity = quantity - ? WHERE id = ?').run(input.quantity, input.batch_id);
    }

    const stmt = this.db.prepare(`
      INSERT INTO pgrss_disposal_records (
        store_id, product_id, batch_id, waste_group, reason, quantity, weight_kg,
        pharmacist_name, pharmacist_crf, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'STORED', ?)
    `);

    const result = stmt.run(
      input.store_id,
      input.product_id,
      input.batch_id || null,
      input.waste_group,
      input.reason,
      input.quantity,
      input.weight_kg,
      input.pharmacist_name.trim(),
      input.pharmacist_crf.trim().toUpperCase(),
      input.notes?.trim() || null
    );

    return this.getRecordById(Number(result.lastInsertRowid));
  }

  /**
   * Retorna registro de resíduo por ID com dados enriquecidos
   */
  getRecordById(id: number): PgrssDisposalRecord {
    const record = this.db.prepare(`
      SELECT 
        r.*,
        p.name as product_name,
        p.ean as product_ean,
        b.batch_number,
        s.name as store_name
      FROM pgrss_disposal_records r
      JOIN products p ON p.id = r.product_id
      LEFT JOIN batches b ON b.id = r.batch_id
      JOIN stores s ON s.id = r.store_id
      WHERE r.id = ?
    `).get(id) as PgrssDisposalRecord | undefined;

    if (!record) {
      throw new Error(`Registro de resíduo ${id} não encontrado.`);
    }

    return record;
  }

  /**
   * Lista resíduos segregados com filtros
   */
  listWasteRecords(filters?: WasteRecordFilter): PgrssDisposalRecord[] {
    let sql = `
      SELECT 
        r.*,
        p.name as product_name,
        p.ean as product_ean,
        b.batch_number,
        s.name as store_name
      FROM pgrss_disposal_records r
      JOIN products p ON p.id = r.product_id
      LEFT JOIN batches b ON b.id = r.batch_id
      JOIN stores s ON s.id = r.store_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters?.store_id) {
      sql += ' AND r.store_id = ?';
      params.push(filters.store_id);
    }
    if (filters?.status) {
      sql += ' AND r.status = ?';
      params.push(filters.status);
    }
    if (filters?.waste_group) {
      sql += ' AND r.waste_group = ?';
      params.push(filters.waste_group);
    }
    if (filters?.reason) {
      sql += ' AND r.reason = ?';
      params.push(filters.reason);
    }
    if (filters?.start_date) {
      sql += ' AND r.created_at >= ?';
      params.push(filters.start_date);
    }
    if (filters?.end_date) {
      sql += ' AND r.created_at <= ?';
      params.push(filters.end_date);
    }

    sql += ' ORDER BY r.created_at DESC, r.id DESC';
    return this.db.prepare(sql).all(...params) as PgrssDisposalRecord[];
  }

  /**
   * Emite Manifesto de Transporte de Resíduos (MTR) agrupando itens no abrigo
   */
  createMtrManifest(input: CreateMtrManifestDTO): PgrssManifest {
    if (!input.disposal_record_ids || input.disposal_record_ids.length === 0) {
      throw new Error('Selecione ao menos um resíduo para emitir o manifesto MTR.');
    }

    // Busca e valida cada item selecionado
    const placeholders = input.disposal_record_ids.map(() => '?').join(',');
    const records = this.db.prepare(`
      SELECT * FROM pgrss_disposal_records 
      WHERE id IN (${placeholders})
    `).all(...input.disposal_record_ids) as PgrssDisposalRecord[];

    if (records.length !== input.disposal_record_ids.length) {
      throw new Error('Um ou mais registros de resíduos não foram encontrados.');
    }

    for (const rec of records) {
      if (rec.status !== 'STORED') {
        throw new Error(
          `Resíduo ID ${rec.id} não está disponível para coleta (status atual: ${rec.status}).`
        );
      }
    }

    const totalWeight = Number(records.reduce((acc, curr) => acc + curr.weight_kg, 0).toFixed(3));
    const totalItems = records.length;

    // Gera número oficial MTR sequencial
    const dateStr = new Date().toISOString().substring(0, 10).replace(/-/g, '');
    const countRow = this.db.prepare("SELECT COUNT(*) as count FROM pgrss_manifests").get() as { count: number };
    const manifestNumber = `MTR-${dateStr}-${String(countRow.count + 1).padStart(4, '0')}`;
    const dispatchDate = input.dispatch_date || new Date().toISOString().substring(0, 10);

    const stmt = this.db.prepare(`
      INSERT INTO pgrss_manifests (
        store_id, manifest_number, collector_name, collector_cnpj, environmental_license,
        vehicle_plate, driver_name, total_weight_kg, total_items, dispatch_date, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DISPATCHED')
    `);

    const result = stmt.run(
      input.store_id,
      manifestNumber,
      input.collector_name.trim(),
      input.collector_cnpj.trim(),
      input.environmental_license.trim().toUpperCase(),
      input.vehicle_plate.trim().toUpperCase(),
      input.driver_name.trim(),
      totalWeight,
      totalItems,
      dispatchDate
    );

    const manifestId = Number(result.lastInsertRowid);

    // Insere vínculos e atualiza status dos itens
    const insertItemStmt = this.db.prepare(`
      INSERT INTO pgrss_manifest_items (manifest_id, disposal_record_id)
      VALUES (?, ?)
    `);

    const updateStatusStmt = this.db.prepare(`
      UPDATE pgrss_disposal_records
      SET status = 'DISPATCHED'
      WHERE id = ?
    `);

    for (const rec of records) {
      insertItemStmt.run(manifestId, rec.id);
      updateStatusStmt.run(rec.id);
    }

    return this.getManifestById(manifestId);
  }

  /**
   * Busca manifesto MTR com itens inclusos
   */
  getManifestById(id: number): PgrssManifest {
    const manifest = this.db.prepare(`
      SELECT m.*, s.name as store_name
      FROM pgrss_manifests m
      JOIN stores s ON s.id = m.store_id
      WHERE m.id = ?
    `).get(id) as PgrssManifest | undefined;

    if (!manifest) {
      throw new Error(`Manifesto MTR ${id} não encontrado.`);
    }

    const items = this.db.prepare(`
      SELECT 
        r.*,
        p.name as product_name,
        p.ean as product_ean,
        b.batch_number
      FROM pgrss_manifest_items mi
      JOIN pgrss_disposal_records r ON r.id = mi.disposal_record_id
      JOIN products p ON p.id = r.product_id
      LEFT JOIN batches b ON b.id = r.batch_id
      WHERE mi.manifest_id = ?
    `).all(id) as PgrssDisposalRecord[];

    return {
      ...manifest,
      items,
    };
  }

  /**
   * Lista manifestos MTR
   */
  listManifests(storeId?: number): PgrssManifest[] {
    let sql = `
      SELECT m.*, s.name as store_name
      FROM pgrss_manifests m
      JOIN stores s ON s.id = m.store_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (storeId) {
      sql += ' AND m.store_id = ?';
      params.push(storeId);
    }

    sql += ' ORDER BY m.dispatch_date DESC, m.id DESC';
    return this.db.prepare(sql).all(...params) as PgrssManifest[];
  }

  /**
   * Finaliza manifesto MTR com o Certificado de Destinação Final (CDF) de incineração
   */
  finalizeWithCdf(manifestId: number, input: FinalizeCdfDTO): PgrssManifest {
    const manifest = this.getManifestById(manifestId);

    if (manifest.status !== 'DISPATCHED') {
      throw new Error(`Manifesto ${manifest.manifest_number} já foi finalizado ou cancelado.`);
    }

    this.db.prepare(`
      UPDATE pgrss_manifests
      SET 
        status = 'DESTINED',
        cdf_number = ?,
        certificate_date = ?,
        incineration_plant = ?
      WHERE id = ?
    `).run(
      input.cdf_number.trim().toUpperCase(),
      input.certificate_date,
      input.incineration_plant.trim(),
      manifestId
    );

    // Atualiza status de todos os resíduos desse manifesto para INCINERATED
    this.db.prepare(`
      UPDATE pgrss_disposal_records
      SET status = 'INCINERATED'
      WHERE id IN (
        SELECT disposal_record_id FROM pgrss_manifest_items WHERE manifest_id = ?
      )
    `).run(manifestId);

    return this.getManifestById(manifestId);
  }

  /**
   * Gera espelho formatado do MTR (RDC 222/2018) para impressão
   */
  generateMtrDocument(manifestId: number): string {
    const manifest = this.getManifestById(manifestId);
    const store = this.db.prepare('SELECT * FROM stores WHERE id = ?').get(manifest.store_id) as any;

    let doc = '';
    doc += '================================================================================\n';
    doc += '        MANIFESTO DE TRANSPORTE DE RESÍDUOS (MTR) — RDC 222/2018 ANVISA        \n';
    doc += '================================================================================\n';
    doc += `NÚMERO DO MANIFESTO: ${manifest.manifest_number}\n`;
    doc += `DATA DE EXPEDIÇÃO:   ${manifest.dispatch_date}\n`;
    doc += `SITUAÇÃO ATUAL:      ${manifest.status === 'DESTINED' ? 'FINALIZADO (CDF EMITIDO)' : 'EM TRÂNSITO'}\n`;
    doc += '--------------------------------------------------------------------------------\n';
    doc += '1. GERADOR DO RESÍDUO (FARMÁCIA / DROGARIA)\n';
    doc += `Razão Social: ${store?.name || 'FarmaCore Drogaria'}\n`;
    doc += `CNPJ:         ${store?.cnpj || '12.345.678/0001-00'}\n`;
    doc += `Endereço:     ${store?.address || 'Matriz FarmaCore'}\n`;
    doc += '--------------------------------------------------------------------------------\n';
    doc += '2. TRANSPORTADORA ESPECIALIZADA / LICENCIADA\n';
    doc += `Empresa:      ${manifest.collector_name}\n`;
    doc += `CNPJ:         ${manifest.collector_cnpj}\n`;
    doc += `Licença Amb.: ${manifest.environmental_license}\n`;
    doc += `Placa Veíc.:  ${manifest.vehicle_plate} | Motorista: ${manifest.driver_name}\n`;
    doc += '--------------------------------------------------------------------------------\n';
    doc += '3. RELAÇÃO DE RESÍDUOS DE SERVIÇOS DE SAÚDE (PGRSS)\n';
    doc += 'Item | Descrição / Princípio Ativo       | Lote        | Grupo | Motivo  | Peso\n';
    doc += '-----+------------------------------------+-------------+-------+---------+---------\n';

    manifest.items?.forEach((item, idx) => {
      const num = String(idx + 1).padStart(4, ' ');
      const desc = (item.product_name || 'Medicamento').padEnd(34, ' ').substring(0, 34);
      const lote = (item.batch_number || 'S/LOTE').padEnd(11, ' ').substring(0, 11);
      const grupo = item.waste_group === 'GRUPO_B_QUIMICO' ? 'Gr. B' : 'Gr. A/E';
      const mot = item.reason.substring(0, 7).padEnd(7, ' ');
      const peso = `${item.weight_kg.toFixed(2)} kg`.padStart(8, ' ');
      doc += `${num} | ${desc} | ${lote} | ${grupo.padEnd(5, ' ')} | ${mot} | ${peso}\n`;
    });

    doc += '--------------------------------------------------------------------------------\n';
    doc += `TOTAL DE VOLUMES/ITENS: ${manifest.total_items} | PESO TOTAL DA CARGA: ${manifest.total_weight_kg.toFixed(3)} kg\n`;

    if (manifest.cdf_number) {
      doc += '--------------------------------------------------------------------------------\n';
      doc += '4. CERTIFICADO DE DESTINAÇÃO FINAL (CDF)\n';
      doc += `Certificado Nº:     ${manifest.cdf_number}\n`;
      doc += `Data da Destinação: ${manifest.certificate_date}\n`;
      doc += `Planta Tratadora:   ${manifest.incineration_plant}\n`;
    }

    doc += '================================================================================\n';
    doc += 'Declaramos que os resíduos descritos foram devidamente segregados, identificados\n';
    doc += 'e acondicionados conforme a RDC 222/2018 da ANVISA e normas ambientais vigentes.\n';
    doc += '\n\n';
    doc += '_______________________________            _______________________________\n';
    doc += '   Farmacêutico Responsável                      Motorista Coletor        \n';
    doc += '================================================================================\n';

    return doc;
  }

  /**
   * Obtém métricas e KPIs sanitários do PGRSS
   */
  getPgrssKpis(storeId?: number): PgrssKpis {
    let baseSql = 'FROM pgrss_disposal_records WHERE 1=1';
    const params: any[] = [];
    if (storeId) {
      baseSql += ' AND store_id = ?';
      params.push(storeId);
    }

    const storedRow = this.db.prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(weight_kg), 0) as weight
      ${baseSql} AND status = 'STORED'
    `).get(...params) as { count: number; weight: number };

    const dispatchedRow = this.db.prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(weight_kg), 0) as weight
      ${baseSql} AND status = 'DISPATCHED'
    `).get(...params) as { count: number; weight: number };

    const incineratedRow = this.db.prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(weight_kg), 0) as weight
      ${baseSql} AND status = 'INCINERATED'
    `).get(...params) as { count: number; weight: number };

    let manifestSql = 'FROM pgrss_manifests WHERE 1=1';
    const mParams: any[] = [];
    if (storeId) {
      manifestSql += ' AND store_id = ?';
      mParams.push(storeId);
    }

    const activeManifests = this.db.prepare(`
      SELECT COUNT(*) as count ${manifestSql} AND status = 'DISPATCHED'
    `).get(...mParams) as { count: number };

    const finalizedManifests = this.db.prepare(`
      SELECT COUNT(*) as count ${manifestSql} AND status = 'DESTINED'
    `).get(...mParams) as { count: number };

    return {
      stored_records_count: storedRow.count,
      stored_weight_kg: Number(storedRow.weight.toFixed(3)),
      dispatched_records_count: dispatchedRow.count,
      dispatched_weight_kg: Number(dispatchedRow.weight.toFixed(3)),
      incinerated_records_count: incineratedRow.count,
      incinerated_weight_kg: Number(incineratedRow.weight.toFixed(3)),
      active_manifests_count: activeManifests.count,
      finalized_manifests_count: finalizedManifests.count,
    };
  }
}
