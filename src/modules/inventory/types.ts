export interface Batch {
  id: number;
  productId: number;
  batchNumber: string;
  manufacturingDate: string; // YYYY-MM-DD
  expirationDate: string;    // YYYY-MM-DD
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number; // quantity - reservedQuantity
  createdAt: string;
}

export interface AddBatchDTO {
  productId: number;
  batchNumber: string;
  manufacturingDate: string;
  expirationDate: string;
  quantity: number;
}

export * from './audit-types';

