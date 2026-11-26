import React, { useState, useEffect, useCallback } from 'react';
import { assistanceApi } from '../services/api';
import type {
  PharmaceuticalStaff,
  PharmaceuticalShift,
  PharmaceuticalLogbookEntry,
  AssistanceKpis,
  PharmaceuticalRole,
  LogbookEntryType,
} from '../types/pharmaceutical-assistance';

export const PharmaceuticalAssistancePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'STAFF' | 'SHIFTS' | 'LOGBOOK'>('STAFF');
  const [kpis, setKpis] = useState<AssistanceKpis | null>(null);
  const [staffList, setStaffList] = useState<PharmaceuticalStaff[]>([]);
  const [shifts, setShifts] = useState<Array<PharmaceuticalShift & { staff_name?: string; crf?: string }>>([]);
  const [logbook, setLogbook] = useState<Array<PharmaceuticalLogbookEntry & { staff_name?: string; crf?: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal Novo Farmacêutico
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [staffName, setStaffName] = useState('');
  const [staffCpf, setStaffCpf] = useState('');
  const [staffCrfNumber, setStaffCrfNumber] = useState('');
  const [staffCrfUf, setStaffCrfUf] = useState('SP');
  const [staffRole, setStaffRole] = useState<PharmaceuticalRole>('RT_TITULAR');
  const [staffCrtNumber, setStaffCrtNumber] = useState('');
  const [staffCrtDate, setStaffCrtDate] = useState('');

  // Modal Nova Ocorrência
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [logStaffId, setLogStaffId] = useState<number | ''>('');
  const [logType, setLogType] = useState<LogbookEntryType>('INSPECTION_CRF');
  const [logTitle, setLogTitle] = useState('');
  const [logDescription, setLogDescription] = useState('');
  const [logInspectorName, setLogInspectorName] = useState('');
  const [logTermNumber, setLogTermNumber] = useState('');
  const [logActionTaken, setLogActionTaken] = useState('');

  // Modal Extrato de Fiscalização
  const [isExtractModalOpen, setIsExtractModalOpen] = useState(false);
  const [extractData, setExtractData] = useState<any | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [kpisRes, staffRes, shiftsRes, logsRes] = await Promise.all([
        assistanceApi.getKpis(1),
        assistanceApi.getStaff(1),
        assistanceApi.getShifts(1),
        assistanceApi.getLogbook(1, 50),
      ]);
      setKpis(kpisRes);
      setStaffList(staffRes);
      setShifts(shiftsRes);
      setLogbook(logsRes);
      if (staffRes.length > 0 && !logStaffId) {
        setLogStaffId(staffRes[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Falha ao carregar dados da assistência farmacêutica');
    } finally {
      setLoading(false);
    }
  }, [logStaffId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRegisterStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    try {
      await assistanceApi.registerStaff({
        store_id: 1,
        name: staffName,
        cpf: staffCpf,
        crf_number: staffCrfNumber,
        crf_uf: staffCrfUf,
        role: staffRole,
        crt_certificate_number: staffCrtNumber || undefined,
        crt_validity_date: staffCrtDate || undefined,
      });
      setSuccessMsg('Profissional farmacêutico cadastrado com sucesso!');
      setIsStaffModalOpen(false);
      setStaffName('');
      setStaffCpf('');
      setStaffCrfNumber('');
      setStaffCrtNumber('');
      setStaffCrtDate('');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Erro ao registrar profissional');
    }
  };

  const handleCreateLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logStaffId) return;
    setError(null);
    setSuccessMsg(null);
    try {
      await assistanceApi.recordLogbook({
        store_id: 1,
        staff_id: Number(logStaffId),
        entry_type: logType,
        title: logTitle,
        description: logDescription,
        crf_inspector_name: logInspectorName || undefined,
        crf_inspection_term_number: logTermNumber || undefined,
        action_taken: logActionTaken || undefined,
      });
      setSuccessMsg('Ocorrência registrada no Livro Eletrônico com Hash SHA-256!');
      setIsLogModalOpen(false);
      setLogTitle('');
      setLogDescription('');
      setLogInspectorName('');
      setLogTermNumber('');
      setLogActionTaken('');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Erro ao registrar ocorrência');
    }
  };

  const handleOpenExtract = async () => {
    setError(null);
    try {
      const data = await assistanceApi.getExtract(1);
      setExtractData(data);
      setIsExtractModalOpen(true);
    } catch (err: any) {
      setError(err.message || 'Erro ao emitir extrato fiscalizatório');
    }
  };

  const dayNames = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

  return (
    <div className="container mx-auto p-4 space-y-6" data-testid="pharmaceutical-assistance-page">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-lg shadow border-l-4 border-emerald-600">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <span className="p-2 bg-emerald-100 text-emerald-800 rounded-md">💊</span>
            Assistência Farmacêutica Integral & Livro do Farmacêutico RT
          </h1>
          <p className="text-gray-600 mt-1">
            Conformidade obrigatória com a <strong>Lei Federal nº 13.021/2014</strong>, <strong>RDC 44/2009 ANVISA</strong> e fiscalizações do <strong>CRF/CFF</strong>.
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex gap-2">
          <button
            onClick={handleOpenExtract}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow flex items-center gap-1"
            data-testid="btn-open-extract"
          >
            📋 Extrato Fiscal CRF/VISA
          </button>
          <button
            onClick={() => setIsLogModalOpen(true)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg shadow flex items-center gap-1"
            data-testid="btn-open-log-modal"
          >
            ✍️ Nova Ocorrência RT
          </button>
          <button
            onClick={() => setIsStaffModalOpen(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg shadow flex items-center gap-1"
            data-testid="btn-open-staff-modal"
          >
            + Cadastrar Farmacêutico
          </button>
        </div>
      </div>

      {/* Alertas */}
      {error && (
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg flex justify-between items-center" data-testid="alert-error">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-700 font-bold">×</button>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg flex justify-between items-center" data-testid="alert-success">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-green-700 font-bold">×</button>
        </div>
      )}

      {/* KPIs de Assistência Integral */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow border border-gray-150">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Responsável Técnico (RT)</p>
          <p className="text-xl font-bold text-gray-800 mt-1" data-testid="kpi-rt-name">
            {kpis?.hasActiveRT ? kpis.activeRtName : 'NENHUM RT ATIVO'}
          </p>
          <span className={`inline-block mt-2 px-2 py-0.5 text-xs rounded font-semibold ${kpis?.hasActiveRT ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {kpis?.hasActiveRT ? 'RT REGULARIZADO' : 'EXIGÊNCIA SANITÁRIA'}
          </span>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border border-gray-150">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Certidão de Regularidade (CRT)</p>
          <p className="text-lg font-bold text-gray-800 mt-1">
            {kpis?.crtCertificateNumber || 'Sem Certificado'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {kpis?.crtDaysRemaining !== undefined ? `Vencimento em ${kpis.crtDaysRemaining} dias` : 'Vigência não informada'}
          </p>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border border-gray-150">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Horas Semanais Cobertas</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1" data-testid="kpi-weekly-hours">
            {kpis?.totalWeeklyHoursCovered || 0}h / sem
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {kpis?.totalActivePharmacists || 0} profissional(is) cadastrado(s)
          </p>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border border-gray-150">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Livro de Ocorrências</p>
          <p className="text-2xl font-bold text-purple-600 mt-1" data-testid="kpi-total-entries">
            {kpis?.totalLogbookEntries || 0}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {kpis?.recentInspectionsCount || 0} termo(s) de inspeção oficial
          </p>
        </div>
      </div>

      {/* Navegação por Abas */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('STAFF')}
          className={`py-3 px-6 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'STAFF'
              ? 'border-emerald-600 text-emerald-600 font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          data-testid="tab-staff"
        >
          Farmacêuticos & Responsabilidade Técnica ({staffList.length})
        </button>
        <button
          onClick={() => setActiveTab('SHIFTS')}
          className={`py-3 px-6 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'SHIFTS'
              ? 'border-emerald-600 text-emerald-600 font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          data-testid="tab-shifts"
        >
          Grade de Escalas Horárias ({shifts.length})
        </button>
        <button
          onClick={() => setActiveTab('LOGBOOK')}
          className={`py-3 px-6 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'LOGBOOK'
              ? 'border-emerald-600 text-emerald-600 font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          data-testid="tab-logbook"
        >
          Livro Eletrônico de Ocorrências Sanitárias ({logbook.length})
        </button>
      </div>

      {/* Conteúdo das Abas */}
      {activeTab === 'STAFF' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Profissional</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CPF</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CRF</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Papel Regulatório</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CRT / Vigência</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {staffList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Nenhum profissional farmacêutico cadastrado ainda.
                  </td>
                </tr>
              ) : (
                staffList.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50" data-testid={`staff-row-${s.id}`}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{s.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{s.cpf}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{s.crf_number}/{s.crf_uf}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        s.role === 'RT_TITULAR' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {s.role === 'RT_TITULAR' ? 'RT TITULAR' : s.role === 'RT_SUBSTITUTO' ? 'RT SUBSTITUTO' : 'ASSISTENTE'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {s.crt_certificate_number ? `${s.crt_certificate_number} (${s.crt_validity_date || 's/ validade'})` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${s.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                        {s.is_active ? 'ATIVO' : 'INATIVO'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'SHIFTS' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dia da Semana</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Farmacêutico Responsável</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CRF</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Horário de Entrada</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Horário de Saída</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {shifts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    Nenhuma escala semanal configurada.
                  </td>
                </tr>
              ) : (
                shifts.map((sh) => (
                  <tr key={sh.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{dayNames[sh.day_of_week]}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sh.staff_name || `Farmacêutico #${sh.staff_id}`}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sh.crf || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-emerald-700">{sh.start_time}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-emerald-700">{sh.end_time}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'LOGBOOK' && (
        <div className="space-y-4">
          {logbook.length === 0 ? (
            <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
              Nenhuma ocorrência registrada no livro até o momento.
            </div>
          ) : (
            logbook.map((entry) => (
              <div key={entry.id} className="bg-white p-5 rounded-lg shadow border-l-4 border-purple-500 space-y-2" data-testid={`log-entry-${entry.id}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <span className="px-2 py-0.5 text-xs font-bold rounded bg-purple-100 text-purple-800 mr-2">
                      {entry.entry_type}
                    </span>
                    <h3 className="text-lg font-bold text-gray-900 inline">{entry.title}</h3>
                  </div>
                  <span className="text-xs text-gray-500 font-mono">{entry.entry_date}</span>
                </div>
                <p className="text-gray-700 text-sm">{entry.description}</p>
                {entry.crf_inspection_term_number && (
                  <p className="text-xs text-blue-700 font-medium">
                    Termo de Inspeção: {entry.crf_inspection_term_number} | Fiscal: {entry.crf_inspector_name || 'Não informado'}
                  </p>
                )}
                {entry.action_taken && (
                  <p className="text-xs text-emerald-700 bg-emerald-50 p-2 rounded">
                    <strong>Providência Adotada:</strong> {entry.action_taken}
                  </p>
                )}
                <div className="pt-2 border-t border-gray-100 flex justify-between items-center text-xs text-gray-500 font-mono">
                  <span>Farmacêutico: {entry.staff_name} ({entry.crf})</span>
                  <span title="Assinatura Criptográfica SHA-256">Hash: {entry.sha256_hash.substring(0, 20)}...</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal Cadastro de Farmacêutico */}
      {isStaffModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4">
            <h2 className="text-xl font-bold text-gray-800">Cadastrar Profissional Farmacêutico</h2>
            <form onSubmit={handleRegisterStaff} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  className="w-full border rounded p-2 text-sm"
                  placeholder="ex: Dra. Juliana Fernandes"
                  data-testid="input-staff-name"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-600">CPF</label>
                  <input
                    type="text"
                    required
                    value={staffCpf}
                    onChange={(e) => setStaffCpf(e.target.value)}
                    className="w-full border rounded p-2 text-sm"
                    placeholder="000.000.000-00"
                    data-testid="input-staff-cpf"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600">Papel Regulatório</label>
                  <select
                    value={staffRole}
                    onChange={(e) => setStaffRole(e.target.value as PharmaceuticalRole)}
                    className="w-full border rounded p-2 text-sm"
                    data-testid="select-staff-role"
                  >
                    <option value="RT_TITULAR">RT Titular</option>
                    <option value="RT_SUBSTITUTO">RT Substituto</option>
                    <option value="FARMACEUTICO_ASSISTENTE">Farmacêutico Assistente</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-600">Nº do CRF</label>
                  <input
                    type="text"
                    required
                    value={staffCrfNumber}
                    onChange={(e) => setStaffCrfNumber(e.target.value)}
                    className="w-full border rounded p-2 text-sm"
                    placeholder="12345"
                    data-testid="input-staff-crf"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600">UF do CRF</label>
                  <input
                    type="text"
                    required
                    maxLength={2}
                    value={staffCrfUf}
                    onChange={(e) => setStaffCrfUf(e.target.value.toUpperCase())}
                    className="w-full border rounded p-2 text-sm"
                    data-testid="input-staff-uf"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-600">Nº da CRT</label>
                  <input
                    type="text"
                    value={staffCrtNumber}
                    onChange={(e) => setStaffCrtNumber(e.target.value)}
                    className="w-full border rounded p-2 text-sm"
                    placeholder="CRT-SP-2026-99"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600">Validade da CRT</label>
                  <input
                    type="date"
                    value={staffCrtDate}
                    onChange={(e) => setStaffCrtDate(e.target.value)}
                    className="w-full border rounded p-2 text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setIsStaffModalOpen(false)}
                  className="px-4 py-2 border rounded text-gray-600 text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white rounded text-sm font-bold"
                  data-testid="btn-submit-staff"
                >
                  Salvar Farmacêutico
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Nova Ocorrência RT */}
      {isLogModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4">
            <h2 className="text-xl font-bold text-gray-800">Registrar no Livro de Ocorrências RT</h2>
            <form onSubmit={handleCreateLog} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600">Farmacêutico Declarante</label>
                <select
                  required
                  value={logStaffId}
                  onChange={(e) => setLogStaffId(Number(e.target.value))}
                  className="w-full border rounded p-2 text-sm"
                  data-testid="select-log-staff"
                >
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.crf_number}/{s.crf_uf})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600">Tipo de Ocorrência</label>
                <select
                  value={logType}
                  onChange={(e) => setLogType(e.target.value as LogbookEntryType)}
                  className="w-full border rounded p-2 text-sm"
                  data-testid="select-log-type"
                >
                  <option value="INSPECTION_CRF">Fiscalização Presencial CRF</option>
                  <option value="INSPECTION_VISA">Fiscalização Vigilância Sanitária (VISA)</option>
                  <option value="TEMPERATURE_EXCURSION">Desvio de Temperatura Termolábeis</option>
                  <option value="RECALL_ALERT">Recolhimento / Alerta Sanitário de Lote</option>
                  <option value="TECHNICAL_COMPLAINT">Queixa Técnica Farmacêutica</option>
                  <option value="DISPENSATION_INCIDENT">Incidente na Dispensação de Controlados</option>
                  <option value="GENERAL_OCCURRENCE">Ocorrência Sanitária Geral</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600">Título</label>
                <input
                  type="text"
                  required
                  value={logTitle}
                  onChange={(e) => setLogTitle(e.target.value)}
                  className="w-full border rounded p-2 text-sm"
                  placeholder="ex: Termo de Inspeção CRF/SP nº 4099"
                  data-testid="input-log-title"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600">Descrição Detalhada</label>
                <textarea
                  required
                  rows={3}
                  value={logDescription}
                  onChange={(e) => setLogDescription(e.target.value)}
                  className="w-full border rounded p-2 text-sm"
                  placeholder="Relato cronológico e técnico dos fatos..."
                  data-testid="input-log-description"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-600">Fiscal / Inspetor</label>
                  <input
                    type="text"
                    value={logInspectorName}
                    onChange={(e) => setLogInspectorName(e.target.value)}
                    className="w-full border rounded p-2 text-sm"
                    placeholder="Fiscal Fulano"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600">Nº do Termo / Notificação</label>
                  <input
                    type="text"
                    value={logTermNumber}
                    onChange={(e) => setLogTermNumber(e.target.value)}
                    className="w-full border rounded p-2 text-sm"
                    placeholder="Termo 1234/2026"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600">Providência Adotada</label>
                <input
                  type="text"
                  value={logActionTaken}
                  onChange={(e) => setLogActionTaken(e.target.value)}
                  className="w-full border rounded p-2 text-sm"
                  placeholder="ex: Regularização imediata do registro..."
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setIsLogModalOpen(false)}
                  className="px-4 py-2 border rounded text-gray-600 text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 text-white rounded text-sm font-bold"
                  data-testid="btn-submit-log"
                >
                  Assinar & Gravar com Hash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Extrato Fiscal CRF/VISA */}
      {isExtractModalOpen && extractData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto" data-testid="extract-modal">
            <div className="border-b pb-3">
              <h2 className="text-xl font-bold text-gray-800">Extrato Oficial do Livro de Ocorrências RT</h2>
              <p className="text-xs text-gray-500">Documento gerado para apresentação à fiscalização do CRF / Vigilância Sanitária</p>
            </div>
            <div className="bg-gray-50 p-3 rounded text-sm space-y-1">
              <p><strong>Estabelecimento:</strong> {extractData.store.name} (CNPJ: {extractData.store.cnpj})</p>
              <p><strong>Farmacêutico RT Titular:</strong> {extractData.rtStaff ? `${extractData.rtStaff.name} (CRF: ${extractData.rtStaff.crf_number}/${extractData.rtStaff.crf_uf})` : 'Não registrado'}</p>
              <p><strong>Total de Registros:</strong> {extractData.totalEntries}</p>
              <p className="font-mono text-xs text-gray-600"><strong>Hash de Autenticidade:</strong> {extractData.extractHash}</p>
            </div>
            <div className="space-y-3">
              {extractData.entries.map((item: any) => (
                <div key={item.id} className="border p-3 rounded text-sm space-y-1">
                  <div className="flex justify-between font-bold text-xs text-purple-700">
                    <span>{item.entry_type} - {item.title}</span>
                    <span className="font-mono">{item.entry_date}</span>
                  </div>
                  <p className="text-gray-700">{item.description}</p>
                  <p className="text-xs text-gray-500">Responsável: {item.staff_name} ({item.crf})</p>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <button
                onClick={() => setIsExtractModalOpen(false)}
                className="px-4 py-2 bg-gray-700 text-white rounded text-sm font-bold"
                data-testid="btn-close-extract"
              >
                Fechar Extrato
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PharmaceuticalAssistancePage;
