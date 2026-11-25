import React, { useState, useEffect, useCallback } from 'react';
import { agreementsApi } from '../services/api';
import type {
  AgreementInvoice,
  AgreementBillingKpis,
  PayrollExportResult,
  AgreementInvoiceStatus
} from '../types/agreements';

export const CorporateAgreementsBillingPage: React.FC = () => {
  const [invoices, setInvoices] = useState<AgreementInvoice[]>([]);
  const [kpis, setKpis] = useState<AgreementBillingKpis | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('TODOS');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal de Faturamento em Lote
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchPeriodStart, setBatchPeriodStart] = useState('2026-11-01');
  const [batchPeriodEnd, setBatchPeriodEnd] = useState('2026-11-20');
  const [batchDueDate, setBatchDueDate] = useState('2026-12-05');
  const [batchSubmitting, setBatchSubmitting] = useState(false);

  // Modal de Liquidação / Baixa
  const [settleInvoiceTarget, setSettleInvoiceTarget] = useState<AgreementInvoice | null>(null);
  const [paidDate, setPaidDate] = useState(new Date().toISOString().slice(0, 10));
  const [settleNotes, setSettleNotes] = useState('');
  const [settleSubmitting, setSettleSubmitting] = useState(false);

  // Modal de Espelho de Desconto em Folha para RH
  const [payrollData, setPayrollData] = useState<PayrollExportResult | null>(null);
  const [isPayrollModalOpen, setIsPayrollModalOpen] = useState(false);
  const [payrollLoading, setPayrollLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const statusParam = statusFilter !== 'TODOS' ? (statusFilter as AgreementInvoiceStatus) : undefined;
      const [invRes, kpiRes] = await Promise.all([
        agreementsApi.listInvoices({ status: statusParam }),
        agreementsApi.getKpis()
      ]);

      if (invRes.success) {
        setInvoices(invRes.data || []);
      }
      if (kpiRes.success) {
        setKpis(kpiRes.data || null);
      }
    } catch (err: any) {
      setError(err.message || 'Falha ao carregar faturas de convênios');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Executar Faturamento em Lote
  const handleBatchBilling = async (e: React.FormEvent) => {
    e.preventDefault();
    setBatchSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await agreementsApi.generateBatchBilling({
        period_start: batchPeriodStart,
        period_end: batchPeriodEnd,
        due_date: batchDueDate
      });
      if (res.success) {
        setSuccessMsg(`Faturamento em lote concluído com sucesso! ${res.data.length} fatura(s) gerada(s).`);
        setIsBatchModalOpen(false);
        await loadData();
      } else {
        setError(res.error || 'Erro ao processar faturamento em lote');
      }
    } catch (err: any) {
      setError(err.message || 'Erro inesperado no fechamento');
    } finally {
      setBatchSubmitting(false);
    }
  };

  // Liquidar Fatura
  const handleSettleInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleInvoiceTarget) return;
    setSettleSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await agreementsApi.settleInvoice(settleInvoiceTarget.id, {
        paid_date: paidDate,
        notes: settleNotes
      });
      if (res.success) {
        setSuccessMsg(`Fatura ${settleInvoiceTarget.invoice_number} liquidada com sucesso!`);
        setSettleInvoiceTarget(null);
        await loadData();
      } else {
        setError(res.error || 'Falha ao liquidar fatura');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao liquidar fatura');
    } finally {
      setSettleSubmitting(false);
    }
  };

  // Abrir Espelho de Folha de Pagamento
  const handleOpenPayrollExport = async (inv: AgreementInvoice) => {
    setPayrollLoading(true);
    setError(null);
    try {
      const res = await agreementsApi.exportPayrollDiscount(inv.id);
      if (res.success) {
        setPayrollData(res.data);
        setIsPayrollModalOpen(true);
      } else {
        setError(res.error || 'Erro ao gerar espelho de folha');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao exportar espelho de folha');
    } finally {
      setPayrollLoading(false);
    }
  };

  // Download do arquivo CSV para RH
  const handleDownloadCsv = () => {
    if (!payrollData) return;
    const blob = new Blob([payrollData.csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `desconto_folha_${payrollData.invoiceId}_${payrollData.cnpj.replace(/\D/g, '')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen" data-testid="corporate-agreements-billing-page">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-6 border-b border-gray-200 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-indigo-100 text-indigo-800 text-xs font-semibold px-2.5 py-0.5 rounded uppercase">
              B2B Corporativo & RH
            </span>
            <span className="text-gray-400 text-xs">Fase 45 FarmaCore</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">
            Gestão de Convênios Empresariais & Faturamento em Lote
          </h1>
          <p className="text-sm text-gray-600">
            Faturamento automatizado de compras corporativas com desconto em folha e trava preventiva de inadimplência.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            data-testid="refresh-billing-button"
            onClick={loadData}
            disabled={loading}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            {loading ? 'Carregando...' : 'Atualizar'}
          </button>
          <button
            data-testid="batch-billing-button"
            onClick={() => setIsBatchModalOpen(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm transition"
          >
            + Fechamento em Lote (RH)
          </button>
        </div>
      </div>

      {/* Alertas */}
      {error && (
        <div data-testid="error-alert" className="mt-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm rounded">
          {error}
        </div>
      )}
      {successMsg && (
        <div data-testid="success-alert" className="mt-4 p-4 bg-green-50 border-l-4 border-green-500 text-green-700 text-sm rounded">
          {successMsg}
        </div>
      )}

      {/* KPIs Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <span className="text-xs font-medium text-gray-500">Convênios Ativos</span>
          <p className="text-2xl font-bold text-gray-900 mt-1" data-testid="kpi-active-agreements">
            {kpis?.total_agreements_active ?? 0}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <span className="text-xs font-medium text-gray-500">Faturas em Aberto</span>
          <p className="text-2xl font-bold text-amber-600 mt-1" data-testid="kpi-open-invoices">
            {kpis?.open_invoices_count ?? 0}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <span className="text-xs font-medium text-gray-500">Total a Receber</span>
          <p className="text-2xl font-bold text-gray-900 mt-1" data-testid="kpi-open-amount">
            R$ {(kpis?.total_open_amount ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <span className="text-xs font-medium text-gray-500">Faturas Pagas (Mês)</span>
          <p className="text-2xl font-bold text-emerald-600 mt-1" data-testid="kpi-paid-invoices">
            {kpis?.paid_invoices_month_count ?? 0}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <span className="text-xs font-medium text-gray-500">Colaboradores Conveniados</span>
          <p className="text-2xl font-bold text-blue-600 mt-1" data-testid="kpi-active-employees">
            {kpis?.active_employees_count ?? 0}
          </p>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="mt-6 flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200 gap-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">Filtrar por Status:</span>
          <select
            data-testid="status-filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white text-gray-800"
          >
            <option value="TODOS">Todos os Status</option>
            <option value="OPEN">Em Aberto (Pendente RH)</option>
            <option value="PAID">Quitadas / Pagas</option>
            <option value="CANCELLED">Canceladas</option>
          </select>
        </div>
        <span className="text-xs text-gray-500" data-testid="total-records-count">
          Exibindo {invoices.length} fatura(s)
        </span>
      </div>

      {/* Tabela de Faturas de Convênio */}
      <div className="mt-4 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Nº Fatura</th>
                <th className="px-4 py-3 text-left font-semibold">Empresa Conveniada</th>
                <th className="px-4 py-3 text-left font-semibold">Período</th>
                <th className="px-4 py-3 text-left font-semibold">Vencimento</th>
                <th className="px-4 py-3 text-center font-semibold">Compras</th>
                <th className="px-4 py-3 text-center font-semibold">Colaboradores</th>
                <th className="px-4 py-3 text-right font-semibold">Total Fatura</th>
                <th className="px-4 py-3 text-center font-semibold">Status</th>
                <th className="px-4 py-3 text-center font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-gray-800">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500" data-testid="empty-invoices-row">
                    Nenhuma fatura de convênio encontrada no período selecionado.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50" data-testid={`invoice-row-${inv.id}`}>
                    <td className="px-4 py-3 font-semibold text-indigo-600">{inv.invoice_number}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{inv.company_name || `Convênio #${inv.agreement_id}`}</div>
                      <div className="text-xs text-gray-500">{inv.cnpj || '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {inv.period_start} a {inv.period_end}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{inv.due_date}</td>
                    <td className="px-4 py-3 text-center">{inv.total_sales_count}</td>
                    <td className="px-4 py-3 text-center">{inv.total_employees_count}</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">
                      R$ {inv.total_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                          inv.status === 'PAID'
                            ? 'bg-green-100 text-green-800'
                            : inv.status === 'OPEN'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {inv.status === 'PAID' ? 'PAGO' : inv.status === 'OPEN' ? 'ABERTO' : inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          data-testid={`export-payroll-button-${inv.id}`}
                          onClick={() => handleOpenPayrollExport(inv)}
                          disabled={payrollLoading}
                          className="px-2.5 py-1 text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded font-medium transition"
                          title="Espelho de Desconto em Folha para RH"
                        >
                          Espelho RH
                        </button>
                        {inv.status === 'OPEN' && (
                          <button
                            data-testid={`settle-invoice-button-${inv.id}`}
                            onClick={() => {
                              setSettleInvoiceTarget(inv);
                              setSettleNotes('');
                            }}
                            className="px-2.5 py-1 text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded font-medium transition"
                            title="Registrar Pagamento / Baixa"
                          >
                            Liquidar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Faturamento em Lote */}
      {isBatchModalOpen && (
        <div
          data-testid="batch-billing-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
        >
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Fechamento Mensal em Lote (RH)</h3>
            <p className="text-xs text-gray-500 mb-4">
              Consolida todas as compras dos colaboradores de convênios ativos no período e gera as faturas sequenciais.
            </p>
            <form onSubmit={handleBatchBilling} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Início do Período</label>
                <input
                  type="date"
                  data-testid="batch-start-date"
                  value={batchPeriodStart}
                  onChange={(e) => setBatchPeriodStart(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Fim do Período (Corte)</label>
                <input
                  type="date"
                  data-testid="batch-end-date"
                  value={batchPeriodEnd}
                  onChange={(e) => setBatchPeriodEnd(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Data de Vencimento</label>
                <input
                  type="date"
                  data-testid="batch-due-date"
                  value={batchDueDate}
                  onChange={(e) => setBatchDueDate(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsBatchModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  data-testid="confirm-batch-billing-button"
                  disabled={batchSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold"
                >
                  {batchSubmitting ? 'Gerando Faturas...' : 'Processar Fechamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Liquidar Fatura */}
      {settleInvoiceTarget && (
        <div
          data-testid="settle-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
        >
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Liquidar Fatura de Convênio</h3>
            <p className="text-xs text-gray-500 mb-4">
              Fatura: <span className="font-semibold text-gray-800">{settleInvoiceTarget.invoice_number}</span> -{' '}
              {settleInvoiceTarget.company_name} (R${' '}
              {settleInvoiceTarget.total_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
            </p>
            <form onSubmit={handleSettleInvoice} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Data do Pagamento</label>
                <input
                  type="date"
                  data-testid="settle-paid-date"
                  value={paidDate}
                  onChange={(e) => setPaidDate(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Observações do Recebimento</label>
                <input
                  type="text"
                  data-testid="settle-notes"
                  placeholder="Ex: TED Bancária nº 12345 / PIX PJ"
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setSettleInvoiceTarget(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  data-testid="confirm-settle-button"
                  disabled={settleSubmitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold"
                >
                  {settleSubmitting ? 'Confirmando...' : 'Confirmar Liquidação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Espelho de Folha de Pagamento para RH */}
      {isPayrollModalOpen && payrollData && (
        <div
          data-testid="payroll-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
        >
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6">
            <div className="flex justify-between items-start pb-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Espelho de Desconto em Folha (RH)</h3>
                <p className="text-xs text-gray-500">
                  {payrollData.companyName} ({payrollData.cnpj}) | Período: {payrollData.period}
                </p>
              </div>
              <button
                onClick={() => setIsPayrollModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 my-4 bg-gray-50 p-3 rounded-lg text-sm">
              <div>
                <span className="text-gray-500 text-xs">Total de Colaboradores:</span>
                <p className="font-bold text-gray-900">{payrollData.totalEmployees}</p>
              </div>
              <div>
                <span className="text-gray-500 text-xs">Valor Total a Descontar:</span>
                <p className="font-bold text-indigo-700">
                  R$ {payrollData.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Conteúdo do Arquivo de Integração (CSV RH):
              </label>
              <textarea
                data-testid="payroll-csv-content"
                readOnly
                rows={8}
                value={payrollData.csvContent}
                className="w-full font-mono text-xs p-3 bg-gray-900 text-green-400 rounded-lg overflow-x-auto"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsPayrollModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Fechar
              </button>
              <button
                type="button"
                data-testid="download-csv-button"
                onClick={handleDownloadCsv}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2"
              >
                <span>Baixar CSV para RH</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CorporateAgreementsBillingPage;
