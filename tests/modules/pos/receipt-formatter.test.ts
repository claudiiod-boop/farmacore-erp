import { describe, it, expect } from 'vitest';
import { formatReceipt, ReceiptFormatOptions } from '../../../src/modules/pos/receipt-formatter';
import { SaleDetails } from '../../../src/modules/pos/types';

describe('Receipt Formatter (ESC/POS 48 colunas)', () => {
  const sampleOtcSale: SaleDetails = {
    sale: {
      id: 1,
      preSaleId: 10,
      cashSessionId: 1,
      status: 'COMPLETED',
      totalAmount: 35.0,
      discountAmount: 0,
      changeAmount: 5.0,
      createdAt: '2026-11-02T10:30:00.000Z',
    },
    items: [
      {
        id: 1,
        saleId: 1,
        productId: 101,
        productName: 'Dipirona Monoidratada 500mg 20 Comprimidos',
        batchId: 201,
        batchNumber: 'LOTE-DIP-01',
        expirationDate: '2027-12-31',
        quantity: 2,
        unitPrice: 10.0,
        totalPrice: 20.0,
      },
      {
        id: 2,
        saleId: 1,
        productId: 102,
        productName: 'Vitamina C 1g Efervescente 10cpr',
        batchId: 202,
        batchNumber: 'LOTE-VIT-02',
        expirationDate: '2028-06-30',
        quantity: 1,
        unitPrice: 15.0,
        totalPrice: 15.0,
      },
    ],
    payments: [
      {
        id: 1,
        saleId: 1,
        method: 'DINHEIRO',
        amount: 40.0,
        createdAt: '2026-11-02T10:30:00.000Z',
      },
    ],
    preSaleCode: 'PV-0001',
    prescription: null,
  };

  const sampleControlledSale: SaleDetails = {
    sale: {
      id: 2,
      preSaleId: 11,
      cashSessionId: 1,
      status: 'COMPLETED',
      totalAmount: 45.0,
      discountAmount: 0,
      changeAmount: 0,
      createdAt: '2026-11-02T11:00:00.000Z',
    },
    items: [
      {
        id: 3,
        saleId: 2,
        productId: 103,
        productName: 'Clonazepam 2mg 30 Comprimidos',
        batchId: 203,
        batchNumber: 'LOTE-CLONA-99',
        expirationDate: '2027-05-15',
        quantity: 1,
        unitPrice: 45.0,
        totalPrice: 45.0,
      },
    ],
    payments: [
      {
        id: 2,
        saleId: 2,
        method: 'PIX',
        amount: 45.0,
        createdAt: '2026-11-02T11:00:00.000Z',
      },
    ],
    preSaleCode: 'PV-0002',
    prescription: {
      id: 1,
      preSaleId: 11,
      doctorName: 'Dr. Roberto Carlos da Silva',
      doctorCrm: '123456',
      doctorUf: 'SP',
      prescriptionType: 'B1',
      prescriptionDate: '2026-11-01',
      patientName: 'Maria de Lourdes Santos Oliveira',
      buyerName: 'Joao dos Santos Oliveira',
      buyerCpf: '123.456.789-00',
      createdAt: '2026-11-02T10:55:00.000Z',
    },
  };

  it('should format receipt string and ensure all lines do not exceed 48 columns', () => {
    const receipt = formatReceipt(sampleOtcSale);
    expect(typeof receipt).toBe('string');
    expect(receipt.length).toBeGreaterThan(0);

    const lines = receipt.split('\n');
    for (const [idx, line] of lines.entries()) {
      expect(line.length, `Line ${idx + 1} exceeds 48 columns: "${line}"`).toBeLessThanOrEqual(48);
    }
  });

  it('should include store header details, CNPJ and document title', () => {
    const receipt = formatReceipt(sampleOtcSale);

    expect(receipt).toContain('FARMACORE DROGARIA & FARMACIA');
    expect(receipt).toContain('12.345.678/0001-90');
    expect(receipt).toContain('EXTRATO DE VENDA AO CONSUMIDOR');
  });

  it('should properly format items, quantities, prices, lot numbers and expiration dates', () => {
    const receipt = formatReceipt(sampleOtcSale);

    expect(receipt).toContain('Dipirona Monoidratada');
    expect(receipt).toContain('LOTE: LOTE-DIP-01');
    expect(receipt).toContain('VAL: 2027-12-31');
    expect(receipt).toContain('Vitamina C');
    expect(receipt).toContain('LOTE: LOTE-VIT-02');
    expect(receipt).toContain('VAL: 2028-06-30');
  });

  it('should include totals, discounts, payments, and change amount', () => {
    const receipt = formatReceipt(sampleOtcSale);

    expect(receipt).toContain('SUBTOTAL');
    expect(receipt).toContain('35.00');
    expect(receipt).toContain('DESCONTO');
    expect(receipt).toContain('TOTAL R$');
    expect(receipt).toContain('DINHEIRO');
    expect(receipt).toContain('40.00');
    expect(receipt).toContain('TROCO R$');
    expect(receipt).toContain('5.00');
  });

  it('should NOT include controlled substance section for OTC sales without prescription', () => {
    const receipt = formatReceipt(sampleOtcSale);
    expect(receipt).not.toContain('*** DISPENSACAO SOB CONTROLE ESPECIAL ***');
    expect(receipt).not.toContain('RECEITA:');
    expect(receipt).not.toContain('CRM:');
  });

  it('should include prominent Portaria 344/98 controlled substance section when prescription is present', () => {
    const receipt = formatReceipt(sampleControlledSale);

    expect(receipt).toContain('*** DISPENSACAO SOB CONTROLE ESPECIAL ***');
    expect(receipt).toContain('RECEITA: B1');
    expect(receipt).toContain('DATA: 2026-11-01');
    expect(receipt).toContain('MEDICO:');
    expect(receipt).toContain('Dr. Roberto Carlos da Silva');
    expect(receipt).toContain('CRM: 123456/SP');
    expect(receipt).toContain('PACIENTE: Maria de Lourdes Santos Oliveira');
    expect(receipt).toContain('COMPRADOR: Joao dos Santos Oliveira');
    expect(receipt).toContain('CPF: 123.456.789-00');

    // Verify all lines still strictly adhere to 48 chars
    const lines = receipt.split('\n');
    for (const [idx, line] of lines.entries()) {
      expect(line.length, `Line ${idx + 1} exceeds 48 columns: "${line}"`).toBeLessThanOrEqual(48);
    }
  });

  it('should include footer with tax transparency notice (Lei 12.741/2012) and fiscal simulation disclaimer', () => {
    const receipt = formatReceipt(sampleOtcSale);

    expect(receipt).toMatch(/12\.741/);
    expect(receipt).toMatch(/SIMULA/i);
  });

  it('should support custom formatting options (custom store name, cnpj, address, width)', () => {
    const options: ReceiptFormatOptions = {
      storeName: 'FARMACIA POPULAR DE BAIRRO',
      cnpj: '99.888.777/0001-11',
      address: 'Rua das Flores, 123',
      city: 'Curitiba/PR',
      columnWidth: 48,
    };

    const receipt = formatReceipt(sampleOtcSale, options);
    expect(receipt).toContain('FARMACIA POPULAR DE BAIRRO');
    expect(receipt).toContain('99.888.777/0001-11');
    expect(receipt).toContain('Rua das Flores, 123');
  });
});
