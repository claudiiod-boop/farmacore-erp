import React, { useEffect } from 'react';
import {
  Printer,
  RotateCcw,
  X,
  FileText,
  AlertCircle,
  Package,
  Calendar,
  CheckCircle,
} from 'lucide-react';
import { CartItem } from './CartTable';
import { PrescriptionDTO } from '../services/api';
import { formatDate } from './BatchSelector';
import { formatBrl } from './ProductSearch';

export interface TicketPreSaleData {
  code: string;
  createdAt?: string;
  customerName?: string | null;
  customerCpf?: string | null;
  totalAmount?: number;
}

export interface PreSaleTicketProps {
  isOpen: boolean;
  onClose: () => void;
  onNewOrder?: () => void;
  onPrint?: () => void;
  preSale: TicketPreSaleData;
  items: CartItem[];
  prescription?: PrescriptionDTO | null;
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

export default function PreSaleTicket({
  isOpen,
  onClose,
  onNewOrder,
  onPrint,
  preSale,
  items,
  prescription,
}: PreSaleTicketProps) {
  // Handle Escape and F9 shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'F9') {
        e.preventDefault();
        if (onNewOrder) {
          onNewOrder();
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onNewOrder]);

  if (!isOpen) return null;

  const displayCode = preSale.code.startsWith('#')
    ? preSale.code
    : `#${preSale.code}`;

  const calculatedTotal =
    preSale.totalAmount !== undefined
      ? preSale.totalAmount
      : items.reduce((acc, it) => acc + (it.totalPrice || 0), 0);

