import { Database } from '../../database/connection';
import {
  SngpcMovement,
  SngpcMovementType,
  SngpcReferenceType,
  SngpcTransmission,
  SngpcTransmissionParams,
  SngpcLivroItem,
  SngpcLivroRegistro,
} from './types';
import {
  buildSngpcXml,
  SngpcXmlEntryItem,
  SngpcXmlSaleItem,
} from './sngpc-xml-builder';

interface SngpcMovementRow {
  id: number | bigint;
  movement_type: string;
  product_id: number | bigint;
  batch_id: number | bigint;
  quantity: number;
  reference_type: string;
  reference_id: number | bigint;
  movement_date: string;
  ms_registration: string;
  prescription_id: number | bigint | null;
  is_transmitted: number;
  transmission_id: number | bigint | null;
  created_at: string;
}

interface SngpcTransmissionRow {
  id: number | bigint;
  start_date: string;
  end_date: string;
  pharmacist_name: string;
  pharmacist_cpf: string;
  pharmacist_crf: string;
  pharmacist_crf_uf: string;
  xml_content: string;
  status: string;
  hash_xml: string;
  created_at: string;
}

interface LivroMovementRow extends SngpcMovementRow {
  product_name: string;
  batch_number: string;
  invoice_number?: number | string | null;
  doctor_name?: string | null;
  doctor_crm?: string | null;
  doctor_uf?: string | null;
  buyer_name?: string | null;
  buyer_cpf?: string | null;
  notification_number?: string | null;
}

interface WeeklyXmlMovementRow extends SngpcMovementRow {
  invoice_number?: number | string | null;
  issue_date?: string | null;
  supplier_cnpj?: string | null;
  batch_number?: string | null;
  prescription_type?: string | null;
  notification_number?: string | null;
  prescription_date?: string | null;
  doctor_name?: string | null;
  doctor_crm?: string | null;
  doctor_uf?: string | null;
  patient_name?: string | null;
  buyer_name?: string | null;
  buyer_cpf?: string | null;
  buyer_doc_type?: string | null;
}

function mapMovementRow(row: SngpcMovementRow): SngpcMovement {
  return {
    id: Number(row.id),
    movementType: row.movement_type as SngpcMovementType,
    productId: Number(row.product_id),
    batchId: Number(row.batch_id),
    quantity: Number(row.quantity),
    referenceType: row.reference_type as SngpcReferenceType,
    referenceId: Number(row.reference_id),
    movementDate: row.movement_date,
    msRegistration: row.ms_registration,
    prescriptionId: row.prescription_id !== null ? Number(row.prescription_id) : null,
    isTransmitted: Number(row.is_transmitted),
    transmissionId: row.transmission_id !== null ? Number(row.transmission_id) : null,
    createdAt: row.created_at,
  };
}

function mapTransmissionRow(row: SngpcTransmissionRow): SngpcTransmission {
  return {
    id: Number(row.id),
    startDate: row.start_date,
    endDate: row.end_date,
    pharmacistName: row.pharmacist_name,
    pharmacistCpf: row.pharmacist_cpf,
    pharmacistCrf: row.pharmacist_crf,
    pharmacistCrfUf: row.pharmacist_crf_uf,
    xmlContent: row.xml_content,
    status: row.status as SngpcTransmission['status'],
    hashXml: row.hash_xml,
    createdAt: row.created_at,
  };
}

export class SngpcService {
  constructor(private db: Database) {}

