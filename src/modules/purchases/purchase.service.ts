import { Database } from '../../database/connection';
import { parseNfeXml } from './nfe-parser';
import type {
  PurchasePreviewItem,
  PurchasePreviewResult,
  PurchaseImportOptions,
  PurchaseImportResult,
  PurchaseInvoiceSummary,
  PurchaseInvoiceDetails,
} from './types';

export class PurchaseImportError extends Error {
  code: string;

  constructor(message: string, code = 'PURCHASE_IMPORT_ERROR') {
    super(message);
    this.name = 'PurchaseImportError';
    this.code = code;
  }
}

export interface SngpcServiceEntryPayload {
  movementType: 'ENTRADA';
  productId: number;
  batchId: number;
  quantity: number;
  referenceType: 'PURCHASE_INVOICE';
  referenceId: number;
  movementDate: string;
  msRegistration: string;
}

interface ProductRow {
  id: number | bigint;
  ean: string;
  name: string;
  price: number;
  pmc: number;
  control_type: string;
  ms_registration: string;
}

export class PurchaseService {
  constructor(
    private db: Database,
    private sngpcService?: { recordEntryMovement: (data: SngpcServiceEntryPayload) => void }
  ) {}

  /**
   * Dry-run preview of NF-e XML.
   * Completely read-only with zero database side-effects.
   * Cross-references EANs with catalog products and flags CMED ceiling warnings.
   */
  previewNfeXml(xmlString: string): PurchasePreviewResult {
    const parsed = parseNfeXml(xmlString);

    const findProductStmt = this.db.prepare<ProductRow>(
      'SELECT id, ean, name, price, pmc, control_type, ms_registration FROM products WHERE ean = ?'
    );

    const previewItems: PurchasePreviewItem[] = parsed.items.map((item) => {
      const product = findProductStmt.get(item.ean);

      if (product) {
        const currentPrice = Number(product.price);
        const itemPmc = item.pmc !== null && item.pmc !== undefined ? Number(item.pmc) : null;
        let cmedWarning: string | null = null;
        let suggestedPrice: number | null = currentPrice;

        if (itemPmc !== null && itemPmc > 0 && currentPrice > itemPmc) {
          cmedWarning = `Preço de venda atual (R$ ${currentPrice.toFixed(2)}) excede o PMC da CMED (R$ ${itemPmc.toFixed(2)})`;
          suggestedPrice = itemPmc;
        }

        return {
          ...item,
          productId: Number(product.id),
          isExistingProduct: true,
          cmedWarning,
          suggestedPrice,
        };
      } else {
        return {
          ...item,
          productId: null,
          isExistingProduct: false,
          cmedWarning: null,
          suggestedPrice: item.pmc ?? null,
        };
      }
    });

    const newProductsCount = previewItems.filter((i) => !i.isExistingProduct).length;
    const existingProductsCount = previewItems.filter((i) => i.isExistingProduct).length;
    const hasCmedAlerts = previewItems.some((i) => !!i.cmedWarning);

    return {
      accessKey: parsed.accessKey,
      invoiceNumber: parsed.invoiceNumber,
      invoiceSeries: parsed.invoiceSeries,
      issueDate: parsed.issueDate,
      supplierCnpj: parsed.supplierCnpj,
      supplierName: parsed.supplierName,
      totalInvoiceAmount: parsed.totalInvoiceAmount,
      totalProductsAmount: parsed.totalProductsAmount,
      totalIcmsSt: parsed.totalIcmsSt,
      items: previewItems,
      newProductsCount,
      existingProductsCount,
      hasCmedAlerts,
    };
  }

