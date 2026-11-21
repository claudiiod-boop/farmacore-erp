// FarmaCore ERP — Formatador Térmico ESC/POS e Comprovantes de Tele-Entrega (Fase 13)

import type {
  Courier,
  DeliveryDispatch,
  DeliveryDispatchWithOrders,
  DeliveryOrder,
  DeliveryOrderItem,
  SettlementResult,
} from './types';

export const ESC = '\x1b';
export const GS = '\x1d';
export const ESC_INIT = '\x1b@'; // \x1B\x40
export const ESC_CUT = '\x1d\x56\x41\x10'; // \x1D\x56\x41\x10 GS V 65 16 (Full cut with feed)
export const ESC_BOLD_ON = '\x1bE\x01';
export const ESC_BOLD_OFF = '\x1bE\x00';
export const ESC_ALIGN_LEFT = '\x1ba\x00';
export const ESC_ALIGN_CENTER = '\x1ba\x01';
export const ESC_ALIGN_RIGHT = '\x1ba\x02';

export interface StoreInfo {
  name?: string;
  storeName?: string;
  cnpj?: string;
  address?: string;
  city?: string;
  phone?: string;
}

export interface FormattedReceipt {
  textReceipt: string;
  fullEscPos: string;
}

export interface DeliveryDispatchSlipParams {
  store?: StoreInfo;
  dispatch: DeliveryDispatch | DeliveryDispatchWithOrders;
  courier?: Courier | null;
  orders?: DeliveryOrder[];
  columnWidth?: number;
}

export interface DeliveryOrderSlipParams {
  store?: StoreInfo;
  order: DeliveryOrder;
  items?: DeliveryOrderItem[];
  courierName?: string | null;
  columnWidth?: number;
}

export interface SettlementSummaryData {
  totalOrders?: number;
  totalDelivered?: number;
  totalReturned?: number;
  collectedCash?: number;
  collectedCard?: number;
  collectedPix?: number;
  totalCollected?: number;
  commissionEarned?: number;
  dailyAllowance?: number;
  totalPayableToCourier?: number;
  cashMovementId?: number | null;
  cashSessionId?: number | null;
  operatorName?: string;
}

export interface CourierSettlementReceiptParams {
  store?: StoreInfo;
  dispatch: DeliveryDispatch | DeliveryDispatchWithOrders;
  courier?: Courier | null;
  settlementSummary?: SettlementSummaryData;
  settlementResult?: SettlementResult;
  columnWidth?: number;
}

const DEFAULT_STORE: Required<StoreInfo> = {
  name: 'DROGARIA FARMACORE MATRIZ',
  storeName: 'DROGARIA FARMACORE MATRIZ',
  cnpj: '12.345.678/0001-90',
  address: 'Av. Paulista, 1500 - Bela Vista',
  city: 'São Paulo - SP',
  phone: '(11) 3200-5000',
};

// =========================================================================
// Funções Utilitárias de Alinhamento e Formatação
// =========================================================================

export function centerText(text: string, width = 48): string {
  if (text.length >= width) {
    return text.slice(0, width);
  }
  const totalPadding = width - text.length;
  const leftPadding = Math.floor(totalPadding / 2);
  const rightPadding = totalPadding - leftPadding;
  return ' '.repeat(leftPadding) + text + ' '.repeat(rightPadding);
}

export function justifyText(left: string, right: string, width = 48): string {
  const combined = left.length + right.length;
  if (combined >= width) {
    const availableLeft = Math.max(0, width - right.length - 1);
    left = left.slice(0, availableLeft);
  }
  const spaceCount = Math.max(1, width - left.length - right.length);
  return left + ' '.repeat(spaceCount) + right;
}

export function truncateOrFit(text: string, width = 48): string {
  if (text.length > width) {
    return text.slice(0, width);
  }
  return text;
}

export function wrapText(text: string, width = 48): string[] {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (!word) continue;
    if (word.length > width) {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = '';
      }
      for (let i = 0; i < word.length; i += width) {
        lines.push(word.slice(i, i + width));
      }
      continue;
    }

    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (testLine.length <= width) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

export function formatCurrency(value: number | undefined | null): string {
  return (value || 0).toFixed(2);
}

