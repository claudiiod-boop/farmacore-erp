import { useEffect } from 'react';
import {
  Printer,
  RotateCcw,
  X,
  FileText,
  CheckCircle2,
} from 'lucide-react';
import { Sale } from '../../services/api';
import { formatBrl } from '../ProductSearch';
import { formatDate } from '../BatchSelector';

export interface SaleReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale;
  receiptText?: string;
  onPrint?: () => void;
  onNewSale?: () => void;
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

export default function SaleReceiptModal({
  isOpen,
  onClose,
  sale,
  receiptText,
  onPrint,
  onNewSale,
}: SaleReceiptModalProps) {
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
            <span className="font-bold text-sm">Venda Concluída com Sucesso!</span>
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
          {/* Cabeçalho Comercial */}
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

          {/* Destaque do Código da Venda #VENDA-XXXXX */}
          <div className="py-2.5 text-center border-b-2 border-dashed border-slate-300 my-2 bg-slate-50 rounded">
            <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
              CUPOM NÃO FISCAL
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
