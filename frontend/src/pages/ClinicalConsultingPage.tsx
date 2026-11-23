import React, { useState, useEffect } from 'react';
import {
  clinicalApi,
  type ClinicalPharmacist,
  type ClinicalAttendance,
  type PharmacovigilanceReport,
  type DsfSlipResponse,
} from '../services/api';

type Tab = 'attendance' | 'rapidTests' | 'procedures' | 'pharmacovigilance' | 'history';

export const ClinicalConsultingPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('attendance');
  const [pharmacists, setPharmacists] = useState<ClinicalPharmacist[]>([]);
  const [selectedPharmacistId, setSelectedPharmacistId] = useState<number>(0);
  const [activeAttendance, setActiveAttendance] = useState<ClinicalAttendance | null>(null);
  const [attendancesHistory, setAttendancesHistory] = useState<ClinicalAttendance[]>([]);
  const [pharmacovigilanceList, setPharmacovigilanceList] = useState<PharmacovigilanceReport[]>([]);
  const [dsfModal, setDsfModal] = useState<DsfSlipResponse | null>(null);
  const [activeDsfCopy, setActiveDsfCopy] = useState<'patient' | 'pharmacy'>('patient');

  // Loading & feedback
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form State: Atendimento / Anamnese
  const [patientName, setPatientName] = useState('');
  const [patientCpf, setPatientCpf] = useState('');
  const [patientBirthDate, setPatientBirthDate] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [bpSystolic, setBpSystolic] = useState('');
  const [bpDiastolic, setBpDiastolic] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [temperature, setTemperature] = useState('');
  const [glucose, setGlucose] = useState('');
  const [oxygenSat, setOxygenSat] = useState('');
  const [anamnesisNotes, setAnamnesisNotes] = useState('');
  const [pharmacotherapeuticOrientation, setPharmacotherapeuticOrientation] = useState('');

  // Form State: Teste Rápido (TLR RDC 777/2023)
  const [testType, setTestType] = useState<string>('GLUCOSE');
  const [reagentName, setReagentName] = useState('Accu-Chek Guide');
  const [reagentBatch, setReagentBatch] = useState('LT-2026-GLU');
  const [reagentExpiration, setReagentExpiration] = useState('2028-12-31');
  const [reagentMsRegistration, setReagentMsRegistration] = useState('10287410055');
  const [resultValue, setResultValue] = useState('');
  const [resultInterpretation, setResultInterpretation] = useState<string>('NORMAL');
  const [referenceRange, setReferenceRange] = useState('70 a 99 mg/dL (Jejum)');
  const [rapidTestPrice, setRapidTestPrice] = useState('15.00');

  // Form State: Procedimento / Injetável
  const [procType, setProcType] = useState<string>('INJECTABLE');
  const [medicationName, setMedicationName] = useState('');
  const [medicationBatch, setMedicationBatch] = useState('');
  const [applicationSite, setApplicationSite] = useState('GLUTEUS_D');
  const [prescriberName, setPrescriberName] = useState('');
  const [prescriberCrm, setPrescriberCrm] = useState('');
  const [procNotes, setProcNotes] = useState('');
  const [procPrice, setProcPrice] = useState('10.00');

  // Form State: Farmacovigilância
  const [pvPatientName, setPvPatientName] = useState('');
  const [pvPatientCpf, setPvPatientCpf] = useState('');
  const [pvSuspectMed, setPvSuspectMed] = useState('');
  const [pvBatch, setPvBatch] = useState('');
  const [pvManufacturer, setPvManufacturer] = useState('');
  const [pvDescription, setPvDescription] = useState('');
  const [pvSeverity, setPvSeverity] = useState<'MILD' | 'MODERATE' | 'SEVERE' | 'FATAL'>('MODERATE');
  const [pvOutcome, setPvOutcome] = useState<'RECOVERED' | 'RECOVERING' | 'PERSISTING' | 'UNKNOWN'>('RECOVERING');

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const phList = await clinicalApi.getPharmacists(1);
      setPharmacists(phList);
      if (phList.length > 0) {
        setSelectedPharmacistId(phList[0].id || 1);
      }
      await refreshHistory();
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const refreshHistory = async () => {
    try {
      const history = await clinicalApi.listAttendances(1);
      setAttendancesHistory(history);
      const pv = await clinicalApi.listPharmacovigilance(1);
      setPharmacovigilanceList(pv);
    } catch (err: any) {
      console.error(err);
    }
  };

  // Iniciar / Criar Atendimento
  const handleStartAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName.trim() || !patientCpf.trim()) {
      setMessage({ type: 'error', text: 'Informe Nome e CPF do paciente para iniciar o atendimento.' });
      return;
    }

    try {
      setLoading(true);
      setMessage(null);
      const created = await clinicalApi.startAttendance({
        storeId: 1,
        pharmacistId: selectedPharmacistId,
        patientName,
        patientCpf,
        patientBirthDate: patientBirthDate || undefined,
        patientPhone: patientPhone || undefined,
        bloodPressureSystolic: bpSystolic ? Number(bpSystolic) : undefined,
        bloodPressureDiastolic: bpDiastolic ? Number(bpDiastolic) : undefined,
        heartRate: heartRate ? Number(heartRate) : undefined,
        temperature: temperature ? Number(temperature) : undefined,
        bloodGlucose: glucose ? Number(glucose) : undefined,
        oxygenSaturation: oxygenSat ? Number(oxygenSat) : undefined,
        anamnesisNotes: anamnesisNotes || undefined,
        pharmacotherapeuticOrientation: pharmacotherapeuticOrientation || undefined,
      });

      setActiveAttendance(created);
      setMessage({ type: 'success', text: `Atendimento ${created.attendanceCode} iniciado com sucesso!` });
      await refreshHistory();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao iniciar atendimento' });
    } finally {
      setLoading(false);
    }
  };

  // Adicionar Teste Rápido ao Atendimento Ativo
  const handleAddRapidTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAttendance?.id) {
      setMessage({ type: 'error', text: 'Inicie um atendimento antes de registrar exames TLR.' });
      return;
    }
    if (!resultValue.trim()) {
      setMessage({ type: 'error', text: 'Informe o valor do resultado do exame rápido.' });
      return;
    }

    try {
      setLoading(true);
      setMessage(null);
      await clinicalApi.addRapidTest(activeAttendance.id, {
        testType,
        reagentName,
        reagentBatch,
        reagentExpiration,
        reagentMsRegistration,
        resultValue,
        resultInterpretation,
        referenceRange,
        price: rapidTestPrice ? Number(rapidTestPrice) : 0,
      });

      const updated = await clinicalApi.getAttendance(activeAttendance.id);
      setActiveAttendance(updated);
      setResultValue('');
      setMessage({ type: 'success', text: 'Teste Rápido TLR registrado na DSF do paciente com sucesso!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao adicionar teste rápido' });
    } finally {
      setLoading(false);
    }
  };

  // Adicionar Procedimento / Injetável ao Atendimento Ativo
  const handleAddProcedure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAttendance?.id) {
      setMessage({ type: 'error', text: 'Inicie um atendimento antes de registrar procedimentos.' });
      return;
    }

    try {
      setLoading(true);
      setMessage(null);
      await clinicalApi.addProcedure(activeAttendance.id, {
        procedureType: procType,
        medicationName: medicationName || undefined,
        medicationBatch: medicationBatch || undefined,
        applicationSite: applicationSite || undefined,
        prescriberName: prescriberName || undefined,
        prescriberCrm: prescriberCrm || undefined,
        notes: procNotes || undefined,
        price: procPrice ? Number(procPrice) : 0,
      });

      const updated = await clinicalApi.getAttendance(activeAttendance.id);
      setActiveAttendance(updated);
      setMedicationName('');
      setMedicationBatch('');
      setPrescriberName('');
      setPrescriberCrm('');
      setProcNotes('');
      setMessage({ type: 'success', text: 'Procedimento registrado com sucesso no atendimento!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao adicionar procedimento' });
    } finally {
      setLoading(false);
    }
  };

  // Concluir Atendimento e Emitir DSF
  const handleCompleteAttendance = async () => {
    if (!activeAttendance?.id) return;
    try {
      setLoading(true);
      setMessage(null);
      const res = await clinicalApi.completeAttendance(activeAttendance.id, {
        pharmacotherapeuticOrientation,
      });
      setActiveAttendance(null);
      setDsfModal(res.dsfSlip);
      setMessage({ type: 'success', text: `Atendimento finalizado com sucesso! DSF emitido: ${res.attendance.dsfNumber}` });
      await refreshHistory();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao finalizar atendimento' });
    } finally {
      setLoading(false);
    }
  };

  // Visualizar DSF de atendimento histórico
  const handleViewDsf = async (attendanceId: number) => {
    try {
      setLoading(true);
      const slip = await clinicalApi.getDsfSlip(attendanceId, 1);
      setDsfModal(slip);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao buscar DSF' });
    } finally {
      setLoading(false);
    }
  };

  // Registrar Farmacovigilância
  const handleRegisterPharmacovigilance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pvPatientName.trim() || !pvSuspectMed.trim() || !pvDescription.trim()) {
      setMessage({ type: 'error', text: 'Preencha paciente, medicamento suspeito e descrição do evento adverso.' });
      return;
    }

    try {
      setLoading(true);
      setMessage(null);
      const res = await clinicalApi.registerPharmacovigilance({
        storeId: 1,
        pharmacistId: selectedPharmacistId,
        patientName: pvPatientName,
        patientCpf: pvPatientCpf || undefined,
        suspectMedication: pvSuspectMed,
        medicationBatch: pvBatch || undefined,
        manufacturer: pvManufacturer || undefined,
        adverseEventDescription: pvDescription,
        severityLevel: pvSeverity,
        eventOutcome: pvOutcome,
      });

      setMessage({
        type: 'success',
        text: `Notificação registrada! Protocolo Sanitário: ${res.report.notivisaProtocolNumber}`,
      });
      setPvPatientName('');
      setPvPatientCpf('');
      setPvSuspectMed('');
      setPvBatch('');
      setPvManufacturer('');
      setPvDescription('');
      await refreshHistory();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao registrar farmacovigilância' });
    } finally {
      setLoading(false);
    }
  };

  const handleExportSanitary = async (id: number) => {
    try {
      setLoading(true);
      const dossier = await clinicalApi.exportPharmacovigilanceSanitary(id);
      const blob = new Blob([JSON.stringify(dossier, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `NOTIVISA_${dossier.regulatoryReportNumber}.json`;
      a.click();
      setMessage({ type: 'success', text: `Dossiê Notivisa exportado com sucesso: ${dossier.regulatoryReportNumber}` });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao exportar dossiê' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-800">Consultório Farmacêutico & Serviços Clínicos</h1>
            <span className="bg-emerald-100 text-emerald-800 text-xs font-semibold px-2.5 py-1 rounded-full border border-emerald-300">
              RDC 777/2023 & RDC 44/2009
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Gestão de Atendimentos Clínicos, Anamnese, Testes Rápidos (TLR), Injetáveis, Farmacovigilância e Emissão de DSF em 2 Vias.
          </p>
        </div>

        {/* Seleção do Farmacêutico Ativo */}
        <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-md border border-slate-200">
          <label className="text-xs font-bold text-slate-600 uppercase">Farmacêutico(a) Resp:</label>
          <select
            className="text-sm font-medium border-slate-300 rounded px-2.5 py-1 bg-white text-slate-700 focus:ring-emerald-500"
            value={selectedPharmacistId}
            onChange={(e) => setSelectedPharmacistId(Number(e.target.value))}
          >
            {pharmacists.map((ph) => (
              <option key={ph.id} value={ph.id}>
                {ph.name} (CRF-{ph.crfUf} nº {ph.crfNumber})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Alerta de Feedback */}
      {message && (
        <div
          className={`p-4 rounded-md text-sm font-medium flex items-center justify-between ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
              : 'bg-red-50 text-red-800 border border-red-300'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="font-bold underline text-xs">
            Fechar
          </button>
        </div>
      )}

      {/* Status do Atendimento Ativo */}
      {activeAttendance && (
        <div className="bg-emerald-50 border border-emerald-300 p-4 rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Atendimento em Andamento</span>
            <div className="text-base font-bold text-slate-800 mt-0.5">
              {activeAttendance.patientName} (CPF: {activeAttendance.patientCpf}) — Código: {activeAttendance.attendanceCode}
            </div>
            <div className="text-xs text-slate-600 mt-0.5">
              Procedimentos: {activeAttendance.procedures?.length || 0} | Exames TLR: {activeAttendance.rapidTests?.length || 0} | Total: R${' '}
              {((activeAttendance.totalAmount || 0)).toFixed(2)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('rapidTests')}
              className="text-xs bg-white text-emerald-700 border border-emerald-300 font-semibold px-3 py-1.5 rounded hover:bg-emerald-100"
            >
              + Teste TLR
            </button>
            <button
              onClick={() => setActiveTab('procedures')}
              className="text-xs bg-white text-emerald-700 border border-emerald-300 font-semibold px-3 py-1.5 rounded hover:bg-emerald-100"
            >
              + Injetável/Procedimento
            </button>
            <button
              onClick={handleCompleteAttendance}
              disabled={loading}
              className="text-xs bg-emerald-600 text-white font-bold px-4 py-2 rounded hover:bg-emerald-700 shadow-sm"
            >
              Finalizar & Emitir DSF (2 Vias)
            </button>
          </div>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          onClick={() => setActiveTab('attendance')}
          className={`pb-3 px-4 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'attendance'
              ? 'border-emerald-600 text-emerald-700 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          1. Atendimento & Anamnese
        </button>
        <button
          onClick={() => setActiveTab('rapidTests')}
          className={`pb-3 px-4 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'rapidTests'
              ? 'border-emerald-600 text-emerald-700 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          2. Testes Rápidos TLR (RDC 777/23)
        </button>
        <button
          onClick={() => setActiveTab('procedures')}
          className={`pb-3 px-4 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'procedures'
              ? 'border-emerald-600 text-emerald-700 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          3. Procedimentos & Injetáveis
        </button>
        <button
          onClick={() => setActiveTab('pharmacovigilance')}
          className={`pb-3 px-4 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'pharmacovigilance'
              ? 'border-emerald-600 text-emerald-700 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          4. Farmacovigilância (Notivisa)
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`pb-3 px-4 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'history'
              ? 'border-emerald-600 text-emerald-700 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          5. Histórico & DSF Emitidas
        </button>
      </div>

      {/* Conteúdo da Aba 1: Atendimento & Sinais Vitais */}
      {activeTab === 'attendance' && (
        <form
          data-testid="attendance-form"
          onSubmit={handleStartAttendance}
          className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 space-y-6"
        >
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-lg font-bold text-slate-800">Dados do Paciente & Anamnese Farmacêutica</h2>
            <p className="text-xs text-slate-500">Conforme RDC ANVISA 44/2009 e Resolução CFF 585/2013</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nome Completo do Paciente *</label>
              <input
                type="text"
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="Ex: Maria José de Oliveira"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">CPF *</label>
              <input
                type="text"
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                value={patientCpf}
                onChange={(e) => setPatientCpf(e.target.value)}
                placeholder="000.000.000-00"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Data de Nascimento</label>
              <input
                type="date"
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                value={patientBirthDate}
                onChange={(e) => setPatientBirthDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Telefone / WhatsApp</label>
              <input
                type="text"
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                value={patientPhone}
                onChange={(e) => setPatientPhone(e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>

          {/* Sinais Vitais */}
          <div className="pt-2">
            <h3 className="text-sm font-bold text-slate-700 mb-3">Aferição de Parâmetros Fisiológicos & Bioquímicos</h3>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">PA Sistólica (mmHg)</label>
                <input
                  type="number"
                  placeholder="120"
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-sm"
                  value={bpSystolic}
                  onChange={(e) => setBpSystolic(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">PA Diastólica (mmHg)</label>
                <input
                  type="number"
                  placeholder="80"
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-sm"
                  value={bpDiastolic}
                  onChange={(e) => setBpDiastolic(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Freq. Cardíaca (bpm)</label>
                <input
                  type="number"
                  placeholder="75"
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-sm"
                  value={heartRate}
                  onChange={(e) => setHeartRate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Temperatura (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="36.5"
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-sm"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Glicemia (mg/dL)</label>
                <input
                  type="number"
                  placeholder="95"
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-sm"
                  value={glucose}
                  onChange={(e) => setGlucose(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Saturação O2 (%)</label>
                <input
                  type="number"
                  placeholder="98"
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-sm"
                  value={oxygenSat}
                  onChange={(e) => setOxygenSat(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Anamnese e Orientações */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Queixa Principal / Anamnese</label>
              <textarea
                rows={3}
                className="w-full border border-slate-300 rounded p-2.5 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Relato do paciente, queixas, sintomas, alergias conhecidas ou condições pré-existentes..."
                value={anamnesisNotes}
                onChange={(e) => setAnamnesisNotes(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Orientações Farmacoterapêuticas</label>
              <textarea
                rows={3}
                className="w-full border border-slate-300 rounded p-2.5 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Conduta do farmacêutico, recomendações não farmacológicas, adesão terapêutica..."
                value={pharmacotherapeuticOrientation}
                onChange={(e) => setPharmacotherapeuticOrientation(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={loading}
              className="bg-emerald-600 text-white font-semibold px-6 py-2.5 rounded hover:bg-emerald-700 shadow-sm transition-colors text-sm"
            >
              Iniciar Atendimento Clínico
            </button>
          </div>
        </form>
      )}

      {/* Conteúdo da Aba 2: Testes Rápidos TLR (RDC 777/2023) */}
      {activeTab === 'rapidTests' && (
        <div className="space-y-6">
          <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-bold text-amber-800">
                  RDC ANVISA 777/2023 — Exames de Análises Clínicas em Farmácias (TLR)
                </h3>
                <div className="mt-1 text-xs text-amber-700">
                  É obrigatório o registro do reagente, lote, validade e registro ANVISA/MS. Os resultados têm finalidade de
                  triagem e não substituem o diagnóstico médico formal.
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handleAddRapidTest} className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 space-y-4">
            <h2 className="text-base font-bold text-slate-800">Novo Registro de Teste Rápido Laboratorial (TLR)</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Exame / Parâmetro *</label>
                <select
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  value={testType}
                  onChange={(e) => setTestType(e.target.value)}
                >
                  <option value="GLUCOSE">Glicemia Capilar (GLUCOSE)</option>
                  <option value="COVID19_ANTIGEN">Covid-19 Antígeno</option>
                  <option value="COVID19_ANTIBODY">Covid-19 Anticorpos IgG/IgM</option>
                  <option value="INFLUENZA_AB">Influenza A/B Antígeno</option>
                  <option value="DENGUE_NS1">Dengue NS1 / Anticorpos</option>
                  <option value="HEMOGLOBIN_GLYCATED">Hemoglobina Glicada (HbA1c)</option>
                  <option value="CHOLESTEROL">Perfil Lipídico / Colesterol Total</option>
                  <option value="BETA_HCG">Beta-HCG (Teste de Gravidez)</option>
                  <option value="STREP_A">Streptococcus A</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nome Comercial do Reagente *</label>
                <input
                  type="text"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  value={reagentName}
                  onChange={(e) => setReagentName(e.target.value)}
                  placeholder="Ex: Accu-Chek Guide"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Lote do Reagente *</label>
                <input
                  type="text"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  value={reagentBatch}
                  onChange={(e) => setReagentBatch(e.target.value)}
                  placeholder="Ex: LT-GLU-99"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Validade do Lote *</label>
                <input
                  type="date"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  value={reagentExpiration}
                  onChange={(e) => setReagentExpiration(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Reg. MS / ANVISA *</label>
                <input
                  type="text"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  value={reagentMsRegistration}
                  onChange={(e) => setReagentMsRegistration(e.target.value)}
                  placeholder="Ex: 10287410055"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Resultado Numérico / Texto *</label>
                <input
                  type="text"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  value={resultValue}
                  onChange={(e) => setResultValue(e.target.value)}
                  placeholder="Ex: 92 mg/dL ou Não Reativo"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Interpretação Sanitária *</label>
                <select
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  value={resultInterpretation}
                  onChange={(e) => setResultInterpretation(e.target.value)}
                >
                  <option value="NORMAL">NORMAL</option>
                  <option value="ALTERED">ALTERADO</option>
                  <option value="NON_REACTIVE">NÃO REATIVO</option>
                  <option value="REACTIVE">REATIVO</option>
                  <option value="INDETERMINATE">INDETERMINADO</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Intervalo de Referência</label>
                <input
                  type="text"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  value={referenceRange}
                  onChange={(e) => setReferenceRange(e.target.value)}
                  placeholder="Ex: Jejum: 70 a 99 mg/dL"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Valor do Serviço (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  value={rapidTestPrice}
                  onChange={(e) => setRapidTestPrice(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={loading || !activeAttendance}
                className="bg-emerald-600 text-white font-semibold px-6 py-2.5 rounded hover:bg-emerald-700 shadow-sm transition-colors text-sm disabled:opacity-50"
              >
                Registrar Teste na DSF
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Conteúdo da Aba 3: Procedimentos & Injetáveis */}
      {activeTab === 'procedures' && (
        <form onSubmit={handleAddProcedure} className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-800">Administração de Medicamentos & Procedimentos</h2>
            <p className="text-xs text-slate-500">
              Injetáveis exigem dados da prescrição médica (CRM/CRO), lote do medicamento e sítio anatômico de administração.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Tipo de Procedimento *</label>
              <select
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                value={procType}
                onChange={(e) => setProcType(e.target.value)}
              >
                <option value="INJECTABLE">Aplicação de Medicamento Injetável</option>
                <option value="WOUND_DRESSING">Curativo Simples</option>
                <option value="NEBULIZATION">Inalação / Nebulização</option>
                <option value="EAR_PIERCING">Perfuração de Lóbulo Auricular</option>
                <option value="BLOOD_PRESSURE">Aferição de Pressão Arterial</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nome do Medicamento</label>
              <input
                type="text"
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                value={medicationName}
                onChange={(e) => setMedicationName(e.target.value)}
                placeholder="Ex: Citoneurin 5000 UI"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Lote do Medicamento</label>
              <input
                type="text"
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                value={medicationBatch}
                onChange={(e) => setMedicationBatch(e.target.value)}
                placeholder="Ex: LOTE-CIT-01"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Local Anatômico de Aplicação</label>
              <select
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                value={applicationSite}
                onChange={(e) => setApplicationSite(e.target.value)}
              >
                <option value="GLUTEUS_D">Glúteo Direito (IM)</option>
                <option value="GLUTEUS_E">Glúteo Esquerdo (IM)</option>
                <option value="DELTOID_D">Deltoide Direito (IM/SC)</option>
                <option value="DELTOID_E">Deltoide Esquerdo (IM/SC)</option>
                <option value="VASTUS_LATERALIS_D">Vasto Lateral da Coxa Direita</option>
                <option value="VASTUS_LATERALIS_E">Vasto Lateral da Coxa Esquerda</option>
                <option value="OUTRO">Outro Local</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nome do Prescritor (Médico/Dentista)</label>
              <input
                type="text"
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                value={prescriberName}
                onChange={(e) => setPrescriberName(e.target.value)}
                placeholder="Ex: Dr. Roberto Médici"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Registro Profissional (CRM/CRO)</label>
              <input
                type="text"
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                value={prescriberCrm}
                onChange={(e) => setPrescriberCrm(e.target.value)}
                placeholder="Ex: CRM-SP 123456"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Observações do Procedimento</label>
              <input
                type="text"
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                value={procNotes}
                onChange={(e) => setProcNotes(e.target.value)}
                placeholder="Ex: Sem intercorrências, orientada quanto a compressas locais se dor"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Valor do Procedimento (R$)</label>
              <input
                type="number"
                step="0.01"
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                value={procPrice}
                onChange={(e) => setProcPrice(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={loading || !activeAttendance}
              className="bg-emerald-600 text-white font-semibold px-6 py-2.5 rounded hover:bg-emerald-700 shadow-sm transition-colors text-sm disabled:opacity-50"
            >
              Registrar Procedimento na DSF
            </button>
          </div>
        </form>
      )}

      {/* Conteúdo da Aba 4: Farmacovigilância */}
      {activeTab === 'pharmacovigilance' && (
        <div className="space-y-6">
          <form
            onSubmit={handleRegisterPharmacovigilance}
            className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 space-y-4"
          >
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-800">
                Notificação de Farmacovigilância & Queixas Técnicas (VigiMed / Notivisa)
              </h2>
              <p className="text-xs text-slate-500">
                Notificação obrigatória de Reações Adversas a Medicamentos (RAM) e desvios de qualidade sanitários.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nome do Paciente *</label>
                <input
                  type="text"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  value={pvPatientName}
                  onChange={(e) => setPvPatientName(e.target.value)}
                  placeholder="Nome do paciente"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">CPF do Paciente</label>
                <input
                  type="text"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  value={pvPatientCpf}
                  onChange={(e) => setPvPatientCpf(e.target.value)}
                  placeholder="000.000.000-00"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Medicamento Suspeito *</label>
                <input
                  type="text"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  value={pvSuspectMed}
                  onChange={(e) => setPvSuspectMed(e.target.value)}
                  placeholder="Ex: Dipirona 500mg Gotas"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Lote</label>
                <input
                  type="text"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  value={pvBatch}
                  onChange={(e) => setPvBatch(e.target.value)}
                  placeholder="Lote do produto"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Fabricante / Laboratório</label>
                <input
                  type="text"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  value={pvManufacturer}
                  onChange={(e) => setPvManufacturer(e.target.value)}
                  placeholder="Ex: Medley, EMS, Eurofarma"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Gravidade Clínica *</label>
                <select
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  value={pvSeverity}
                  onChange={(e) => setPvSeverity(e.target.value as any)}
                >
                  <option value="MILD">Leve (Não interferiu na rotina)</option>
                  <option value="MODERATE">Moderada (Interferiu, sem risco de vida)</option>
                  <option value="SEVERE">Grave (Hospitalização / Risco de Morte)</option>
                  <option value="FATAL">Fatal (Óbito)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Desfecho do Evento *</label>
                <select
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  value={pvOutcome}
                  onChange={(e) => setPvOutcome(e.target.value as any)}
                >
                  <option value="RECOVERED">Recuperado totalmente</option>
                  <option value="RECOVERING">Em processo de recuperação</option>
                  <option value="PERSISTING">Persistente / Sequelas</option>
                  <option value="UNKNOWN">Desconhecido</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Descrição Detalhada do Evento Adverso *</label>
              <textarea
                rows={3}
                className="w-full border border-slate-300 rounded p-2.5 text-sm"
                value={pvDescription}
                onChange={(e) => setPvDescription(e.target.value)}
                placeholder="Descreva sintomas, tempo decorrido após tomada, intervenções médicas realizadas..."
                required
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={loading}
                className="bg-red-600 text-white font-semibold px-6 py-2.5 rounded hover:bg-red-700 shadow-sm transition-colors text-sm"
              >
                Registrar Notificação Sanitária
              </button>
            </div>
          </form>

          {/* Listagem de Farmacovigilância */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
            <h3 className="text-sm font-bold text-slate-700 mb-3">Notificações Registradas</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-semibold text-left">
                    <th className="p-3">Protocolo Sanitário</th>
                    <th className="p-3">Paciente</th>
                    <th className="p-3">Medicamento</th>
                    <th className="p-3">Gravidade</th>
                    <th className="p-3">Data</th>
                    <th className="p-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pharmacovigilanceList.map((pv) => (
                    <tr key={pv.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-slate-800">{pv.notivisaProtocolNumber}</td>
                      <td className="p-3">{pv.patientName}</td>
                      <td className="p-3 font-medium">{pv.suspectMedication}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded font-bold ${
                            pv.severityLevel === 'SEVERE' || pv.severityLevel === 'FATAL'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {pv.severityLevel}
                        </span>
                      </td>
                      <td className="p-3 text-slate-500">{pv.createdAt?.substring(0, 10)}</td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleExportSanitary(pv.id!)}
                          className="bg-slate-100 text-slate-700 font-medium px-2.5 py-1 rounded hover:bg-slate-200"
                        >
                          Exportar JSON
                        </button>
                      </td>
                    </tr>
                  ))}
                  {pharmacovigilanceList.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-slate-400">
                        Nenhuma notificação de farmacovigilância registrada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo da Aba 5: Histórico & DSF Emitidas */}
      {activeTab === 'history' && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-bold text-slate-800">Histórico de Atendimentos Farmacêuticos & DSFs</h2>
            <button
              onClick={refreshHistory}
              className="text-xs bg-slate-100 text-slate-600 font-semibold px-3 py-1.5 rounded hover:bg-slate-200"
            >
              Atualizar
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold text-left">
                  <th className="p-3">DSF / Código</th>
                  <th className="p-3">Paciente</th>
                  <th className="p-3">CPF</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Data</th>
                  <th className="p-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {attendancesHistory.map((att) => (
                  <tr key={att.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-bold text-emerald-700">
                      {att.dsfNumber || att.attendanceCode}
                    </td>
                    <td className="p-3 font-medium text-slate-800">{att.patientName}</td>
                    <td className="p-3 text-slate-600">{att.patientCpf}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded font-bold ${
                          att.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : att.status === 'IN_PROGRESS'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {att.status}
                      </span>
                    </td>
                    <td className="p-3 text-slate-500">{att.createdAt?.substring(0, 16)}</td>
                    <td className="p-3 text-right">
                      {att.status === 'COMPLETED' && (
                        <button
                          onClick={() => handleViewDsf(att.id!)}
                          className="bg-emerald-50 text-emerald-700 border border-emerald-300 font-semibold px-2.5 py-1 rounded hover:bg-emerald-100"
                        >
                          Ver DSF (2 Vias)
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {attendancesHistory.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-slate-400">
                      Nenhum atendimento clínico localizado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal / Visualizador Térmico da DSF em 2 Vias */}
      {dsfModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-base">Declaração de Serviço Farmacêutico (DSF)</h3>
                <p className="text-xs text-slate-500">Documento Oficial Sanitário (RDC 44/2009 & RDC 777/2023)</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveDsfCopy('patient')}
                  className={`text-xs px-3 py-1.5 rounded font-semibold ${
                    activeDsfCopy === 'patient'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  1ª Via: Paciente
                </button>
                <button
                  onClick={() => setActiveDsfCopy('pharmacy')}
                  className={`text-xs px-3 py-1.5 rounded font-semibold ${
                    activeDsfCopy === 'pharmacy'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  2ª Via: Estabelecimento
                </button>
                <button
                  onClick={() => setDsfModal(null)}
                  className="text-slate-400 hover:text-slate-600 text-lg font-bold ml-2"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-4 overflow-y-auto bg-slate-100 flex-1">
              <pre className="font-mono text-xs bg-white p-4 rounded border border-slate-300 shadow-inner whitespace-pre leading-relaxed text-slate-800">
                {activeDsfCopy === 'patient' ? dsfModal.patientCopy : dsfModal.pharmacyCopy}
              </pre>
            </div>

            <div className="p-4 border-t border-slate-200 flex justify-between items-center bg-slate-50">
              <span className="text-xs text-slate-500 font-mono">DSF: {dsfModal.dsfNumber}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="bg-emerald-600 text-white font-semibold text-xs px-4 py-2 rounded hover:bg-emerald-700"
                >
                  Imprimir Comprovante Térmico
                </button>
                <button
                  onClick={() => setDsfModal(null)}
                  className="bg-slate-200 text-slate-700 font-semibold text-xs px-4 py-2 rounded hover:bg-slate-300"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClinicalConsultingPage;