export function formatDateBr(dateStr?: string | null): string {
  if (!dateStr) return '';
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${d}/${m}/${y}`;
  }
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }
  return dateStr;
}

export function formatDateTimeBr(dateTimeStr?: string | null): string {
  if (!dateTimeStr) {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    const h = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    return `${d}/${m}/${y} ${h}:${min}:${s}`;
  }

  const isoMatch = dateTimeStr.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):?(\d{2})?/
  );
  if (isoMatch) {
    const [, y, m, d, h, min, s] = isoMatch;
    return `${d}/${m}/${y} ${h}:${min}${s ? `:${s}` : ''}`;
  }
  return dateTimeStr;
}

function resolveStore(store?: StoreInfo): Required<StoreInfo> {
  const name = store?.name ?? store?.storeName ?? DEFAULT_STORE.name;
  return {
    name,
    storeName: name,
    cnpj: store?.cnpj ?? DEFAULT_STORE.cnpj,
    address: store?.address ?? DEFAULT_STORE.address,
    city: store?.city ?? DEFAULT_STORE.city,
    phone: store?.phone ?? DEFAULT_STORE.phone,
  };
}

// =========================================================================
// 1. ROMANEIO DE DESPACHO / TELE-ENTREGA (formatDeliveryDispatchSlip)
// =========================================================================

export function formatDeliveryDispatchSlip(
  params: DeliveryDispatchSlipParams
): FormattedReceipt {
  const width = params.columnWidth ?? 48;
  const line = '-'.repeat(width);
  const doubleLine = '='.repeat(width);
  const store = resolveStore(params.store);

  const dispatch = params.dispatch;
  const courier = params.courier ?? ('courier' in dispatch ? dispatch.courier : null);
  const orders = params.orders ?? ('orders' in dispatch ? dispatch.orders : []) ?? [];

  const lines: string[] = [];

  // Cabeçalho da Farmácia
  lines.push(doubleLine);
  lines.push(centerText(store.name, width));
  if (store.cnpj) lines.push(centerText(`CNPJ: ${store.cnpj}`, width));
  if (store.address) lines.push(centerText(store.address, width));
  if (store.city) lines.push(centerText(store.city, width));
  if (store.phone) lines.push(centerText(`Tel: ${store.phone}`, width));
  lines.push(doubleLine);

  // Título do Documento
  lines.push(centerText('ROMANEIO DE DESPACHO / TELE-ENTREGA', width));
  lines.push(doubleLine);

  // Dados do Romaneio e Data
  const dispatchNum = dispatch.dispatchNumber ?? `ROM-${dispatch.id}`;
  const dispatchDate = formatDateTimeBr(dispatch.dispatchedAt ?? dispatch.createdAt);
  lines.push(justifyText(`Romaneio: ${dispatchNum}`, dispatchDate, width));
  lines.push(line);

  // Dados do Entregador / Motoboy
  lines.push(truncateOrFit('ENTREGADOR / MOTOBOY:', width));
  if (courier) {
    lines.push(truncateOrFit(`Nome: ${courier.name} (ID: ${courier.id})`, width));
    lines.push(justifyText(`CPF: ${courier.cpf}`, `Tel: ${courier.phone}`, width));
    const veh = courier.vehicleType ?? 'MOTO';
    const plate = courier.vehiclePlate ? `Placa: ${courier.vehiclePlate}` : '';
    lines.push(justifyText(`Veículo: ${veh}`, plate, width));
  } else {
    lines.push(truncateOrFit(`ID Entregador: ${dispatch.courierId}`, width));
  }
  lines.push(line);

  // Relação de Pedidos para Entrega
  const totalOrders = orders.length || dispatch.totalOrders || 0;
  lines.push(centerText(`RELAÇÃO DE PEDIDOS PARA ENTREGA (${totalOrders})`, width));
  lines.push(line);

  let totalChange = 0;

  orders.forEach((ord, idx) => {
    const orderNum = ord.orderNumber ?? `DEL-#${ord.id}`;
    lines.push(`[${idx + 1}/${totalOrders}] Pedido: ${orderNum}`);
    lines.push(truncateOrFit(`Cliente: ${ord.customerName}`, width));
    lines.push(truncateOrFit(`Tel: ${ord.customerPhone}`, width));

    const fullAddr = `${ord.street}, ${ord.number}${ord.complement ? ` - ${ord.complement}` : ''}`;
    lines.push(...wrapText(`Endereço: ${fullAddr}`, width));
    lines.push(truncateOrFit(`Bairro: ${ord.neighborhood} - ${ord.city} - ${ord.state}`, width));

    if (ord.referencePoint) {
      lines.push(...wrapText(`Ref: ${ord.referencePoint}`, width));
    }

    const payDesc = `Cobrança: ${ord.paymentMethod}`;
    const valDesc = `R$ ${formatCurrency(ord.totalAmount)}`;
    lines.push(justifyText(payDesc, valDesc, width));

    if (ord.changeFor && ord.changeFor > ord.totalAmount) {
      const troco = ord.changeFor - ord.totalAmount;
      totalChange += troco;
      lines.push(
        justifyText(
          `Troco p/ ${formatCurrency(ord.changeFor)}`,
          `(Levar: R$ ${formatCurrency(troco)})`,
          width
        )
      );
    }

    lines.push(line);
  });

  // Resumo Consolidado
  lines.push(centerText('RESUMO CONSOLIDADO DO ROMANEIO', width));
  lines.push(justifyText('TOTAL DE PEDIDOS:', String(totalOrders), width));
  lines.push(
    justifyText(
      'VALOR TOTAL:',
      `R$ ${formatCurrency(dispatch.totalAmount)}`,
      width
    )
  );

  const cashStr = `Dinheiro: R$ ${formatCurrency(dispatch.collectedCash)}`;
  const cardStr = `Cartão: R$ ${formatCurrency(dispatch.collectedCard)}`;
  const pixStr = `PIX: R$ ${formatCurrency(dispatch.collectedPix)}`;
  lines.push(truncateOrFit(`${cashStr} | ${cardStr} | ${pixStr}`, width));

  const totalChangeValue = dispatch.totalChangeProvided ?? totalChange;
  if (totalChangeValue > 0) {
    lines.push(
      justifyText(
        'Total Troco a Levar:',
        `R$ ${formatCurrency(totalChangeValue)}`,
        width
      )
    );
  }

  if (dispatch.totalCommission && dispatch.totalCommission > 0) {
    lines.push(
      justifyText(
        'Comissão Estimada:',
        `R$ ${formatCurrency(dispatch.totalCommission)}`,
        width
      )
    );
  }
  lines.push(doubleLine);

  // Linha de Assinatura
  lines.push('');
  lines.push(centerText('_'.repeat(Math.min(40, width)), width));
  lines.push(centerText('Assinatura do Entregador', width));
  if (courier) {
    lines.push(centerText(courier.name, width));
  }
  lines.push(doubleLine);

  const textReceipt = lines.join('\n');

  // Comandos ESC/POS
  const escPosCommands: string[] = [
    ESC_INIT,
    ESC_ALIGN_CENTER,
    ESC_BOLD_ON,
    `${store.name}\n`,
    ESC_BOLD_OFF,
    `CNPJ: ${store.cnpj}\n`,
    `${store.address}\n`,
    `${store.city}\n`,
    `${doubleLine}\n`,
    ESC_BOLD_ON,
    'ROMANEIO DE DESPACHO / TELE-ENTREGA\n',
    ESC_BOLD_OFF,
    `${doubleLine}\n`,
    ESC_ALIGN_LEFT,
    `${textReceipt.slice(textReceipt.indexOf('Romaneio:'))}\n\n\n`,
    ESC_CUT,
  ];

  return {
    textReceipt,
    fullEscPos: escPosCommands.join(''),
  };
}

