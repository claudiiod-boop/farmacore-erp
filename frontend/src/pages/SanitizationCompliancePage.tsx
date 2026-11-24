import React, { useState, useEffect } from 'react';
import {
  SanitizationLog,
  PestControlCertificate,
  WaterTankCleaningLog,
  StandardOperatingProcedure,
  SanitaryComplianceOverview,
  CleaningType,
  SopCategory,
} from '../types/sanitization';
import { sanitizationApi } from '../services/api';

export const SanitizationCompliancePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'LOGS' | 'PEST_CONTROL' | 'WATER_TANK' | 'SOPS'>('LOGS');
  const [overview, setOverview] = useState<SanitaryComplianceOverview | null>(null);
  const [logs, setLogs] = useState<SanitizationLog[]>([]);
  const [pestCerts, setPestCerts] = useState<PestControlCertificate[]>([]);
  const [waterCleanings, setWaterCleanings] = useState<WaterTankCleaningLog[]>([]);
  const [sops, setSops] = useState<StandardOperatingProcedure[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals & Form states
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [newLog, setNewLog] = useState({
    sectorName: 'SALA_INJETAIS',
    cleaningType: 'ROUTINE' as CleaningType,
    chemicalProduct: 'Álcool Etílico 70%',
    dilutionOrBatch: 'Lote 2026-A',
    performedBy: '',
    notes: '',
  });

  const [verifyModalId, setVerifyModalId] = useState<number | null>(null);
  const [pharmacistCrf, setPharmacistCrf] = useState('');

  const [isPestModalOpen, setIsPestModalOpen] = useState(false);
  const [newPest, setNewPest] = useState({
    serviceProviderName: '',
    serviceProviderCnpj: '',
    sanitaryLicenseNumber: '',
    certificateNumber: '',
    applicationDate: new Date().toISOString().split('T')[0],
    targetPests: 'Baratas, Roedores e Formigas',
    chemicalAgentsUsed: 'Deltametrina 2.5%, Bromadiolona',
    technicalResponsiblePest: '',
    pharmacistApprovalCrf: '',
  });

  const [isSopModalOpen, setIsSopModalOpen] = useState(false);
  const [newSop, setNewSop] = useState({
    sopCode: '',
    title: '',
    category: 'HIGIENE_AMBIENTAL' as SopCategory,
    version: '1.0',
    effectiveDate: new Date().toISOString().split('T')[0],
    authorName: '',
    reviewerPharmacistCrf: '',
    contentSummary: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [ov, lg, pc, wt, sp] = await Promise.all([
        sanitizationApi.getComplianceOverview(),
        sanitizationApi.getLogs(),
        sanitizationApi.getPestControlList(),
        sanitizationApi.getWaterTankList(),
        sanitizationApi.getSops(),
      ]);
      setOverview(ov);
      setLogs(lg || []);
      setPestCerts(pc || []);
      setWaterCleanings(wt || []);
      setSops(sp || []);
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Erro ao carregar dados sanitários' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLog.performedBy.trim()) {
      setFeedbackMsg({ type: 'error', text: 'Informe quem realizou a higienização.' });
      return;
    }
    try {
      await sanitizationApi.createLog({
        ...newLog,
        scheduledDate: new Date().toISOString().split('T')[0],
      });
      setFeedbackMsg({ type: 'success', text: 'Registro de higienização salvo com sucesso!' });
      setIsLogModalOpen(false);
      setNewLog({
        sectorName: 'SALA_INJETAIS',
        cleaningType: 'ROUTINE',
        chemicalProduct: 'Álcool Etílico 70%',
        dilutionOrBatch: 'Lote 2026-A',
        performedBy: '',
        notes: '',
      });
      loadData();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Erro ao registrar higienização.' });
    }
  };

  const handleVerifyLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyModalId || !pharmacistCrf.trim()) return;
    try {
      await sanitizationApi.verifyLog(verifyModalId, pharmacistCrf.trim());
      setFeedbackMsg({ type: 'success', text: 'Higienização homologada pelo Farmacêutico RT!' });
      setVerifyModalId(null);
      setPharmacistCrf('');
      loadData();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Erro ao homologar higienização.' });
    }
  };

  const handleCreatePest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await sanitizationApi.createPestControl(newPest);
      setFeedbackMsg({ type: 'success', text: 'Certificado de dedetização cadastrado com sucesso!' });
      setIsPestModalOpen(false);
      loadData();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Erro ao cadastrar dedetização.' });
    }
  };

  const handleCreateSop = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await sanitizationApi.createOrUpdateSop(newSop);
      setFeedbackMsg({ type: 'success', text: 'POP cadastrado/atualizado com sucesso!' });
      setIsSopModalOpen(false);
      loadData();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Erro ao salvar POP.' });
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* CABEÇALHO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span>🛡️</span> Sanitização, Dedetização & POPs Regulatórios (RDC 44/2009 ANVISA)
          </h1>
          <p className="text-sm text-gray-500">
            Governança de boas práticas farmacêuticas, assepsia setorial, controle de pragas e procedimentos padronizados.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsLogModalOpen(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium shadow-sm flex items-center gap-1 text-sm"
          >
            <span>✨</span> Registrar Higienização
          </button>
          <button
            onClick={() => setIsPestModalOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium shadow-sm flex items-center gap-1 text-sm"
          >
            <span>📜</span> Novo Laudo Dedetização
          </button>
          <button
            onClick={() => setIsSopModalOpen(true)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded font-medium shadow-sm flex items-center gap-1 text-sm"
          >
            <span>📘</span> Cadastrar POP
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`p-3 rounded text-sm flex justify-between items-center ${
            feedbackMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <span>{feedbackMsg.text}</span>
          <button onClick={() => setFeedbackMsg(null)} className="text-xs font-bold underline">
            Fechar
          </button>
        </div>
      )}

      {/* CARDS DE CONFORMIDADE VISA */}
      {overview && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Score Geral ANVISA</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className={`text-3xl font-extrabold ${overview.score >= 80 ? 'text-emerald-600' : 'text-amber-600'}`}>
                {overview.score}%
              </span>
              <span className="text-xs font-medium text-gray-500">
                {overview.overallCompliant ? 'CONFORME' : 'ATENÇÃO'}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Conformidade com a RDC 44/2009</p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Dedetização & Pragas</span>
            <div className="mt-2">
              <span
                className={`px-2 py-0.5 rounded text-xs font-bold ${
                  overview.pestControl.status === 'VALID'
                    ? 'bg-emerald-100 text-emerald-800'
                    : overview.pestControl.status === 'EXPIRING_SOON'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {overview.pestControl.status}
              </span>
              <p className="text-sm font-semibold text-gray-700 mt-1">
                {overview.pestControl.daysRemaining > 0 ? `${overview.pestControl.daysRemaining} dias restantes` : 'Expirado ou ausente'}
              </p>
            </div>
            <p className="text-xs text-gray-400 mt-1">Periodicidade semestral obrigatória</p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Caixa d'Água & Potabilidade</span>
            <div className="mt-2">
              <span
                className={`px-2 py-0.5 rounded text-xs font-bold ${
                  overview.waterTank.status === 'VALID' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                }`}
              >
                {overview.waterTank.status}
              </span>
              <p className="text-sm font-semibold text-gray-700 mt-1">
                {overview.waterTank.daysRemaining > 0 ? `${overview.waterTank.daysRemaining} dias restantes` : 'Necessita limpeza'}
              </p>
            </div>
            <p className="text-xs text-gray-400 mt-1">Laudo microbiológico de potabilidade</p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">POPs & Manuais</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-extrabold text-purple-600">{overview.sops.totalActive}</span>
              <span className="text-xs font-medium text-gray-500">POPs Ativos</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {overview.sops.needsRevisionCount > 0
                ? `⚠️ ${overview.sops.needsRevisionCount} POP(s) aguardando revisão anual`
                : 'Todos os POPs revisados e vigentes'}
            </p>
          </div>
        </div>
      )}

      {/* NAVEGAÇÃO POR ABAS */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-6">
          <button
            onClick={() => setActiveTab('LOGS')}
            className={`pb-3 text-sm font-medium border-b-2 ${
              activeTab === 'LOGS' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            📋 Registros de Higienização ({logs.length})
          </button>
          <button
            onClick={() => setActiveTab('PEST_CONTROL')}
            className={`pb-3 text-sm font-medium border-b-2 ${
              activeTab === 'PEST_CONTROL' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            🐜 Dedetização & Pragas ({pestCerts.length})
          </button>
          <button
            onClick={() => setActiveTab('WATER_TANK')}
            className={`pb-3 text-sm font-medium border-b-2 ${
              activeTab === 'WATER_TANK' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            🚰 Caixa d'Água ({waterCleanings.length})
          </button>
          <button
            onClick={() => setActiveTab('SOPS')}
            className={`pb-3 text-sm font-medium border-b-2 ${
              activeTab === 'SOPS' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            📚 POPs & Normas ({sops.length})
          </button>
        </nav>
      </div>

      {/* CONTEÚDO DAS ABAS */}
      {activeTab === 'LOGS' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left">Data</th>
                <th className="px-4 py-3 text-left">Setor</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left">Saneante / Lote</th>
                <th className="px-4 py-3 text-left">Executor</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Homologação RT</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-gray-400">
                    Nenhum registro de higienização encontrado.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{log.scheduled_date}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{log.sector_name}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700 font-medium">
                        {log.cleaning_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {log.chemical_product} {log.dilution_or_batch && `(${log.dilution_or_batch})`}
                    </td>
                    <td className="px-4 py-3 text-gray-800">{log.performed_by}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800">
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {log.verified_by_pharmacist ? (
                        <span className="text-xs text-emerald-700 font-medium">
                          ✓ {log.verified_by_pharmacist}
                        </span>
                      ) : (
                        <span className="text-xs text-amber-600 font-medium">Pendente de visto</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!log.verified_by_pharmacist && (
                        <button
                          onClick={() => setVerifyModalId(log.id)}
                          className="px-2 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded border border-emerald-300"
                        >
                          Assinar RT
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'PEST_CONTROL' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left">Certificado</th>
                <th className="px-4 py-3 text-left">Empresa Terceirizada</th>
                <th className="px-4 py-3 text-left">Licença Sanitária</th>
                <th className="px-4 py-3 text-left">Aplicação</th>
                <th className="px-4 py-3 text-left">Validade (6m)</th>
                <th className="px-4 py-3 text-left">Pragas Alvo</th>
                <th className="px-4 py-3 text-left">RT Farmácia</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pestCerts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-gray-400">
                    Nenhum certificado de dedetização cadastrado.
                  </td>
                </tr>
              ) : (
                pestCerts.map((cert) => (
                  <tr key={cert.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-bold text-gray-900">{cert.certificate_number}</td>
                    <td className="px-4 py-3 text-gray-700">
                      <div>{cert.service_provider_name}</div>
                      <div className="text-xs text-gray-400">CNPJ: {cert.service_provider_cnpj}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{cert.sanitary_license_number}</td>
                    <td className="px-4 py-3 text-gray-600">{cert.application_date}</td>
                    <td className="px-4 py-3 font-semibold text-gray-800">{cert.expiration_date}</td>
                    <td className="px-4 py-3 text-gray-600">{cert.target_pests}</td>
                    <td className="px-4 py-3 text-gray-700">{cert.pharmacist_approval_crf}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-bold ${
                          cert.status === 'VALID'
                            ? 'bg-emerald-100 text-emerald-800'
                            : cert.status === 'EXPIRING_SOON'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {cert.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'WATER_TANK' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left">Prestador</th>
                <th className="px-4 py-3 text-left">Data Limpeza</th>
                <th className="px-4 py-3 text-left">Validade Semestral</th>
                <th className="px-4 py-3 text-left">Laudo Potabilidade</th>
                <th className="px-4 py-3 text-left">Qualidade da Água</th>
                <th className="px-4 py-3 text-left">RT Farmacêutico</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {waterCleanings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                    Nenhum registro de limpeza de caixa d'água cadastrado.
                  </td>
                </tr>
              ) : (
                waterCleanings.map((wt) => (
                  <tr key={wt.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-800">{wt.service_provider}</td>
                    <td className="px-4 py-3 text-gray-600">{wt.cleaning_date}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{wt.expiration_date}</td>
                    <td className="px-4 py-3 text-gray-600">{wt.potability_report_number || 'S/N'}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-800">
                        {wt.potability_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{wt.pharmacist_crf}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-bold ${
                          wt.status === 'VALID' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {wt.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'SOPS' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left">Código POP</th>
                <th className="px-4 py-3 text-left">Título & Escopo</th>
                <th className="px-4 py-3 text-left">Categoria</th>
                <th className="px-4 py-3 text-left">Versão</th>
                <th className="px-4 py-3 text-left">Vigência</th>
                <th className="px-4 py-3 text-left">Próxima Revisão</th>
                <th className="px-4 py-3 text-left">RT Revisor</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sops.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-gray-400">
                    Nenhum Procedimento Operacional Padrão (POP) cadastrado.
                  </td>
                </tr>
              ) : (
                sops.map((sop) => (
                  <tr key={sop.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono font-bold text-purple-700">{sop.sop_code}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">{sop.title}</div>
                      <div className="text-xs text-gray-500 line-clamp-1">{sop.content_summary}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-xs bg-purple-50 text-purple-800 font-medium">
                        {sop.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold text-gray-700">v{sop.version}</td>
                    <td className="px-4 py-3 text-gray-600">{sop.effective_date}</td>
                    <td className="px-4 py-3 font-semibold text-gray-800">{sop.next_review_date}</td>
                    <td className="px-4 py-3 text-gray-700">{sop.reviewer_pharmacist_crf}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-bold ${
                          sop.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {sop.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL REGISTRO DE HIGIENIZAÇÃO */}
      {isLogModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Registrar Higienização de Setor</h2>
            <form onSubmit={handleCreateLog} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700">Setor Físico</label>
                <select
                  value={newLog.sectorName}
                  onChange={(e) => setNewLog({ ...newLog, sectorName: e.target.value })}
                  className="w-full border rounded p-2 text-sm mt-1"
                >
                  <option value="SALA_INJETAIS">Sala de Injetáveis / Serviços Farmacêuticos</option>
                  <option value="ESTOQUE_CENTRAL">Estoque Central / Almoxarifado</option>
                  <option value="GELADEIRA_TERMOLABEIS">Geladeira de Termolábeis</option>
                  <option value="SALAO_VENDAS">Salão de Vendas & Balcão</option>
                  <option value="SANITARIOS">Sanitários</option>
                  <option value="QUARANTINE_AREA">Área de Quarentena Sanitária</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700">Tipo de Limpeza</label>
                <select
                  value={newLog.cleaningType}
                  onChange={(e) => setNewLog({ ...newLog, cleaningType: e.target.value as CleaningType })}
                  className="w-full border rounded p-2 text-sm mt-1"
                >
                  <option value="ROUTINE">Rotineira (Diária)</option>
                  <option value="TERMINAL">Terminal / Profunda (Semanal)</option>
                  <option value="IMMEDIATE">Imediata (Derramamento/Acidente)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700">Produto Saneante Utilizado</label>
                <input
                  type="text"
                  value={newLog.chemicalProduct}
                  onChange={(e) => setNewLog({ ...newLog, chemicalProduct: e.target.value })}
                  placeholder="Ex: Álcool 70%, Quaternário de Amônio"
                  className="w-full border rounded p-2 text-sm mt-1"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700">Responsável pela Limpeza</label>
                <input
                  type="text"
                  value={newLog.performedBy}
                  onChange={(e) => setNewLog({ ...newLog, performedBy: e.target.value })}
                  placeholder="Nome do colaborador"
                  className="w-full border rounded p-2 text-sm mt-1"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsLogModalOpen(false)}
                  className="px-4 py-2 border rounded text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-sm font-semibold"
                >
                  Salvar Registro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL VISTO DO FARMACÊUTICO */}
      {verifyModalId !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Assinatura do Farmacêutico RT</h2>
            <p className="text-xs text-gray-500">
              Insira o número do seu CRF para atestar e homologar a higienização deste setor conforme a RDC 44/2009.
            </p>
            <form onSubmit={handleVerifyLog} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700">CRF do Farmacêutico</label>
                <input
                  type="text"
                  value={pharmacistCrf}
                  onChange={(e) => setPharmacistCrf(e.target.value)}
                  placeholder="Ex: CRF-SP 12345"
                  className="w-full border rounded p-2 text-sm mt-1"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setVerifyModalId(null)}
                  className="px-3 py-1.5 border rounded text-xs text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold"
                >
                  Homologar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL LAUDO DEDETIZAÇÃO */}
      {isPestModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Cadastrar Laudo de Dedetização</h2>
            <form onSubmit={handleCreatePest} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700">Número do Certificado</label>
                  <input
                    type="text"
                    value={newPest.certificateNumber}
                    onChange={(e) => setNewPest({ ...newPest, certificateNumber: e.target.value })}
                    placeholder="CERT-2026-..."
                    className="w-full border rounded p-2 text-sm mt-1"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700">Data de Aplicação</label>
                  <input
                    type="date"
                    value={newPest.applicationDate}
                    onChange={(e) => setNewPest({ ...newPest, applicationDate: e.target.value })}
                    className="w-full border rounded p-2 text-sm mt-1"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700">Empresa Especializada</label>
                <input
                  type="text"
                  value={newPest.serviceProviderName}
                  onChange={(e) => setNewPest({ ...newPest, serviceProviderName: e.target.value })}
                  placeholder="Razão social da empresa de dedetização"
                  className="w-full border rounded p-2 text-sm mt-1"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700">CNPJ da Empresa</label>
                  <input
                    type="text"
                    value={newPest.serviceProviderCnpj}
                    onChange={(e) => setNewPest({ ...newPest, serviceProviderCnpj: e.target.value })}
                    placeholder="00.000.000/0001-00"
                    className="w-full border rounded p-2 text-sm mt-1"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700">Licença Sanitária (VISA/Ambiental)</label>
                  <input
                    type="text"
                    value={newPest.sanitaryLicenseNumber}
                    onChange={(e) => setNewPest({ ...newPest, sanitaryLicenseNumber: e.target.value })}
                    placeholder="CEVS / Alvará"
                    className="w-full border rounded p-2 text-sm mt-1"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700">Responsável Técnico Dedetizadora</label>
                  <input
                    type="text"
                    value={newPest.technicalResponsiblePest}
                    onChange={(e) => setNewPest({ ...newPest, technicalResponsiblePest: e.target.value })}
                    placeholder="Nome e registro (CRBio/CRQ)"
                    className="w-full border rounded p-2 text-sm mt-1"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700">Farmacêutico RT Aprovador (CRF)</label>
                  <input
                    type="text"
                    value={newPest.pharmacistApprovalCrf}
                    onChange={(e) => setNewPest({ ...newPest, pharmacistApprovalCrf: e.target.value })}
                    placeholder="Ex: CRF-SP 12345"
                    className="w-full border rounded p-2 text-sm mt-1"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsPestModalOpen(false)}
                  className="px-4 py-2 border rounded text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-semibold"
                >
                  Salvar Laudo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CADASTRAR POP */}
      {isSopModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Cadastrar Procedimento Operacional Padrão (POP)</h2>
            <form onSubmit={handleCreateSop} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700">Código do POP</label>
                  <input
                    type="text"
                    value={newSop.sopCode}
                    onChange={(e) => setNewSop({ ...newSop, sopCode: e.target.value })}
                    placeholder="Ex: POP-AMB-001"
                    className="w-full border rounded p-2 text-sm mt-1"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700">Categoria</label>
                  <select
                    value={newSop.category}
                    onChange={(e) => setNewSop({ ...newSop, category: e.target.value as SopCategory })}
                    className="w-full border rounded p-2 text-sm mt-1"
                  >
                    <option value="HIGIENE_AMBIENTAL">Higiene e Limpeza Ambiental</option>
                    <option value="SERVICOS_FARMACEUTICOS">Serviços Farmacêuticos / Injetáveis</option>
                    <option value="TERMOLABEIS">Cadeia de Frio & Termolábeis</option>
                    <option value="DESCARTE_RESIDUOS">PGRSS & Descarte de Resíduos</option>
                    <option value="DISPENSACAO">Dispensação e Medicamentos Controlados</option>
                    <option value="GERAL">Boas Práticas Gerais</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700">Título do POP</label>
                <input
                  type="text"
                  value={newSop.title}
                  onChange={(e) => setNewSop({ ...newSop, title: e.target.value })}
                  placeholder="Ex: Procedimento para Assepsia e Desinfecção da Sala de Aplicação"
                  className="w-full border rounded p-2 text-sm mt-1"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700">Elaborador</label>
                  <input
                    type="text"
                    value={newSop.authorName}
                    onChange={(e) => setNewSop({ ...newSop, authorName: e.target.value })}
                    placeholder="Nome do elaborador"
                    className="w-full border rounded p-2 text-sm mt-1"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700">Farmacêutico RT Aprovador (CRF)</label>
                  <input
                    type="text"
                    value={newSop.reviewerPharmacistCrf}
                    onChange={(e) => setNewSop({ ...newSop, reviewerPharmacistCrf: e.target.value })}
                    placeholder="Ex: CRF-SP 12345"
                    className="w-full border rounded p-2 text-sm mt-1"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700">Resumo / Instruções Principais</label>
                <textarea
                  value={newSop.contentSummary}
                  onChange={(e) => setNewSop({ ...newSop, contentSummary: e.target.value })}
                  rows={3}
                  placeholder="Descrição sucinta dos passos operacionais e saneantes homologados"
                  className="w-full border rounded p-2 text-sm mt-1"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsSopModalOpen(false)}
                  className="px-4 py-2 border rounded text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm font-semibold"
                >
                  Salvar POP
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
