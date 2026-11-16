import { describe, it, expect } from 'vitest';
import { formatPbmReceipt } from '../../../src/modules/pbm/pbm-receipt-formatter';
import type {
  PbmTransaction,
  PbmTransactionItem,
  StoreInfo,
} from '../../../src/modules/pbm/types';

describe('PBM Receipt Formatter (Cupom Vinculado 48 Colunas ESC/POS)', () => {
  const mockStore: StoreInfo = {
    name: 'FARMACIA FARMACORE LTDA',
    cnpj: '12.345.678/0001-90',
    ie: '123.456.789.111',
    address: 'RUA DAS FARMACIAS, 123 - CENTRO - CURITIBA/PR',
    pharmacistName: 'DRA. AMANDA COSTA',
    pharmacistCrf: '98765',
    pharmacistUf: 'PR',
  };

  const mockTransaction: PbmTransaction = {
    id: 1,
    transactionUuid: 'uuid-12345',
    providerId: 'FARMACIA_POPULAR',
    authorizationProtocol: 'FP20261116000001',
    receiptNumber: '987654321',
    status: 'CONFIRMED',
    patientCpf: '12345678900',
    patientName: 'JOAO DA SILVA',
    patientBirthDate: '1958-05-15',
    doctorCrm: '12345',
    doctorUf: 'PR',
    doctorName: 'DR. CARLOS SILVA',
    prescriptionDate: '2026-11-10',
    nfceNumber: 12345,
    fiscalKeyNfce: '41261112345678000190650010000123451000123456',
    totalGrossAmount: 24.0,
    subsidyAmount: 21.6,
    patientCopayAmount: 2.4,
    createdAt: '2026-11-16T15:42:10.000Z',
    confirmedAt: '2026-11-16T15:45:00.000Z',
  };

  const mockItems: (PbmTransactionItem & { batchNumber?: string })[] = [
    {
      id: 1,
      pbmTransactionId: 1,
      productId: 101,
      batchId: 501,
      batchNumber: 'LOT12345',
      ean: '7891234567890',
      msRegistration: '100430001',
      productName: 'LOSARTANA POTASSICA 50MG CX 30 CP',
      dailyDose: 1.0,
      authorizedQuantity: 1,
      unitGrossPrice: 12.0,
      totalGrossPrice: 12.0,
      referenceUnitPrice: 12.0,
      subsidyUnitPrice: 12.0,
      subsidyTotalPrice: 12.0,
      patientUnitPrice: 0.0,
      patientTotalPrice: 0.0,
      programType: 'GRATUITO',
      createdAt: '2026-11-16T15:42:10.000Z',
    },
    {
      id: 2,
      pbmTransactionId: 1,
      productId: 102,
      batchId: 502,
      batchNumber: 'LOT98765',
      ean: '7899876543210',
      msRegistration: '100430002',
      productName: 'SINVASTATINA 20MG CX 30 CP',
      dailyDose: 1.0,
      authorizedQuantity: 1,
      unitGrossPrice: 12.0,
      totalGrossPrice: 12.0,
      referenceUnitPrice: 12.0,
      subsidyUnitPrice: 9.6,
      subsidyTotalPrice: 9.6,
      patientUnitPrice: 2.4,
      patientTotalPrice: 2.4,
      programType: 'CO_PAGAMENTO',
      createdAt: '2026-11-16T15:42:10.000Z',
    },
  ];

  it('should format 1st copy (Consumidor) with items, government subsidy and patient copay', () => {
    const receipt = formatPbmReceipt(mockTransaction, mockItems, mockStore);

    expect(receipt.consumerCopy).toContain('AQUI TEM FARMÁCIA POPULAR');
    expect(receipt.consumerCopy).toContain('MINISTÉRIO DA SAÚDE');
    expect(receipt.consumerCopy).toContain('FARMACIA FARMACORE LTDA');
    expect(receipt.consumerCopy).toContain('12.345.678/0001-90');
    expect(receipt.consumerCopy).toContain('1a VIA - CONSUMIDOR');
    expect(receipt.consumerCopy).toContain('FP20261116000001');
    expect(receipt.consumerCopy).toContain('987654321');
    expect(receipt.consumerCopy).toContain('JOAO DA SILVA');
    expect(receipt.consumerCopy).toContain('123.***.***-00');
    expect(receipt.consumerCopy).toContain('CRM 12345/PR');
    expect(receipt.consumerCopy).toContain('10/11/2026');

    // Itens
    expect(receipt.consumerCopy).toContain('LOSARTANA POTASSICA 50MG CX 30 CP');
    expect(receipt.consumerCopy).toContain('SINVASTATINA 20MG CX 30 CP');
    expect(receipt.consumerCopy).toContain('VLR SUBSIDIO GOVERNO:');
    expect(receipt.consumerCopy).toContain('VLR PAGO PACIENTE:');

    // Totalizadores
    expect(receipt.consumerCopy).toContain('TOTAL BRUTO:');
    expect(receipt.consumerCopy).toContain('24,00');
    expect(receipt.consumerCopy).toContain('TOTAL SUBSIDIADO (MIN. SAUDE):');
    expect(receipt.consumerCopy).toContain('21,60');
    expect(receipt.consumerCopy).toContain('TOTAL A PAGAR PELO BENEFICIARIO:');
    expect(receipt.consumerCopy).toContain('2,40');
  });

  it('should format 2nd copy (Estabelecimento - Denasus 5 Anos) with batch info, doctor CRM, and legal signatures', () => {
    const receipt = formatPbmReceipt(mockTransaction, mockItems, mockStore);

    expect(receipt.storeCopy).toContain('2a VIA - ESTABELECIMENTO');
    expect(receipt.storeCopy).toContain('GUARDA OBRIGATORIA: 5 ANOS');
    expect(receipt.storeCopy).toContain('PROTOCOLO AUTORIZACAO: FP20261116000001');
    expect(receipt.storeCopy).toContain('RECIBO DATASUS: 987654321');
    expect(receipt.storeCopy).toContain('CUPOM FISCAL / NFC-e:');
    expect(receipt.storeCopy).toContain('12345');
    expect(receipt.storeCopy).toContain('JOAO DA SILVA');
    expect(receipt.storeCopy).toContain('123.***.***-00');
    expect(receipt.storeCopy).toContain('15/05/1958'); // DT NASC
    expect(receipt.storeCopy).toContain('DR. CARLOS SILVA');
    expect(receipt.storeCopy).toContain('CRM 12345/PR');

    // Auditoria Denasus - Lotes e Posologia
    expect(receipt.storeCopy).toContain('ITENS DISPENSADOS / AUDITORIA DENASUS:');
    expect(receipt.storeCopy).toContain('EAN: 7891234567890');
    expect(receipt.storeCopy).toContain('LOTE: LOT12345');
    expect(receipt.storeCopy).toContain('DOSE DIARIA: 1.0');
    expect(receipt.storeCopy).toContain('EAN: 7899876543210');
    expect(receipt.storeCopy).toContain('LOTE: LOT98765');

    // Termo Legal Denasus
    expect(receipt.storeCopy).toContain('DECLARO TER RECEBIDO DO MINISTÉRIO DA SAÚDE');
    expect(receipt.storeCopy).toContain('ATRAVÉS DO PROGRAMA FARMÁCIA POPULAR DO BRASIL');
    expect(receipt.storeCopy).toContain('ASSINATURA DO BENEFICIARIO OU PROCURADOR LEGAL');
    expect(receipt.storeCopy).toContain('NOME: JOAO DA SILVA');
    expect(receipt.storeCopy).toContain('RG:');
    expect(receipt.storeCopy).toContain('ORGAO EMISSOR:');

    // Farmacêutico RT
    expect(receipt.storeCopy).toContain('FARMACÊUTICO RESPONSÁVEL TÉCNICO');
    expect(receipt.storeCopy).toContain('CRF/PR 98765');
  });

  it('should include proxy details if withdrawal was performed by legal proxy', () => {
    const proxyTransaction: PbmTransaction = {
      ...mockTransaction,
      proxyName: 'MARIA APARECIDA DA SILVA',
      proxyCpf: '98765432100',
    };

    const receipt = formatPbmReceipt(proxyTransaction, mockItems, mockStore);

    expect(receipt.storeCopy).toContain('PROCURADOR: MARIA APARECIDA DA SILVA');
    expect(receipt.storeCopy).toContain('CPF PROCURADOR: 987.***.***-00');
    expect(receipt.storeCopy).toContain('NOME: MARIA APARECIDA DA SILVA');
  });

  it('should respect exact 48 columns limit per line without breaking layout', () => {
    const longStore: StoreInfo = {
      name: 'DROGARIA SUPER HIPER MEGA POPULAR DO BRASIL DE FARMACIA E MANIPULACAO LTDA ME',
      cnpj: '12.345.678/0001-90',
      ie: '123.456.789.111',
      address: 'AVENIDA DAS INDUSTRIAS QUIMICAS E FARMACEUTICAS DO ESTADO DE SAO PAULO NUMERO 99999 BLOCO 8 APTO 123',
      pharmacistName: 'DRA. AMANDA BEATRIZ DA SILVEIRA E SOUZA GUIMARAES',
      pharmacistCrf: '98765',
      pharmacistUf: 'PR',
    };

    const longItems: (PbmTransactionItem & { batchNumber?: string })[] = [
      {
        ...mockItems[0],
        productName: 'CLORIDRATO DE CIPROFLOXACINO MONOIDRATADO 500MG COM REVESTIMENTO GASTRORRESISTENTE CAIXA COM 14 COMPRIMIDOS',
      },
    ];

    const receipt = formatPbmReceipt(mockTransaction, longItems, longStore);

    const checkLines = (text: string, label: string) => {
      const lines = text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.length > 48) {
          throw new Error(
            `Line ${i + 1} in ${label} exceeds 48 columns (length=${line.length}): "${line}"`
          );
        }
      }
    };

    checkLines(receipt.consumerCopy, 'consumerCopy');
    checkLines(receipt.storeCopy, 'storeCopy');
  });

  it('should include ESC/POS paper cut commands in fullEscPos', () => {
    const receipt = formatPbmReceipt(mockTransaction, mockItems, mockStore);

    expect(receipt.fullEscPos).toContain(receipt.consumerCopy);
    expect(receipt.fullEscPos).toContain(receipt.storeCopy);
    // Deve conter comandos ESC/POS de corte (\x1b\x69 ou \x1d\x56\x41\x00)
    const hasEscPosCut =
      receipt.fullEscPos.includes('\x1b\x69') ||
      receipt.fullEscPos.includes('\x1d\x56\x41\x00');
    expect(hasEscPosCut).toBe(true);
  });
});
