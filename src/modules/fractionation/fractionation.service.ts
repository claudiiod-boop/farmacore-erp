import { Database } from '../../database/connection';
import {
  FractionableProduct,
  FractionationRecord,
  FractionationDispensation,
  FractionateMedicineInput,
  DispenseFractionedInput,
  FractionationKpis,
} from './fractionation.types';

export class FractionationService {
  constructor(private db: Database) {}

  /**
   * Lista produtos habilitados para fracionamento ou pesquisa catálogo
   */
  public listFractionableProducts(search?: string): FractionableProduct[] {
    let sql = `
      SELECT id, ean, name, active_ingredient, ms_registration, stripe, price,
             is_fractionable, units_per_package, fractional_unit
      FROM products
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search?.trim()) {
      sql += ' AND (name LIKE ? OR ean LIKE ? OR active_ingredient LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    } else {
      sql += ' AND is_fractionable = 1';
    }

    sql += ' ORDER BY name ASC';
    return this.db.prepare(sql).all(...params) as FractionableProduct[];
  }

  /**
   * Habilita ou desabilita o fracionamento em um produto
   */
  public toggleProductFractionable(
    productId: number,
    isFractionable: boolean,
    unitsPerPackage = 1,
    fractionalUnit = 'COMPRIMIDO'
  ): FractionableProduct {
    const prod = this.db
      .prepare('SELECT id FROM products WHERE id = ?')
      .get(productId);
    if (!prod) {
      throw new Error('PRODUCT_NOT_FOUND');
    }

    this.db
      .prepare(`
        UPDATE products
        SET is_fractionable = ?, units_per_package = ?, fractional_unit = ?
        WHERE id = ?
      `)
      .run(isFractionable ? 1 : 0, Math.max(1, unitsPerPackage), fractionalUnit, productId);

    return this.db
      .prepare(`
        SELECT id, ean, name, active_ingredient, ms_registration, stripe, price,
               is_fractionable, units_per_package, fractional_unit
        FROM products
        WHERE id = ?
      `)
      .get(productId) as FractionableProduct;
  }

  /**
   * Executa o fracionamento farmacêutico (RDC 80/2006)
   * Rompe embalagem secundária fechada, gera sublote e credita unidades fracionadas.
   */
  public fractionateMedicine(input: FractionateMedicineInput): FractionationRecord {
    if (!input.pharmacist_name?.trim() || !input.pharmacist_crf?.trim() || !input.pharmacist_crf_uf?.trim()) {
      throw new Error('PHARMACIST_DETAILS_REQUIRED');
    }
    if (input.original_packages_opened <= 0) {
      throw new Error('INVALID_PACKAGES_QUANTITY');
    }

    const product = this.db
      .prepare(`
        SELECT id, name, ean, ms_registration, is_fractionable, units_per_package, fractional_unit
        FROM products
        WHERE id = ?
      `)
      .get(input.product_id) as
      | {
          id: number;
          name: string;
          ean: string;
          ms_registration: string;
          is_fractionable: number;
          units_per_package: number;
          fractional_unit: string;
        }
      | undefined;

    if (!product) {
      throw new Error('PRODUCT_NOT_FOUND');
    }
    if (product.is_fractionable !== 1) {
      throw new Error('PRODUCT_NOT_FRACTIONABLE');
    }

    const batch = this.db
      .prepare(`
        SELECT id, batch_number, expiration_date, quantity, reserved_quantity
        FROM batches
        WHERE id = ? AND product_id = ?
      `)
      .get(input.original_batch_id, input.product_id) as
      | { id: number; batch_number: string; expiration_date: string; quantity: number; reserved_quantity: number }
      | undefined;

    if (!batch) {
      throw new Error('BATCH_NOT_FOUND');
    }

    const availableStock = batch.quantity - batch.reserved_quantity;
    if (availableStock < input.original_packages_opened) {
      throw new Error('INSUFFICIENT_BATCH_STOCK');
    }

    const unitsGenerated = input.original_packages_opened * (product.units_per_package || 1);
    const subBatchCode = `FRAC-${batch.batch_number}-${Date.now().toString().slice(-6)}`;

    const transaction = this.db.transaction(() => {
      // Abate as caixas fechadas do lote pai
      this.db
        .prepare(`
          UPDATE batches
          SET quantity = quantity - ?
          WHERE id = ?
        `)
        .run(input.original_packages_opened, batch.id);

      // Registra o fracionamento
      const stmt = this.db.prepare(`
        INSERT INTO fractionation_records (
          store_id, product_id, original_batch_id, pharmacist_name, pharmacist_crf,
          pharmacist_crf_uf, original_packages_opened, units_generated, units_available,
          sub_batch_code, expiry_date, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const res = stmt.run(
        input.store_id,
        input.product_id,
        input.original_batch_id,
        input.pharmacist_name.trim(),
        input.pharmacist_crf.trim(),
        input.pharmacist_crf_uf.trim().toUpperCase(),
        input.original_packages_opened,
        unitsGenerated,
        unitsGenerated,
        subBatchCode,
        batch.expiration_date,
        input.notes || null
      );

      return Number(res.lastInsertRowid);
    });

