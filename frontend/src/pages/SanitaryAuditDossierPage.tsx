import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Printer,
  RefreshCw,
  Thermometer,
  Pill,
  BookOpen,
  Trash2,
  Syringe,
  Activity,
  UserCheck,
  ChevronRight,
  X,
  FileCheck,
  Clock,
  AlertCircle
} from 'lucide-react';
import { sanitaryAuditApi } from '../services/api';
import {
  SanitaryAudit,
  SanitaryInspectionDossier,
  SanitaryDashboardKpis,
  SanitaryItemCategory,
  SanitaryItemStatus
} from '../types/sanitary-audit';

export const SanitaryAuditDossierPage: React.FC = () => {
  const [dashboard, setDashboard] = useState<SanitaryDashboardKpis | null>(null);
  const [latestAudit, setLatestAudit] = useState<SanitaryAudit | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'COMPLIANT' | 'NON_COMPLIANT' | 'WARNING_EXPIRING'>('ALL');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal Novo Scan
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [pharmacistName, setPharmacistName] = useState('Dra. Vanessa Farmacêutica RT');
  const [pharmacistCrf, setPharmacistCrf] = useState('CRF-SP 45.678');

  // Modal Dossiê Oficial
  const [dossierData, setDossierData] = useState<SanitaryInspectionDossier | null>(null);
  const [isDossierModalOpen, setIsDossierModalOpen] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [dashRes, histRes] = await Promise.all([
        sanitaryAuditApi.getDashboard('1'),
        sanitaryAuditApi.getHistory('1')
      ]);

      if (dashRes.success) setDashboard(dashRes.data);
      if (histRes.success && histRes.data.length > 0) {
        // Carrega auditoria detalhada com itens
        const auditDetail = await sanitaryAuditApi.getAuditById(histRes.data[0].id);
        if (auditDetail.success) setLatestAudit(auditDetail.data);
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.message || 'Erro ao carregar auditoria sanitária' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Executar nova autoinspeção
  const handleExecuteScan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setFeedbackMsg(null);
      const res = await sanitaryAuditApi.runScan({
        store_id: '1',
        responsible_pharmacist_crf: pharmacistCrf,
        responsible_pharmacist_name: pharmacistName
      });

      if (res.success && res.data) {
        setLatestAudit(res.data);
        setIsScanModalOpen(false);
        setFeedbackMsg({
          type: 'success',
          text: `Autoinspeção sanitária concluída com Score ${res.data.overall_score}% (${res.data.compliance_status})`
        });
        loadData();
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.message || 'Falha ao executar auditoria sanitária' });
    } finally {
      setLoading(false);
    }
  };

  // Abrir Dossiê Oficial
  const handleOpenDossier = async () => {
    if (!latestAudit) return;
    try {
      setLoading(true);
      const res = await sanitaryAuditApi.getDossier(latestAudit.id);
      if (res.success && res.data) {
        setDossierData(res.data);
        setIsDossierModalOpen(true);
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.message || 'Erro ao gerar dossiê oficial' });
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = (latestAudit?.items || []).filter((item) => {
    if (selectedFilter === 'ALL') return true;
    return item.status === selectedFilter;
  });

  return (
    <div className="flex-1 bg-slate-950 text-slate-100 p-6 overflow-y-auto font-sans">
      {/* Topo / Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-800 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-8 h-8 text-emerald-400" />
            Auditoria Sanitária & Dossiê de Autoinspeção
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Varredura contínua de conformidade ANVISA / Vigilância Sanitária (RDC 44, RDC 430, RDC 222, Portaria 344).
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            data-testid="btn-open-dossier"
            onClick={handleOpenDossier}
            disabled={!latestAudit || loading}
            className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 px-4 py-2.5 rounded-xl border border-slate-700 font-semibold text-sm transition"
          >
            <Printer className="w-4 h-4 text-emerald-400" />
            <span>Dossiê Oficial em 1 Clique</span>
          </button>

          <button
            type="button"
            data-testid="btn-run-scan-modal"
            onClick={() => setIsScanModalOpen(true)}
            disabled={loading}
            className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-emerald-950/40 transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Executar Autoinspeção RT</span>
          </button>
        </div>
      </div>

      {/* Alerta de Feedback */}
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

      {/* Painel Central: Score de Saúde Sanitária */}
      {dashboard && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 my-6 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center space-x-6">
            <div className="relative flex items-center justify-center">
              <div
                data-testid="display-overall-score"
                className={`text-5xl font-extrabold font-mono ${
                  dashboard.last_audit_score >= 90
                    ? 'text-emerald-400'
                    : dashboard.last_audit_score >= 70
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                {dashboard.last_audit_score}%
              </div>
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs uppercase font-bold text-slate-400">Score de Saúde Sanitária</span>
                <span
                  data-testid="badge-compliance-status"
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                    dashboard.last_audit_status === 'EXCELLENT'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : dashboard.last_audit_status === 'WARNING'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                  }`}
                >
                  {dashboard.last_audit_status === 'EXCELLENT'
                    ? 'Excelente • Pronto p/ Inspeção'
                    : dashboard.last_audit_status === 'WARNING'
                    ? 'Conforme c/ Alertas'
                    : 'Risco Crítico de Notificação'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Última auditoria:{' '}
                <span className="text-white font-medium">{dashboard.last_audit_date || 'Nenhuma registrada'}</span> •{' '}
                {dashboard.pending_corrective_actions} ação(ões) corretiva(s) pendente(s)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full md:w-auto text-xs">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-500">Cadeia Frio</span>
              <div className="text-sm font-bold text-white">{dashboard.category_health.cold_chain}/20 pts</div>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-500">SNGPC / 344</span>
              <div className="text-sm font-bold text-white">{dashboard.category_health.sngpc}/25 pts</div>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-500">POPs & Pragas</span>
              <div className="text-sm font-bold text-white">{dashboard.category_health.pops_certificates}/15 pts</div>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-500">PGRSS Resíduos</span>
              <div className="text-sm font-bold text-white">{dashboard.category_health.pgrss}/15 pts</div>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-500">Injetáveis</span>
              <div className="text-sm font-bold text-white">{dashboard.category_health.injectables}/15 pts</div>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-500">Farmacovigilância</span>
              <div className="text-sm font-bold text-white">{dashboard.category_health.pharmacovigilance}/10 pts</div>
            </div>
          </div>
        </div>
      )}

      {/* Checklist Detalhado por Requisito Sanitário */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-emerald-400" />
            Checklist de Inspeção e Plano de Ação (CAPA)
          </h2>

          <div className="flex items-center space-x-2">
            {(['ALL', 'COMPLIANT', 'NON_COMPLIANT', 'WARNING_EXPIRING'] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                data-testid={`filter-audit-${filter.toLowerCase()}`}
                onClick={() => setSelectedFilter(filter)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  selectedFilter === filter
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {filter === 'ALL'
                  ? 'Todos'
                  : filter === 'COMPLIANT'
                  ? 'Conformes'
                  : filter === 'NON_COMPLIANT'
                  ? 'Não Conformes'
                  : 'Avisos'}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-slate-800">
          {filteredItems.length > 0 ? (
            filteredItems.map((item) => (
              <div key={item.id} data-testid={`audit-item-${item.id}`} className="p-4 hover:bg-slate-800/30 transition text-xs">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-white text-sm">{item.item_description}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                        {item.category}
                      </span>
                    </div>
                    <p className="text-slate-300">{item.evidence_text}</p>
                    {item.corrective_action && (
                      <div className="bg-rose-950/40 border border-rose-500/30 rounded-xl p-3 text-rose-300 mt-2">
                        <span className="font-bold text-[11px] uppercase tracking-wider block mb-0.5">
                          Ação Corretiva Recomendada (CAPA):
                        </span>
                        {item.corrective_action}
                      </div>
                    )}
                  </div>

                  <div>
                    {item.status === 'COMPLIANT' && (
                      <span className="flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Conforme</span>
                      </span>
                    )}
                    {item.status === 'NON_COMPLIANT' && (
                      <span className="flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Não Conforme</span>
                      </span>
                    )}
                    {item.status === 'WARNING_EXPIRING' && (
                      <span className="flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Aviso / Vencendo</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-slate-500 text-xs">
              Nenhum item localizado para este filtro. Execute uma autoinspeção.
            </div>
          )}
        </div>
      </div>

      {/* Modal Executar Autoinspeção */}
      {isScanModalOpen && (
        <div
          data-testid="modal-run-scan"
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-emerald-400" />
                Nova Autoinspeção Sanitária RT
              </h3>
              <button onClick={() => setIsScanModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteScan} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Farmacêutico Responsável Técnico</label>
                <input
                  type="text"
                  value={pharmacistName}
                  onChange={(e) => setPharmacistName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Registro Profissional (CRF / UF)</label>
                <input
                  type="text"
                  value={pharmacistCrf}
                  onChange={(e) => setPharmacistCrf(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white outline-none font-mono"
                  required
                />
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] text-slate-400">
                O sistema fará a varredura automática em temperatura, cadeia de frio, livros SNGPC, BMPO, POPs,
                dedetização, MTR e NOTIVISA.
              </div>

              <div className="flex space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsScanModalOpen(false)}
                  className="flex-1 bg-slate-800 text-slate-300 py-2.5 rounded-xl font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl shadow"
                >
                  Iniciar Varredura
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Visualizar Dossiê Oficial Consolidado */}
      {isDossierModalOpen && dossierData && (
        <div
          data-testid="modal-official-dossier"
          className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 md:p-8 max-w-3xl w-full flex flex-col max-h-[90vh] shadow-2xl">
            <div className="flex justify-between items-center pb-4 border-b border-slate-800">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Printer className="w-6 h-6 text-emerald-400" />
                Dossiê Oficial de Autoinspeção Sanitária
              </h3>
              <button onClick={() => setIsDossierModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto my-4 bg-slate-950 p-4 rounded-2xl border border-slate-800 font-mono text-xs text-slate-300 whitespace-pre-wrap select-all">
              {dossierData.officialReportText}
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setIsDossierModalOpen(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-5 py-2.5 rounded-xl text-xs font-semibold"
              >
                Fechar
              </button>
              <button
                type="button"
                data-testid="btn-print-report"
                onClick={() => window.print()}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-2.5 rounded-xl text-xs shadow-lg shadow-emerald-950/40"
              >
                Imprimir Documento Oficial
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SanitaryAuditDossierPage;