  const totalUnits = items.reduce((acc, it) => acc + (it.quantity || 1), 0);

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else if (typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print();
    }
  };

  const handleNewOrder = () => {
    if (onNewOrder) {
      onNewOrder();
    } else {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 print:p-0 print:bg-white"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ticket-title"
    >
      <div className="flex flex-col items-center max-w-md w-full">
        {/* Painel do Ticket Térmico de 80mm */}
        <div
          id="printable-ticket"
          className="bg-white text-slate-800 rounded-xl shadow-2xl border border-slate-300 w-full p-6 font-mono text-xs max-w-[380px] print:max-w-none print:shadow-none print:border-none print:p-2"
        >
          {/* Cabeçalho Comercial FarmaCore */}
          <div className="text-center pb-3 border-b-2 border-dashed border-slate-300 space-y-1">
            <h2 id="ticket-title" className="text-base font-extrabold text-slate-900 tracking-tight">
              FARMACORE ERP & PDV
            </h2>
            <p className="text-[11px] text-slate-600 font-sans font-medium">
              Comprovante de Pré-Venda • Atendimento de Balcão
            </p>
            <p className="text-[10px] text-slate-400">
              CNPJ: 12.345.678/0001-99 • CRF-SP: 54.321
            </p>
            <p className="text-[10px] text-slate-500">
              Emissão: {formatDateTime(preSale.createdAt)}
            </p>
          </div>

          {/* Código em Destaque #PV-XXXX */}
          <div className="py-3 text-center border-b-2 border-dashed border-slate-300 my-2 bg-slate-50 rounded">
            <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
              CÓDIGO DE ATENDIMENTO
            </span>
            <div
              data-testid="ticket-code"
              className="text-3xl font-extrabold font-mono text-slate-950 tracking-wider"
            >
              {displayCode}
            </div>
          </div>

          {/* Aviso Obrigatório para Encaminhamento ao Caixa */}
          <div className="bg-amber-50 border border-amber-300 rounded p-2.5 my-3 text-center text-amber-900">
            <span className="font-sans font-bold text-xs uppercase block">
              Dirija-se ao Caixa
            </span>
            <span className="text-[10px] text-amber-800 font-sans mt-0.5 block leading-tight">
              Apresente este ticket no caixa para efetuar o pagamento e retirada dos medicamentos.
            </span>
          </div>

          {/* Identificação do Cliente (se informado) */}
          {(preSale.customerName || preSale.customerCpf) && (
            <div className="py-2 border-b border-dashed border-slate-300 space-y-0.5 text-[11px]">
              {preSale.customerName && (
                <div>
                  <span className="text-slate-500">Cliente: </span>
                  <span className="font-bold text-slate-800">{preSale.customerName}</span>
                </div>
              )}
              {preSale.customerCpf && (
                <div>
                  <span className="text-slate-500">CPF: </span>
                  <span className="font-bold text-slate-800">{preSale.customerCpf}</span>
                </div>
              )}
            </div>
          )}

          {/* Relação de Medicamentos com Lotes e Validades */}
          <div className="py-3 border-b-2 border-dashed border-slate-300 space-y-3">
            <div className="flex justify-between text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200 pb-1">
              <span>Item / Lote / Validade</span>
              <span>Subtotal</span>
            </div>

            {items.map((item, idx) => {
              const productName = item.product?.name || (item as any).productName || `Item #${idx + 1}`;
              const batchNum = item.batch?.batchNumber || (item as any).batchNumber || 'N/D';
              const expiration = item.batch?.expirationDate || (item as any).expirationDate || '';

              return (
                <div key={idx} className="space-y-1">
                  <div className="font-bold text-slate-900 text-xs leading-snug">
                    {idx + 1}. {productName}
                  </div>
                  <div className="text-[11px] text-slate-600 flex items-center justify-between">
                    <span>
                      Lote: <strong>{batchNum}</strong> | Val: {formatDate(expiration)}
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

          {/* Totalizadores da Pré-Venda */}
          <div className="py-3 border-b-2 border-dashed border-slate-300 space-y-1">
            <div className="flex justify-between text-slate-600 text-xs">
              <span>Total de Linhas:</span>
              <span>{items.length}</span>
            </div>
            <div className="flex justify-between text-slate-600 text-xs">
              <span>Total de Unidades:</span>
              <span>{totalUnits} un</span>
            </div>
            <div className="flex justify-between items-center text-sm font-extrabold text-slate-900 pt-1 border-t border-slate-200">
              <span className="uppercase">TOTAL:</span>
              <span className="text-base text-emerald-700">{formatBrl(calculatedTotal)}</span>
            </div>
          </div>

          {/* Seção de Retenção de Receituário Sanitário (se aplicável) */}
          {prescription && (
            <div
              data-testid="ticket-prescription-section"
              className="py-3 border-b-2 border-dashed border-slate-300 space-y-1.5 bg-amber-50/50 p-2.5 rounded my-2 text-[10px]"
            >
              <div className="flex items-center text-amber-900 font-bold uppercase text-[10px]">
                <FileText className="w-3.5 h-3.5 mr-1 text-amber-700" />
                <span>Receita Retida (Portaria 344/98)</span>
              </div>
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
              <div>
                <span className="text-slate-600 font-medium">Data Receita: </span>
                <span className="font-semibold text-slate-800">
                  {formatDate(prescription.prescriptionDate)}
                </span>
              </div>
              {prescription.buyerName && (
                <div>
                  <span className="text-slate-600 font-medium">Comprador: </span>
                  <span className="font-semibold text-slate-800">{prescription.buyerName}</span>
                  {prescription.buyerCpf && (
                    <span className="text-slate-600"> (CPF: {prescription.buyerCpf})</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Rodapé Fiscal do Comprovante */}
          <div className="pt-3 text-center text-[10px] text-slate-400 space-y-0.5 font-sans">
            <p>ESTE DOCUMENTO NÃO É DOCUMENTO FISCAL</p>
            <p>Válido para pagamento no caixa durante a sessão de hoje</p>
          </div>
        </div>

        {/* Barra de Ações do Modal (oculta na impressão) */}
        <div className="flex items-center justify-between w-full mt-4 space-x-3 print:hidden">
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white font-medium text-xs rounded-lg transition flex items-center shadow-sm"
          >
            <X className="w-4 h-4 mr-1" />
            Fechar (Esc)
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-lg border border-slate-300 transition flex items-center shadow-sm"
            >
              <Printer className="w-4 h-4 mr-1.5 text-slate-600" />
              Imprimir Ticket
            </button>

            <button
              type="button"
              onClick={handleNewOrder}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition flex items-center shadow-sm"
            >
              <RotateCcw className="w-4 h-4 mr-1.5" />
              Novo Atendimento (F9)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
