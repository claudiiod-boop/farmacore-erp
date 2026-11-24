import React, { useState, useEffect } from 'react';
import {
  InjectableAdministrationLog,
  VaccinationRecord,
  InjectablesVaccinationSummary,
  AdministrationRoute,
  VaccineDoseType,
} from '../types/injectables';
import { injectablesApi } from '../services/api';

export const InjectablesVaccinationPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'INJECTABLES' | 'VACCINES'>('INJECTABLES');
  const [summary, setSummary] = useState<InjectablesVaccinationSummary | null>(null);
  const [injectables, setInjectables] = useState<InjectableAdministrationLog[]>([]);
  const [vaccines, setVaccines] = useState<VaccinationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals
  const [isInjectModalOpen, setIsInjectModalOpen] = useState(false);
  const [newInjectable, setNewInjectable] = useState({
    patientName: '',
    patientCpf: '',
    patientBirthDate: '',
    patientPhone: '',
    medicationName: '',
    medicationDosage: '',
    medicationBatch: '',
    medicationExpirationDate: '',
    syringeNeedleBatch: '',
    administrationRoute: 'INTRAMUSCULAR' as AdministrationRoute,
    anatomicalSite: 'Deltoide Direito',
    prescriberName: '',
    prescriberCrm: '',
    prescriberUf: 'SP',
    pharmacistName: '',
    pharmacistCrf: '',
    notes: '',
  });

  const [isVaccineModalOpen, setIsVaccineModalOpen] = useState(false);
  const [newVaccine, setNewVaccine] = useState({
    patientName: '',
    patientCpf: '',
    patientBirthDate: '',
    patientPhone: '',
    vaccineName: '',
    manufacturer: '',
    vaccineBatch: '',
    diluentBatch: '',
    vaccineExpirationDate: '',
    doseType: 'SINGLE_DOSE' as VaccineDoseType,
    administrationRoute: 'INTRAMUSCULAR' as AdministrationRoute,
    anatomicalSite: 'Deltoide Esquerdo',
    preTriageFever: false,
    preTriageAllergies: '',
    pharmacistName: '',
    pharmacistCrf: '',
  });

  const [eapvModalVacId, setEapvModalVacId] = useState<number | null>(null);
  const [eapvDescription, setEapvDescription] = useState('');

  const [viewDsfItem, setViewDsfItem] = useState<InjectableAdministrationLog | null>(null);
  const [viewCertItem, setViewCertItem] = useState<VaccinationRecord | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sum, inj, vac] = await Promise.all([
        injectablesApi.getSummary(),
        injectablesApi.getInjectables(),
        injectablesApi.getVaccines(),
      ]);
      setSummary(sum);
      setInjectables(inj || []);
      setVaccines(vac || []);
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Erro ao carregar registros.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateInjectable = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await injectablesApi.createInjectable(newInjectable);
      setFeedbackMsg({
        type: 'success',
        text: `Aplicação registrada com sucesso! Declaração gerada: ${created.declaration_number}`,
      });
      setIsInjectModalOpen(false);
      setNewInjectable({
        patientName: '',
        patientCpf: '',
        patientBirthDate: '',
        patientPhone: '',
        medicationName: '',
        medicationDosage: '',
        medicationBatch: '',
        medicationExpirationDate: '',
        syringeNeedleBatch: '',
        administrationRoute: 'INTRAMUSCULAR',
        anatomicalSite: 'Deltoide Direito',
        prescriberName: '',
        prescriberCrm: '',
        prescriberUf: 'SP',
        pharmacistName: '',
        pharmacistCrf: '',
        notes: '',
      });
      loadData();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Erro ao registrar aplicação.' });
    }
  };

  const handleCreateVaccine = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await injectablesApi.createVaccine(newVaccine);
      setFeedbackMsg({
        type: 'success',
        text: `Vacinação registrada com sucesso! Certificado gerado: ${created.certificate_code}`,
      });
      setIsVaccineModalOpen(false);
      setNewVaccine({
        patientName: '',
        patientCpf: '',
        patientBirthDate: '',
        patientPhone: '',
        vaccineName: '',
        manufacturer: '',
        vaccineBatch: '',
        diluentBatch: '',
        vaccineExpirationDate: '',
        doseType: 'SINGLE_DOSE',
        administrationRoute: 'INTRAMUSCULAR',
        anatomicalSite: 'Deltoide Esquerdo',
        preTriageFever: false,
        preTriageAllergies: '',
        pharmacistName: '',
        pharmacistCrf: '',
      });
      loadData();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Erro ao registrar vacinação.' });
    }
  };

  const handleExportSipni = async () => {
    try {
      const res = await injectablesApi.exportSipni();
      setFeedbackMsg({
        type: 'success',
        text: `Lote SI-PNI exportado com sucesso! ${res.exportedCount} registro(s) sincronizado(s).`,
      });
      loadData();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Erro ao exportar lote SI-PNI.' });
    }
  };

  const handleRecordEapv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eapvModalVacId || !eapvDescription.trim()) return;
    try {
      await injectablesApi.recordEapv(eapvModalVacId, eapvDescription.trim());
      setFeedbackMsg({ type: 'success', text: 'Evento adverso pós-vacinal (EAPV) registrado no prontuário!' });
      setEapvModalVacId(null);
      setEapvDescription('');
      loadData();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Erro ao registrar EAPV.' });
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* CABEÇALHO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span>💉</span> Livro Oficial de Injetáveis & Sala de Vacinas (RDC 197/2017 & RDC 44/2009)
          </h1>
          <p className="text-sm text-gray-500">
            Controle de administração de medicamentos injetáveis, vacinas humanas, lote de insumos e exportação SI-PNI.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsInjectModalOpen(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium shadow-sm flex items-center gap-1 text-sm"
          >
            <span>💉</span> Aplicar Injetável
          </button>
          <button
            onClick={() => setIsVaccineModalOpen(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium shadow-sm flex items-center gap-1 text-sm"
          >
            <span>🛡️</span> Aplicar Vacina
          </button>
          <button
            onClick={handleExportSipni}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium shadow-sm flex items-center gap-1 text-sm"
          >
            <span>📡</span> Exportar Lote SI-PNI
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

      {/* KPIS CONSOLIDADOS */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Injetáveis no Mês</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-extrabold text-indigo-600">{summary.totalInjectablesMonth}</span>
              <span className="text-xs font-medium text-gray-500">aplicações com DSF</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Guarda obrigatória de 5 anos (RDC 44)</p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Vacinas no Mês</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-extrabold text-emerald-600">{summary.totalVaccinesMonth}</span>
              <span className="text-xs font-medium text-gray-500">doses administradas</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Conforme calendário RDC 197/2017</p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Integração SI-PNI</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className={`text-3xl font-extrabold ${summary.sipniPendingCount > 0 ? 'text-amber-600' : 'text-gray-700'}`}>
                {summary.sipniPendingCount}
              </span>
              <span className="text-xs font-medium text-gray-500">lotes pendentes</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {summary.sipniPendingCount > 0 ? 'Requer exportação ao Ministério da Saúde' : 'Todas as doses exportadas'}
            </p>
          </div>
        </div>
      )}

      {/* NAVEGAÇÃO POR ABAS */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-6">
          <button
            onClick={() => setActiveTab('INJECTABLES')}
            className={`pb-3 text-sm font-medium border-b-2 ${
              activeTab === 'INJECTABLES' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            📋 Livro Oficial de Injetáveis ({injectables.length})
          </button>
          <button
            onClick={() => setActiveTab('VACCINES')}
            className={`pb-3 text-sm font-medium border-b-2 ${
              activeTab === 'VACCINES' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            🛡️ Sala de Vacinas & Imunobiológicos ({vaccines.length})
          </button>
        </nav>
      </div>

      {/* CONTEÚDO DAS ABAS */}
      {activeTab === 'INJECTABLES' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left">Declaração DSF</th>
                <th className="px-4 py-3 text-left">Data</th>
                <th className="px-4 py-3 text-left">Paciente</th>
                <th className="px-4 py-3 text-left">Medicamento & Dosagem</th>
                <th className="px-4 py-3 text-left">Lote / Insumo</th>
                <th className="px-4 py-3 text-left">Via / Local</th>
                <th className="px-4 py-3 text-left">Prescritor</th>
                <th className="px-4 py-3 text-left">RT Farmacêutico</th>
                <th className="px-4 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {injectables.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-gray-400">
                    Nenhum registro de aplicação de injetável encontrado.
                  </td>
                </tr>
              ) : (
                injectables.map((inj) => (
                  <tr key={inj.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono font-bold text-indigo-600">{inj.declaration_number}</td>
                    <td className="px-4 py-3 text-gray-600">{inj.administered_at.slice(0, 10)}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">{inj.patient_name}</div>
                      <div className="text-xs text-gray-400">CPF: {inj.patient_cpf}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-800">{inj.medication_name}</div>
                      <div className="text-xs text-gray-500">{inj.medication_dosage}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      <div>Lote: {inj.medication_batch} (Val: {inj.medication_expiration_date})</div>
                      <div>Seringa: {inj.syringe_needle_batch}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">
                      <span className="font-medium bg-gray-100 px-1.5 py-0.5 rounded">{inj.administration_route}</span>
                      <div className="mt-0.5">{inj.anatomical_site}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">
                      <div>{inj.prescriber_name}</div>
                      <div className="text-gray-400">{inj.prescriber_crm} ({inj.prescriber_uf})</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">
                      <div>{inj.pharmacist_name}</div>
                      <div className="text-gray-400">{inj.pharmacist_crf}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setViewDsfItem(inj)}
                        className="px-2 py-1 text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded border border-indigo-200"
                      >
                        Ver DSF
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'VACCINES' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left">Certificado</th>
                <th className="px-4 py-3 text-left">Data</th>
                <th className="px-4 py-3 text-left">Paciente</th>
                <th className="px-4 py-3 text-left">Vacina & Fabricante</th>
                <th className="px-4 py-3 text-left">Lote / Validade</th>
                <th className="px-4 py-3 text-left">Dose</th>
                <th className="px-4 py-3 text-left">Status SI-PNI</th>
                <th className="px-4 py-3 text-left">EAPV</th>
                <th className="px-4 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {vaccines.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-gray-400">
                    Nenhum registro de vacinação cadastrado.
                  </td>
                </tr>
              ) : (
                vaccines.map((vac) => (
                  <tr key={vac.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono font-bold text-emerald-700">{vac.certificate_code}</td>
                    <td className="px-4 py-3 text-gray-600">{vac.administered_at.slice(0, 10)}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">{vac.patient_name}</div>
                      <div className="text-xs text-gray-400">CPF: {vac.patient_cpf}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-800">{vac.vaccine_name}</div>
                      <div className="text-xs text-gray-500">{vac.manufacturer}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      <div>Lote: {vac.vaccine_batch}</div>
                      <div>Val: {vac.vaccine_expiration_date}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-800">
                        {vac.dose_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-bold ${
                          vac.sipni_status === 'EXPORTED'
                            ? 'bg-blue-100 text-blue-800'
                            : vac.sipni_status === 'ACCEPTED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {vac.sipni_status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {vac.eapv_adverse_event ? (
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800">
                          ⚠️ Registrado
                        </span>
                      ) : (
                        <button
                          onClick={() => setEapvModalVacId(vac.id)}
                          className="text-xs text-gray-500 hover:text-red-600 underline"
                        >
                          + Registrar
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setViewCertItem(vac)}
                        className="px-2 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded border border-emerald-200"
                      >
                        Carteira
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL NOVA APLICAÇÃO DE INJETÁVEL */}
      {isInjectModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span>💉</span> Registrar Aplicação de Medicamento Injetável (RDC 44/2009)
            </h2>
            <form onSubmit={handleCreateInjectable} className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-xs font-bold uppercase text-gray-500">1. Dados do Paciente</h3>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700">Nome do Paciente</label>
                    <input
                      type="text"
                      data-testid="patient-name-input"
                      value={newInjectable.patientName}
                      onChange={(e) => setNewInjectable({ ...newInjectable, patientName: e.target.value })}
                      className="w-full border rounded p-2 text-sm mt-1"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700">CPF do Paciente</label>
                    <input
                      type="text"
                      data-testid="patient-cpf-input"
                      value={newInjectable.patientCpf}
                      onChange={(e) => setNewInjectable({ ...newInjectable, patientCpf: e.target.value })}
                      placeholder="000.000.000-00"
                      className="w-full border rounded p-2 text-sm mt-1"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="border-b pb-2">
                <h3 className="text-xs font-bold uppercase text-gray-500">2. Medicamento & Insumos</h3>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700">Nome do Medicamento</label>
                    <input
                      type="text"
                      data-testid="medication-name-input"
                      value={newInjectable.medicationName}
                      onChange={(e) => setNewInjectable({ ...newInjectable, medicationName: e.target.value })}
                      placeholder="Ex: Benzetacil, Voltaren, Depo-Provera"
                      className="w-full border rounded p-2 text-sm mt-1"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700">Concentração / Dosagem</label>
                    <input
                      type="text"
                      data-testid="medication-dosage-input"
                      value={newInjectable.medicationDosage}
                      onChange={(e) => setNewInjectable({ ...newInjectable, medicationDosage: e.target.value })}
                      placeholder="Ex: 1.200.000 UI, 75mg/3mL"
                      className="w-full border rounded p-2 text-sm mt-1"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700">Lote do Medicamento</label>
                    <input
                      type="text"
                      data-testid="medication-batch-input"
                      value={newInjectable.medicationBatch}
                      onChange={(e) => setNewInjectable({ ...newInjectable, medicationBatch: e.target.value })}
                      className="w-full border rounded p-2 text-sm mt-1"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700">Data de Validade</label>
                    <input
                      type="date"
                      data-testid="medication-exp-input"
                      value={newInjectable.medicationExpirationDate}
                      onChange={(e) => setNewInjectable({ ...newInjectable, medicationExpirationDate: e.target.value })}
                      className="w-full border rounded p-2 text-sm mt-1"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700">Lote Seringa / Agulha</label>
                    <input
                      type="text"
                      data-testid="syringe-batch-input"
                      value={newInjectable.syringeNeedleBatch}
                      onChange={(e) => setNewInjectable({ ...newInjectable, syringeNeedleBatch: e.target.value })}
                      placeholder="Lote do insumo"
                      className="w-full border rounded p-2 text-sm mt-1"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="border-b pb-2">
                <h3 className="text-xs font-bold uppercase text-gray-500">3. Via & Prescrição</h3>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700">Via de Administração</label>
                    <select
                      value={newInjectable.administrationRoute}
                      onChange={(e) => setNewInjectable({ ...newInjectable, administrationRoute: e.target.value as AdministrationRoute })}
                      className="w-full border rounded p-2 text-sm mt-1"
                    >
                      <option value="INTRAMUSCULAR">Intramuscular (IM)</option>
                      <option value="INTRAVENOSA">Intravenosa (IV)</option>
                      <option value="SUBCUTANEA">Subcutânea (SC)</option>
                      <option value="INTRADERMICA">Intradérmica (ID)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700">Local Anatômico</label>
                    <input
                      type="text"
                      data-testid="anatomical-site-input"
                      value={newInjectable.anatomicalSite}
                      onChange={(e) => setNewInjectable({ ...newInjectable, anatomicalSite: e.target.value })}
                      placeholder="Ex: Deltoide Direito, Glúteo"
                      className="w-full border rounded p-2 text-sm mt-1"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700">Nome do Prescritor</label>
                    <input
                      type="text"
                      data-testid="prescriber-name-input"
                      value={newInjectable.prescriberName}
                      onChange={(e) => setNewInjectable({ ...newInjectable, prescriberName: e.target.value })}
                      placeholder="Dr(a)..."
                      className="w-full border rounded p-2 text-sm mt-1"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700">CRM / Registro</label>
                    <input
                      type="text"
                      data-testid="prescriber-crm-input"
                      value={newInjectable.prescriberCrm}
                      onChange={(e) => setNewInjectable({ ...newInjectable, prescriberCrm: e.target.value })}
                      placeholder="123456"
                      className="w-full border rounded p-2 text-sm mt-1"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700">UF do CRM</label>
                    <input
                      type="text"
                      data-testid="prescriber-uf-input"
                      value={newInjectable.prescriberUf}
                      onChange={(e) => setNewInjectable({ ...newInjectable, prescriberUf: e.target.value.toUpperCase() })}
                      maxLength={2}
                      className="w-full border rounded p-2 text-sm mt-1"
                      required
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase text-gray-500">4. Farmacêutico Aplicador</h3>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700">Nome do Farmacêutico</label>
                    <input
                      type="text"
                      data-testid="pharmacist-name-input"
                      value={newInjectable.pharmacistName}
                      onChange={(e) => setNewInjectable({ ...newInjectable, pharmacistName: e.target.value })}
                      className="w-full border rounded p-2 text-sm mt-1"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700">CRF do Farmacêutico</label>
                    <input
                      type="text"
                      data-testid="pharmacist-crf-input"
                      value={newInjectable.pharmacistCrf}
                      onChange={(e) => setNewInjectable({ ...newInjectable, pharmacistCrf: e.target.value })}
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
                  onClick={() => setIsInjectModalOpen(false)}
                  className="px-4 py-2 border rounded text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-semibold"
                >
                  Confirmar e Gerar DSF
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL NOVA VACINAÇÃO */}
      {isVaccineModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span>🛡️</span> Registrar Vacinação (RDC 197/2017)
            </h2>
            <form onSubmit={handleCreateVaccine} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-700">Nome do Vacinado</label>
                  <input
                    type="text"
                    value={newVaccine.patientName}
                    onChange={(e) => setNewVaccine({ ...newVaccine, patientName: e.target.value })}
                    className="w-full border rounded p-2 text-sm mt-1"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700">Data de Nascimento</label>
                  <input
                    type="date"
                    value={newVaccine.patientBirthDate}
                    onChange={(e) => setNewVaccine({ ...newVaccine, patientBirthDate: e.target.value })}
                    className="w-full border rounded p-2 text-sm mt-1"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700">CPF do Vacinado</label>
                  <input
                    type="text"
                    value={newVaccine.patientCpf}
                    onChange={(e) => setNewVaccine({ ...newVaccine, patientCpf: e.target.value })}
                    className="w-full border rounded p-2 text-sm mt-1"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700">Telefone / Contato</label>
                  <input
                    type="text"
                    value={newVaccine.patientPhone}
                    onChange={(e) => setNewVaccine({ ...newVaccine, patientPhone: e.target.value })}
                    className="w-full border rounded p-2 text-sm mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700">Vacina / Antígeno</label>
                  <input
                    type="text"
                    value={newVaccine.vaccineName}
                    onChange={(e) => setNewVaccine({ ...newVaccine, vaccineName: e.target.value })}
                    placeholder="Ex: Gripe Tetravalente, HPV, Herpes Zoster"
                    className="w-full border rounded p-2 text-sm mt-1"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700">Fabricante</label>
                  <input
                    type="text"
                    value={newVaccine.manufacturer}
                    onChange={(e) => setNewVaccine({ ...newVaccine, manufacturer: e.target.value })}
                    placeholder="Ex: Sanofi, GSK, Pfizer, Butantan"
                    className="w-full border rounded p-2 text-sm mt-1"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700">Lote da Vacina</label>
                  <input
                    type="text"
                    value={newVaccine.vaccineBatch}
                    onChange={(e) => setNewVaccine({ ...newVaccine, vaccineBatch: e.target.value })}
                    className="w-full border rounded p-2 text-sm mt-1"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700">Data de Validade</label>
                  <input
                    type="date"
                    value={newVaccine.vaccineExpirationDate}
                    onChange={(e) => setNewVaccine({ ...newVaccine, vaccineExpirationDate: e.target.value })}
                    className="w-full border rounded p-2 text-sm mt-1"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700">Esquema / Dose</label>
                  <select
                    value={newVaccine.doseType}
                    onChange={(e) => setNewVaccine({ ...newVaccine, doseType: e.target.value as VaccineDoseType })}
                    className="w-full border rounded p-2 text-sm mt-1"
                  >
                    <option value="SINGLE_DOSE">Dose Única</option>
                    <option value="DOSE_1">1ª Dose</option>
                    <option value="DOSE_2">2ª Dose</option>
                    <option value="DOSE_3">3ª Dose</option>
                    <option value="REFRACTORY_BOOSTER">Reforço Anual</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-gray-50 border rounded space-y-2">
                <span className="text-xs font-bold uppercase text-gray-600">Triagem Clínica Pré-Vacinal</span>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="triageFever"
                    checked={newVaccine.preTriageFever}
                    onChange={(e) => setNewVaccine({ ...newVaccine, preTriageFever: e.target.checked })}
                    className="rounded text-emerald-600"
                  />
                  <label htmlFor="triageFever" className="text-xs text-gray-700">
                    Paciente apresenta estado febril no momento (temperatura &gt; 37.8°C)
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700">Farmacêutico Responsável</label>
                  <input
                    type="text"
                    value={newVaccine.pharmacistName}
                    onChange={(e) => setNewVaccine({ ...newVaccine, pharmacistName: e.target.value })}
                    className="w-full border rounded p-2 text-sm mt-1"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700">CRF do Farmacêutico</label>
                  <input
                    type="text"
                    value={newVaccine.pharmacistCrf}
                    onChange={(e) => setNewVaccine({ ...newVaccine, pharmacistCrf: e.target.value })}
                    placeholder="CRF-SP 12345"
                    className="w-full border rounded p-2 text-sm mt-1"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsVaccineModalOpen(false)}
                  className="px-4 py-2 border rounded text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-sm font-semibold"
                >
                  Registrar e Emitir Carteira
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL REGISTRAR EAPV */}
      {eapvModalVacId !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Registrar Evento Adverso Pós-Vacinal (EAPV)</h2>
            <p className="text-xs text-gray-500">
              Descreva os sintomas apresentados pelo paciente para registro formal no prontuário e farmacovigilância.
            </p>
            <form onSubmit={handleRecordEapv} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700">Descrição do Evento</label>
                <textarea
                  value={eapvDescription}
                  onChange={(e) => setEapvDescription(e.target.value)}
                  rows={4}
                  placeholder="Ex: Cefaleia moderada, mialgia ou febre 12h após imunização"
                  className="w-full border rounded p-2 text-sm mt-1"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEapvModalVacId(null)}
                  className="px-3 py-1.5 border rounded text-xs text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold"
                >
                  Salvar EAPV
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL VISUALIZAÇÃO DSF */}
      {viewDsfItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="border-b pb-3 flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold text-gray-900">DECLARAÇÃO DE SERVIÇO FARMACÊUTICO (DSF)</h2>
                <p className="text-xs text-gray-500">Administração de Medicamentos Injetáveis (RDC 44/2009)</p>
              </div>
              <span className="font-mono font-bold text-sm text-indigo-700">{viewDsfItem.declaration_number}</span>
            </div>

            <div className="text-xs space-y-2 text-gray-700 bg-gray-50 p-3 rounded border">
              <div><strong>Paciente:</strong> {viewDsfItem.patient_name} (CPF: {viewDsfItem.patient_cpf})</div>
              <div><strong>Medicamento:</strong> {viewDsfItem.medication_name} ({viewDsfItem.medication_dosage})</div>
              <div><strong>Lote:</strong> {viewDsfItem.medication_batch} | <strong>Validade:</strong> {viewDsfItem.medication_expiration_date}</div>
              <div><strong>Insumo (Seringa/Agulha):</strong> {viewDsfItem.syringe_needle_batch}</div>
              <div><strong>Via / Sítio:</strong> {viewDsfItem.administration_route} - {viewDsfItem.anatomical_site}</div>
              <div><strong>Prescritor:</strong> {viewDsfItem.prescriber_name} (CRM: {viewDsfItem.prescriber_crm}/{viewDsfItem.prescriber_uf})</div>
              <div><strong>Farmacêutico RT:</strong> {viewDsfItem.pharmacist_name} ({viewDsfItem.pharmacist_crf})</div>
              <div><strong>Data / Hora:</strong> {viewDsfItem.administered_at}</div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setViewDsfItem(null)}
                className="px-4 py-2 border rounded text-xs text-gray-600 hover:bg-gray-50"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL VISUALIZAÇÃO CARTEIRA DE VACINAÇÃO */}
      {viewCertItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="border-b pb-3 flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold text-gray-900">COMPROVANTE DE VACINAÇÃO HUMANA</h2>
                <p className="text-xs text-gray-500">RDC 197/2017 & Integração SI-PNI</p>
              </div>
              <span className="font-mono font-bold text-sm text-emerald-700">{viewCertItem.certificate_code}</span>
            </div>

            <div className="text-xs space-y-2 text-gray-700 bg-emerald-50/50 p-3 rounded border border-emerald-200">
              <div><strong>Cidadão Vacinado:</strong> {viewCertItem.patient_name} (CPF: {viewCertItem.patient_cpf})</div>
              <div><strong>Nascimento:</strong> {viewCertItem.patient_birth_date}</div>
              <div><strong>Imunobiológico:</strong> {viewCertItem.vaccine_name}</div>
              <div><strong>Fabricante:</strong> {viewCertItem.manufacturer}</div>
              <div><strong>Lote:</strong> {viewCertItem.vaccine_batch} | <strong>Validade:</strong> {viewCertItem.vaccine_expiration_date}</div>
              <div><strong>Dose Administrada:</strong> {viewCertItem.dose_type}</div>
              <div><strong>Farmacêutico Aplicador:</strong> {viewCertItem.pharmacist_name} ({viewCertItem.pharmacist_crf})</div>
              <div><strong>Status SI-PNI:</strong> {viewCertItem.sipni_status}</div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setViewCertItem(null)}
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
