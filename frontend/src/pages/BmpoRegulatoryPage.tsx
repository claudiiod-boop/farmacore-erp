import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Printer,
  Plus,
  Trash2,
  AlertCircle,
  Calendar,
  Building,
  UserCheck,
  FileCheck
} from 'lucide-react';
import { bmpoApi } from '../services/api';
import type {
  RegulatoryReport,
  RegulatoryReportDetails,
  RegulatoryKpis,
  RegulatoryReportType
} from '../types';

export const BmpoRegulatoryPage: React.FC = () => {
  const [storeId] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'BMPO' | 'RMNR' | 'ALL'>('BMPO');
  const [reports, setReports] = useState<RegulatoryReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<RegulatoryReportDetails | null>(null);
  const [kpis, setKpis] = useState<RegulatoryKpis>({
    total_reports: 0,
    filed_reports: 0,
    pending_filings: 0,
    rmnra_count: 0,
    rmnrb_count: 0,
  });

  // Formulário de Geração
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [formType, setFormType] = useState<RegulatoryReportType>('BMPO_TRIMESTRAL');
  const [formYear, setFormYear] = useState<number>(new Date().getFullYear());
  const [formQuarter, setFormQuarter] = useState<number>(4);
  const [formMonth, setFormMonth] = useState<number>(11);
  const [formPharmacistName, setFormPharmacistName] = useState('Dra. Camila Farmacêutica');
  const [formPharmacistCrf, setFormPharmacistCrf] = useState('CRF-SP 54321');
  const [formObservations, setFormObservations] = useState('');

  // Modal Protocolo VISA
  const [showFilingModal, setShowFilingModal] = useState(false);
  const [filingProtocol, setFilingProtocol] = useState('');
  const [filingDate, setFilingDate] = useState(new Date().toISOString().substring(0, 10));
  const [filingObservations, setFilingObservations] = useState('');

  // Modal de Impressão
  const [printDocument, setPrintDocument] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [list, kpiData] = await Promise.all([
        bmpoApi.listReports(storeId),
        bmpoApi.getKpis(storeId),
      ]);
      setReports(list);
      setKpis(kpiData);

      if (list.length > 0 && !selectedReport) {
        const details = await bmpoApi.getReportById(list[0].id);
        setSelectedReport(details);
      }
    } catch (err) {
      console.error('Erro ao carregar dados regulatórios:', err);
    }
  }, [storeId, selectedReport]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelectReport = async (id: number) => {
    try {
      const details = await bmpoApi.getReportById(id);
      setSelectedReport(details);
    } catch (err: any) {
      alert(`Erro ao carregar detalhes: ${err.message}`);
    }
  };

  const handleGenerateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let created: RegulatoryReportDetails;
      if (formType.startsWith('BMPO')) {
        created = await bmpoApi.generateBmpo({
          storeId,
          reportType: formType as 'BMPO_TRIMESTRAL' | 'BMPO_ANUAL',
          periodYear: formYear,
          periodQuarter: formType === 'BMPO_TRIMESTRAL' ? formQuarter : undefined,
          pharmacistName: formPharmacistName,
          pharmacistCrf: formPharmacistCrf,
          observations: formObservations || undefined,
        });
      } else {
        created = await bmpoApi.generateRmnr({
          storeId,
          reportType: formType as 'RMNRA' | 'RMNRB',
          periodYear: formYear,
          periodMonth: formMonth,
          pharmacistName: formPharmacistName,
          pharmacistCrf: formPharmacistCrf,
          observations: formObservations || undefined,
        });
      }

      setShowGenerateModal(false);
      await loadData();
      setSelectedReport(created);
    } catch (err: any) {
      alert(`Erro ao gerar relatório: ${err.message}`);
    }
  };

  const handleFileWithVisa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReport) return;
    try {
      const updated = await bmpoApi.fileWithVisa({
        reportId: selectedReport.id,
        visaProtocolNumber: filingProtocol,
        visaFilingDate: filingDate,
        observations: filingObservations || undefined,
      });
      setShowFilingModal(false);
      setFilingProtocol('');
      await loadData();
      setSelectedReport(updated);
    } catch (err: any) {
      alert(`Erro ao protocolar na VISA: ${err.message}`);
    }
  };

  const handleDeleteReport = async (id: number) => {
    if (!window.confirm('Deseja excluir este rascunho de relatório?')) return;
    try {
      await bmpoApi.deleteReport(id);
      setSelectedReport(null);
      await loadData();
    } catch (err: any) {
      alert(`Erro ao excluir: ${err.message}`);
    }
  };

  const handleOpenPrint = async (id: number) => {
    try {
      const { document } = await bmpoApi.getPrintDocument(id);
      setPrintDocument(document);
    } catch (err: any) {
      alert(`Erro ao obter documento: ${err.message}`);
    }
  };

  const filteredReports = reports.filter((r) => {
    if (activeTab === 'BMPO') return r.report_type.startsWith('BMPO');
    if (activeTab === 'RMNR') return r.report_type.startsWith('RMNR');
    return true;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-y-auto">
      {/* Header Regulatório */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-rose-600 flex items-center justify-center shadow-lg shadow-amber-900/30">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white flex items-center gap-2">
              Balanços Oficiais BMPO, RMNRA & RMNRB
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                Portaria 344/98 ANVISA
              </span>
            </h1>
            <p className="text-xs text-slate-400">Mapas Trimestrais e Anuais para Vigilância Sanitária (VISA)</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            data-testid="new-report-button"
            onClick={() => setShowGenerateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-amber-900/30 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Novo Balanço / Relação
          </button>
        </div>
      </div>

      {/* Grid de KPIs Regulatórios */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-6 pb-2">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium">Total de Balanços</span>
          <div className="text-2xl font-black text-white mt-1" data-testid="kpi-total-reports">
            {kpis.total_reports}
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Protocolados VISA
          </span>
          <div className="text-2xl font-black text-emerald-400 mt-1" data-testid="kpi-filed-reports">
            {kpis.filed_reports}
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-xs text-amber-400 font-medium flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            Pendentes Protocolo
          </span>
          <div className="text-2xl font-black text-amber-400 mt-1" data-testid="kpi-pending-filings">
            {kpis.pending_filings}
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-xs text-yellow-400 font-medium">RMNRA (Receita A)</span>
          <div className="text-2xl font-black text-yellow-400 mt-1" data-testid="kpi-rmnra-count">
            {kpis.rmnra_count}
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-xs text-sky-400 font-medium">RMNRB (Receita B)</span>
          <div className="text-2xl font-black text-sky-400 mt-1" data-testid="kpi-rmnrb-count">
            {kpis.rmnrb_count}
          </div>
        </div>
      </div>

      {/* Conteúdo Principal Dividido: Lista Lateral e Detalhes */}
      <div className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna 1: Lista e Filtros de Relatórios */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Histórico de Mapas</span>
            <div className="flex gap-1 bg-slate-800/80 p-0.5 rounded-lg text-[11px]">
              <button
                onClick={() => setActiveTab('BMPO')}
                className={`px-2.5 py-1 rounded-md font-semibold ${
                  activeTab === 'BMPO' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                BMPO
              </button>
              <button
                onClick={() => setActiveTab('RMNR')}
                className={`px-2.5 py-1 rounded-md font-semibold ${
                  activeTab === 'RMNR' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                RMNR
              </button>
              <button
                onClick={() => setActiveTab('ALL')}
                className={`px-2.5 py-1 rounded-md font-semibold ${
                  activeTab === 'ALL' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Todos
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 max-h-[60vh]">
            {filteredReports.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">Nenhum mapa encontrado.</div>
            ) : (
              filteredReports.map((r) => (
                <div
                  key={r.id}
                  data-testid={`report-card-${r.id}`}
                  onClick={() => handleSelectReport(r.id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
                    selectedReport?.id === r.id
                      ? 'bg-amber-950/30 border-amber-500/60 shadow-md'
                      : 'bg-slate-800/40 border-slate-800 hover:bg-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-amber-400" />
                      {r.report_type}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                        r.status === 'FILED_WITH_VISA'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {r.status === 'FILED_WITH_VISA' ? 'Protocolado' : 'Rascunho'}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-400">
                    {r.period_quarter
                      ? `${r.period_quarter}º Trimestre de ${r.period_year}`
                      : r.period_month
                      ? `Mês ${String(r.period_month).padStart(2, '0')}/${r.period_year}`
                      : `Exercício Anual ${r.period_year}`}
                  </div>

                  <div className="text-[10px] text-slate-500 flex justify-between items-center pt-1 border-t border-slate-800/60">
                    <span>RT: {r.pharmacist_crf}</span>
                    {r.visa_protocol_number && <span className="font-mono text-emerald-400">Prot: {r.visa_protocol_number}</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Coluna 2 e 3: Visualizador e Ações do Relatório */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between space-y-4">
          {!selectedReport ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-500 space-y-2">
              <FileCheck className="w-12 h-12 text-slate-600" />
              <span>Selecione um relatório ao lado para visualizar os detalhes</span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Barra Superior do Detalhe */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-800">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2" data-testid="selected-report-title">
                    {selectedReport.report_type} — Exercício {selectedReport.period_year}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Responsável Técnico: {selectedReport.pharmacist_name} ({selectedReport.pharmacist_crf})
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    data-testid="print-report-button"
                    onClick={() => handleOpenPrint(selectedReport.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-all border border-slate-700"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Imprimir A4
                  </button>

                  {selectedReport.status !== 'FILED_WITH_VISA' && (
                    <>
                      <button
                        data-testid="open-file-visa-button"
                        onClick={() => setShowFilingModal(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Protocolar na VISA
                      </button>

                      <button
                        data-testid="delete-report-button"
                        onClick={() => handleDeleteReport(selectedReport.id)}
                        className="p-1.5 text-rose-400 hover:bg-rose-950/40 rounded-lg transition-all"
                        title="Excluir Rascunho"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Informações do Protocolo se protocolado */}
              {selectedReport.status === 'FILED_WITH_VISA' && (
                <div className="bg-emerald-950/30 border border-emerald-800/60 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-center text-xs text-emerald-300 gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>
                      Protocolado junto à Vigilância Sanitária em {selectedReport.visa_filing_date}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-white bg-emerald-900/60 px-3 py-1 rounded border border-emerald-700">
                    Nº {selectedReport.visa_protocol_number}
                  </span>
                </div>
              )}

              {/* Tabela de Itens BMPO */}
              {selectedReport.report_type.startsWith('BMPO') && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Demonstrativo de Movimentação por Medicamento ({selectedReport.items.length})
                  </span>
                  <div className="border border-slate-800 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-800/80 text-slate-400 border-b border-slate-700">
                          <th className="py-2 px-3">Medicamento / Princípio Ativo</th>
                          <th className="py-2 px-3">Lista</th>
                          <th className="py-2 px-3 text-right">Inicial</th>
                          <th className="py-2 px-3 text-right">Entradas</th>
                          <th className="py-2 px-3 text-right">Saídas</th>
                          <th className="py-2 px-3 text-right">Perdas</th>
                          <th className="py-2 px-3 text-right">Final</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-300 font-mono">
                        {selectedReport.items.map((it) => (
                          <tr key={it.id || it.product_id} className="hover:bg-slate-800/40">
                            <td className="py-2 px-3 font-sans font-medium text-white">{it.presentation}</td>
                            <td className="py-2 px-3">
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">
                                {it.control_list}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right">{it.initial_stock}</td>
                            <td className="py-2 px-3 text-right text-sky-400 font-bold">{it.acquisitions}</td>
                            <td className="py-2 px-3 text-right text-emerald-400 font-bold">{it.sales}</td>
                            <td className="py-2 px-3 text-right text-rose-400">{it.losses}</td>
                            <td className="py-2 px-3 text-right font-bold text-white">{it.final_stock}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tabela de Prescrições RMNR */}
              {selectedReport.report_type.startsWith('RMNR') && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Relação Nominal de Notificações Retidas ({selectedReport.prescriptions.length})
                  </span>
                  <div className="border border-slate-800 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-800/80 text-slate-400 border-b border-slate-700">
                          <th className="py-2 px-3">Notificação</th>
                          <th className="py-2 px-3">Data</th>
                          <th className="py-2 px-3">Médico (CRM/UF)</th>
                          <th className="py-2 px-3">Paciente</th>
                          <th className="py-2 px-3">Medicamento</th>
                          <th className="py-2 px-3 text-right">Qtd</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-300">
                        {selectedReport.prescriptions.map((pr) => (
                          <tr key={pr.id || pr.prescription_notification_number} className="hover:bg-slate-800/40">
                            <td className="py-2 px-3 font-mono font-bold text-amber-400">
                              {pr.prescription_notification_number}
                            </td>
                            <td className="py-2 px-3 font-mono">{pr.dispensation_date.substring(0, 10)}</td>
                            <td className="py-2 px-3 font-medium text-white">
                              {pr.prescriber_name} ({pr.prescriber_register_number}/{pr.prescriber_uf})
                            </td>
                            <td className="py-2 px-3 text-slate-300">{pr.patient_name}</td>
                            <td className="py-2 px-3 text-slate-300">{pr.product_name}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-white">
                              {pr.quantity_dispensed}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal: Novo Balanço / Relação */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h2 className="text-lg font-bold text-white">Gerar Novo Balanço Oficial</h2>
            <form onSubmit={handleGenerateReport} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-400 font-semibold">Tipo de Documento</label>
                <select
                  data-testid="form-report-type-select"
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as RegulatoryReportType)}
                  className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none"
                >
                  <option value="BMPO_TRIMESTRAL">BMPO Trimestral (Portaria 344/98)</option>
                  <option value="BMPO_ANUAL">BMPO Anual (Consolidado)</option>
                  <option value="RMNRA">RMNRA — Relação Mensal Notificação Receita A (Amarela)</option>
                  <option value="RMNRB">RMNRB — Relação Mensal Notificação Receita B (Azul)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-semibold">Ano do Exercício</label>
                  <input
                    type="number"
                    data-testid="form-year-input"
                    value={formYear}
                    onChange={(e) => setFormYear(Number(e.target.value))}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none font-mono"
                  />
                </div>

                {formType === 'BMPO_TRIMESTRAL' ? (
                  <div>
                    <label className="text-slate-400 font-semibold">Trimestre</label>
                    <select
                      data-testid="form-quarter-select"
                      value={formQuarter}
                      onChange={(e) => setFormQuarter(Number(e.target.value))}
                      className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none"
                    >
                      <option value={1}>1º Trimestre (Jan - Mar)</option>
                      <option value={2}>2º Trimestre (Abr - Jun)</option>
                      <option value={3}>3º Trimestre (Jul - Set)</option>
                      <option value={4}>4º Trimestre (Out - Dez)</option>
                    </select>
                  </div>
                ) : formType.startsWith('RMNR') ? (
                  <div>
                    <label className="text-slate-400 font-semibold">Mês de Referência</label>
                    <select
                      data-testid="form-month-select"
                      value={formMonth}
                      onChange={(e) => setFormMonth(Number(e.target.value))}
                      className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none"
                    >
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>
                          Mês {String(i + 1).padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>

              <div>
                <label className="text-slate-400 font-semibold">Farmacêutico Responsável Técnico</label>
                <input
                  type="text"
                  data-testid="form-pharmacist-name-input"
                  value={formPharmacistName}
                  onChange={(e) => setFormPharmacistName(e.target.value)}
                  className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none"
                />
              </div>

              <div>
                <label className="text-slate-400 font-semibold">Número do CRF</label>
                <input
                  type="text"
                  data-testid="form-pharmacist-crf-input"
                  value={formPharmacistCrf}
                  onChange={(e) => setFormPharmacistCrf(e.target.value)}
                  className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  data-testid="submit-generate-report-button"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold"
                >
                  Gerar Documento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Protocolar na VISA */}
      {showFilingModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              Protocolo VISA
            </h2>
            <form onSubmit={handleFileWithVisa} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-400 font-semibold">Número do Protocolo da Vigilância</label>
                <input
                  type="text"
                  data-testid="visa-protocol-input"
                  value={filingProtocol}
                  onChange={(e) => setFilingProtocol(e.target.value)}
                  placeholder="Ex: VISA-SP-2026-987654"
                  required
                  className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none font-mono"
                />
              </div>

              <div>
                <label className="text-slate-400 font-semibold">Data da Entrega / Carimbo</label>
                <input
                  type="date"
                  data-testid="visa-filing-date-input"
                  value={filingDate}
                  onChange={(e) => setFilingDate(e.target.value)}
                  required
                  className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowFilingModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  data-testid="submit-file-visa-button"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold"
                >
                  Confirmar Protocolo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Documento Oficial A4 para Impressão */}
      {printDocument && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full p-6 shadow-2xl flex flex-col space-y-4 max-h-[90vh]">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Printer className="w-5 h-5 text-amber-400" />
                Documento Oficial Formatado (Portaria 344/98)
              </h2>
              <button
                onClick={() => setPrintDocument(null)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold"
              >
                Fechar
              </button>
            </div>

            <div
              data-testid="official-print-content"
              className="flex-1 overflow-auto p-4 bg-slate-950 border border-slate-800 rounded-xl font-mono text-[11px] text-slate-200 whitespace-pre"
            >
              {printDocument}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Imprimir Documento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BmpoRegulatoryPage;
