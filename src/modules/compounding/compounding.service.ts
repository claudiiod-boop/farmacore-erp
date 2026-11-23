import { Database } from '../../database/connection';
import { CompoundingCalculationService } from './compounding-calculation.service';
import {
  RawMaterial,
  RawMaterialBatch,
  RawMaterialBatchStatus,
  CompoundingOrder,
  CompoundingOrderItem,
  CompoundingOrderStatus,
} from './compounding.types';

export class CompoundingService {
  private calc: CompoundingCalculationService;

  constructor(private db: Database) {
    this.calc = new CompoundingCalculationService();
  }

  // ===================== GESTÃO DE MATÉRIAS-PRIMAS =====================
  public createRawMaterial(data: Partial<RawMaterial>): RawMaterial {
    const res = this.db
      .prepare(`
        INSERT INTO raw_materials (dcb, cas_number, name, apparent_density, default_unit, cost_per_unit, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        data.dcb || null,
        data.cas_number || null,
        data.name,
        data.apparent_density || 0.60,
        data.default_unit || 'mg',
        data.cost_per_unit || 0.05,
        data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1
      );

    return this.getRawMaterialById(Number(res.lastInsertRowid))!;
  }

  public getRawMaterialById(id: number): RawMaterial | undefined {
    return this.db
      .prepare<RawMaterial>('SELECT * FROM raw_materials WHERE id = ?')
      .get(id);
  }

  public listRawMaterials(search?: string): RawMaterial[] {
    let sql = 'SELECT * FROM raw_materials WHERE is_active = 1';
    const params: any[] = [];
    if (search) {
      sql += ' AND (name LIKE ? OR dcb LIKE ? OR cas_number LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    sql += ' ORDER BY name ASC';
    return this.db.prepare<RawMaterial>(sql).all(...params);
  }

  // ===================== QUARENTENA & LAUDOS ANALÍTICOS =====================
  public createRawMaterialBatch(batch: Partial<RawMaterialBatch>): RawMaterialBatch {
    const res = this.db
      .prepare(`
        INSERT INTO raw_material_batches (
          raw_material_id, batch_number, supplier, manufacturer, potency_percent, moisture_percent,
          molecular_weight_salt, molecular_weight_base, report_number, expiration_date, status, current_stock
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        batch.raw_material_id,
        batch.batch_number,
        batch.supplier,
        batch.manufacturer || null,
        batch.potency_percent !== undefined ? batch.potency_percent : 100.0,
        batch.moisture_percent !== undefined ? batch.moisture_percent : 0.0,
        batch.molecular_weight_salt || null,
        batch.molecular_weight_base || null,
        batch.report_number,
        batch.expiration_date,
        batch.status || 'QUARANTINE',
        batch.current_stock || 0.0
      );

    return this.getBatchById(Number(res.lastInsertRowid))!;
  }

  public getBatchById(id: number): RawMaterialBatch | undefined {
    return this.db
      .prepare<RawMaterialBatch>(`
        SELECT b.*, rm.name as raw_material_name
        FROM raw_material_batches b
        JOIN raw_materials rm ON rm.id = b.raw_material_id
        WHERE b.id = ?
      `)
      .get(id);
  }

  public listBatches(
    rawMaterialId?: number,
    status?: RawMaterialBatchStatus
  ): RawMaterialBatch[] {
    let sql = `
      SELECT b.*, rm.name as raw_material_name
      FROM raw_material_batches b
      JOIN raw_materials rm ON rm.id = b.raw_material_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (rawMaterialId) {
      sql += ' AND b.raw_material_id = ?';
      params.push(rawMaterialId);
    }

    if (status) {
      sql += ' AND b.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY b.expiration_date ASC';
    return this.db.prepare<RawMaterialBatch>(sql).all(...params);
  }

  public releaseRawMaterialBatch(batchId: number, pharmacistName: string): RawMaterialBatch {
    this.db
      .prepare(`
        UPDATE raw_material_batches
        SET status = 'APPROVED', released_by = ?, released_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .run(pharmacistName, batchId);

    return this.getBatchById(batchId)!;
  }

  public rejectRawMaterialBatch(
    batchId: number,
    pharmacistName: string,
    rejectionReason: string
  ): RawMaterialBatch {
    this.db
      .prepare(`
        UPDATE raw_material_batches
        SET status = 'REJECTED', released_by = ?, rejection_reason = ?, released_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .run(pharmacistName, rejectionReason, batchId);

    return this.getBatchById(batchId)!;
  }

  // ===================== ORDENS DE MANIPULAÇÃO & FICHA DE PESAGEM =====================
  public createOrder(
    orderData: Partial<CompoundingOrder>,
    components: Array<{ rawMaterialId: number; prescribedDose: number; unit?: string }>
  ): CompoundingOrder {
    if (!components || components.length === 0) {
      throw new Error('A fórmula magistral deve possuir ao menos um componente.');
    }

    const totalUnits = orderData.total_units || 30;
    const yearMonth = new Date().toISOString().slice(0, 7).replace('-', '');
    const countRow = this.db
      .prepare<{ total: number }>('SELECT COUNT(*) as total FROM compounding_orders')
      .get() || { total: 0 };
    const seq = String(countRow.total + 1).padStart(4, '0');
    const orderNumber = `OM-${yearMonth}-${seq}`;

    // Processa componentes, buscando o lote ativo aprovado (FEFO) de cada matéria-prima
    let subtotal = 0;
    const calculatedItems: Array<{
      rawMaterial: RawMaterial;
      batch: RawMaterialBatch;
      prescribedDose: number;
      unit: string;
      fc: number;
      feq: number;
      correctedDosePerUnit: number;
      totalDoseToWeighMg: number;
    }> = [];

    for (const comp of components) {
      const rawMat = this.getRawMaterialById(comp.rawMaterialId);
      if (!rawMat) {
        throw new Error(`Matéria-prima ID ${comp.rawMaterialId} não encontrada.`);
      }

      // Busca lote aprovado com data de validade mais próxima (FEFO)
      const approvedBatches = this.listBatches(comp.rawMaterialId, 'APPROVED');
      if (approvedBatches.length === 0) {
        throw new Error(
          `Matéria-prima "${rawMat.name}" não possui lotes aprovados em estoque para manipulação (Status Quarentena/Reprovado).`
        );
      }
      const batch = approvedBatches[0];

      const doses = this.calc.calculateDoses(
        comp.prescribedDose,
        totalUnits,
        batch.potency_percent,
        batch.moisture_percent,
        batch.molecular_weight_salt,
        batch.molecular_weight_base
      );

      const totalDoseToWeighMg = doses.correctedDosePerUnitMg * totalUnits;
      // Custo: custo por mg * total mg
      subtotal += totalDoseToWeighMg * (rawMat.cost_per_unit || 0.05);

      calculatedItems.push({
        rawMaterial: rawMat,
        batch,
        prescribedDose: comp.prescribedDose,
        unit: comp.unit || rawMat.default_unit || 'mg',
        fc: doses.factorCorrection,
        feq: doses.factorEquivalence,
        correctedDosePerUnit: doses.correctedDosePerUnitMg,
        totalDoseToWeighMg,
      });
    }

    // Dimensionamento de cápsulas se a forma for 'CAPSULA'
    let selectedCapsuleSize: string | null = null;
    let targetWeightPerUnit: number | null = null;
    let excipientItem: { totalWeighMg: number } | null = null;

    if ((orderData.pharmaceutical_form || 'CAPSULA') === 'CAPSULA') {
      const capsuleResult = this.calc.calculateCapsuleDimensions(
        calculatedItems.map((i) => ({
          massMg: i.correctedDosePerUnit,
          apparentDensity: i.rawMaterial.apparent_density,
        })),
        totalUnits
      );

      selectedCapsuleSize = capsuleResult.selectedCapsuleSize;
      targetWeightPerUnit = capsuleResult.targetCapsuleWeightMg;

      if (capsuleResult.excipientMassPerCapsuleMg > 0) {
        excipientItem = {
          totalWeighMg: capsuleResult.totalExcipientToWeighG * 1000,
        };
      }
    }

    const packagingCost = orderData.packaging_cost !== undefined ? orderData.packaging_cost : 5.0;
    const pharmaceuticalFee =
      orderData.pharmaceutical_fee !== undefined ? orderData.pharmaceutical_fee : 15.0;
    const totalAmount = Number((subtotal + packagingCost + pharmaceuticalFee).toFixed(2));

    const orderRes = this.db
      .prepare(`
        INSERT INTO compounding_orders (
          store_id, order_number, patient_name, patient_document, prescriber_name, prescriber_crm,
          prescriber_uf, pharmaceutical_form, total_units, capsule_size, target_weight_per_unit,
          status, subtotal, packaging_cost, pharmaceutical_fee, total_amount, directions, warnings,
          pharmacist_responsible
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'AWAITING_WEIGHING', ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        orderData.store_id || 1,
        orderNumber,
        orderData.patient_name || 'Paciente Balcão',
        orderData.patient_document || null,
        orderData.prescriber_name || 'Médico Prescritor',
        orderData.prescriber_crm || '000000',
        orderData.prescriber_uf || 'SP',
        orderData.pharmaceutical_form || 'CAPSULA',
        totalUnits,
        selectedCapsuleSize,
        targetWeightPerUnit,
        Number(subtotal.toFixed(2)),
        packagingCost,
        pharmaceuticalFee,
        totalAmount,
        orderData.directions || 'Tomar conforme orientação médica.',
        orderData.warnings || 'Uso interno. Mantenha fora do alcance de crianças.',
        orderData.pharmacist_responsible || 'FARMACEUTICO_RT'
      );

    const orderId = Number(orderRes.lastInsertRowid);

    // Insere itens na ficha de pesagem
    const itemStmt = this.db.prepare(`
      INSERT INTO compounding_order_items (
        order_id, raw_material_id, batch_id, prescribed_dose, unit, factor_correction,
        factor_equivalence, corrected_dose_per_unit, total_dose_to_weigh, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
    `);

    for (const item of calculatedItems) {
      itemStmt.run(
        orderId,
        item.rawMaterial.id!,
        item.batch.id!,
        item.prescribedDose,
        item.unit,
        item.fc,
        item.feq,
        item.correctedDosePerUnit,
        item.totalDoseToWeighMg
      );
    }

    return this.getOrderById(orderId)!;
  }

  public getOrderById(orderId: number): CompoundingOrder | undefined {
    const order = this.db
      .prepare<CompoundingOrder>('SELECT * FROM compounding_orders WHERE id = ?')
      .get(orderId);

    if (!order) return undefined;

    const items = this.db
      .prepare<CompoundingOrderItem>(`
        SELECT ci.*, rm.name as raw_material_name, b.batch_number
        FROM compounding_order_items ci
        JOIN raw_materials rm ON rm.id = ci.raw_material_id
        LEFT JOIN raw_material_batches b ON b.id = ci.batch_id
        WHERE ci.order_id = ?
        ORDER BY ci.id ASC
      `)
      .all(orderId);

    return { ...order, items };
  }

  public listOrders(storeId: number = 1, status?: CompoundingOrderStatus): CompoundingOrder[] {
    let sql = 'SELECT * FROM compounding_orders WHERE store_id = ?';
    const params: any[] = [storeId];
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    sql += ' ORDER BY id DESC';

    const orders = this.db.prepare<CompoundingOrder>(sql).all(...params);
    return orders.map((o) => {
      const items = this.db
        .prepare<CompoundingOrderItem>(`
          SELECT ci.*, rm.name as raw_material_name, b.batch_number
          FROM compounding_order_items ci
          JOIN raw_materials rm ON rm.id = ci.raw_material_id
          LEFT JOIN raw_material_batches b ON b.id = ci.batch_id
          WHERE ci.order_id = ?
        `)
        .all(o.id!);
      return { ...o, items };
    });
  }

  /**
   * Registro de pesagem do item na balança analítica
   */
  public weighItem(
    orderId: number,
    itemId: number,
    weighedAmount: number,
    operatorName: string
  ): CompoundingOrder {
    const order = this.getOrderById(orderId);
    if (!order) {
      throw new Error(`Ordem de manipulação ${orderId} não encontrada.`);
    }

    const item = order.items?.find((i) => i.id === itemId);
    if (!item) {
      throw new Error(`Item ID ${itemId} não pertence à ordem ${orderId}.`);
    }

    this.db
      .prepare(`
        UPDATE compounding_order_items
        SET weighed_amount = ?, weighed_by = ?, weighed_at = CURRENT_TIMESTAMP, status = 'WEIGHED'
        WHERE id = ?
      `)
      .run(weighedAmount, operatorName, itemId);

    // Se todos os itens foram pesados, atualiza status para 'QUALITY_CONTROL'
    const updatedOrder = this.getOrderById(orderId)!;
    const allWeighed = updatedOrder.items?.every((i) => i.status === 'WEIGHED') || false;

    if (allWeighed) {
      this.db
        .prepare(`
          UPDATE compounding_orders
          SET status = 'QUALITY_CONTROL', updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `)
        .run(orderId);
    } else {
      this.db
        .prepare(`
          UPDATE compounding_orders
          SET status = 'IN_MANIPULATION', updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `)
        .run(orderId);
    }

    return this.getOrderById(orderId)!;
  }

  /**
   * Avaliação do Controle de Qualidade (Peso Médio & Liberação da Fórmula)
   */
  public evaluateQualityControl(
    orderId: number,
    actualAverageWeightMg: number,
    pharmacistName: string
  ): CompoundingOrder {
    const order = this.getOrderById(orderId);
    if (!order) {
      throw new Error(`Ordem ${orderId} não encontrada.`);
    }

    const targetWeight = order.target_weight_per_unit || 300.0;
    const evaluation = this.calc.evaluateAverageWeight(targetWeight, actualAverageWeightMg);

    if (!evaluation.approved) {
      this.db
        .prepare(`
          UPDATE compounding_orders
          SET quality_status = 'REJECTED', actual_average_weight = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `)
        .run(actualAverageWeightMg, orderId);

      throw new Error(
        `Controle de qualidade REPROVADO: ${evaluation.message}. A fórmula não pode ser liberada ao paciente.`
      );
    }

    // Calcula validade (padrão magistral: 180 dias ou 6 meses)
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 180);

    this.db
      .prepare(`
        UPDATE compounding_orders
        SET quality_status = 'APPROVED', status = 'READY', actual_average_weight = ?,
            pharmacist_responsible = ?, manipulated_at = CURRENT_TIMESTAMP,
            expires_at = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .run(actualAverageWeightMg, pharmacistName, validUntil.toISOString(), orderId);

    return this.getOrderById(orderId)!;
  }

  /**
   * Geração do Rótulo Magistral Oficial (RDC 67/2007) formatado para impressora térmica/etiqueta
   */
  public generateMagistralLabel(orderId: number): string {
    const order = this.getOrderById(orderId);
    if (!order) {
      throw new Error(`Ordem ${orderId} não encontrada.`);
    }

    const line = '='.repeat(48);
    const subline = '-'.repeat(48);

    const pad = (text: string) => {
      const len = text.length;
      if (len >= 48) return text.substring(0, 48);
      const left = Math.floor((48 - len) / 2);
      return ' '.repeat(left) + text;
    };

    let label = '';
    label += `${line}\n`;
    label += `${pad('FARMACORE FARMACIA MAGISTRAL')}\n`;
    label += `${pad('BOAS PRATICAS DE MANIPULACAO - RDC 67/2007')}\n`;
    label += `${line}\n`;
    label += `ORDEM MANIPULACAO: ${order.order_number}\n`;
    label += `PACIENTE: ${order.patient_name.toUpperCase()}\n`;
    label += `PRESCRITOR: ${order.prescriber_name.toUpperCase()} (CRM/UF: ${order.prescriber_crm}/${order.prescriber_uf})\n`;
    label += `${subline}\n`;
    label += `${pad('FORMULA MAGISTRAL INDIVIDUALIZADA')}\n`;

    for (const item of order.items || []) {
      label += `* ${item.raw_material_name} ..... ${item.prescribed_dose} ${item.unit}\n`;
      if (item.batch_number) {
        label += `  (Lote MP: ${item.batch_number} | FC: ${item.factor_correction} | FEq: ${item.factor_equivalence})\n`;
      }
    }

    if (order.pharmaceutical_form === 'CAPSULA' && order.capsule_size) {
      label += `* Excipiente q.s.p. ........ 1 capsula nº ${order.capsule_size}\n`;
      label += `  (Peso Medio Teorico: ${order.target_weight_per_unit || 0} mg)\n`;
    }

    label += `${subline}\n`;
    label += `QUANTIDADE TOTAL: ${order.total_units} ${order.pharmaceutical_form}S\n`;
    label += `POSOLOGIA:\n${order.directions}\n`;
    label += `${subline}\n`;
    label += `MANIPULADO EM: ${order.manipulated_at ? new Date(order.manipulated_at).toLocaleDateString('pt-BR') : 'EM PREPARO'}\n`;
    label += `VALIDADE: ${order.expires_at ? new Date(order.expires_at).toLocaleDateString('pt-BR') : '180 DIAS'}\n`;
    label += `FARM. RESP.: ${order.pharmacist_responsible || 'FARMACEUTICO RT'}\n`;
    label += `${line}\n`;
    label += `${pad('ADVERTENCIAS LEGAIS')}\n`;
    label += `${order.warnings || 'Uso interno. Nao usar se o lacre estiver violado.'}\n`;
    label += `VENDA SOB PRESCRICAO MEDICA\n`;
    label += `${line}\n`;

    return label;
  }
}