  recordEntryMovement(data: {
    productId: number;
    batchId: number;
    quantity: number;
    referenceId: number;
    movementDate: string;
    msRegistration: string;
    movementType?: SngpcMovementType;
    referenceType?: SngpcReferenceType;
  }): SngpcMovement {
    if (!data.productId || data.productId <= 0) {
      throw new Error('INVALID_PRODUCT_ID');
    }
    if (!data.batchId || data.batchId <= 0) {
      throw new Error('INVALID_BATCH_ID');
    }
    if (typeof data.quantity !== 'number' || isNaN(data.quantity) || data.quantity <= 0) {
      throw new Error('INVALID_QUANTITY');
    }
    if (!data.movementDate || data.movementDate.trim() === '') {
      throw new Error('INVALID_MOVEMENT_DATE');
    }
    if (!data.msRegistration || data.msRegistration.trim() === '') {
      throw new Error('INVALID_MS_REGISTRATION');
    }

    const movementType: SngpcMovementType = data.movementType || 'ENTRADA';
    const referenceType: SngpcReferenceType = data.referenceType || 'PURCHASE_INVOICE';

    const stmt = this.db.prepare(`
      INSERT INTO sngpc_movements (
        movement_type,
        product_id,
        batch_id,
        quantity,
        reference_type,
        reference_id,
        movement_date,
        ms_registration,
        prescription_id,
        is_transmitted,
        transmission_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, NULL)
    `);

    const result = stmt.run(
      movementType,
      data.productId,
      data.batchId,
      Math.round(data.quantity),
      referenceType,
      data.referenceId,
      data.movementDate.trim(),
      data.msRegistration.trim()
    );

    const insertedId = Number(result.lastInsertRowid);
    const row = this.db
      .prepare<SngpcMovementRow>('SELECT * FROM sngpc_movements WHERE id = ?')
      .get(insertedId);

    if (!row) {
      throw new Error('Failed to retrieve newly created SNGPC entry movement');
    }

    return mapMovementRow(row);
  }

  recordSaleMovement(data: {
    productId: number;
    batchId: number;
    quantity: number;
    referenceId: number; // saleId
    movementDate: string;
    msRegistration: string;
    prescriptionId: number;
  }): SngpcMovement {
    if (!data.productId || data.productId <= 0) {
      throw new Error('INVALID_PRODUCT_ID');
    }
    if (!data.batchId || data.batchId <= 0) {
      throw new Error('INVALID_BATCH_ID');
    }
    if (typeof data.quantity !== 'number' || isNaN(data.quantity) || data.quantity <= 0) {
      throw new Error('INVALID_QUANTITY');
    }
    if (!data.referenceId || data.referenceId <= 0) {
      throw new Error('INVALID_REFERENCE_ID');
    }
    if (!data.movementDate || data.movementDate.trim() === '') {
      throw new Error('INVALID_MOVEMENT_DATE');
    }
    if (!data.msRegistration || data.msRegistration.trim() === '') {
      throw new Error('INVALID_MS_REGISTRATION');
    }
    if (!data.prescriptionId || data.prescriptionId <= 0) {
      throw new Error('INVALID_PRESCRIPTION_ID');
    }

    const stmt = this.db.prepare(`
      INSERT INTO sngpc_movements (
        movement_type,
        product_id,
        batch_id,
        quantity,
        reference_type,
        reference_id,
        movement_date,
        ms_registration,
        prescription_id,
        is_transmitted,
        transmission_id
      ) VALUES ('SAIDA_VENDA', ?, ?, ?, 'SALE', ?, ?, ?, ?, 0, NULL)
    `);

    const result = stmt.run(
      data.productId,
      data.batchId,
      Math.round(data.quantity),
      data.referenceId,
      data.movementDate.trim(),
      data.msRegistration.trim(),
      data.prescriptionId
    );

    const insertedId = Number(result.lastInsertRowid);
    const row = this.db
      .prepare<SngpcMovementRow>('SELECT * FROM sngpc_movements WHERE id = ?')
      .get(insertedId);

    if (!row) {
      throw new Error('Failed to retrieve newly created SNGPC sale movement');
    }

    return mapMovementRow(row);
  }