  /**
   * Atomically imports an NF-e XML into the ERP database inside a transaction.
   * Creates/updates catalog products, enforces CMED ceiling price limits,
   * creates inventory batches (FEFO), and registers regulatory SNGPC ENTRADA movements.
   */
  importNfeXml(xmlString: string, options?: PurchaseImportOptions): PurchaseImportResult {
    const parsed = parseNfeXml(xmlString);

    return this.db.transaction(() => {
      // 1. Check if invoice has already been imported
      const existing = this.db
        .prepare<{ id: number }>('SELECT id FROM purchase_invoices WHERE access_key = ?')
        .get(parsed.accessKey);

      if (existing) {
        throw new PurchaseImportError(
          `Nota fiscal de compra já importada anteriormente (Chave: ${parsed.accessKey})`,
          'PURCHASE_INVOICE_ALREADY_IMPORTED'
        );
      }

      // 2. Insert invoice header
      const insertInvoiceStmt = this.db.prepare(`
        INSERT INTO purchase_invoices (
          access_key, invoice_number, invoice_series, issue_date,
          supplier_cnpj, supplier_name, supplier_ie,
          total_invoice_amount, total_products_amount, total_icms_st,
          xml_content
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const invoiceRun = insertInvoiceStmt.run(
        parsed.accessKey,
        parsed.invoiceNumber,
        parsed.invoiceSeries,
        parsed.issueDate,
        parsed.supplierCnpj,
        parsed.supplierName,
        parsed.supplierIe || null,
        parsed.totalInvoiceAmount,
        parsed.totalProductsAmount,
        parsed.totalIcmsSt,
        xmlString
      );

      const invoiceId = Number(invoiceRun.lastInsertRowid);

      let batchesCreatedCount = 0;
      let productsRegisteredCount = 0;

      const findProductStmt = this.db.prepare<ProductRow>(
        'SELECT id, ean, name, price, pmc, control_type, ms_registration FROM products WHERE ean = ?'
      );

      const insertProductStmt = this.db.prepare(`
        INSERT INTO products (
          ean, name, active_ingredient, ms_registration,
          stripe, control_type, pmc, pf, price, is_active,
          ncm, cest, cfop, csosn_icms, cst_pis, cst_cofins, origin
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, '1300100', '5405', '500', '04', '04', 0)
      `);

      const updateProductPriceStmt = this.db.prepare(
        'UPDATE products SET price = ?, pmc = ? WHERE id = ?'
      );

      const updateProductPmcStmt = this.db.prepare('UPDATE products SET pmc = ? WHERE id = ?');

      const insertBatchStmt = this.db.prepare(`
        INSERT INTO batches (
          product_id, batch_number, manufacturing_date, expiration_date, quantity, reserved_quantity
        ) VALUES (?, ?, ?, ?, ?, 0)
      `);

      const insertItemStmt = this.db.prepare(`
        INSERT INTO purchase_invoice_items (
          purchase_invoice_id, product_id, batch_id, item_index,
          supplier_product_code, ean, product_name, ncm, cfop,
          quantity, unit_cost, total_cost,
          batch_number, expiration_date, manufacturing_date,
          anvisa_registration, pmc
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertSngpcStmt = this.db.prepare(`
        INSERT INTO sngpc_movements (
          movement_type, product_id, batch_id, quantity, reference_type,
          reference_id, movement_date, ms_registration, is_transmitted
        ) VALUES ('ENTRADA', ?, ?, ?, 'PURCHASE_INVOICE', ?, ?, ?, 0)
      `);

      for (const item of parsed.items) {
        let product = findProductStmt.get(item.ean);
        let productId: number;
        let controlType = 'ISENTO';
        let msRegistration = item.anvisaRegistration || '';

        if (!product) {
          if (!options?.autoRegisterProducts) {
            throw new PurchaseImportError(
              `Produto com EAN ${item.ean} (${item.productName}) não cadastrado no catálogo. Habilite auto-cadastro para prosseguir.`,
              'PRODUCT_NOT_FOUND'
            );
          }

          const customClass = options.itemClassifications?.[item.ean];
          const stripe = customClass?.stripe || 'SEM_TARJA';
          controlType = customClass?.controlType || 'ISENTO';
          const pmc = item.pmc && item.pmc > 0 ? item.pmc : item.unitCost * 1.5;
          const price = pmc;

          const productRun = insertProductStmt.run(
            item.ean,
            item.productName,
            item.productName,
            item.anvisaRegistration || '',
            stripe,
            controlType,
            pmc,
            item.unitCost,
            price,
            item.ncm || '30049099'
          );

          productId = Number(productRun.lastInsertRowid);
          productsRegisteredCount++;
        } else {
          productId = Number(product.id);
          controlType = product.control_type;
          msRegistration = item.anvisaRegistration || product.ms_registration || '';

          // CMED ceiling enforcement
          if (item.pmc !== null && item.pmc !== undefined && item.pmc > 0) {
            if (product.price > item.pmc) {
              updateProductPriceStmt.run(item.pmc, item.pmc, productId);
            } else if (product.pmc !== item.pmc) {
              updateProductPmcStmt.run(item.pmc, productId);
            }
          }
        }

        // Batch creation
        const batchNumber = item.batchNumber || `LOTE-${parsed.invoiceNumber}-${item.itemIndex}`;
        const mfgDate = item.manufacturingDate || parsed.issueDate;
        const expDate = item.expirationDate || '2099-12-31';
        const batchQty = Math.round(item.quantity);

        const batchRun = insertBatchStmt.run(
          productId,
          batchNumber,
          mfgDate,
          expDate,
          batchQty
        );
        const batchId = Number(batchRun.lastInsertRowid);
        batchesCreatedCount++;

        // SNGPC integration for controlled items
        if (controlType !== 'ISENTO') {
          if (this.sngpcService?.recordEntryMovement) {
            this.sngpcService.recordEntryMovement({
              movementType: 'ENTRADA',
              productId,
              batchId,
              quantity: batchQty,
              referenceType: 'PURCHASE_INVOICE',
              referenceId: invoiceId,
              movementDate: parsed.issueDate,
              msRegistration,
            });
          } else {
            insertSngpcStmt.run(
              productId,
              batchId,
              batchQty,
              invoiceId,
              parsed.issueDate,
              msRegistration
            );
          }
        }

        // Insert invoice item
        insertItemStmt.run(
          invoiceId,
          productId,
          batchId,
          item.itemIndex,
          item.supplierProductCode,
          item.ean,
          item.productName,
          item.ncm,
          item.cfop,
          batchQty,
          item.unitCost,
          item.totalCost,
          batchNumber,
          expDate,
          mfgDate,
          item.anvisaRegistration || null,
          item.pmc || null
        );
      }

      return {
        invoiceId,
        accessKey: parsed.accessKey,
        batchesCreatedCount,
        productsRegisteredCount,
        totalItems: parsed.items.length,
      };
    })();
  }

  /**
   * Returns list of imported purchase invoices ordered by created_at DESC.
   */
  getInvoices(): PurchaseInvoiceSummary[] {
    const rows = this.db
      .prepare<any>(`
        SELECT
          id,
          access_key as accessKey,
          invoice_number as invoiceNumber,
          invoice_series as invoiceSeries,
          issue_date as issueDate,
          supplier_cnpj as supplierCnpj,
          supplier_name as supplierName,
          supplier_ie as supplierIe,
          total_invoice_amount as totalInvoiceAmount,
          total_products_amount as totalProductsAmount,
          total_icms_st as totalIcmsSt,
          created_at as createdAt,
          (SELECT COUNT(*) FROM purchase_invoice_items WHERE purchase_invoice_id = purchase_invoices.id) as itemsCount
        FROM purchase_invoices
        ORDER BY created_at DESC, id DESC
      `)
      .all();

    return rows.map((r) => ({
      id: Number(r.id),
      accessKey: r.accessKey,
      invoiceNumber: Number(r.invoiceNumber),
      invoiceSeries: Number(r.invoiceSeries),
      issueDate: r.issueDate,
      supplierCnpj: r.supplierCnpj,
      supplierName: r.supplierName,
      supplierIe: r.supplierIe,
      totalInvoiceAmount: Number(r.totalInvoiceAmount),
      totalProductsAmount: Number(r.totalProductsAmount),
      totalIcmsSt: Number(r.totalIcmsSt),
      itemsCount: Number(r.itemsCount || 0),
      createdAt: r.createdAt,
    }));
  }

  listInvoices(): PurchaseInvoiceSummary[] {
    return this.getInvoices();
  }

  /**
   * Returns purchase invoice details including all items and linked batch information.
   */
  getInvoiceById(id: number): PurchaseInvoiceDetails | null {
    const invoice = this.db
      .prepare<any>(`
        SELECT
          id,
          access_key as accessKey,
          invoice_number as invoiceNumber,
          invoice_series as invoiceSeries,
          issue_date as issueDate,
          supplier_cnpj as supplierCnpj,
          supplier_name as supplierName,
          supplier_ie as supplierIe,
          total_invoice_amount as totalInvoiceAmount,
          total_products_amount as totalProductsAmount,
          total_icms_st as totalIcmsSt,
          xml_content as xmlContent,
          created_at as createdAt
        FROM purchase_invoices
        WHERE id = ?
      `)
      .get(id);

    if (!invoice) return null;

    const items = this.db
      .prepare<any>(`
        SELECT
          id,
          purchase_invoice_id as purchaseInvoiceId,
          product_id as productId,
          batch_id as batchId,
          item_index as itemIndex,
          supplier_product_code as supplierProductCode,
          ean,
          product_name as productName,
          ncm,
          cfop,
          quantity,
          unit_cost as unitCost,
          total_cost as totalCost,
          batch_number as batchNumber,
          expiration_date as expirationDate,
          manufacturing_date as manufacturingDate,
          anvisa_registration as anvisaRegistration,
          pmc,
          created_at as createdAt
        FROM purchase_invoice_items
        WHERE purchase_invoice_id = ?
        ORDER BY item_index ASC
      `)
      .all(id);

    const batchStmt = this.db.prepare<any>(`
      SELECT id, batch_number as batchNumber, manufacturing_date as manufacturingDate, expiration_date as expirationDate, quantity
      FROM batches
      WHERE id = ?
    `);

    const mappedItems = items.map((item) => {
      let batch = null;
      if (item.batchId) {
        const b = batchStmt.get(item.batchId);
        if (b) {
          batch = {
            id: Number(b.id),
            batchNumber: b.batchNumber,
            manufacturingDate: b.manufacturingDate,
            expirationDate: b.expirationDate,
            quantity: Number(b.quantity),
          };
        }
      }

      return {
        id: Number(item.id),
        purchaseInvoiceId: Number(item.purchaseInvoiceId),
        productId: Number(item.productId),
        batchId: item.batchId ? Number(item.batchId) : null,
        itemIndex: Number(item.itemIndex),
        supplierProductCode: item.supplierProductCode,
        ean: item.ean,
        productName: item.productName,
        ncm: item.ncm,
        cfop: item.cfop,
        quantity: Number(item.quantity),
        unitCost: Number(item.unitCost),
        totalCost: Number(item.totalCost),
        batchNumber: item.batchNumber,
        expirationDate: item.expirationDate,
        manufacturingDate: item.manufacturingDate,
        anvisaRegistration: item.anvisaRegistration,
        pmc: item.pmc !== null && item.pmc !== undefined ? Number(item.pmc) : null,
        createdAt: item.createdAt,
        batch,
      };
    });

    return {
      id: Number(invoice.id),
      accessKey: invoice.accessKey,
      invoiceNumber: Number(invoice.invoiceNumber),
      invoiceSeries: Number(invoice.invoiceSeries),
      issueDate: invoice.issueDate,
      supplierCnpj: invoice.supplierCnpj,
      supplierName: invoice.supplierName,
      supplierIe: invoice.supplierIe,
      totalInvoiceAmount: Number(invoice.totalInvoiceAmount),
      totalProductsAmount: Number(invoice.totalProductsAmount),
      totalIcmsSt: Number(invoice.totalIcmsSt),
      xmlContent: invoice.xmlContent,
      createdAt: invoice.createdAt,
      items: mappedItems,
    };
  }
}