// =========================================================================
// 2. ETIQUETA DE PACOTE / PEDIDO INDIVIDUAL (formatDeliveryOrderSlip)
// =========================================================================

export function formatDeliveryOrderSlip(
  params: DeliveryOrderSlipParams
): FormattedReceipt {
  const width = params.columnWidth ?? 48;
  const line = '-'.repeat(width);
  const doubleLine = '='.repeat(width);
  const store = resolveStore(params.store);

  const ord = params.order;
  const items = params.items ?? ord.items ?? [];
  const lines: string[] = [];

  // Cabeçalho da Farmácia
  lines.push(doubleLine);
  lines.push(centerText(store.name, width));
  if (store.cnpj) lines.push(centerText(`CNPJ: ${store.cnpj}`, width));
  if (store.address) lines.push(centerText(store.address, width));
  if (store.city) lines.push(centerText(store.city, width));
  if (store.phone) lines.push(centerText(`Tel: ${store.phone}`, width));
  lines.push(doubleLine);

  // Título da Etiqueta
  lines.push(centerText('TELE-ENTREGA - ETIQUETA DE PACOTE', width));
  lines.push(doubleLine);

  // Número do Pedido e Data
  const orderNum = ord.orderNumber ?? `DEL-#${ord.id}`;
  const orderDate = formatDateTimeBr(ord.receivedAt ?? ord.createdAt);
  lines.push(justifyText(`Pedido: ${orderNum}`, orderDate, width));
  lines.push(line);

  // Destinatário
  lines.push(truncateOrFit('DESTINATÁRIO:', width));
  lines.push(truncateOrFit(`Cliente: ${ord.customerName}`, width));
  const docAndPhone: string[] = [];
  if (ord.customerCpf) docAndPhone.push(`CPF: ${ord.customerCpf}`);
  if (ord.customerPhone) docAndPhone.push(`Tel: ${ord.customerPhone}`);
  if (docAndPhone.length === 2) {
    lines.push(justifyText(docAndPhone[0], docAndPhone[1], width));
  } else if (docAndPhone.length === 1) {
    lines.push(truncateOrFit(docAndPhone[0], width));
  }

  const fullAddr = `${ord.street}, ${ord.number}${ord.complement ? ` - ${ord.complement}` : ''}`;
  lines.push(...wrapText(`Endereço: ${fullAddr}`, width));
  lines.push(truncateOrFit(`Bairro: ${ord.neighborhood} - ${ord.city} - ${ord.state}`, width));
  if (ord.zipCode) {
    lines.push(truncateOrFit(`CEP: ${ord.zipCode}`, width));
  }
  if (ord.referencePoint) {
    lines.push(...wrapText(`Ponto de Ref: ${ord.referencePoint}`, width));
  }
  if (ord.notes) {
    lines.push(...wrapText(`Obs: ${ord.notes}`, width));
  }
  lines.push(line);

  // Itens Conferidos do Pacote
  lines.push(centerText('ITENS CONFERIDOS DO PACOTE', width));
  lines.push(justifyText('QTD  DESCRIÇÃO', 'VALOR(R$)', width));
  lines.push(line);

  for (const item of items) {
    const itemTotal = item.totalPrice ?? item.quantity * item.unitPrice;
    const desc = `${item.quantity}x ${item.productName}`;
    lines.push(justifyText(desc, formatCurrency(itemTotal), width));
    if (item.batchNumber) {
      lines.push(truncateOrFit(`     Lote: ${item.batchNumber}`, width));
    }
  }
  lines.push(line);

  // Totais Financeiros
  lines.push(justifyText('Subtotal:', `R$ ${formatCurrency(ord.subtotalAmount)}`, width));
  lines.push(justifyText('Taxa de Entrega:', `R$ ${formatCurrency(ord.deliveryFee)}`, width));
  if (ord.discountAmount && ord.discountAmount > 0) {
    lines.push(justifyText('Desconto:', `R$ ${formatCurrency(ord.discountAmount)}`, width));
  }
  lines.push(line);
  lines.push(
    justifyText('TOTAL A COBRAR:', `R$ ${formatCurrency(ord.totalAmount)}`, width)
  );
  lines.push(justifyText('Forma de Pagamento:', ord.paymentMethod, width));

  if (ord.changeFor && ord.changeFor > ord.totalAmount) {
    const troco = ord.changeFor - ord.totalAmount;
    lines.push(justifyText('Troco para:', `R$ ${formatCurrency(ord.changeFor)}`, width));
    lines.push(
      justifyText('(Devolver de Troco):', `R$ ${formatCurrency(troco)}`, width)
    );
  }
  lines.push(line);

  // Entregador
  const courier = params.courierName ?? (ord.courier ? ord.courier.name : null);
  if (courier) {
    lines.push(truncateOrFit(`Entregador Responsável: ${courier}`, width));
    lines.push(line);
  }

  // Rodapé
  lines.push(centerText('Obrigado pela preferência! Cuide da sua saúde.', width));
  lines.push(doubleLine);

  const textReceipt = lines.join('\n');

  // Comandos ESC/POS
  const escPosCommands: string[] = [
    ESC_INIT,
    ESC_ALIGN_CENTER,
    ESC_BOLD_ON,
    `${store.name}\n`,
    ESC_BOLD_OFF,
    `CNPJ: ${store.cnpj}\n`,
    `${store.address}\n`,
    `${store.city}\n`,
    `${doubleLine}\n`,
    ESC_BOLD_ON,
    'TELE-ENTREGA - ETIQUETA DE PACOTE\n',
    ESC_BOLD_OFF,
    `${doubleLine}\n`,
    ESC_ALIGN_LEFT,
    `${textReceipt.slice(textReceipt.indexOf('Pedido:'))}\n\n\n`,
    ESC_CUT,
  ];

  return {
    textReceipt,
    fullEscPos: escPosCommands.join(''),
  };
}

