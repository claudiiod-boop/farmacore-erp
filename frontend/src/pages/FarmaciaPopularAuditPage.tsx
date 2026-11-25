import React, { useState, useEffect, useCallback } from 'react';
import { fpAuditApi } from '../services/api';
import type {
  FpAuditItem,
  FpDigitalReceiptDossier,
  FpAuditKpis,
  FpAuditItemStatus,
  FpDossierStatus,
} from '../types/fp-audit';

export const FarmaciaPopularAuditPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'ITEMS' | 'DOSSIERS'>('ITEMS');
  const [items, setItems] = useState<FpAuditItem[]>([]);
  const [dossiers, setDossiers] = useState<FpDigitalReceiptDossier[]>([]);
  const [kpis, setKpis] = useState<FpAuditKpis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal Importar Lote FNS
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [batchRef, setBatchRef] = useState('FNS-2026-10-LOTE01');
  const [competence, setCompetence] = useState('2026-10');
  const [creditDate, setCreditDate] = useState('2026-11-15');
  const [sampleAuthCode, setSampleAuthCode] = useState('AUTH-FP-2026-001');
  const [sampleAuthAmount, setSampleAuthAmount] = useState('120.00');
  const [sampleCreditedAmount, setSampleCreditedAmount] = useState('90.00');
  const [sampleGlossReason, setSampleGlossReason] = useState('Divergência de posologia diária');
  const [importing, setImporting] = useState(false);

  // Modal Contestação de Glosa
  const [isContestModalOpen, setIsContestModalOpen] = useState(false);
  const [targetContestItem, setTargetContestItem] = useState<FpAuditItem | null>(null);
  const [contestJustification, setContestJustification] = useState('');
  const [contesting, setContesting] = useState(false);

  // Modal Arquivar Dossiê 5 Anos
  const [isDossierModalOpen, setIsDossierModalOpen] = useState(false);
  const [dossierAuthCode, setDossierAuthCode] = useState('AUTH-FP-2026-001');
  const [dossierCpf, setDossierCpf] = useState('123.456.789-00');
  const [dossierName, setDossierName] = useState('Carlos Eduardo Silva');
  const [dossierDate, setDossierDate] = useState('2026-11-25');
  const [dossierCouponPath, setDossierCouponPath] = useState('/docs/cupons/cupom_assinado_001.pdf');
  const [dossierPrescriptionPath, setDossierPrescriptionPath] = useState('/docs/receitas/receita_retida_001.pdf');
  const [savingDossier, setSavingDossier] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [kpisRes, itemsRes, dossiersRes] = await Promise.all([
        fpAuditApi.getKpis(1),
        fpAuditApi.listAuditItems({ store_id: 1 }),
        fpAuditApi.listDossiers({ store_id: 1 })
      ]);

      if (kpisRes.success && kpisRes.data) setKpis(kpisRes.data);
      if (itemsRes.success && itemsRes.data) setItems(itemsRes.data);
      if (dossiersRes.success && dossiersRes.data) setDossiers(dossiersRes.data);
    } catch (err: any) {
      setError(err.message || 'Falha ao carregar dados de auditoria do Farmácia Popular');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Importar Lote FNS
  const handleImportBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setImporting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const authVal = Number(sampleAuthAmount);
      const credVal = Number(sampleCreditedAmount);
      const res = await fpAuditApi.importSettlementBatch({
        store_id: 1,
        batch_reference: batchRef,
        competence_month: competence,
        credit_date: creditDate,
        items: [
          {
            authorization_code: sampleAuthCode,
            patient_cpf: '123.456.789-00',
            patient_name: 'Beneficiário FNS',
            prescriber_crm: '12345',
            prescriber_uf: 'SP',
            authorized_ms_amount: authVal,
            credited_fns_amount: credVal,
            gloss_reason: authVal > credVal ? sampleGlossReason : undefined
          }
        ]
      });

      if (res.success && res.data) {
        setSuccessMsg(`Lote ${res.data.batch_reference} importado! Glosa identificada: R$ ${res.data.total_loss_amount.toFixed(2)}`);
        setIsImportModalOpen(false);
        await loadData();
      } else {
        setError(res.error || 'Erro ao importar lote FNS');
      }
    } catch (err: any) {
      setError(err.message || 'Falha na importação do lote');
    } finally {
      setImporting(false);
    }
  };

  // Abrir Modal de Contestação
  const handleOpenContestModal = (item: FpAuditItem) => {
    setTargetContestItem(item);
    setContestJustification(`Contraprova documental da autorização ${item.authorization_code} com receita e cupom vinculado assinados em anexo.`);
    setIsContestModalOpen(true);
  };

  // Submeter Contestação
  const handleConfirmContest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetContestItem) return;

    setContesting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fpAuditApi.contestGloss(targetContestItem.id, {
        justification: contestJustification
      });

      if (res.success && res.data) {
        setSuccessMsg(`Contestação da autorização ${targetContestItem.authorization_code} registrada com protocolo ${res.data.contest_protocol}!`);
        setIsContestModalOpen(false);
        setTargetContestItem(null);
        await loadData();
      } else {
        setError(res.error || 'Erro ao contestar glosa');
      }
    } catch (err: any) {
      setError(err.message || 'Falha ao registrar contestação');
    } finally {
      setContesting(false);
    }
  };

  // Salvar Dossiê de 5 Anos
  const handleSaveDossier = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingDossier(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fpAuditApi.registerDossier({
        store_id: 1,
        authorization_code: dossierAuthCode,
        patient_cpf: dossierCpf,
        patient_name: dossierName,
        dispensation_date: dossierDate,
        signed_coupon_file_path: dossierCouponPath || undefined,
        prescription_file_path: dossierPrescriptionPath || undefined
      });

      if (res.success && res.data) {
        setSuccessMsg(`Dossiê arquivado com validade de guarda legal até ${res.data.retention_deadline} (5 Anos)!`);
        setIsDossierModalOpen(false);
        await loadData();
      } else {
        setError(res.error || 'Erro ao registrar dossiê comprobatório');
      }
    } catch (err: any) {
      setError(err.message || 'Falha ao salvar dossiê');
    } finally {
      setSavingDossier(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Auditoria Farmácia Popular & Prevenção de Glosas
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
              Portaria GM/MS nº 5/2017
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-950 text-sky-400 border border-sky-800">
              Guarda 5 Anos (DENASUS)
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Conciliação de repasses do FNS/DataSUS, contestação de glosas administrativas e guarda digital de cupons e receitas médicas.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            data-testid="refresh-fp-audit-btn"
            onClick={loadData}
            disabled={loading}
            className="px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300 text-sm font-medium transition cursor-pointer"
          >
            {loading ? 'Atualizando...' : 'Atualizar Dados'}
          </button>
          <button
            type="button"
            data-testid="open-import-batch-modal"
            onClick={() => setIsImportModalOpen(true)}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-sm transition cursor-pointer"
          >
            + Importar Lote FNS
          </button>
          <button
            type="button"
            data-testid="open-register-dossier-modal"
            onClick={() => setIsDossierModalOpen(true)}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-sm transition cursor-pointer"
          >
            + Novo Dossiê 5 Anos
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div data-testid="fp-audit-error-alert" className="p-4 rounded-lg bg-red-950/80 border border-red-800 text-red-300 text-sm">
          {error}
        </div>
      )}
      {successMsg && (
        <div data-testid="fp-audit-success-alert" className="p-4 rounded-lg bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-sm">
          {successMsg}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div data-testid="kpi-total-credited" className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
          <span className="text-xs font-medium text-slate-400">Total Creditado FNS</span>
          <div className="text-2xl font-bold text-emerald-400 mt-1">
            {(kpis?.total_credited_amount ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
          <span className="text-xs text-slate-400 mt-1 block">Repasses bancários confirmados</span>
        </div>

        <div data-testid="kpi-total-gloss" className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
          <span className="text-xs font-medium text-slate-400">Total Glosado FNS</span>
          <div className="text-2xl font-bold text-red-400 mt-1">
            {(kpis?.total_gloss_amount ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
          <span className="text-xs text-slate-400 mt-1 block">Retenções administrativas</span>
        </div>

        <div data-testid="kpi-gloss-rate" className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
          <span className="text-xs font-medium text-slate-400">Taxa de Glosa</span>
          <div className="text-2xl font-bold text-amber-400 mt-1">
            {kpis?.gloss_rate_percentage ?? 0} %
          </div>
          <span className="text-xs text-slate-400 mt-1 block">Meta regulatória: &lt; 2.0%</span>
        </div>

        <div data-testid="kpi-dossiers-archived" className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
          <span className="text-xs font-medium text-slate-400">Dossiês Guardados (5 Anos)</span>
          <div className="text-2xl font-bold text-sky-400 mt-1">
            {kpis?.archived_dossiers_count ?? 0} <span className="text-xs font-normal text-slate-400">/ {(kpis?.pending_dossiers_count ?? 0) + (kpis?.archived_dossiers_count ?? 0)} total</span>
          </div>
          <span className="text-xs text-emerald-400 mt-1 block">Conformidade DENASUS</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 space-x-4">
        <button
          type="button"
          data-testid="tab-audit-items"
          onClick={() => setActiveTab('ITEMS')}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition ${
            activeTab === 'ITEMS'
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          Itens Auditados & Glosas FNS ({items.length})
        </button>
        <button
          type="button"
          data-testid="tab-dossiers"
          onClick={() => setActiveTab('DOSSIERS')}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition ${
            activeTab === 'DOSSIERS'
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          Repositório de Dossiês (Guarda 5 Anos) ({dossiers.length})
        </button>
      </div>

      {/* Tab 1 Content: Itens e Glosas */}
      {activeTab === 'ITEMS' && (
        <div className="rounded-xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Autorização MS</th>
                  <th className="px-4 py-3">Paciente / CPF</th>
                  <th className="px-4 py-3">Prescritor</th>
                  <th className="px-4 py-3">Autorizado</th>
                  <th className="px-4 py-3">Creditado FNS</th>
                  <th className="px-4 py-3">Glosa</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-slate-500 text-xs">
                      Nenhum item de repasse importado. Importe um lote de repasse FNS para iniciar a auditoria.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition">
                      <td className="px-4 py-3 font-mono font-medium text-slate-200">
                        {item.authorization_code}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">{item.patient_name}</div>
                        <div className="text-xs font-mono text-slate-400">{item.patient_cpf}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-400">
                        CRM {item.prescriber_crm}-{item.prescriber_uf}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-300">
                        {item.authorized_ms_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="px-4 py-3 font-medium text-emerald-400">
                        {item.credited_fns_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="px-4 py-3 font-bold text-red-400">
                        {item.gloss_amount > 0 ? (
                          <span>
                            {item.gloss_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            {item.gloss_reason && (
                              <span className="block text-[11px] font-normal text-red-300 mt-0.5">
                                {item.gloss_reason}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-xs font-normal">R$ 0,00</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            item.status === 'APPROVED'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : item.status === 'CONTESTED'
                              ? 'bg-sky-950 text-sky-300 border border-sky-800'
                              : 'bg-red-950 text-red-300 border border-red-800'
                          }`}
                        >
                          {item.status}
                        </span>
                        {item.contest_protocol && (
                          <span className="block text-[10px] font-mono text-sky-400 mt-1">
                            {item.contest_protocol}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {item.gloss_amount > 0 && item.status !== 'CONTESTED' && (
                          <button
                            type="button"
                            data-testid={`contest-gloss-btn-${item.id}`}
                            onClick={() => handleOpenContestModal(item)}
                            className="px-3 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition cursor-pointer"
                          >
                            Contestar Glosa
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2 Content: Dossiês 5 Anos */}
      {activeTab === 'DOSSIERS' && (
        <div className="rounded-xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Autorização</th>
                  <th className="px-4 py-3">Paciente / CPF</th>
                  <th className="px-4 py-3">Data Dispensação</th>
                  <th className="px-4 py-3">Retenção Obrigatória (5 Anos)</th>
                  <th className="px-4 py-3">Hash SHA-256 Integridade</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {dossiers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-500 text-xs">
                      Nenhum dossiê digital arquivado. Cadastre novos comprovantes para manter a guarda regulatória de 5 anos.
                    </td>
                  </tr>
                ) : (
                  dossiers.map((dossier) => (
                    <tr key={dossier.id} className="hover:bg-slate-800/40 transition">
                      <td className="px-4 py-3 font-mono font-medium text-slate-200">
                        {dossier.authorization_code}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">{dossier.patient_name}</div>
                        <div className="text-xs font-mono text-slate-400">{dossier.patient_cpf}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {dossier.dispensation_date}
                      </td>
                      <td className="px-4 py-3 font-semibold text-amber-400">
                        {dossier.retention_deadline}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-400 max-w-xs truncate" title={dossier.sha256_integrity_hash}>
                        {dossier.sha256_integrity_hash}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            dossier.status === 'ARCHIVED'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : 'bg-amber-950 text-amber-300 border border-amber-800'
                          }`}
                        >
                          {dossier.status === 'ARCHIVED' ? 'ARQUIVADO (5 ANOS)' : 'PENDENTE DE RECEITA'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Importar Lote FNS */}
      {isImportModalOpen && (
        <div data-testid="import-batch-modal" className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white">Importar Lote de Repasse FNS / DataSUS</h3>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleImportBatch} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Referência do Lote FNS</label>
                <input
                  type="text"
                  data-testid="batch-reference-input"
                  value={batchRef}
                  onChange={(e) => setBatchRef(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Competência (AAAA-MM)</label>
                  <input
                    type="text"
                    data-testid="batch-competence-input"
                    value={competence}
                    onChange={(e) => setCompetence(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Data Crédito Bancário</label>
                  <input
                    type="date"
                    data-testid="batch-credit-date-input"
                    value={creditDate}
                    onChange={(e) => setCreditDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                    required
                  />
                </div>
              </div>

              <div className="border-t border-slate-800 pt-3 space-y-2">
                <span className="text-xs font-semibold text-slate-300 block">Autorização Demonstrativa do Lote</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-400">Código Autorização</label>
                    <input
                      type="text"
                      data-testid="sample-auth-code-input"
                      value={sampleAuthCode}
                      onChange={(e) => setSampleAuthCode(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400">Valor Autorizado (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      data-testid="sample-auth-amount-input"
                      value={sampleAuthAmount}
                      onChange={(e) => setSampleAuthAmount(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-400">Valor Creditado FNS (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      data-testid="sample-credited-amount-input"
                      value={sampleCreditedAmount}
                      onChange={(e) => setSampleCreditedAmount(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400">Motivo Glosa (se houver)</label>
                    <input
                      type="text"
                      data-testid="sample-gloss-reason-input"
                      value={sampleGlossReason}
                      onChange={(e) => setSampleGlossReason(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  data-testid="confirm-import-batch-btn"
                  disabled={importing}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition cursor-pointer"
                >
                  {importing ? 'Importando...' : 'Confirmar Importação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Contestação de Glosa */}
      {isContestModalOpen && targetContestItem && (
        <div data-testid="contest-gloss-modal" className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white">Contestar Glosa Administrativa</h3>
              <button
                type="button"
                onClick={() => setIsContestModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1 text-xs">
              <div><span className="text-slate-400">Autorização:</span> <span className="font-mono text-slate-200">{targetContestItem.authorization_code}</span></div>
              <div><span className="text-slate-400">Paciente:</span> <span className="text-slate-200">{targetContestItem.patient_name}</span></div>
              <div><span className="text-slate-400">Valor Glosado:</span> <span className="font-bold text-red-400">R$ {targetContestItem.gloss_amount.toFixed(2)}</span></div>
              <div><span className="text-slate-400">Motivo Inicial:</span> <span className="text-slate-300">{targetContestItem.gloss_reason}</span></div>
            </div>

            <form onSubmit={handleConfirmContest} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Justificativa Técnica / Contraprova</label>
                <textarea
                  data-testid="contest-justification-input"
                  value={contestJustification}
                  onChange={(e) => setContestJustification(e.target.value)}
                  rows={4}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-slate-200"
                  required
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsContestModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  data-testid="confirm-contest-btn"
                  disabled={contesting}
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition cursor-pointer"
                >
                  {contesting ? 'Enviando...' : 'Protocolar Contestação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cadastro de Dossiê 5 Anos */}
      {isDossierModalOpen && (
        <div data-testid="register-dossier-modal" className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white">Arquivar Dossiê de 5 Anos (Portaria 5/2017)</h3>
              <button
                type="button"
                onClick={() => setIsDossierModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveDossier} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Autorização DataSUS</label>
                  <input
                    type="text"
                    data-testid="dossier-auth-input"
                    value={dossierAuthCode}
                    onChange={(e) => setDossierAuthCode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Data Dispensação</label>
                  <input
                    type="date"
                    data-testid="dossier-date-input"
                    value={dossierDate}
                    onChange={(e) => setDossierDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">CPF Beneficiário</label>
                  <input
                    type="text"
                    data-testid="dossier-cpf-input"
                    value={dossierCpf}
                    onChange={(e) => setDossierCpf(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Nome Beneficiário</label>
                  <input
                    type="text"
                    data-testid="dossier-name-input"
                    value={dossierName}
                    onChange={(e) => setDossierName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Caminho / PDF Cupom Vinculado Assinado</label>
                <input
                  type="text"
                  data-testid="dossier-coupon-input"
                  value={dossierCouponPath}
                  onChange={(e) => setDossierCouponPath(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Caminho / PDF Receita Médica Retida</label>
                <input
                  type="text"
                  data-testid="dossier-prescription-input"
                  value={dossierPrescriptionPath}
                  onChange={(e) => setDossierPrescriptionPath(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsDossierModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  data-testid="confirm-save-dossier-btn"
                  disabled={savingDossier}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition cursor-pointer"
                >
                  {savingDossier ? 'Arquivando...' : 'Salvar Dossiê (5 Anos)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FarmaciaPopularAuditPage;
