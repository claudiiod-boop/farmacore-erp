import { Database } from '../../database/connection';
import { CatalogService } from '../catalog/catalog.service';
import { InventoryService } from '../inventory/inventory.service';
import {
  CreatePreSaleDTO,
  PreSale,
  PreSaleDetails,
  PreSaleItemDetails,
  PreSaleStatus,
  PrescriptionDetails,
} from './types';

interface PreSaleRow {
  id: number | bigint;
  code: string;
  status: string;
  customer_name: string | null;
  customer_cpf: string | null;
  total_amount: number;
  created_at: string;
}

interface PreSaleItemRow {
  id: number | bigint;
  pre_sale_id: number | bigint;
  product_id: number | bigint;
  product_name: string;
  batch_id: number | bigint;
  batch_number: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface PrescriptionRow {
  id: number | bigint;
  pre_sale_id: number | bigint;
  doctor_name: string;
  doctor_crm: string;
  doctor_uf: string;
  prescription_type: string;
  prescription_date: string;
  patient_name: string;
  buyer_name: string | null;
  buyer_cpf: string | null;
  created_at: string;
}

function mapPreSaleRow(row: PreSaleRow): PreSale {
  return {
    id: Number(row.id),
    code: row.code,
    status: row.status as PreSaleStatus,
    customerName: row.customer_name,
    customerCpf: row.customer_cpf,
    totalAmount: Number(row.total_amount),
    createdAt: row.created_at,
  };
}

function mapPreSaleItemRow(row: PreSaleItemRow): PreSaleItemDetails {
  return {
    id: Number(row.id),
    preSaleId: Number(row.pre_sale_id),
    productId: Number(row.product_id),
    productName: row.product_name,
    batchId: Number(row.batch_id),
    batchNumber: row.batch_number,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
    totalPrice: Number(row.total_price),
  };
}

function mapPrescriptionRow(row: PrescriptionRow): PrescriptionDetails {
  return {
    id: Number(row.id),
    preSaleId: Number(row.pre_sale_id),
    doctorName: row.doctor_name,
    doctorCrm: row.doctor_crm,
    doctorUf: row.doctor_uf,
    prescriptionType: row.prescription_type,
    prescriptionDate: row.prescription_date,
    patientName: row.patient_name,
    buyerName: row.buyer_name,
    buyerCpf: row.buyer_cpf,
    createdAt: row.created_at,
  };
}

export class PreSaleService {
  constructor(
    private db: Database,
    private catalogService: CatalogService,
    private inventoryService: InventoryService
  ) {}

