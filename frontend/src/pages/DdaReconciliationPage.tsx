import React, { useState, useEffect } from 'react';
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  Clock,
  DollarSign,
  RefreshCw,
  UploadCloud,
  Check,
  ShieldAlert,
  Search,
  Filter,
  ArrowRight,
  Building2,
  Calendar,
  X
} from 'lucide-react';
import { ddaApi } from '../services/api';
import { DdaInvoice, DdaKpis, DdaInvoiceStatus, ImportDdaInvoiceInput } from '../types/dda';

export const DdaReconciliationPage: React.FC = () => {
  const [invoices, setInvoices] = useState<DdaInvoice[]>([]);
  const [kpis, setKpis] = useState<DdaKpis | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal de Importação
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importBankCode, setImportBankCode] = useState('001');
  const [importBeneficiaryCnpj, setImportBeneficiaryCnpj] = useState('12.345.678/0001-99');
  const [importBeneficiaryName, setImportBeneficiaryName] = useState('Distribuidora Panpharma Medicamentos');
  const [importDueDate, setImportDueDate] = useState('2026-12-15');
  const [importNominalAmount, setImportNominalAmount] = useState('2500.50');

  // Modal de Quitação
  const [settleInvoiceTarget, setSettleInvoiceTarget] = useState<DdaInvoice | null>(null);
  const [settleDate, setSettleDate] = useState(new Date().toISOString().slice(0, 10));

  const loadData = async () => {
    try {
      setLoading(true);
      const [invRes, kpiRes] = await Promise.all([
        ddaApi.getInvoices({
          store_id: '1',
          status: selectedStatus === 'ALL' ? undefined : selectedStatus
        }),
        ddaApi.getKpis('1')
      ]);

      if (invRes.success) setInvoices(invRes.data);
      if (kpiRes.success) setKpis(kpiRes.data);
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.message || 'Erro ao carregar dados DDA' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedStatus]);

  // Executa conciliação automática
  const handleAutoReconcile = async () => {
    try {
      setLoading(true);
      setFeedbackMsg(null);
      const res = await ddaApi.reconcileAuto('1');
      if (res.success && res.data) {
        const { matchedCount, mismatchValueCount, unmatchedCount } = res.data;
        setFeedbackMsg({
          type: 'success',
          text: `Conciliação finalizada: ${matchedCount} títulos conciliados com sucesso, ${mismatchValueCount} com divergência de valor e ${unmatchedCount} não reconhecidos.`
        });
        loadData();
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.message || 'Falha na conciliação automática' });
    } finally {
      setLoading(false);
    }
  };

  // Importa boleto simulado
  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const item: ImportDdaInvoiceInput = {
        bank_code: importBankCode,
        bank_name: importBankCode === '001' ? 'Banco do Brasil' : importBankCode === '237' ? 'Bradesco' : 'Itaú',
        barcode: '00191234567890123456789012345678901234567890',
        digitable_line: '00190.00009 01234.567890 12345.678901 2 89012345678901',
        beneficiary_cnpj: importBeneficiaryCnpj,
        beneficiary_name: importBeneficiaryName,
        payer_cnpj: '98.765.432/0001-88',
        due_date: importDueDate,
        issue_date: new Date().toISOString().slice(0, 10),
        nominal_amount: parseFloat(importNominalAmount) || 0
      };

      const res = await ddaApi.importFile('1', [item]);
      if (res.success) {
        setFeedbackMsg({ type: 'success', text: 'Boleto bancário DDA importado com sucesso!' });
        setIsImportModalOpen(false);
        loadData();
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.message || 'Erro ao importar boleto DDA' });
    } finally {
      setLoading(false);
    }
  };

  // Quitar boleto
  const handleSettleSubmit = async () => {
    if (!settleInvoiceTarget) return;
    try {
      setLoading(true);
      const res = await ddaApi.settleInvoice(settleInvoiceTarget.id, settleInvoiceTarget.final_amount, settleDate);
      if (res.success) {
        setFeedbackMsg({ type: 'success', text: `Título #${settleInvoiceTarget.id.slice(0, 8)} liquidado com sucesso!` });
        setSettleInvoiceTarget(null);
        loadData();
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.message || 'Erro ao liquidar boleto' });
    } finally {
      setLoading(false);
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    const term = searchTerm.toLowerCase();
    return (
      inv.beneficiary_name.toLowerCase().includes(term) ||
      inv.beneficiary_cnpj.includes(term) ||
      inv.digitable_line.includes(term)
    );
  });

  return (
    <div className="flex-1 bg-slate-950 text-slate-100 p-6 overflow-y-auto font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-800 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="w-7 h-7 text-emerald-400" />
            Conciliação DDA & Boletos de Fornecedores
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Varredura eletrônica Febraban/CIP de boletos de distribuidoras farmacêuticas e cruzamento com NF-e de entrada.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            data-testid="btn-import-dda-modal"
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-xl border border-slate-700 font-semibold text-sm transition"
          >
            <UploadCloud className="w-4 h-4 text-emerald-400" />
            <span>Importar Arquivo DDA</span>
          </button>

          <button
            type="button"
            data-testid="btn-auto-reconcile"
            onClick={handleAutoReconcile}
            disabled={loading}
            className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-emerald-950/40 transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Conciliar com Compras</span>
          </button>
        </div>
      </div>

      {/* Alertas e Mensagens */}
      {feedbackMsg && (
        <div
          data-testid="alert-feedback-message"
          className={`mt-4 p-4 rounded-xl border flex items-center space-x-3 ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
          }`}
        >
          {feedbackMsg.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
          )}
          <span className="text-sm font-medium">{feedbackMsg.text}</span>
        </div>
      )}

      {/* Cards de KPIs */}
      {kpis && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 my-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex justify-between items-start">
              <span className="text-xs uppercase font-semibold text-slate-400">Total Boletos DDA</span>
              <FileText className="w-5 h-5 text-slate-400" />
            </div>
            <div data-testid="kpi-total-invoices" className="text-2xl font-bold text-white mt-2">
              {kpis.total_invoices}
            </div>
            <div className="text-xs text-slate-500 mt-1">Registrados no CNPJ da drogaria</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex justify-between items-start">
              <span className="text-xs uppercase font-semibold text-slate-400">Conciliados c/ Sucesso</span>
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div data-testid="kpi-matched-invoices" className="text-2xl font-bold text-emerald-400 mt-2">
              {kpis.matched_invoices}{' '}
              <span className="text-xs font-normal text-emerald-500">
                ({kpis.reconciliation_rate_percent}%)
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              R$ {kpis.total_amount_matched.toFixed(2).replace('.', ',')}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex justify-between items-start">
              <span className="text-xs uppercase font-semibold text-slate-400">Pendentes de Conciliação</span>
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <div data-testid="kpi-pending-invoices" className="text-2xl font-bold text-amber-400 mt-2">
              {kpis.pending_invoices}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              R$ {kpis.total_amount_pending.toFixed(2).replace('.', ',')}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex justify-between items-start">
              <span className="text-xs uppercase font-semibold text-slate-400">Não Reconhecidos / Risco</span>
              <ShieldAlert className="w-5 h-5 text-rose-400" />
            </div>
            <div data-testid="kpi-unmatched-invoices" className="text-2xl font-bold text-rose-400 mt-2">
              {kpis.unmatched_invoices}
            </div>
            <div className="text-xs text-slate-500 mt-1">Sem correspondência no ERP</div>
          </div>
        </div>
      )}

      {/* Barra de Filtros e Busca */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between mb-6">
        <div className="flex items-center space-x-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-400 uppercase">Status:</span>
          {(['ALL', 'PENDING', 'MATCHED', 'MISMATCH_VALUE', 'UNMATCHED', 'PAID'] as const).map((st) => (
            <button
              key={st}
              type="button"
              data-testid={`filter-btn-${st.toLowerCase()}`}
              onClick={() => setSelectedStatus(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                selectedStatus === st
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {st === 'ALL'
                ? 'Todos'
                : st === 'PENDING'
                ? 'Pendentes'
                : st === 'MATCHED'
                ? 'Conciliados'
                : st === 'MISMATCH_VALUE'
                ? 'Divergência'
                : st === 'UNMATCHED'
                ? 'Alerta'
                : 'Pagos'}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por distribuidora, CNPJ ou linha..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Tabela de Boletos DDA */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase font-semibold border-b border-slate-800">
              <tr>
                <th className="p-4">Banco</th>
                <th className="p-4">Favorecido / Distribuidora</th>
                <th className="p-4">Vencimento</th>
                <th className="p-4">Valor Final</th>
                <th className="p-4">Status Conciliação</th>
                <th className="p-4">Vínculo ERP</th>
                <th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredInvoices.length > 0 ? (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} data-testid={`dda-row-${inv.id}`} className="hover:bg-slate-800/40 transition">
                    <td className="p-4 font-mono">
                      <span className="font-bold text-white">{inv.bank_code}</span>
                      <div className="text-[11px] text-slate-500">{inv.bank_name}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-semibold text-white">{inv.beneficiary_name}</div>
                      <div className="text-slate-400 font-mono text-[11px]">CNPJ: {inv.beneficiary_cnpj}</div>
                    </td>
                    <td className="p-4 font-mono text-slate-300">
                      {inv.due_date}
                      <div className="text-[10px] text-slate-500">Emissão: {inv.issue_date}</div>
                    </td>
                    <td className="p-4 font-mono font-bold text-base text-white">
                      R$ {inv.final_amount.toFixed(2).replace('.', ',')}
                    </td>
                    <td className="p-4">
                      {inv.status === 'MATCHED' && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Conciliado
                        </span>
                      )}
                      {inv.status === 'PENDING' && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-700 text-slate-300">
                          Pendente
                        </span>
                      )}
                      {inv.status === 'MISMATCH_VALUE' && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          Divergência Valor
                        </span>
                      )}
                      {inv.status === 'UNMATCHED' && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                          Não Reconhecido
                        </span>
                      )}
                      {inv.status === 'PAID' && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                          Liquidado
                        </span>
                      )}
                    </td>
                    <td className="p-4 font-mono text-[11px] text-slate-400">
                      {inv.matched_purchase_invoice_id && (
                        <span className="text-emerald-400">NF-e Compra #{inv.matched_purchase_invoice_id}</span>
                      )}
                      {inv.matched_expense_id && (
                        <span className="text-blue-400">Despesa #{inv.matched_expense_id}</span>
                      )}
                      {!inv.matched_purchase_invoice_id && !inv.matched_expense_id && (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {inv.status !== 'PAID' && (
                        <button
                          type="button"
                          data-testid={`btn-settle-${inv.id}`}
                          onClick={() => setSettleInvoiceTarget(inv)}
                          className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                        >
                          Liquidar
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    Nenhum boleto DDA encontrado para os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Importação DDA */}
      {isImportModalOpen && (
        <div
          data-testid="modal-import-dda"
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-emerald-400" />
                Importar Título DDA Bancário
              </h3>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleImportSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Banco Emissor</label>
                <select
                  value={importBankCode}
                  onChange={(e) => setImportBankCode(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white outline-none"
                >
                  <option value="001">001 - Banco do Brasil</option>
                  <option value="237">237 - Bradesco</option>
                  <option value="341">341 - Itaú</option>
                  <option value="033">033 - Santander</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Distribuidora / Cedente</label>
                <input
                  type="text"
                  value={importBeneficiaryName}
                  onChange={(e) => setImportBeneficiaryName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">CNPJ Distribuidora</label>
                <input
                  type="text"
                  value={importBeneficiaryCnpj}
                  onChange={(e) => setImportBeneficiaryCnpj(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white outline-none font-mono"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Vencimento</label>
                  <input
                    type="date"
                    value={importDueDate}
                    onChange={(e) => setImportDueDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Valor (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={importNominalAmount}
                    onChange={(e) => setImportNominalAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white outline-none font-mono font-bold"
                    required
                  />
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="flex-1 bg-slate-800 text-slate-300 py-2.5 rounded-xl font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl shadow"
                >
                  Importar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Quitação */}
      {settleInvoiceTarget && (
        <div
          data-testid="modal-settle-dda"
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-white">Confirmar Liquidação de Boleto</h3>
            <p className="text-xs text-slate-400 mt-1">
              {settleInvoiceTarget.beneficiary_name} • R${' '}
              {settleInvoiceTarget.final_amount.toFixed(2).replace('.', ',')}
            </p>

            <div className="my-4 text-left">
              <label className="block text-xs text-slate-400 mb-1">Data do Pagamento</label>
              <input
                type="date"
                value={settleDate}
                onChange={(e) => setSettleDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white outline-none"
              />
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                type="button"
                onClick={() => setSettleInvoiceTarget(null)}
                className="flex-1 bg-slate-800 text-slate-300 py-2.5 rounded-xl text-xs font-semibold"
              >
                Voltar
              </button>
              <button
                type="button"
                data-testid="btn-confirm-settle"
                onClick={handleSettleSubmit}
                disabled={loading}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs shadow"
              >
                Confirmar Baixa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DdaReconciliationPage;