// =========================================================================
// 3. RECIBO DE ACERTO DE CONTAS COM MOTOBOY (formatCourierSettlementReceipt)
// =========================================================================

export function formatCourierSettlementReceipt(
  params: CourierSettlementReceiptParams
): FormattedReceipt {
  const width = params.columnWidth ?? 48;
  const line = '-'.repeat(width);
  const doubleLine = '='.repeat(width);
  const store = resolveStore(params.store);

  const dispatch = params.dispatch;
  const courier = params.courier ?? ('courier' in dispatch ? dispatch.courier : null);
  const summary =
    params.settlementSummary ??
    (params.settlementResult
      ? {
          totalOrders: dispatch.totalOrders,
          totalDelivered: params.settlementResult.totalDelivered,
          totalReturned: params.settlementResult.totalReturned,
          collectedCash: params.settlementResult.collectedCash,
          collectedCard: params.settlementResult.collectedCard,
          collectedPix: params.settlementResult.collectedPix,
          totalCollected:
            params.settlementResult.collectedCash +
            params.settlementResult.collectedCard +
            params.settlementResult.collectedPix,
          commissionEarned: params.settlementResult.commissionEarned,
          cashMovementId: params.settlementResult.cashMovementId,
          operatorName: dispatch.operatorName ?? 'Operador PDV',
        }
      : {});

  const lines: string[] = [];

  // Cabeçalho da Farmácia
  lines.push(doubleLine);
  lines.push(centerText(store.name, width));
  if (store.cnpj) lines.push(centerText(`CNPJ: ${store.cnpj}`, width));
  if (store.address) lines.push(centerText(store.address, width));
  if (store.city) lines.push(centerText(store.city, width));
  if (store.phone) lines.push(centerText(`Tel: ${store.phone}`, width));
  lines.push(doubleLine);

  // Título
  lines.push(centerText('ACERTO DE CONTAS - TELE-ENTREGA', width));
  lines.push(doubleLine);

  // Dados do Romaneio e Data
  const dispatchNum = dispatch.dispatchNumber ?? `ROM-${dispatch.id}`;
  const settleDate = formatDateTimeBr(dispatch.settledAt ?? new Date().toISOString());
  lines.push(justifyText(`Romaneio: ${dispatchNum}`, settleDate, width));

  // Entregador e Operador
  if (courier) {
    lines.push(truncateOrFit(`Entregador: ${courier.name} (ID: ${courier.id})`, width));
    const veh = courier.vehicleType ?? 'MOTO';
    const plate = courier.vehiclePlate ? `(${courier.vehiclePlate})` : '';
    lines.push(truncateOrFit(`Veículo: ${veh} ${plate}`.trim(), width));
  } else {
    lines.push(truncateOrFit(`ID Entregador: ${dispatch.courierId}`, width));
  }
  const operatorName = summary.operatorName ?? dispatch.operatorName ?? 'Operador PDV';
  lines.push(truncateOrFit(`Operador / Caixa: ${operatorName}`, width));
  lines.push(line);

  // Resumo das Entregas
  lines.push(centerText('RESUMO DAS ENTREGAS', width));
  const totOrders = summary.totalOrders ?? dispatch.totalOrders ?? 0;
  lines.push(justifyText('Total de Pedidos:', String(totOrders), width));
  lines.push(justifyText('Entregues:', String(summary.totalDelivered ?? totOrders), width));
  lines.push(justifyText('Devolvidos:', String(summary.totalReturned ?? 0), width));
  lines.push(line);

  // Apuração de Valores Recebidos
  lines.push(centerText('APURAÇÃO DE VALORES RECEBIDOS', width));
  const cash = summary.collectedCash ?? dispatch.collectedCash ?? 0;
  const card = summary.collectedCard ?? dispatch.collectedCard ?? 0;
  const pix = summary.collectedPix ?? dispatch.collectedPix ?? 0;
  const totalColl = summary.totalCollected ?? cash + card + pix;

  lines.push(justifyText('Dinheiro:', `R$ ${formatCurrency(cash)}`, width));
  lines.push(justifyText('Cartão:', `R$ ${formatCurrency(card)}`, width));
  lines.push(justifyText('PIX:', `R$ ${formatCurrency(pix)}`, width));
  lines.push(justifyText('Total Arrecadado:', `R$ ${formatCurrency(totalColl)}`, width));
  lines.push(line);

  // Remuneração do Entregador
  lines.push(centerText('REMUNERAÇÃO DO ENTREGADOR', width));
  const commission = summary.commissionEarned ?? dispatch.totalCommission ?? 0;
  lines.push(
    justifyText('Comissão das Entregas:', `R$ ${formatCurrency(commission)}`, width)
  );
  if (summary.dailyAllowance !== undefined && summary.dailyAllowance > 0) {
    lines.push(
      justifyText(
        'Diária do Entregador:',
        `R$ ${formatCurrency(summary.dailyAllowance)}`,
        width
      )
    );
  }
  const totalPayable = summary.totalPayableToCourier ?? commission + (summary.dailyAllowance || 0);
  lines.push(
    justifyText(
      'Total Pago ao Motoboy:',
      `R$ ${formatCurrency(totalPayable)}`,
      width
    )
  );
  lines.push(line);

  // Movimentação de Caixa PDV
  lines.push(centerText('MOVIMENTAÇÃO DE CAIXA PDV', width));
  lines.push(
    justifyText(
      'Entrada Suprimento (Dinheiro):',
      `R$ ${formatCurrency(cash)}`,
      width
    )
  );
  if (summary.cashMovementId) {
    lines.push(truncateOrFit(`Movimento de Caixa: #${summary.cashMovementId}`, width));
  }
  const sessId = summary.cashSessionId ?? dispatch.cashSessionId;
  if (sessId) {
    lines.push(truncateOrFit(`Sessão: #${sessId}`, width));
  }
  lines.push(line);

  // Assinaturas
  lines.push('');
  lines.push(centerText('_'.repeat(Math.min(40, width)), width));
  lines.push(centerText('Assinatura do Entregador', width));
  if (courier) {
    lines.push(centerText(courier.name, width));
  }
  lines.push('');
  lines.push(centerText('_'.repeat(Math.min(40, width)), width));
  lines.push(centerText('Assinatura do Operador / Caixa', width));
  lines.push(centerText(operatorName, width));
  lines.push(doubleLine);

  const textReceipt = lines.join('\n');

  // Comandos ESC/POS
  const escPosCommands: string[] = [
    ESC_INIT,
    ESC_ALIGN_CENTER,
    ESC_BOLD_ON,
    `${store.name}\n`,
    ESC_BOLD_OFF,
    `CNPJ: ${store.cnpj}\n`,
    `${store.address}\n`,
    `${store.city}\n`,
    `${doubleLine}\n`,
    ESC_BOLD_ON,
    'ACERTO DE CONTAS - TELE-ENTREGA\n',
    ESC_BOLD_OFF,
    `${doubleLine}\n`,
    ESC_ALIGN_LEFT,
    `${textReceipt.slice(textReceipt.indexOf('Romaneio:'))}\n\n\n`,
    ESC_CUT,
  ];

  return {
    textReceipt,
    fullEscPos: escPosCommands.join(''),
  };
}
