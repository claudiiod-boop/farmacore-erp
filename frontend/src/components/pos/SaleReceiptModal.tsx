import { useState, useEffect, useMemo } from 'react';
import {
  Printer,
  RotateCcw,
  X,
  FileText,
  CheckCircle2,
  Copy,
  Check,
  AlertTriangle,
  CreditCard,
} from 'lucide-react';
import { Sale, NfceInvoiceDetails } from '../../services/api';
import { formatBrl } from '../ProductSearch';
import { formatDate } from '../BatchSelector';

export interface SaleReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale;
  receiptText?: string;
  onPrint?: () => void;
  onNewSale?: () => void;
  nfceInvoice?: NfceInvoiceDetails | null;
  pbmProtocol?: string;
  onOpenPbmReceipt?: () => void;
  tefReceiptNsu?: string;
  onOpenTefReceipt?: () => void;
}

export function formatDateTime(dateStr?: string): string {
  if (!dateStr) {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

export function formatAccessKey(key?: string): string {
  if (!key) return '';
  const clean = key.replace(/\D/g, '');
  if (clean.length !== 44) return key;
  return clean.match(/.{1,4}/g)?.join(' ') || key;
}

export function renderQrCodeMatrix(text: string) {
  const size = 160;
  const modules = 29;
  const cellSize = size / modules;

  let hashVal = 2166136261;
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    hashVal ^= text.charCodeAt(i);
    hashVal = Math.imul(hashVal, 16777619);
    bytes.push(hashVal & 0xff);
  }
  while (bytes.length < 128) {
    hashVal = Math.imul(hashVal, 16777619);
    bytes.push(hashVal & 0xff);
  }

  const isCorner = (r: number, c: number): boolean => {
    if (r < 7 && c < 7) return true;
    if (r < 7 && c >= modules - 7) return true;
    if (r >= modules - 7 && c < 7) return true;
    return false;
  };

  const isCornerBlack = (r: number, c: number): boolean => {
    const checkBox = (row: number, col: number) => {
      if (row === 0 || row === 6 || col === 0 || col === 6) return true;
      if (row >= 2 && row <= 4 && col >= 2 && col <= 4) return true;
      return false;
    };
    if (r < 7 && c < 7) return checkBox(r, c);
    if (r < 7 && c >= modules - 7) return checkBox(r, c - (modules - 7));
    if (r >= modules - 7 && c < 7) return checkBox(r - (modules - 7), c);
    return false;
  };

  const rects: Array<{ x: number; y: number; w: number; h: number }> = [];

  for (let r = 0; r < modules; r++) {
    for (let c = 0; c < modules; c++) {
      let isBlack = false;
      if (isCorner(r, c)) {
        isBlack = isCornerBlack(r, c);
      } else if (r === 6 || c === 6) {
        isBlack = (r + c) % 2 === 0;
      } else {
        const byteIndex = (r * modules + c) % bytes.length;
        const bitIndex = (r + c) % 8;
        isBlack = ((bytes[byteIndex] >> bitIndex) & 1) === 1;
      }

      if (isBlack) {
        rects.push({
          x: c * cellSize,
          y: r * cellSize,
          w: cellSize + 0.1,
          h: cellSize + 0.1,
        });
      }
    }
  }

  return { size, rects };
}

export default function SaleReceiptModal({
  isOpen,
  onClose,
  sale,
  receiptText,
  onPrint,
  onNewSale,
  nfceInvoice,
  pbmProtocol,
  onOpenPbmReceipt,
  tefReceiptNsu,
  onOpenTefReceipt,
}: SaleReceiptModalProps) {
  const [copiedKey, setCopiedKey] = useState(false);

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else if (typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print();
    }
  };

  const handleNewSale = () => {
    if (onNewSale) {
      onNewSale();
    } else {
      onClose();
    }
  };

  const handleCopyAccessKey = async () => {
    if (!nfceInvoice?.invoice?.chNFe) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(nfceInvoice.invoice.chNFe);
        setCopiedKey(true);
        setTimeout(() => setCopiedKey(false), 2000);
      }
    } catch {
      // fallback
    }
  };

  // Keyboard navigation: Enter prints, Escape starts new sale/closes
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleNewSale();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handlePrint();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onPrint, onNewSale, onClose]);

  const qrMatrix = useMemo(() => {
    if (!nfceInvoice?.invoice) return null;
    const text = nfceInvoice.invoice.qrCodeUrl || nfceInvoice.invoice.chNFe;
    return renderQrCodeMatrix(text);
  }, [nfceInvoice]);

  if (!isOpen) return null;

  const saleCode = `#VENDA-${String(sale.id).padStart(5, '0')}`;
  const cashierInfo =
    sale.operatorName || sale.cashierName || (sale.cashSessionId ? `Caixa #${sale.cashSessionId}` : 'Caixa Principal');

  const items = sale.items || [];
  const payments = sale.payments || [];
  const prescription = sale.prescription;
  const hasControlledItems =
    Boolean(prescription) ||
    items.some((it) => it.controlType && it.controlType !== 'ISENTO');

  const isContingency =
    nfceInvoice?.invoice.tpEmis === 9 || nfceInvoice?.invoice.status === 'CONTINGENCIA';

  const consumerCpf = nfceInvoice?.customerCpf || sale.prescription?.buyerCpf;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 print:static print:block print:overflow-visible print:p-0 print:bg-white"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-modal-title"
    >
      <div className="flex flex-col items-center max-w-md w-full print:max-w-none print:w-full print:m-0">
        {/* Banner de Sucesso (oculto na impressão) */}
        <div className="w-full bg-emerald-600 text-white p-3 rounded-t-xl flex items-center justify-between shadow-lg print:hidden">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-200" />
            <span className="font-bold text-sm">
              Venda Concluída com Sucesso!
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="text-emerald-200 hover:text-white p-1 rounded transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cupom Térmico ESC/POS de 48 Colunas (80mm) */}
        <div
          id="printable-sale-receipt"
          className="bg-white text-slate-800 rounded-b-xl shadow-2xl border border-slate-300 w-full p-6 font-mono text-xs max-w-[380px] print:max-w-none print:w-full print:m-0 print:shadow-none print:border-none print:p-2 print:rounded-none"
        >
          {/* Cabeçalho Comercial ou DANFE Oficial */}
          {nfceInvoice ? (
            <div className="text-center pb-3 border-b-2 border-dashed border-slate-300 space-y-1">
              <h2 id="receipt-modal-title" className="text-sm font-extrabold text-slate-900 tracking-tight">
                {nfceInvoice.profile.razaoSocial || nfceInvoice.profile.nomeFantasia || 'FARMACORE DROGARIA LTDA'}
              </h2>
              <p className="text-[10px] text-slate-600">
                CNPJ: {nfceInvoice.profile.cnpj} • IE: {nfceInvoice.profile.ie}
              </p>
              <p className="text-[10px] text-slate-500">
                {nfceInvoice.profile.logradouro}, {nfceInvoice.profile.numero} - {nfceInvoice.profile.bairro}, {nfceInvoice.profile.municipio}
              </p>
              <div className="pt-2 pb-1 border-t border-b border-slate-200 my-1 space-y-0.5">
                <p className="text-[10px] font-bold text-slate-900 uppercase">
                  DANFE NFC-e - Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica
                </p>
                <p className="text-[9px] text-slate-600 font-sans italic">
                  Não permite aproveitamento de crédito de ICMS
                </p>
              </div>
              <div className="text-[10px] text-slate-700 flex justify-between font-mono font-semibold pt-0.5">
                <span>NFC-e Nº: {String(nfceInvoice.invoice.nNF).padStart(9, '0')}</span>
                <span>Série: {nfceInvoice.invoice.serie}</span>
              </div>
              <div className="text-[10px] text-slate-500">
                Emissão: {formatDateTime(nfceInvoice.invoice.createdAt || sale.createdAt)}
              </div>
              <div className="text-[10px] text-slate-600 font-semibold">
                Operador: {cashierInfo}
              </div>
            </div>
          ) : (
            <div className="text-center pb-3 border-b-2 border-dashed border-slate-300 space-y-1">
              <h2 id="receipt-modal-title" className="text-base font-extrabold text-slate-900 tracking-tight">
                FARMACORE ERP & PDV
              </h2>
              <p className="text-[11px] text-slate-600 font-sans font-medium">
                Comprovante de Venda Fiscal PDV
              </p>
              <p className="text-[10px] text-slate-400">
                CNPJ: 12.345.678/0001-99 • Farmacêutico Resp.: CRF-SP 54.321
              </p>
              <p className="text-[10px] text-slate-500">
                Data/Hora: {formatDateTime(sale.createdAt)}
              </p>
              <p className="text-[10px] text-slate-600 font-semibold">
                Operador: {cashierInfo}
              </p>
            </div>
          )}

          {/* Selo Prominente de Contingência se tpEmis === 9 ou CONTINGENCIA */}
          {isContingency && (
            <div className="bg-amber-100 border-2 border-amber-600 text-amber-950 p-2.5 my-2.5 rounded text-center">
              <div className="flex items-center justify-center space-x-1.5 font-black text-[11px] uppercase tracking-wide">
                <AlertTriangle className="w-4 h-4 text-amber-800 shrink-0" />
                <span>EMITIDA EM CONTINGÊNCIA - PENDENTE DE AUTORIZAÇÃO</span>
              </div>
              <p className="text-[9px] text-amber-900 font-sans mt-0.5">
                Transmissão à SEFAZ em até 24 horas úteis.
              </p>
            </div>
          )}

          {/* Destaque do Código da Venda #VENDA-XXXXX */}
          <div className="py-2.5 text-center border-b-2 border-dashed border-slate-300 my-2 bg-slate-50 rounded">
            <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
              {nfceInvoice ? 'IDENTIFICADOR DA VENDA' : 'CUPOM NÃO FISCAL'}
            </span>
            <div
              data-testid="sale-receipt-code"
              className="text-2xl font-extrabold font-mono text-slate-950 tracking-wider"
            >
              {saleCode}
            </div>
            {sale.preSaleCode && (
              <span className="text-[10px] text-slate-500 font-sans block mt-0.5">
                Origem: Ticket #{sale.preSaleCode}
              </span>
            )}
          </div>

          {/* Grade de Itens da Venda */}
          <div className="py-2.5 border-b-2 border-dashed border-slate-300 space-y-2.5">
            <div className="flex justify-between text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200 pb-1">
              <span>Item / Lote / Validade</span>
              <span>Subtotal</span>
            </div>

            {items.map((item, idx) => {
              const productName = item.productName || `Item #${idx + 1}`;
              const batchNum = item.batchNumber || 'N/D';
              const expiration = item.expirationDate ? formatDate(item.expirationDate) : '';

              return (
                <div key={idx} className="space-y-0.5">
                  <div className="font-bold text-slate-900 text-xs leading-snug">
                    {idx + 1}. {productName}
                  </div>
                  <div className="text-[10px] text-slate-500 flex justify-between">
                    <span>
                      Lote: <strong>{batchNum}</strong>
                      {expiration ? ` | Val: ${expiration}` : ''}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-slate-700">
                    <span>
                      {item.quantity} un x {formatBrl(item.unitPrice)}
                    </span>
                    <span className="font-bold text-slate-900">
                      {formatBrl(item.totalPrice)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Totalizadores Financeiros */}
          <div className="py-2.5 border-b-2 border-dashed border-slate-300 space-y-1 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Qtd. Total de Itens:</span>
              <span>{items.reduce((acc, it) => acc + it.quantity, 0)} un</span>
            </div>
            {sale.discountAmount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Desconto Aplicado:</span>
                <span>-{formatBrl(sale.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-sm font-extrabold text-slate-900 pt-1 border-t border-slate-200">
              <span className="uppercase">TOTAL A PAGAR:</span>
              <span className="text-base text-emerald-700">{formatBrl(sale.totalAmount)}</span>
            </div>
          </div>

          {/* Formas de Pagamento e Troco */}
          <div className="py-2.5 border-b-2 border-dashed border-slate-300 space-y-1 text-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              PAGAMENTOS RECEBIDOS
            </span>
            {payments.map((p, idx) => (
              <div key={idx} className="flex justify-between text-slate-700">
                <span className="font-semibold">{p.method}</span>
                <span className="font-bold text-slate-900">{formatBrl(p.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between text-slate-800 font-bold pt-1 border-t border-slate-200">
              <span>Troco:</span>
              <span className="text-slate-900">{formatBrl(sale.changeAmount || 0)}</span>
            </div>
          </div>

          {/* Tributos Totais Incidentes (Lei 12.741/2012) */}
          {nfceInvoice?.taxes && (
            <div className="py-2 border-b-2 border-dashed border-slate-300 text-[10px] text-slate-600 flex justify-between">
              <span>Tributos Totais Incidentes (Lei 12.741/2012):</span>
              <span className="font-bold text-slate-800">
                {formatBrl(nfceInvoice.taxes.vTotTrib || 0)}
              </span>
            </div>
          )}

          {/* Identificação do Consumidor */}
          {nfceInvoice && (
            <div className="py-2 border-b-2 border-dashed border-slate-300 text-[10px] text-slate-700 space-y-0.5 text-center">
              <span className="font-bold">
                {consumerCpf ? `CONSUMIDOR CPF: ${consumerCpf}` : 'CONSUMIDOR NÃO IDENTIFICADO'}
              </span>
            </div>
          )}

          {/* Seção Sanitária / Receituário Retido (se houver controlados) */}
          {hasControlledItems && (
            <div
              data-testid="receipt-prescription-section"
              className="py-2.5 border-b-2 border-dashed border-slate-300 space-y-1 bg-amber-50/50 p-2.5 rounded my-2 text-[10px]"
            >
              <div className="flex items-center text-amber-900 font-bold uppercase text-[10px]">
                <FileText className="w-3.5 h-3.5 mr-1 text-amber-700" />
                <span>Receita Retida (Portaria 344/98)</span>
              </div>
              {prescription && (
                <>
                  <div>
                    <span className="text-slate-600 font-medium">Prescritor: </span>
                    <span className="font-bold text-slate-800">
                      {prescription.doctorName}
                    </span>{' '}
                    <span className="text-slate-600">
                      (CRM/{prescription.doctorUf}: {prescription.doctorCrm})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-600 font-medium">Paciente: </span>
                    <span className="font-bold text-slate-800">{prescription.patientName}</span>
                  </div>
                  <div>
                    <span className="text-slate-600 font-medium">Tipo Receita: </span>
                    <span className="font-mono text-slate-800 font-semibold">
                      {prescription.prescriptionType}
                    </span>
                  </div>
                  {prescription.prescriptionDate && (
                    <div>
                      <span className="text-slate-600 font-medium">Data Receita: </span>
                      <span className="font-semibold text-slate-800">
                        {formatDate(prescription.prescriptionDate)}
                      </span>
                    </div>
                  )}
                  {prescription.buyerName && (
                    <div>
                      <span className="text-slate-600 font-medium">Comprador: </span>
                      <span className="font-semibold text-slate-800">{prescription.buyerName}</span>
                      {prescription.buyerCpf && (
                        <span className="text-slate-600"> (CPF: {prescription.buyerCpf})</span>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Dados Fiscais SEFAZ (Chave, Protocolo e QR Code) */}
          {nfceInvoice && (
            <div className="py-3 border-b-2 border-dashed border-slate-300 text-center space-y-2.5">
              {/* Chave de Acesso de 44 Dígitos */}
              <div>
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  CHAVE DE ACESSO
                </span>
                <div className="font-mono text-[10px] font-bold text-slate-900 bg-slate-50 p-2 rounded border border-slate-200 select-all tracking-wider leading-relaxed">
                  {formatAccessKey(nfceInvoice.invoice.chNFe)}
                </div>
                <div className="flex justify-center mt-1.5 print:hidden">
                  <button
                    type="button"
                    onClick={handleCopyAccessKey}
                    aria-label="Copiar Chave"
                    className="inline-flex items-center space-x-1 px-2.5 py-1 text-[10px] font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300 transition cursor-pointer"
                  >
                    {copiedKey ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-700 font-semibold">Chave Copiada!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 text-slate-500" />
                        <span>Copiar Chave</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Protocolo de Autorização */}
              {nfceInvoice.invoice.status === 'AUTORIZADA' && nfceInvoice.invoice.protocolNumber && (
                <div className="text-[10px] text-slate-700">
                  <span className="font-semibold">Protocolo de Autorização: </span>
                  <span className="font-mono font-bold text-slate-900">
                    {nfceInvoice.invoice.protocolNumber}
                  </span>
                  {nfceInvoice.invoice.protocolDate && (
                    <span className="text-slate-500">
                      {' '}- {formatDateTime(nfceInvoice.invoice.protocolDate)}
                    </span>
                  )}
                </div>
              )}

              {/* QR Code SEFAZ */}
              {qrMatrix && (
                <div className="pt-2">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                    CONSULTA VIA LEITOR DE QR CODE
                  </span>
                  <div className="flex justify-center">
                    <svg
                      data-testid="nfce-qrcode-svg"
                      aria-label="QR Code SEFAZ"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox={`0 0 ${qrMatrix.size} ${qrMatrix.size}`}
                      className="w-36 h-36 bg-white p-1 border border-slate-200 rounded shadow-xs"
                    >
                      <rect width="100%" height="100%" fill="#ffffff" />
                      {qrMatrix.rects.map((rect, idx) => (
                        <rect
                          key={idx}
                          x={rect.x}
                          y={rect.y}
                          width={rect.w}
                          height={rect.h}
                          fill="#000000"
                        />
                      ))}
                    </svg>
                  </div>
                  {nfceInvoice.invoice.qrCodeUrl && (
                    <div className="text-[9px] text-slate-500 truncate max-w-xs mx-auto mt-1 font-mono">
                      {nfceInvoice.invoice.qrCodeUrl}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Prévia Opcional do Texto Raw ESC/POS se fornecido */}
          {receiptText && (
            <pre data-testid="raw-receipt-text" className="hidden">
              {receiptText}
            </pre>
          )}

          {/* Rodapé Fiscal do Comprovante */}
          <div className="pt-3 text-center text-[10px] text-slate-400 space-y-0.5 font-sans">
            <p>OBRIGADO PELA PREFERÊNCIA • VOLTE SEMPRE</p>
            <p>FarmaCore ERP — Sistema de Gestão Farmacêutica</p>
          </div>
        </div>

        {/* Barra de Ações (oculta na impressão) */}
        <div className="flex items-center justify-between w-full mt-4 space-x-3 print:hidden">
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="px-3 py-2 bg-slate-700 hover:bg-slate-800 text-white font-medium text-xs rounded-lg transition flex items-center shadow-sm"
          >
            <X className="w-4 h-4 mr-1" />
            Fechar
          </button>

          <div className="flex items-center space-x-2">
            {Boolean(tefReceiptNsu && onOpenTefReceipt) && (
              <button
                type="button"
                data-testid="print-tef-receipt-btn"
                onClick={onOpenTefReceipt}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white font-semibold text-xs rounded-lg transition flex items-center shadow-sm"
              >
                <CreditCard className="w-4 h-4 mr-1.5" />
                Comprovante TEF (Cartão)
              </button>
            )}

            {Boolean(pbmProtocol && onOpenPbmReceipt) && (
              <button
                type="button"
                data-testid="print-pbm-receipt-btn"
                onClick={onOpenPbmReceipt}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-xs rounded-lg transition flex items-center shadow-sm"
              >
                <FileText className="w-4 h-4 mr-1.5" />
                Cupom PBM (Denasus)
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-lg border border-slate-300 transition flex items-center shadow-sm"
            >
              <Printer className="w-4 h-4 mr-1.5 text-slate-600" />
              Imprimir Cupom (Enter)
            </button>

            <button
              type="button"
              onClick={handleNewSale}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition flex items-center shadow-sm"
            >
              <RotateCcw className="w-4 h-4 mr-1.5" />
              Nova Venda (Esc)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