  createPreSale(dto: CreatePreSaleDTO): PreSale {
    if (!dto.items || !Array.isArray(dto.items) || dto.items.length === 0) {
      throw new Error('EMPTY_PRE_SALE');
    }

    const validatedItems: {
      productId: number;
      batchId: number;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }[] = [];

    let hasControlledProduct = false;

    for (const item of dto.items) {
      if (typeof item.quantity !== 'number' || item.quantity <= 0) {
        throw new Error('INVALID_QUANTITY');
      }

      const product = this.catalogService.getProductById(item.productId);
      if (!product || !product.isActive) {
        throw new Error('PRODUCT_NOT_FOUND');
      }

      if (product.controlType !== 'ISENTO') {
        hasControlledProduct = true;
      }

      const unitPrice = product.price;
      const totalPrice = Number((unitPrice * item.quantity).toFixed(2));

      validatedItems.push({
        productId: item.productId,
        batchId: item.batchId,
        quantity: item.quantity,
        unitPrice,
        totalPrice,
      });
    }

    if (hasControlledProduct) {
      if (!dto.prescription) {
        throw new Error('PRESCRIPTION_REQUIRED');
      }

      const p = dto.prescription;
      const requiredFields = [
        p.doctorName,
        p.doctorCrm,
        p.doctorUf,
        p.prescriptionType,
        p.prescriptionDate,
        p.patientName,
      ];

      for (const field of requiredFields) {
        if (!field || typeof field !== 'string' || field.trim() === '') {
          throw new Error('PRESCRIPTION_REQUIRED');
        }
      }
    }

    const createTx = this.db.transaction(() => {
      // 1. Reserve each batch atomically
      for (const item of validatedItems) {
        const batch = this.inventoryService.getBatchById(item.batchId);
        if (!batch || batch.productId !== item.productId) {
          throw new Error('INSUFFICIENT_BATCH_STOCK');
        }

        this.inventoryService.reserveBatchStock(item.batchId, item.quantity);
      }

      // 2. Calculate total amount
      const totalAmount = Number(
        validatedItems.reduce((acc, curr) => acc + curr.totalPrice, 0).toFixed(2)
      );

      // 3. Insert pre-sale row with temporary unique code
      const tempCode = `TMP-${Date.now()}-${Math.random()}`;
      const insertPreSaleStmt = this.db.prepare(`
        INSERT INTO pre_sales (code, status, customer_name, customer_cpf, total_amount)
        VALUES (?, 'OPEN', ?, ?, ?)
      `);

      const result = insertPreSaleStmt.run(
        tempCode,
        dto.customerName ?? null,
        dto.customerCpf ?? null,
        totalAmount
      );

      const preSaleId = Number(result.lastInsertRowid);
      const code = `PV-${preSaleId.toString().padStart(4, '0')}`;

      this.db.prepare('UPDATE pre_sales SET code = ? WHERE id = ?').run(code, preSaleId);

      // 4. Insert pre-sale items
      const insertItemStmt = this.db.prepare(`
        INSERT INTO pre_sale_items (pre_sale_id, product_id, batch_id, quantity, unit_price, total_price)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const item of validatedItems) {
        insertItemStmt.run(
          preSaleId,
          item.productId,
          item.batchId,
          item.quantity,
          item.unitPrice,
          item.totalPrice
        );
      }

      // 5. Insert prescription if provided
      if (dto.prescription) {
        const p = dto.prescription;
        const insertPrescriptionStmt = this.db.prepare(`
          INSERT INTO prescriptions (
            pre_sale_id,
            doctor_name,
            doctor_crm,
            doctor_uf,
            prescription_type,
            prescription_date,
            patient_name,
            buyer_name,
            buyer_cpf
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        insertPrescriptionStmt.run(
          preSaleId,
          p.doctorName.trim(),
          p.doctorCrm.trim(),
          p.doctorUf.trim(),
          p.prescriptionType.trim(),
          p.prescriptionDate.trim(),
          p.patientName.trim(),
          p.buyerName ? p.buyerName.trim() : null,
          p.buyerCpf ? p.buyerCpf.trim() : null
        );
      }

      const row = this.db
        .prepare<PreSaleRow>('SELECT * FROM pre_sales WHERE id = ?')
        .get(preSaleId);

      if (!row) {
        throw new Error('Failed to retrieve newly created pre-sale');
      }

      return mapPreSaleRow(row);
    });

    return createTx();
  }

  getPreSaleByCode(code: string): PreSaleDetails | null {
    const preSaleRow = this.db
      .prepare<PreSaleRow>('SELECT * FROM pre_sales WHERE code = ?')
      .get(code);

    if (!preSaleRow) {
      return null;
    }

    const preSale = mapPreSaleRow(preSaleRow);

    const itemRows = this.db
      .prepare<PreSaleItemRow>(`
        SELECT
          psi.id,
          psi.pre_sale_id,
          psi.product_id,
          p.name AS product_name,
          psi.batch_id,
          b.batch_number AS batch_number,
          psi.quantity,
          psi.unit_price,
          psi.total_price
        FROM pre_sale_items psi
        JOIN products p ON p.id = psi.product_id
        JOIN batches b ON b.id = psi.batch_id
        WHERE psi.pre_sale_id = ?
        ORDER BY psi.id ASC
      `)
      .all(preSale.id);

    const items = itemRows.map(mapPreSaleItemRow);

    const prescriptionRow = this.db
      .prepare<PrescriptionRow>('SELECT * FROM prescriptions WHERE pre_sale_id = ?')
      .get(preSale.id);

    const prescription = prescriptionRow ? mapPrescriptionRow(prescriptionRow) : null;

    return {
      preSale,
      items,
      prescription,
    };
  }

  cancelPreSale(code: string): void {
    const preSaleRow = this.db
      .prepare<PreSaleRow>('SELECT * FROM pre_sales WHERE code = ?')
      .get(code);

    if (!preSaleRow) {
      throw new Error('PRE_SALE_NOT_FOUND');
    }

    if (preSaleRow.status !== 'OPEN') {
      throw new Error('PRE_SALE_NOT_OPEN');
    }

    const preSaleId = Number(preSaleRow.id);

    const cancelTx = this.db.transaction(() => {
      const items = this.db
        .prepare<{ batch_id: number; quantity: number }>(`
          SELECT batch_id, quantity FROM pre_sale_items WHERE pre_sale_id = ?
        `)
        .all(preSaleId);

      for (const item of items) {
        this.inventoryService.releaseBatchStock(Number(item.batch_id), Number(item.quantity));
      }

      this.db.prepare("UPDATE pre_sales SET status = 'CANCELLED' WHERE id = ?").run(preSaleId);
    });

    cancelTx();
  }
}
