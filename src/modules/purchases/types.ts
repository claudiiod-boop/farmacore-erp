export interface PurchaseInvoice {
  id: number;
  accessKey: string;
  invoiceNumber: number;
  invoiceSeries: number;
  issueDate: string;
  supplierCnpj: string;
  supplierName: string;
  supplierIe?: string | null;
  totalInvoiceAmount: number;
  totalProductsAmount: number;
  totalIcmsSt: number;
  xmlContent: string;
  createdAt?: string;
}

export interface PurchaseInvoiceItem {
  id: number;
  purchaseInvoiceId: number;
  productId: number;
  batchId?: number | null;
  itemIndex: number;
  supplierProductCode: string;
  ean: string;
  productName: string;
  ncm: string;
  cfop: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  batchNumber?: string | null;
  expirationDate?: string | null;
  manufacturingDate?: string | null;
  anvisaRegistration?: string | null;
  pmc?: number | null;
  createdAt?: string;
}

export interface ParsedNfeItem {
  itemIndex: number;
  supplierProductCode: string;
  ean: string;
  productName: string;
  ncm: string;
  cfop: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  batchNumber?: string | null;
  expirationDate?: string | null;
  manufacturingDate?: string | null;
  anvisaRegistration?: string | null;
  pmc?: number | null;
}

export interface ParsedNfeInvoice {
  accessKey: string;
  invoiceNumber: number;
  invoiceSeries: number;
  issueDate: string;
  supplierCnpj: string;
  supplierName: string;
  supplierIe?: string | null;
  totalInvoiceAmount: number;
  totalProductsAmount: number;
  totalIcmsSt: number;
  items: ParsedNfeItem[];
}

export interface PurchasePreviewItem extends ParsedNfeItem {
  productId?: number | null;
  isExistingProduct: boolean;
  cmedWarning?: string | null;
  suggestedPrice?: number | null;
}

export interface PurchasePreviewResult {
  accessKey: string;
  invoiceNumber: number;
  invoiceSeries: number;
  issueDate: string;
  supplierCnpj: string;
  supplierName: string;
  totalInvoiceAmount: number;
  totalProductsAmount: number;
  totalIcmsSt: number;
  items: PurchasePreviewItem[];
  newProductsCount: number;
  existingProductsCount: number;
  hasCmedAlerts: boolean;
}

export interface PurchaseImportOptions {
  autoRegisterProducts?: boolean;
  itemClassifications?: Record<string, { stripe: string; controlType: string }>;
}

export interface PurchaseImportResult {
  invoiceId: number;
  accessKey: string;
  batchesCreatedCount: number;
  productsRegisteredCount: number;
  totalItems: number;
}