  getMovements(filter?: {
    startDate?: string;
    endDate?: string;
    movementType?: SngpcMovementType;
    isTransmitted?: number;
    productId?: number;
  }): SngpcMovement[] {
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (filter?.startDate) {
      conditions.push('movement_date >= ?');
      params.push(filter.startDate);
    }
    if (filter?.endDate) {
      conditions.push('movement_date <= ?');
      params.push(filter.endDate);
    }
    if (filter?.movementType) {
      conditions.push('movement_type = ?');
      params.push(filter.movementType);
    }
    if (filter?.isTransmitted !== undefined) {
      conditions.push('is_transmitted = ?');
      params.push(filter.isTransmitted);
    }
    if (filter?.productId !== undefined) {
      conditions.push('product_id = ?');
      params.push(filter.productId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT * FROM sngpc_movements ${whereClause} ORDER BY movement_date ASC, id ASC`;

    const rows = this.db.prepare<SngpcMovementRow>(sql).all(...params);
    return rows.map(mapMovementRow);
  }

  getLivroRegistro(filter: {
    startDate: string;
    endDate: string;
    productId?: number;
  }): SngpcLivroRegistro {
    // 1. Get Pharmacy Details
    const profile = this.db
      .prepare<{ cnpj: string; razao_social: string; nome_fantasia: string }>(
        'SELECT cnpj, razao_social, nome_fantasia FROM fiscal_profiles LIMIT 1'
      )
      .get();

    const pharmacyCnpj = profile?.cnpj || '00.000.000/0001-00';
    const pharmacyName = profile?.razao_social || profile?.nome_fantasia || 'FarmaCore Farmácia';

    // 2. Get Pharmacist Details from latest transmission or fallback
    const latestTx = this.db
      .prepare<{
        pharmacist_name: string;
        pharmacist_crf: string;
        pharmacist_crf_uf: string;
      }>(
        'SELECT pharmacist_name, pharmacist_crf, pharmacist_crf_uf FROM sngpc_transmissions ORDER BY id DESC LIMIT 1'
      )
      .get();

    const pharmacistName = latestTx?.pharmacist_name || 'Farmacêutico Responsável';
    const pharmacistCrf = latestTx?.pharmacist_crf || '00000';
    const pharmacistCrfUf = latestTx?.pharmacist_crf_uf || 'SP';

    // 3. Compute initial balance before startDate for each product
    const priorSql = `
      SELECT
        product_id,
        SUM(CASE WHEN movement_type = 'ENTRADA' THEN quantity ELSE -quantity END) as initial_balance
      FROM sngpc_movements
      WHERE movement_date < ?
      ${filter.productId ? 'AND product_id = ?' : ''}
      GROUP BY product_id
    `;
    const priorParams: (string | number)[] = [filter.startDate];
    if (filter.productId) {
      priorParams.push(filter.productId);
    }

    const priorRows = this.db
      .prepare<{ product_id: number; initial_balance: number }>(priorSql)
      .all(...priorParams);

    const runningBalanceMap = new Map<number, number>();
    for (const r of priorRows) {
      runningBalanceMap.set(Number(r.product_id), Number(r.initial_balance || 0));
    }

    // 4. Query movements in period
    const movementsSql = `
      SELECT
        m.*,
        p.name AS product_name,
        b.batch_number AS batch_number,
        pi.invoice_number AS invoice_number,
        pr.doctor_name AS doctor_name,
        pr.doctor_crm AS doctor_crm,
        pr.doctor_uf AS doctor_uf,
        pr.buyer_name AS buyer_name,
        pr.buyer_cpf AS buyer_cpf,
        pr.notification_number AS notification_number
      FROM sngpc_movements m
      JOIN products p ON p.id = m.product_id
      JOIN batches b ON b.id = m.batch_id
      LEFT JOIN purchase_invoices pi ON m.reference_type = 'PURCHASE_INVOICE' AND pi.id = m.reference_id
      LEFT JOIN prescriptions pr ON pr.id = m.prescription_id
      WHERE m.movement_date >= ? AND m.movement_date <= ?
      ${filter.productId ? 'AND m.product_id = ?' : ''}
      ORDER BY m.movement_date ASC, m.id ASC
    `;
    const movementParams: (string | number)[] = [filter.startDate, filter.endDate];
    if (filter.productId) {
      movementParams.push(filter.productId);
    }

    const rows = this.db.prepare<LivroMovementRow>(movementsSql).all(...movementParams);

    const items: SngpcLivroItem[] = [];

    for (const row of rows) {
      const prodId = Number(row.product_id);
      const currentInitial = runningBalanceMap.get(prodId) || 0;
      let entryQty = 0;
      let exitQty = 0;
      let finalBal = currentInitial;
      let docNum = '';

      if (row.movement_type === 'ENTRADA') {
        entryQty = Number(row.quantity);
        finalBal = currentInitial + entryQty;
        docNum = row.invoice_number ? String(row.invoice_number) : `NF-${row.reference_id}`;
      } else if (row.movement_type === 'SAIDA_VENDA') {
        exitQty = Number(row.quantity);
        finalBal = currentInitial - exitQty;
        docNum = row.notification_number || `REC-${row.prescription_id || row.reference_id}`;
      } else {
        exitQty = Number(row.quantity);
        finalBal = currentInitial - exitQty;
        docNum = `PERDA-${row.reference_id}`;
      }

      runningBalanceMap.set(prodId, finalBal);

      items.push({
        date: row.movement_date,
        movementType: row.movement_type as SngpcMovementType,
        documentNumber: docNum,
        productName: row.product_name,
        msRegistration: row.ms_registration,
        batchNumber: row.batch_number,
        initialBalance: currentInitial,
        entryQuantity: entryQty,
        exitQuantity: exitQty,
        finalBalance: finalBal,
        doctorName: row.doctor_name ?? null,
        doctorCrm: row.doctor_crm ?? null,
        doctorUf: row.doctor_uf ?? null,
        buyerName: row.buyer_name ?? null,
        buyerCpf: row.buyer_cpf ?? null,
      });
    }

    const openingTerm = `Termo de Abertura: Livro de Registro Específico de Medicamentos Controlados (Portaria 344/98). Estabelecimento: ${pharmacyName}, CNPJ: ${pharmacyCnpj}. Período: ${filter.startDate} a ${filter.endDate}. Responsável Técnico: ${pharmacistName} - CRF/${pharmacistCrfUf} ${pharmacistCrf}.`;
    const closingTerm = `Termo de Encerramento: Livro contendo ${items.length} registros no período de ${filter.startDate} a ${filter.endDate}. Responsável Técnico: ${pharmacistName} - CRF/${pharmacistCrfUf} ${pharmacistCrf}.`;

    return {
      pharmacyCnpj,
      pharmacyName,
      pharmacistName,
      pharmacistCrf,
      pharmacistCrfUf,
      startDate: filter.startDate,
      endDate: filter.endDate,
      openingTerm,
      closingTerm,
      items,
    };
  }

  generateWeeklyXml(params: SngpcTransmissionParams): {
    transmission: SngpcTransmission;
    movementsCount: number;
  } {
    // 1. Fetch un-transmitted movements
    const movementsSql = `
      SELECT
        m.*,
        pi.invoice_number,
        pi.issue_date,
        pi.supplier_cnpj,
        b.batch_number,
        pr.prescription_type,
        pr.notification_number,
        pr.prescription_date,
        pr.doctor_name,
        pr.doctor_crm,
        pr.doctor_uf,
        pr.patient_name,
        pr.buyer_name,
        pr.buyer_cpf,
        pr.buyer_doc_type
      FROM sngpc_movements m
      JOIN batches b ON b.id = m.batch_id
      LEFT JOIN purchase_invoices pi ON m.reference_type = 'PURCHASE_INVOICE' AND pi.id = m.reference_id
      LEFT JOIN prescriptions pr ON pr.id = m.prescription_id
      WHERE m.is_transmitted = 0
        AND m.movement_date >= ?
        AND m.movement_date <= ?
      ORDER BY m.movement_date ASC, m.id ASC
    `;

    const rows = this.db
      .prepare<WeeklyXmlMovementRow>(movementsSql)
      .all(params.startDate, params.endDate);

    const entries: SngpcXmlEntryItem[] = [];
    const sales: SngpcXmlSaleItem[] = [];

    for (const r of rows) {
      if (r.movement_type === 'ENTRADA') {
        const invNum = r.invoice_number ?? r.reference_id;
        entries.push({
          invoiceNumber: typeof invNum === 'bigint' ? Number(invNum) : invNum,
          issueDate: r.issue_date ?? r.movement_date,
          supplierCnpj: r.supplier_cnpj ?? '00000000000000',
          msRegistration: r.ms_registration,
          batchNumber: r.batch_number ?? 'LOTE',
          quantity: Number(r.quantity),
        });
      } else if (r.movement_type === 'SAIDA_VENDA') {
        sales.push({
          prescriptionType: r.prescription_type ?? '1',
          notificationNumber: r.notification_number ?? `NOTIF-${r.reference_id}`,
          prescriptionDate: r.prescription_date ?? r.movement_date,
          doctorName: r.doctor_name ?? 'Dr. Prescritor',
          doctorCrm: r.doctor_crm ?? '00000',
          doctorUf: r.doctor_uf ?? 'SP',
          patientName: r.patient_name ?? 'Paciente',
          buyerName: r.buyer_name ?? r.patient_name ?? 'Comprador',
          buyerCpf: r.buyer_cpf ?? '00000000000',
          buyerDocType: r.buyer_doc_type ?? '1',
          msRegistration: r.ms_registration,
          batchNumber: r.batch_number ?? 'LOTE',
          quantity: Number(r.quantity),
        });
      }
    }

    // 2. Fetch Pharmacy CNPJ
    const profile = this.db
      .prepare<{ cnpj: string }>('SELECT cnpj FROM fiscal_profiles LIMIT 1')
      .get();
    const cnpjEmissor = profile?.cnpj || '00000000000100';

    // 3. Build XML and calculate SHA-1
    const { xml, hash } = buildSngpcXml({
      cnpjEmissor,
      cpfTransmissor: params.pharmacistCpf,
      startDate: params.startDate,
      endDate: params.endDate,
      entries,
      sales,
    });

    // 4. Atomically persist transmission and update movements
    const generateTx = this.db.transaction(() => {
      const insertTxStmt = this.db.prepare(`
        INSERT INTO sngpc_transmissions (
          start_date,
          end_date,
          pharmacist_name,
          pharmacist_cpf,
          pharmacist_crf,
          pharmacist_crf_uf,
          xml_content,
          status,
          hash_xml
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'GERADO', ?)
      `);

      const txResult = insertTxStmt.run(
        params.startDate,
        params.endDate,
        params.pharmacistName,
        params.pharmacistCpf,
        params.pharmacistCrf,
        params.pharmacistCrfUf,
        xml,
        hash
      );

      const transmissionId = Number(txResult.lastInsertRowid);

      if (rows.length > 0) {
        const movementIds = rows.map((r) => Number(r.id));
        const placeholders = movementIds.map(() => '?').join(',');
        this.db
          .prepare(
            `UPDATE sngpc_movements SET is_transmitted = 1, transmission_id = ? WHERE id IN (${placeholders})`
          )
          .run(transmissionId, ...movementIds);
      }

      const transmission = this.getTransmissionById(transmissionId);
      if (!transmission) {
        throw new Error('Failed to retrieve newly generated SNGPC transmission');
      }

      return {
        transmission,
        movementsCount: rows.length,
      };
    });

    return generateTx();
  }

  getTransmissions(): SngpcTransmission[] {
    const rows = this.db
      .prepare<SngpcTransmissionRow>(
        'SELECT * FROM sngpc_transmissions ORDER BY id DESC'
      )
      .all();
    return rows.map(mapTransmissionRow);
  }

  getTransmissionById(id: number): SngpcTransmission | null {
    const row = this.db
      .prepare<SngpcTransmissionRow>(
        'SELECT * FROM sngpc_transmissions WHERE id = ?'
      )
      .get(id);
    return row ? mapTransmissionRow(row) : null;
  }
}
