import { useState, useEffect } from 'react';
import { X, FileText, Printer, Copy, Check, Calendar, Loader2, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';
import { formatBrl } from '../ProductSearch';
import type { CorporateAgreement, AgreementInvoice } from '../../types';

export interface PayrollInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  agreement: CorporateAgreement;
}

export default function PayrollInvoiceModal({
  isOpen,
  onClose,
  agreement,
}: PayrollInvoiceModalProps) {
  const [invoices, setInvoices] = useState<AgreementInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form for generating new invoice
  const [isGenerating, setIsGenerating] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dueDate, setDueDate] = useState('');

  // Report viewing state
  const [selectedInvoiceReport, setSelectedInvoiceReport] = useState<{
    invoiceId: number;
    textReport: string;
  } | null>(null);
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadInvoices = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.credit.getAgreementInvoices(agreement.id);
      setInvoices(res);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao carregar faturas');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setSelectedInvoiceReport(null);
      setCopied(false);
      // Default dates
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
      const nextDue = new Date(now.getFullYear(), now.getMonth() + 1, agreement.dueDay || 5)
        .toISOString()
        .slice(0, 10);

      setStartDate(firstDay);
      setEndDate(lastDay);
      setDueDate(nextDue);

      loadInvoices();
    }
  }, [isOpen, agreement.id, agreement.dueDay]);

  if (!isOpen) return null;

  const handleGenerateInvoice = async () => {
    if (!startDate || !endDate || !dueDate) {
      setErrorMessage('Informe período inicial, final e data de vencimento.');
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);
    try {
      await api.credit.generateInvoice(agreement.id, {
        startDate,
        endDate,
        dueDate,
      });
      await loadInvoices();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao fechar fatura de folha');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleViewPayrollReport = async (invId: number) => {
    setIsReportLoading(true);
    setErrorMessage(null);
    try {
      const rep = await api.credit.getPayrollReport(invId);
      setSelectedInvoiceReport({
        invoiceId: invId,
        textReport: rep.textReport,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao gerar extrato de folha de pagamento');
    } finally {
      setIsReportLoading(false);
    }
  };

  const handleCopyReport = async () => {
    if (!selectedInvoiceReport?.textReport) return;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(selectedInvoiceReport.textReport);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      // fallback
    }
  };

  const handlePrintReport = () => {
    if (!selectedInvoiceReport?.textReport) return;
    const printWindow = window.open('', '_blank', 'width=600,height=700');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Extrato de RH - Convênio ${agreement.tradeName} - Fatura #${selectedInvoiceReport.invoiceId}</title>
            <style>
              body {
                font-family: 'Courier New', Courier, monospace;
                white-space: pre;
                font-size: 11px;
                padding: 10px;
                margin: 0;
                line-height: 1.25;
              }
              @media print {
                @page { margin: 10mm; size: A4 portrait; }
                body { padding: 5mm; }
              }
            </style>
          </head>
          <body>${selectedInvoiceReport.textReport.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payroll-modal-title"
    >
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full flex flex-col overflow-hidden max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h2 id="payroll-modal-title" className="text-base font-bold">
              Gestão de Faturas & Extrato de RH
            </h2>
            <p className="text-xs text-slate-400">
              {agreement.tradeName || agreement.companyName} ({agreement.code}) • CNPJ: {agreement.cnpj}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg flex items-center space-x-2 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {selectedInvoiceReport ? (
            /* Report View */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Extrato Consolidado para o RH (Fatura #{selectedInvoiceReport.invoiceId})
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedInvoiceReport(null)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-bold cursor-pointer"
                >
                  ← Voltar às Faturas
                </button>
              </div>

              <div
                data-testid="payroll-report-content"
                className="bg-amber-50/40 p-4 rounded-lg border border-dashed border-slate-300 font-mono text-xs whitespace-pre select-text leading-relaxed text-slate-800 max-h-96 overflow-y-auto"
              >
                {selectedInvoiceReport.textReport}
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={handleCopyReport}
                  className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copiar Extrato</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  data-testid="print-payroll-btn"
                  onClick={handlePrintReport}
                  className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir Extrato RH</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Generate new invoice section */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center space-x-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  <span>Novo Fechamento de Fatura Mensal</span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">Período Inicial</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white outline-hidden font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">Período Final</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white outline-hidden font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">Vencimento Boleto</label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white outline-hidden font-mono"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    data-testid="generate-invoice-btn"
                    onClick={handleGenerateInvoice}
                    disabled={isGenerating}
                    className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {isGenerating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <FileText className="w-4 h-4" />
                    )}
                    <span>Fechar Fatura & Consolidar Folha</span>
                  </button>
                </div>
              </div>

              {/* Invoices List */}
              <div>
                <span className="text-xs font-bold text-slate-700 block uppercase tracking-wider mb-2">
                  Histórico de Faturas Emitidas ({invoices.length})
                </span>

                {isLoading ? (
                  <div className="p-6 text-center text-xs text-slate-500">Carregando faturas...</div>
                ) : invoices.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500 bg-slate-50 rounded-lg border border-slate-200">
                    Nenhuma fatura fechada até o momento.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-56 overflow-y-auto">
                    {invoices.map((inv) => (
                      <div
                        key={inv.id}
                        className="p-3 flex items-center justify-between text-xs hover:bg-slate-50"
                      >
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-900">
                              {inv.invoiceNumber || inv.invoice_number}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                inv.status === 'PAID'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {inv.status === 'PAID' ? 'PAGA' : 'ABERTA'}
                            </span>
                          </div>
                          <span className="text-slate-500 text-[11px]">
                            Vencimento:{' '}
                            {new Date(inv.dueDate || inv.due_date || '').toLocaleDateString('pt-BR')} •{' '}
                            {inv.totalEmployeesCount || inv.total_employees_count || 0} funcionários
                          </span>
                        </div>

                        <div className="flex items-center space-x-3">
                          <span className="font-black text-sm text-slate-900">
                            {formatBrl(inv.totalAmount || inv.total_amount || 0)}
                          </span>

                          <button
                            type="button"
                            data-testid={`view-payroll-${inv.id}`}
                            onClick={() => handleViewPayrollReport(inv.id)}
                            disabled={isReportLoading}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded text-xs transition cursor-pointer"
                          >
                            Extrato RH
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
