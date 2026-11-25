import React, { useState, useEffect } from 'react';
import {
  AdverseDrugReaction,
  TechnicalComplaint,
  PharmacovigilanceSummary,
  SeverityLevel,
  ComplaintType,
  PatientGender,
  DechallengeStatus,
  RechallengeStatus,
  ReactionOutcome,
} from '../types/pharmacovigilance';
import { pharmacovigilanceApi } from '../services/api';

export const PharmacovigilancePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'ADRS' | 'COMPLAINTS'>('ADRS');
  const [summary, setSummary] = useState<PharmacovigilanceSummary | null>(null);
  const [adrs, setAdrs] = useState<AdverseDrugReaction[]>([]);
  const [complaints, setComplaints] = useState<TechnicalComplaint[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals & Form States
  const [isAdrModalOpen, setIsAdrModalOpen] = useState(false);
  const [newAdr, setNewAdr] = useState({
    patientInitials: '',
    patientAge: '',
    patientGender: 'M' as PatientGender,
    isPregnant: false,
    suspectedDrugName: '',
    suspectedDrugBatch: '',
    suspectedDrugManufacturer: '',
    dailyDose: '',
    treatmentStartDate: '',
    treatmentEndDate: '',
    therapeuticIndication: '',
    concomitantDrugs: '',
    reactionDescription: '',
    reactionOnsetDate: '',
    severityLevel: 'MODERATE' as SeverityLevel,
    seriousCriteria: '',
    dechallengeStatus: 'IMPROVED' as DechallengeStatus,
    rechallengeStatus: 'NOT_REEXPOSED' as RechallengeStatus,
    outcome: 'RECOVERED' as ReactionOutcome,
    notifierPharmacistName: '',
    notifierPharmacistCrf: '',
  });

  const [isComplaintModalOpen, setIsComplaintModalOpen] = useState(false);
  const [newComplaint, setNewComplaint] = useState({
    productName: '',
    productEan: '',
    batchNumber: '',
    manufacturer: '',
    expirationDate: '',
    complaintType: 'PACKAGING_OR_SEAL_DEFECT' as ComplaintType,
    description: '',
    sampleAvailableForPickup: true,
    quarantineAutoBlocked: true,
    reporterType: 'CUSTOMER' as const,
    reporterName: '',
    notifierPharmacistCrf: '',
  });

  const [viewAdr, setViewAdr] = useState<AdverseDrugReaction | null>(null);
  const [viewComplaint, setViewComplaint] = useState<TechnicalComplaint | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sum, adrList, compList] = await Promise.all([
        pharmacovigilanceApi.getSummary(),
        pharmacovigilanceApi.getAdrs(),
        pharmacovigilanceApi.getComplaints(),
      ]);
      setSummary(sum);
      setAdrs(adrList || []);
      setComplaints(compList || []);
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Erro ao carregar dados de farmacovigilância.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateAdr = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await pharmacovigilanceApi.createAdr({
        ...newAdr,
        patientAge: newAdr.patientAge ? Number(newAdr.patientAge) : undefined,
      });
      setFeedbackMsg({
        type: 'success',
        text: `Notificação de RAM registrada com sucesso! Protocolo: ${created.protocol_code}`,
      });
      setIsAdrModalOpen(false);
      setNewAdr({
        patientInitials: '',
        patientAge: '',
        patientGender: 'M',
        isPregnant: false,
        suspectedDrugName: '',
        suspectedDrugBatch: '',
        suspectedDrugManufacturer: '',
        dailyDose: '',
        treatmentStartDate: '',
        treatmentEndDate: '',
        therapeuticIndication: '',
        concomitantDrugs: '',
        reactionDescription: '',
        reactionOnsetDate: '',
        severityLevel: 'MODERATE',
        seriousCriteria: '',
        dechallengeStatus: 'IMPROVED',
        rechallengeStatus: 'NOT_REEXPOSED',
        outcome: 'RECOVERED',
        notifierPharmacistName: '',
        notifierPharmacistCrf: '',
      });
      loadData();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Erro ao registrar RAM.' });
    }
  };

  const handleCreateComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await pharmacovigilanceApi.createComplaint(newComplaint);
      setFeedbackMsg({
        type: 'success',
        text: `Queixa técnica registrada com sucesso! Protocolo: ${created.protocol_code}`,
      });
      setIsComplaintModalOpen(false);
      setNewComplaint({
        productName: '',
        productEan: '',
        batchNumber: '',
        manufacturer: '',
        expirationDate: '',
        complaintType: 'PACKAGING_OR_SEAL_DEFECT',
        description: '',
        sampleAvailableForPickup: true,
        quarantineAutoBlocked: true,
        reporterType: 'CUSTOMER',
        reporterName: '',
        notifierPharmacistCrf: '',
      });
      loadData();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Erro ao registrar queixa técnica.' });
    }
  };

  const handleSubmitNotivisa = async (type: 'RAM' | 'TECHNICAL_COMPLAINT', id: number) => {
    try {
      const res = await pharmacovigilanceApi.submitToNotivisa(type, id);
      setFeedbackMsg({
        type: 'success',
        text: `Notificação transmitida ao NOTIVISA ANVISA com sucesso! Protocolo Oficial: ${res.notivisaProtocol}`,
      });
      loadData();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Erro ao transmitir ao NOTIVISA.' });
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* CABEÇALHO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span>🛡️</span> Farmacovigilância, Reações Adversas (RAM) & Queixas Técnicas (RDC 406/2020 & NOTIVISA)
          </h1>
          <p className="text-sm text-gray-500">
            Monitoramento de segurança clínica de medicamentos, desvios de qualidade com bloqueio de lote e transmissão oficial à ANVISA.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsAdrModalOpen(true)}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded font-medium shadow-sm flex items-center gap-1 text-sm"
          >
            <span>⚠️</span> Notificar RAM
          </button>
          <button
            onClick={() => setIsComplaintModalOpen(true)}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded font-medium shadow-sm flex items-center gap-1 text-sm"
          >
            <span>📦</span> Notificar Queixa Técnica
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`p-3 rounded text-sm flex justify-between items-center ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <span>{feedbackMsg.text}</span>
          <button onClick={() => setFeedbackMsg(null)} className="text-xs font-bold underline">
            Fechar
          </button>
        </div>
      )}

      {/* KPIS DE FARMACOVIGILÂNCIA */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Total de RAMs</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-extrabold text-gray-900">{summary.totalRams}</span>
              <span className="text-xs font-medium text-gray-500">relatos clínicos</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Reações adversas registradas</p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Casos Graves</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className={`text-3xl font-extrabold ${summary.severeRams > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {summary.severeRams}
              </span>
              <span className="text-xs font-medium text-gray-500">alta prioridade</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Exigem envio imediato em 72h</p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Queixas Técnicas</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-extrabold text-amber-600">{summary.totalComplaints}</span>
              <span className="text-xs font-medium text-gray-500">desvios de lote</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Lotes retidos em quarentena</p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Pendentes NOTIVISA</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className={`text-3xl font-extrabold ${summary.pendingSubmissionCount > 0 ? 'text-blue-600' : 'text-gray-700'}`}>
                {summary.pendingSubmissionCount}
              </span>
              <span className="text-xs font-medium text-gray-500">em rascunho</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Prontos para submissão à ANVISA</p>
          </div>
        </div>
      )}

      {/* ABAS */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-6">
          <button
            onClick={() => setActiveTab('ADRS')}
            className={`pb-3 text-sm font-medium border-b-2 ${
              activeTab === 'ADRS' ? 'border-rose-600 text-rose-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            ⚠️ Reações Adversas - RAM ({adrs.length})
          </button>
          <button
            onClick={() => setActiveTab('COMPLAINTS')}
            className={`pb-3 text-sm font-medium border-b-2 ${
              activeTab === 'COMPLAINTS' ? 'border-amber-600 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            📦 Queixas Técnicas & Desvios ({complaints.length})
          </button>
        </nav>
      </div>

      {/* TABELA DE RAMS */}
      {activeTab === 'ADRS' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left">Protocolo</th>
                <th className="px-4 py-3 text-left">Início</th>
                <th className="px-4 py-3 text-left">Paciente</th>
                <th className="px-4 py-3 text-left">Medicamento Suspeito / Lote</th>
                <th className="px-4 py-3 text-left">Reação / Gravidade</th>
                <th className="px-4 py-3 text-left">Desfecho</th>
                <th className="px-4 py-3 text-left">Status NOTIVISA</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {adrs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-gray-400">
                    Nenhuma notificação de reação adversa registrada.
                  </td>
                </tr>
              ) : (
                adrs.map((adr) => (
                  <tr key={adr.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono font-bold text-rose-600">{adr.protocol_code}</td>
                    <td className="px-4 py-3 text-gray-600">{adr.reaction_onset_date}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">{adr.patient_initials}</div>
                      <div className="text-xs text-gray-400">
                        {adr.patient_age ? `${adr.patient_age} anos` : 'Idade não informada'}, {adr.patient_gender}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-800">{adr.suspected_drug_name}</div>
                      <div className="text-xs text-gray-500">Lote: {adr.suspected_drug_batch}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-bold ${
                          adr.severity_level === 'SEVERE'
                            ? 'bg-red-100 text-red-800'
                            : adr.severity_level === 'MODERATE'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {adr.severity_level}
                      </span>
                      <div className="text-xs text-gray-600 mt-0.5 line-clamp-1">{adr.reaction_description}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 font-medium">{adr.outcome}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-bold ${
                          adr.notivisa_submission_status === 'SUBMITTED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {adr.notivisa_submission_status}
                      </span>
                      {adr.notivisa_protocol && (
                        <div className="text-[10px] font-mono text-gray-400 mt-0.5">{adr.notivisa_protocol}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right space-x-1">
                      <button
                        onClick={() => setViewAdr(adr)}
                        className="px-2 py-1 text-xs font-semibold bg-gray-50 text-gray-700 hover:bg-gray-100 rounded border"
                      >
                        Dossiê
                      </button>
                      {adr.notivisa_submission_status === 'DRAFT' && (
                        <button
                          onClick={() => handleSubmitNotivisa('RAM', adr.id)}
                          className="px-2 py-1 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded"
                        >
                          Transmitir
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

      {/* TABELA DE QUEIXAS TÉCNICAS */}
      {activeTab === 'COMPLAINTS' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left">Protocolo</th>
                <th className="px-4 py-3 text-left">Data</th>
                <th className="px-4 py-3 text-left">Produto & Fabricante</th>
                <th className="px-4 py-3 text-left">Lote / Validade</th>
                <th className="px-4 py-3 text-left">Tipo de Desvio</th>
                <th className="px-4 py-3 text-left">Quarentena</th>
                <th className="px-4 py-3 text-left">Status NOTIVISA</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {complaints.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-gray-400">
                    Nenhuma queixa técnica registrada.
                  </td>
                </tr>
              ) : (
                complaints.map((comp) => (
                  <tr key={comp.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono font-bold text-amber-700">{comp.protocol_code}</td>
                    <td className="px-4 py-3 text-gray-600">{comp.created_at.slice(0, 10)}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">{comp.product_name}</div>
                      <div className="text-xs text-gray-400">{comp.manufacturer}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      <div>Lote: {comp.batch_number}</div>
                      <div>Val: {comp.expiration_date}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-800">
                        {comp.complaint_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {comp.quarantine_auto_blocked ? (
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-purple-100 text-purple-800">
                          🛡️ Bloqueado
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Não retido</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-bold ${
                          comp.notivisa_submission_status === 'SUBMITTED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {comp.notivisa_submission_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-1">
                      <button
                        onClick={() => setViewComplaint(comp)}
                        className="px-2 py-1 text-xs font-semibold bg-gray-50 text-gray-700 hover:bg-gray-100 rounded border"
                      >
                        Dossiê
                      </button>
                      {comp.notivisa_submission_status === 'DRAFT' && (
                        <button
                          onClick={() => handleSubmitNotivisa('TECHNICAL_COMPLAINT', comp.id)}
                          className="px-2 py-1 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded"
                        >
                          Transmitir
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

      {/* MODAL NOVA NOTIFICAÇÃO DE RAM */}
      {isAdrModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span>⚠️</span> Notificação de Reação Adversa a Medicamentos (RAM)
            </h2>
            <form onSubmit={handleCreateAdr} className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-xs font-bold uppercase text-gray-500">1. Dados do Paciente (Sigilo Preservado)</h3>
                <div className="grid grid-cols-4 gap-3 mt-2">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-gray-700">Iniciais do Paciente</label>
                    <input
                      type="text"
                      data-testid="patient-initials-input"
                      value={newAdr.patientInitials}
                      onChange={(e) => setNewAdr({ ...newAdr, patientInitials: e.target.value.toUpperCase() })}
                      placeholder="Ex: C.E.S."
                      className="w-full border rounded p-2 text-sm mt-1"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700">Idade</label>
                    <input
                      type="number"
                      data-testid="patient-age-input"
                      value={newAdr.patientAge}
                      onChange={(e) => setNewAdr({ ...newAdr, patientAge: e.target.value })}
                      placeholder="Anos"
                      className="w-full border rounded p-2 text-sm mt-1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700">Sexo</label>
                    <select
                      value={newAdr.patientGender}
                      onChange={(e) => setNewAdr({ ...newAdr, patientGender: e.target.value as PatientGender })}
                      className="w-full border rounded p-2 text-sm mt-1"
                    >
                      <option value="M">Masculino</option>
                      <option value="F">Feminino</option>
                      <option value="OTHER">Outro</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="border-b pb-2">
                <h3 className="text-xs font-bold uppercase text-gray-500">2. Medicamento Suspeito</h3>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700">Nome do Medicamento</label>
                    <input
                      type="text"
                      data-testid="suspected-drug-input"
                      value={newAdr.suspectedDrugName}
                      onChange={(e) => setNewAdr({ ...newAdr, suspectedDrugName: e.target.value })}
                      placeholder="Nome comercial ou DCB"
                      className="w-full border rounded p-2 text-sm mt-1"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700">Lote do Medicamento</label>
                    <input
                      type="text"
                      data-testid="suspected-batch-input"
                      value={newAdr.suspectedDrugBatch}
                      onChange={(e) => setNewAdr({ ...newAdr, suspectedDrugBatch: e.target.value })}
                      className="w-full border rounded p-2 text-sm mt-1"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700">Dose Diária / Posologia</label>
                    <input
                      type="text"
                      data-testid="daily-dose-input"
                      value={newAdr.dailyDose}
                      onChange={(e) => setNewAdr({ ...newAdr, dailyDose: e.target.value })}
                      placeholder="Ex: 50mg 1x ao dia"
                      className="w-full border rounded p-2 text-sm mt-1"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700">Início do Tratamento</label>
                    <input
                      type="date"
                      data-testid="treatment-start-input"
                      value={newAdr.treatmentStartDate}
                      onChange={(e) => setNewAdr({ ...newAdr, treatmentStartDate: e.target.value })}
                      className="w-full border rounded p-2 text-sm mt-1"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="border-b pb-2">
                <h3 className="text-xs font-bold uppercase text-gray-500">3. Detalhes da Reação Adversa</h3>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700">Data de Início da Reação</label>
                    <input
                      type="date"
                      data-testid="reaction-onset-input"
                      value={newAdr.reactionOnsetDate}
                      onChange={(e) => setNewAdr({ ...newAdr, reactionOnsetDate: e.target.value })}
                      className="w-full border rounded p-2 text-sm mt-1"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700">Gravidade Clínica</label>
                    <select
                      value={newAdr.severityLevel}
                      onChange={(e) => setNewAdr({ ...newAdr, severityLevel: e.target.value as SeverityLevel })}
                      className="w-full border rounded p-2 text-sm mt-1"
                    >
                      <option value="MILD">Leve (sem prejuízo funcional)</option>
                      <option value="MODERATE">Moderada (interferência nas atividades)</option>
                      <option value="SEVERE">Grave (hospitalização / risco à vida)</option>
                    </select>
                  </div>
                </div>

                <div className="mt-2">
                  <label className="block text-xs font-semibold text-gray-700">Descrição Detalhada dos Sinais e Sintomas</label>
                  <textarea
                    data-testid="reaction-desc-input"
                    value={newAdr.reactionDescription}
                    onChange={(e) => setNewAdr({ ...newAdr, reactionDescription: e.target.value })}
                    rows={3}
                    placeholder="Descreva a reação, órgãos envolvidos e conduta tomada"
                    className="w-full border rounded p-2 text-sm mt-1"
                    required
                  />
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase text-gray-500">4. Farmacêutico Notificador</h3>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700">Nome do Farmacêutico</label>
                    <input
                      type="text"
                      data-testid="pharmacist-name-input"
                      value={newAdr.notifierPharmacistName}
                      onChange={(e) => setNewAdr({ ...newAdr, notifierPharmacistName: e.target.value })}
                      className="w-full border rounded p-2 text-sm mt-1"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700">CRF do Farmacêutico</label>
                    <input
                      type="text"
                      data-testid="pharmacist-crf-input"
                      value={newAdr.notifierPharmacistCrf}
                      onChange={(e) => setNewAdr({ ...newAdr, notifierPharmacistCrf: e.target.value })}
                      placeholder="CRF-SP 12345"
                      className="w-full border rounded p-2 text-sm mt-1"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAdrModalOpen(false)}
                  className="px-4 py-2 border rounded text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded text-sm font-semibold"
                >
                  Registrar Notificação de RAM
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL NOVA QUEIXA TÉCNICA */}
      {isComplaintModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span>📦</span> Notificar Queixa Técnica & Desvio de Qualidade (QT)
            </h2>
            <form onSubmit={handleCreateComplaint} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700">Nome do Produto</label>
                  <input
                    type="text"
                    data-testid="complaint-product-input"
                    value={newComplaint.productName}
                    onChange={(e) => setNewComplaint({ ...newComplaint, productName: e.target.value })}
                    className="w-full border rounded p-2 text-sm mt-1"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700">Fabricante</label>
                  <input
                    type="text"
                    data-testid="complaint-manufacturer-input"
                    value={newComplaint.manufacturer}
                    onChange={(e) => setNewComplaint({ ...newComplaint, manufacturer: e.target.value })}
                    className="w-full border rounded p-2 text-sm mt-1"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700">Número do Lote</label>
                  <input
                    type="text"
                    data-testid="complaint-batch-input"
                    value={newComplaint.batchNumber}
                    onChange={(e) => setNewComplaint({ ...newComplaint, batchNumber: e.target.value })}
                    className="w-full border rounded p-2 text-sm mt-1"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700">Data de Validade</label>
                  <input
                    type="date"
                    data-testid="complaint-exp-input"
                    value={newComplaint.expirationDate}
                    onChange={(e) => setNewComplaint({ ...newComplaint, expirationDate: e.target.value })}
                    className="w-full border rounded p-2 text-sm mt-1"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700">Tipo de Desvio de Qualidade</label>
                <select
                  value={newComplaint.complaintType}
                  onChange={(e) => setNewComplaint({ ...newComplaint, complaintType: e.target.value as ComplaintType })}
                  className="w-full border rounded p-2 text-sm mt-1"
                >
                  <option value="PACKAGING_OR_SEAL_DEFECT">Defeito de embalagem ou lacre violado</option>
                  <option value="FOREIGN_MATTER">Presença de corpo estranho / partículas</option>
                  <option value="COLOR_OR_ODOR_CHANGE">Alteração de cor ou odor</option>
                  <option value="PHYSICAL_CHEMICAL_ALTERATION">Alteração físico-química (precipitação / viscosidade)</option>
                  <option value="LACK_OF_THERAPEUTIC_EFFICACY">Suspeita de falta de eficácia terapêutica</option>
                  <option value="LABELING_INACCURACY">Erro ou ilegibilidade de rotulagem</option>
                  <option value="SUSPECTED_COUNTERFEIT">Suspeita de falsificação</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700">Descrição Detalhada do Desvio</label>
                <textarea
                  data-testid="complaint-desc-input"
                  value={newComplaint.description}
                  onChange={(e) => setNewComplaint({ ...newComplaint, description: e.target.value })}
                  rows={3}
                  className="w-full border rounded p-2 text-sm mt-1"
                  required
                />
              </div>

              <div className="p-3 bg-purple-50 border border-purple-200 rounded space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="quarantineBlocked"
                    checked={newComplaint.quarantineAutoBlocked}
                    onChange={(e) => setNewComplaint({ ...newComplaint, quarantineAutoBlocked: e.target.checked })}
                    className="rounded text-purple-600"
                  />
                  <label htmlFor="quarantineBlocked" className="text-xs text-purple-900 font-semibold">
                    Bloquear preventivamente o lote em Quarentena Sanitária no estoque
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700">CRF do Farmacêutico RT</label>
                <input
                  type="text"
                  data-testid="complaint-crf-input"
                  value={newComplaint.notifierPharmacistCrf}
                  onChange={(e) => setNewComplaint({ ...newComplaint, notifierPharmacistCrf: e.target.value })}
                  placeholder="CRF-SP 12345"
                  className="w-full border rounded p-2 text-sm mt-1"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsComplaintModalOpen(false)}
                  className="px-4 py-2 border rounded text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded text-sm font-semibold"
                >
                  Registrar Queixa Técnica
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DETALHES / DOSSIÊ RAM */}
      {viewAdr && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="border-b pb-3 flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold text-gray-900">DOSSIÊ DE FARMACOVIGILÂNCIA (RAM)</h2>
                <p className="text-xs text-gray-500">Notificação Sanitária ANVISA</p>
              </div>
              <span className="font-mono font-bold text-sm text-rose-700">{viewAdr.protocol_code}</span>
            </div>

            <div className="text-xs space-y-2 text-gray-700 bg-gray-50 p-3 rounded border">
              <div><strong>Paciente:</strong> {viewAdr.patient_initials} ({viewAdr.patient_age} anos, {viewAdr.patient_gender})</div>
              <div><strong>Medicamento:</strong> {viewAdr.suspected_drug_name} | <strong>Lote:</strong> {viewAdr.suspected_drug_batch}</div>
              <div><strong>Dose:</strong> {viewAdr.daily_dose} | <strong>Início:</strong> {viewAdr.treatment_start_date}</div>
              <div><strong>Reação Adversa:</strong> {viewAdr.reaction_description}</div>
              <div><strong>Gravidade:</strong> {viewAdr.severity_level} | <strong>Desfecho:</strong> {viewAdr.outcome}</div>
              <div><strong>Farmacêutico RT:</strong> {viewAdr.notifier_pharmacist_name} ({viewAdr.notifier_pharmacist_crf})</div>
              <div><strong>Status NOTIVISA:</strong> {viewAdr.notivisa_submission_status}</div>
              {viewAdr.notivisa_protocol && <div><strong>Protocolo Oficial:</strong> {viewAdr.notivisa_protocol}</div>}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setViewAdr(null)}
                className="px-4 py-2 border rounded text-xs text-gray-600 hover:bg-gray-50"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALHES QUEIXA TÉCNICA */}
      {viewComplaint && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="border-b pb-3 flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold text-gray-900">DOSSIÊ DE QUEIXA TÉCNICA (QT)</h2>
                <p className="text-xs text-gray-500">Desvio de Qualidade de Produto</p>
              </div>
              <span className="font-mono font-bold text-sm text-amber-700">{viewComplaint.protocol_code}</span>
            </div>

            <div className="text-xs space-y-2 text-gray-700 bg-amber-50/50 p-3 rounded border border-amber-200">
              <div><strong>Produto:</strong> {viewComplaint.product_name}</div>
              <div><strong>Fabricante:</strong> {viewComplaint.manufacturer}</div>
              <div><strong>Lote:</strong> {viewComplaint.batch_number} | <strong>Validade:</strong> {viewComplaint.expiration_date}</div>
              <div><strong>Tipo de Desvio:</strong> {viewComplaint.complaint_type}</div>
              <div><strong>Descrição:</strong> {viewComplaint.description}</div>
              <div><strong>Bloqueio Quarentena:</strong> {viewComplaint.quarantine_auto_blocked ? 'Sim' : 'Não'}</div>
              <div><strong>Farmacêutico RT:</strong> {viewComplaint.notifier_pharmacist_crf}</div>
              <div><strong>Status NOTIVISA:</strong> {viewComplaint.notivisa_submission_status}</div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setViewComplaint(null)}
                className="px-4 py-2 border rounded text-xs text-gray-600 hover:bg-gray-50"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