    const recordId = transaction();
    return this.getFractionationRecord(recordId);
  }

  /**
   * Obtém detalhes de um registro de fracionamento e histórico de dispensações
   */
  public getFractionationRecord(id: number): FractionationRecord & {
    dispensations: FractionationDispensation[];
  } {
    const row = this.db
      .prepare(`
        SELECT fr.*, p.name as product_name, p.ean as product_ean, p.ms_registration,
               b.batch_number as original_batch_number
        FROM fractionation_records fr
        JOIN products p ON p.id = fr.product_id
        JOIN batches b ON b.id = fr.original_batch_id
        WHERE fr.id = ?
      `)
      .get(id) as FractionationRecord | undefined;

    if (!row) {
      throw new Error('FRACTIONATION_RECORD_NOT_FOUND');
    }

    const dispensations = this.db
      .prepare(`
        SELECT fd.*, p.name as product_name, fr.sub_batch_code, b.batch_number as original_batch_number,
               fr.expiry_date
        FROM fractionation_dispensations fd
        JOIN fractionation_records fr ON fr.id = fd.fractionation_record_id
        JOIN products p ON p.id = fr.product_id
        JOIN batches b ON b.id = fr.original_batch_id
        WHERE fd.fractionation_record_id = ?
        ORDER BY fd.dispensed_at DESC
      `)
      .all(id) as FractionationDispensation[];

    return {
      ...row,
      dispensations,
    };
  }

  /**
   * Lista registros de fracionamento
   */
  public listFractionationRecords(storeId?: number): FractionationRecord[] {
    let sql = `
      SELECT fr.*, p.name as product_name, p.ean as product_ean, p.ms_registration,
             b.batch_number as original_batch_number
      FROM fractionation_records fr
      JOIN products p ON p.id = fr.product_id
      JOIN batches b ON b.id = fr.original_batch_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (storeId) {
      sql += ' AND fr.store_id = ?';
      params.push(storeId);
    }
    sql += ' ORDER BY fr.id DESC';
    return this.db.prepare(sql).all(...params) as FractionationRecord[];
  }

  /**
   * Dispensação de medicamento fracionado ao paciente
   */
  public dispenseFractioned(input: DispenseFractionedInput): FractionationDispensation {
    if (!input.patient_name?.trim()) {
      throw new Error('PATIENT_NAME_REQUIRED');
    }
    if (!input.doctor_crm?.trim() || !input.doctor_name?.trim() || !input.posology?.trim()) {
      throw new Error('PRESCRIPTION_DATA_REQUIRED');
    }
    if (input.units_dispensed <= 0) {
      throw new Error('INVALID_DISPENSED_UNITS');
    }

    const record = this.db
      .prepare(`
        SELECT fr.*, p.name as product_name, p.price, p.units_per_package,
               b.batch_number as original_batch_number
        FROM fractionation_records fr
        JOIN products p ON p.id = fr.product_id
        JOIN batches b ON b.id = fr.original_batch_id
        WHERE fr.id = ?
      `)
      .get(input.fractionation_record_id) as any;

    if (!record) {
      throw new Error('FRACTIONATION_RECORD_NOT_FOUND');
    }

    if (record.units_available < input.units_dispensed) {
      throw new Error('INSUFFICIENT_FRACTIONED_STOCK');
    }

    const unitPrice = parseFloat(
      (record.price / (record.units_per_package || 1)).toFixed(2)
    );
    const totalPrice = parseFloat((unitPrice * input.units_dispensed).toFixed(2));

    const transaction = this.db.transaction(() => {
      // Abate unidades disponíveis do sublote
      this.db
        .prepare(`
          UPDATE fractionation_records
          SET units_available = units_available - ?
          WHERE id = ?
        `)
        .run(input.units_dispensed, input.fractionation_record_id);

      // Insere a dispensação
      const stmt = this.db.prepare(`
        INSERT INTO fractionation_dispensations (
          fractionation_record_id, sale_id, pre_sale_id, patient_name, patient_cpf,
          doctor_name, doctor_crm, doctor_uf, units_dispensed, unit_price,
          total_price, leaflet_supplied, posology
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const res = stmt.run(
        input.fractionation_record_id,
        input.sale_id || null,
        input.pre_sale_id || null,
        input.patient_name.trim(),
        input.patient_cpf || null,
        input.doctor_name.trim(),
        input.doctor_crm.trim(),
        input.doctor_uf.trim().toUpperCase(),
        input.units_dispensed,
        unitPrice,
        totalPrice,
        input.leaflet_supplied === false ? 0 : 1,
        input.posology.trim()
      );

      return Number(res.lastInsertRowid);
    });

    const dispensationId = transaction();

    return this.db
      .prepare(`
        SELECT fd.*, p.name as product_name, fr.sub_batch_code, b.batch_number as original_batch_number,
               fr.expiry_date
        FROM fractionation_dispensations fd
        JOIN fractionation_records fr ON fr.id = fd.fractionation_record_id
        JOIN products p ON p.id = fr.product_id
        JOIN batches b ON b.id = fr.original_batch_id
        WHERE fd.id = ?
      `)
      .get(dispensationId) as FractionationDispensation;
  }

  /**
   * Emissão de Rótulo Sanitário Térmico 48 colunas (Art. 8º RDC 80/2006 ANVISA)
   */
  public generateOfficialLabel(dispensationId: number): string {
    const row = this.db
      .prepare(`
        SELECT fd.*, p.name as product_name, p.active_ingredient, p.ms_registration, p.fractional_unit,
               fr.sub_batch_code, fr.pharmacist_name, fr.pharmacist_crf, fr.pharmacist_crf_uf,
               fr.fractionation_date, fr.expiry_date,
               b.batch_number as original_batch_number, b.manufacturing_date,
               s.name as store_name, s.cnpj as store_cnpj
        FROM fractionation_dispensations fd
        JOIN fractionation_records fr ON fr.id = fd.fractionation_record_id
        JOIN products p ON p.id = fr.product_id
        JOIN batches b ON b.id = fr.original_batch_id
        JOIN stores s ON s.id = fr.store_id
        WHERE fd.id = ?
      `)
      .get(dispensationId) as any;

    if (!row) {
      throw new Error('DISPENSATION_NOT_FOUND');
    }

    const line = '='.repeat(48);
    const subline = '-'.repeat(48);

    return [
      line,
      '           FARMACORE ERP & REDE DE FARMACIAS',
      `ESTABELECIMENTO: ${row.store_name?.toUpperCase() || 'FARMACIA FARMACORE'}`,
      `CNPJ: ${row.store_cnpj || '12.345.678/0001-90'}`,
      line,
      'ROTULO DE DISPENSACAO FRACIONADA (RDC 80/2006 ANVISA)',
      line,
      `MEDICAMENTO: ${row.product_name?.toUpperCase()}`,
      `DCB/SUBSTANCIA: ${row.active_ingredient?.toUpperCase() || 'NAO INFORMADO'}`,
      `REGISTRO MS: ${row.ms_registration || 'ISENTO/BR'}`,
      `LOTE ORIGINAL: ${row.original_batch_number}`,
      `SUBLOTE FRACIONADO: ${row.sub_batch_code}`,
      `FABRICACAO: ${row.manufacturing_date || 'N/A'} | VALIDADE: ${row.expiry_date}`,
      `DATA FRACIONAMENTO: ${row.fractionation_date}`,
      `FARMACEUTICO(A) RT: ${row.pharmacist_name?.toUpperCase()}`,
      `CRF: ${row.pharmacist_crf}/${row.pharmacist_crf_uf}`,
      subline,
      `QTD DISPENSADA: ${row.units_dispensed} ${row.fractional_unit || 'UNIDADE(S)'}`,
      `VALOR TOTAL: R$ ${row.total_price.toFixed(2)} (R$ ${row.unit_price.toFixed(2)}/un)`,
      `PACIENTE: ${row.patient_name?.toUpperCase()}${row.patient_cpf ? ' - CPF: ' + row.patient_cpf : ''}`,
      `MEDICO(A): ${row.doctor_name?.toUpperCase()} - CRM ${row.doctor_crm}/${row.doctor_uf}`,
      `POSOLOGIA: ${row.posology?.toUpperCase()}`,
      subline,
      `[${row.leaflet_supplied === 1 ? 'X' : ' '}] COPIA DA BULA OFICIAL ENTREGUE AO PACIENTE`,
      '"ESTE MEDICAMENTO FOI FRACIONADO CONFORME RECEITA',
      'MEDICA SOB RESPONSABILIDADE DO FARMACEUTICO."',
      line,
    ].join('\n');
  }

  /**
   * Indicadores e KPIs de Fracionamento
   */
  public getFractionationKpis(): FractionationKpis {
    const fracCounts = this.db
      .prepare(`
        SELECT 
          COUNT(id) as total_frac,
          SUM(CASE WHEN units_available > 0 THEN 1 ELSE 0 END) as active_subbatches,
          COALESCE(SUM(units_available), 0) as total_units_available
        FROM fractionation_records
      `)
      .get() as { total_frac: number; active_subbatches: number; total_units_available: number };

    const dispRow = this.db
      .prepare(`
        SELECT 
          COUNT(id) as total_disp,
          COALESCE(SUM(total_price), 0) as total_dispensed_amount
        FROM fractionation_dispensations
      `)
      .get() as { total_disp: number; total_dispensed_amount: number };

    const prodCount = this.db
      .prepare('SELECT COUNT(id) as total FROM products WHERE is_fractionable = 1')
      .get() as { total: number };

    // Economia estimada ao consumidor:
    // Média de 35% de economia calculada pelo custo evitado de comprar caixas fechadas completas
    const estimatedSavings = parseFloat((dispRow.total_dispensed_amount * 0.35).toFixed(2));

    return {
      totalFractionations: fracCounts?.total_frac || 0,
      activeSubBatches: fracCounts?.active_subbatches || 0,
      totalUnitsAvailable: fracCounts?.total_units_available || 0,
      totalDispensations: dispRow?.total_disp || 0,
      fractionableProductsCount: prodCount?.total || 0,
      estimatedConsumerSavings: estimatedSavings,
    };
  }
}
