import { describe, it, expect } from 'vitest';
import { formatTransferSlip } from '../../../src/modules/transfers/transfer-slip-formatter';
import { getDatabase } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { TransferService } from '../../../src/modules/transfers/transfer.service';
import { StoreService } from '../../../src/modules/stores/store.service';
import type { TransferWithItems } from '../../../src/modules/transfers/types';
import type { Store } from '../../../src/modules/stores/types';

describe('TransferSlipFormatter', () => {
  const mockSourceStore: Store = {
    id: 1,
    code: 'LJ01',
    name: 'FarmaCore Matriz Centro',
    companyName: 'FarmaCore Drogaria S/A',
    cnpj: '12.345.678/0001-90',
    ie: '123456789',
    isHeadquarters: true,
    phone: '11999990001',
    email: 'matriz@farmacore.com.br',
    street: 'Rua das Flores',
    number: '100',
    neighborhood: 'Centro',
    city: 'São Paulo',
    state: 'SP',
    zipCode: '01001-000',
    ibgeCode: '3550308',
    taxRegime: 'LUCRO_REAL',
    isActive: true,
  };

  const mockTargetStore: Store = {
    id: 2,
    code: 'LJ02',
    name: 'FarmaCore Filial Campinas',
    companyName: 'FarmaCore Drogaria S/A',
    cnpj: '12.345.678/0002-71',
    ie: '987654321',
    isHeadquarters: false,
    phone: '19999990002',
    email: 'campinas@farmacore.com.br',
    street: 'Av. Brasil',
    number: '500',
    neighborhood: 'Guanabara',
    city: 'Campinas',
    state: 'SP',
    zipCode: '13070-178',
    ibgeCode: '3509502',
    taxRegime: 'LUCRO_REAL',
    isActive: true,
  };

  const mockInterstateTargetStore: Store = {
    id: 3,
    code: 'LJ03',
    name: 'FarmaCore Filial Rio',
    companyName: 'FarmaCore Drogaria RJ S/A',
    cnpj: '12.345.678/0003-52',
    ie: '555666777',
    isHeadquarters: false,
    phone: '21999990003',
    email: 'rio@farmacore.com.br',
    street: 'Av. Atlântica',
    number: '1200',
    neighborhood: 'Copacabana',
    city: 'Rio de Janeiro',
    state: 'RJ',
    zipCode: '22070-000',
    ibgeCode: '3304557',
    taxRegime: 'LUCRO_REAL',
    isActive: true,
  };

  it('should format a transfer slip with single item and state transfer (CFOP 5152)', () => {
    const transfer: TransferWithItems = {
      id: 10,
      transferNumber: 'TRF-20261118-0001',
      sourceStoreId: 1,
      targetStoreId: 2,
      status: 'IN_TRANSIT',
      requestedBy: 'Carlos Silva',
      dispatchedBy: 'Ana Paula',
      carrierName: 'Expresso Farma Log',
      trackingCode: 'ABC-1234',
      nfeKey: '35261112345678000190550010000000101123456780',
      nfeProtocol: '135260000012345',
      cfop: '5152',
      createdAt: '2026-11-18 10:30:00',
      updatedAt: '2026-11-18 11:00:00',
      items: [
        {
          id: 1,
          transferId: 10,
          productId: 101,
          productName: 'Dipirona Sódica 500mg 20 comp',
          batchNumber: 'LOTE-DIP-01',
          expirationDate: '2027-12-31',
          manufacturingDate: '2025-01-01',
          requestedQuantity: 50,
          shippedQuantity: 50,
          receivedQuantity: 0,
          unitCost: 3.5,
          totalCost: 175.0,
          createdAt: '2026-11-18 10:30:00',
        },
      ],
    };

    const { textSlip, fullEscPos } = formatTransferSlip(transfer, mockSourceStore, mockTargetStore);

    // Header validations
    expect(textSlip).toContain('FARMACORE ERP - ROMANEIO DE TRANSFERÊNCIA ENTRE FILIAIS');
    expect(textSlip).toContain('Nº Transferência: TRF-20261118-0001');
    expect(textSlip).toContain('Data/Hora: 2026-11-18 10:30:00 | Status: IN_TRANSIT');
    expect(textSlip).toContain('CFOP: 5152 - Transferência Estadual');

    // Origin and Destination
    expect(textSlip).toContain('ORIGEM : [LJ01] FarmaCore Matriz Centro');
    expect(textSlip).toContain('CNPJ: 12.345.678/0001-90 | IE: 123456789');
    expect(textSlip).toContain('Rua das Flores, 100 - São Paulo/SP');
    expect(textSlip).toContain('DESTINO: [LJ02] FarmaCore Filial Campinas');
    expect(textSlip).toContain('CNPJ: 12.345.678/0002-71 | IE: 987654321');
    expect(textSlip).toContain('Av. Brasil, 500 - Campinas/SP');

    // Transport info
    expect(textSlip).toContain('Transportador: Expresso Farma Log');
    expect(textSlip).toContain('Rastreio/Placa: ABC-1234');
    expect(textSlip).toContain('NF-e Chave: 35261112345678000190550010000000101123456780');

    // Items table
    expect(textSlip).toContain('Dipirona Sódica');
    expect(textSlip).toContain('LOTE-DIP-01');
    expect(textSlip).toContain('2027-12-31');
    expect(textSlip).toContain('50'); // Quantity

    // Totals
    expect(textSlip).toContain('Total de Itens: 1');
    expect(textSlip).toContain('Quantidade Total de Peças/Unidades: 50');
    expect(textSlip).toContain('Valor Total da Carga (R$): R$ 175,00');

    // Receipt terms
    expect(textSlip).toContain('Expedido por: _________________________ Data: ___/___/______');
    expect(textSlip).toContain('Transportado por: _____________________ Data: ___/___/______');
    expect(textSlip).toContain('Recebido e Conferido por: _____________ Data: ___/___/______');

    // ESC/POS
    expect(fullEscPos).toContain('\x1b\x40'); // Initialize
    expect(fullEscPos).toContain('\x1b\x45\x01'); // Bold ON
    expect(fullEscPos).toContain('\x1b\x69'); // Paper cut
    expect(fullEscPos).toContain('TRF-20261118-0001');
  });

  it('should format slip with multiple items and interstate transfer (CFOP 6152)', () => {
    const transfer: TransferWithItems = {
      id: 20,
      transferNumber: 'TRF-20261118-0002',
      sourceStoreId: 1,
      targetStoreId: 3,
      status: 'IN_TRANSIT',
      requestedBy: 'Marcos Vinicius',
      cfop: '6152',
      createdAt: '2026-11-18 14:00:00',
      updatedAt: '2026-11-18 14:15:00',
      items: [
        {
          id: 1,
          transferId: 20,
          productId: 101,
          productName: 'Amoxicilina 500mg 21 caps',
          batchNumber: 'LOTE-AMX-1',
          expirationDate: '2027-05-15',
          manufacturingDate: '2025-05-01',
          requestedQuantity: 30,
          shippedQuantity: 30,
          receivedQuantity: 0,
          unitCost: 10.0,
          totalCost: 300.0,
          createdAt: '2026-11-18 14:00:00',
        },
        {
          id: 2,
          transferId: 20,
          productId: 102,
          productName: 'Ibuprofeno 600mg 20 comp',
          batchNumber: 'LOTE-IBU-2',
          expirationDate: '2028-01-10',
          manufacturingDate: '2025-06-01',
          requestedQuantity: 20,
          shippedQuantity: 20,
          receivedQuantity: 0,
          unitCost: 8.5,
          totalCost: 170.0,
          createdAt: '2026-11-18 14:00:00',
        },
      ],
    };

    const { textSlip, fullEscPos } = formatTransferSlip(transfer, mockSourceStore, mockInterstateTargetStore);

    // CFOP interstate
    expect(textSlip).toContain('CFOP: 6152 - Transferência Interestadual');
    expect(textSlip).toContain('DESTINO: [LJ03] FarmaCore Filial Rio');
    expect(textSlip).toContain('Rio de Janeiro/RJ');

    // Default carrier and tracking when empty
    expect(textSlip).toContain('Transportador: Próprio/Não informado');
    expect(textSlip).toContain('Rastreio/Placa: N/A');
    expect(textSlip).toContain('NF-e Chave: Não emitida / Pendente');

    // Items table
    expect(textSlip).toContain('Amoxicilina 500mg');
    expect(textSlip).toContain('Ibuprofeno 600mg');
    expect(textSlip).toContain('LOTE-AMX-1');
    expect(textSlip).toContain('LOTE-IBU-2');

    // Totals: 2 items, 50 units, 470,00 total cost
    expect(textSlip).toContain('Total de Itens: 2');
    expect(textSlip).toContain('Quantidade Total de Peças/Unidades: 50');
    expect(textSlip).toContain('Valor Total da Carga (R$): R$ 470,00');

    // ESC/POS check
    expect(fullEscPos).toContain('\x1b\x69');
  });

  it('should generate transfer slip via TransferService.generateTransferSlip', () => {
    const db = getDatabase(':memory:');
    runMigrations(db);
    const service = new TransferService(db);
    const sService = new StoreService(db);

    const filialSP = sService.createStore({
      code: 'LJ02',
      name: 'FarmaCore Filial Campinas',
      companyName: 'FarmaCore Drogaria S/A',
      cnpj: '12.345.678/0002-71',
      ie: '987654321',
      street: 'Av. Brasil',
      number: '500',
      neighborhood: 'Guanabara',
      city: 'Campinas',
      state: 'SP',
      zipCode: '13070-178',
      ibgeCode: '3509502',
    });

    const prodStmt = db.prepare(`
      INSERT INTO products (
        ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price, is_active
      ) VALUES ('7891234567890', 'Paracetamol 500mg', 'Paracetamol', '100000001', 'SEM_TARJA', 'LIVRE', 10.0, 5.0, 7.0, 1)
    `);
    const p1 = prodStmt.run();
    const prodId = Number(p1.lastInsertRowid);

    const created = service.createTransfer({
      sourceStoreId: 1,
      targetStoreId: filialSP.id,
      requestedBy: 'Operador Teste',
      items: [
        {
          productId: prodId,
          requestedQuantity: 5,
          unitCost: 10.0,
        },
      ],
    });

    const slip = service.generateTransferSlip(created.id);
    expect(slip.textSlip).toContain('ROMANEIO DE TRANSFERÊNCIA');
    expect(slip.textSlip).toContain(created.transferNumber);
    expect(slip.fullEscPos).toContain('\x1b\x69');
  });
});
