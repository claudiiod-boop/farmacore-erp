import React, { useState, useEffect, useCallback } from 'react';
import {
  Thermometer,
  Droplets,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
  Plus,
  RefreshCw,
  FileText,
  ShieldAlert,
  Calendar,
  Layers,
  Search,
  Activity,
  ClipboardCheck,
  Building2,
  Sparkles
} from 'lucide-react';
import { temperatureApi } from '../services/api';
import type {
  TemperatureSensor,
  TemperatureReading,
  TemperatureExcursion,
  TemperatureRound,
  TemperatureKpis,
  SensorLocationType,
  RoundShift
} from '../types';

export const TemperatureMonitoringPage: React.FC = () => {
  const [storeId] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'SECTOR_ROUNDS' | 'SENSORS' | 'READING_ENTRY' | 'EXCURSIONS' | 'AUDIT_LOG'>('SECTOR_ROUNDS');

  // KPIs
  const [kpis, setKpis] = useState<TemperatureKpis>({
    active_sensors_count: 0,
    open_excursions_count: 0,
    current_fridge_temp: null,
    current_sales_floor_temp: null,
    current_sales_floor_humidity: null,
    cold_chain_status: 'NO_DATA',
    ambient_status: 'NO_DATA',
  });

  // Sensores
  const [sensors, setSensors] = useState<TemperatureSensor[]>([]);
  const [selectedSensorId, setSelectedSensorId] = useState<number | null>(null);

  // Rondas Multissetoriais
  const [rounds, setRounds] = useState<TemperatureRound[]>([]);
  const [roundShift, setRoundShift] = useState<RoundShift>('MORNING');
  const [roundConductedBy, setRoundConductedBy] = useState('Farmacêutico RT');
  const [roundNotes, setRoundNotes] = useState('');
  const [roundInputs, setRoundInputs] = useState<Record<number, { temp: string; humidity: string }>>({});
  const [isSubmittingRound, setIsSubmittingRound] = useState(false);
  const [isSeedingSectors, setIsSeedingSectors] = useState(false);

  // Leituras (Histórico)
  const [readings, setReadings] = useState<TemperatureReading[]>([]);
  const [auditSensorId, setAuditSensorId] = useState<number>(1);

  // Excursões
  const [excursions, setExcursions] = useState<TemperatureExcursion[]>([]);
  const [excursionFilter, setExcursionFilter] = useState<'ALL' | 'OPEN' | 'RESOLVED'>('OPEN');

  // Modal de Resolução de Excursão
  const [resolvingExcursion, setResolvingExcursion] = useState<TemperatureExcursion | null>(null);
  const [actionTaken, setActionTaken] = useState('');
  const [pharmacistCrf, setPharmacistCrf] = useState('CRF-SP 98765');
  const [isSubmittingResolve, setIsSubmittingResolve] = useState(false);

  // Formulário de Cadastro de Sensor
  const [showAddSensorModal, setShowAddSensorModal] = useState(false);
  const [sensorName, setSensorName] = useState('');
  const [sensorLocationType, setSensorLocationType] = useState<SensorLocationType>('REFRIGERATOR_COLD_CHAIN');
  const [sensorSectorCode, setSensorSectorCode] = useState('HALL_MEDICAMENTOS');
  const [sensorFloorLocation, setSensorFloorLocation] = useState('TÉRREO BALCÃO');
  const [sensorSerial, setSensorSerial] = useState('');
  const [sensorCert, setSensorCert] = useState('');
  const [sensorDueDate, setSensorDueDate] = useState('');
  const [customMinTemp, setCustomMinTemp] = useState('');
  const [customMaxTemp, setCustomMaxTemp] = useState('');

  // Formulário de Registro de Leitura Avulsa
  const [readingTemp, setReadingTemp] = useState('');
  const [readingHumidity, setReadingHumidity] = useState('');
  const [readingRecordedBy, setReadingRecordedBy] = useState('Farmacêutico RT');
  const [readingNotes, setReadingNotes] = useState('');
  const [isSubmittingReading, setIsSubmittingReading] = useState(false);

  // Mensagens de feedback
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showFeedback = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadData = useCallback(async () => {
    try {
      const [kpisData, sensorsData, excursionsData, roundsData] = await Promise.all([
        temperatureApi.getKpis(storeId),
        temperatureApi.getSensors(storeId),
        temperatureApi.getExcursions(storeId, excursionFilter === 'ALL' ? undefined : excursionFilter),
        temperatureApi.getRounds ? temperatureApi.getRounds(storeId) : Promise.resolve([]),
      ]);

      setKpis(kpisData);
      setSensors(sensorsData);
      setExcursions(excursionsData);
      setRounds(roundsData || []);

      if (sensorsData.length > 0 && !selectedSensorId) {
        setSelectedSensorId(sensorsData[0].id);
        setAuditSensorId(sensorsData[0].id);
      }
    } catch (err: any) {
      showFeedback(err.message || 'Falha ao carregar dados de monitoramento', 'error');
    }
  }, [storeId, excursionFilter, selectedSensorId]);

  const loadReadings = useCallback(async (sensorId: number) => {
    try {
      const data = await temperatureApi.getReadings(sensorId, { limit: 50 });
      setReadings(data);
    } catch (err: any) {
      showFeedback(err.message || 'Falha ao carregar leituras do sensor', 'error');
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (activeTab === 'AUDIT_LOG' && auditSensorId) {
      loadReadings(auditSensorId);
    }
  }, [activeTab, auditSensorId, loadReadings]);

  // Inicializar 5 Setores Físicos Padrão
  const handleSeedDefaultSectors = async () => {
    try {
      setIsSeedingSectors(true);
      await temperatureApi.seedDefaultSectors(storeId);
      showFeedback('5 setores regulamentares gerados com sucesso (Hall, Estoque, Geladeira, Injetáveis, Triagem)!');
      await loadData();
    } catch (err: any) {
      showFeedback(err.message || 'Erro ao inicializar setores', 'error');
    } finally {
      setIsSeedingSectors(false);
    }
  };

  // Submeter Ronda Multissetorial em Lote
  const handleSubmitSectorRound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sensors.length === 0) {
      showFeedback('Cadastre ou gere os setores antes de registrar a ronda.', 'error');
      return;
    }

    const readingsToSubmit = [];
    for (const sensor of sensors) {
      const input = roundInputs[sensor.id];
      if (input && input.temp && !isNaN(parseFloat(input.temp))) {
        readingsToSubmit.push({
          sensorId: sensor.id,
          temperature: parseFloat(input.temp),
          humidity: input.humidity && !isNaN(parseFloat(input.humidity)) ? parseFloat(input.humidity) : undefined,
        });
      }
    }

    if (readingsToSubmit.length === 0) {
      showFeedback('Informe a temperatura de pelo menos um setor físico da farmácia.', 'error');
      return;
    }

    try {
      setIsSubmittingRound(true);
      const res = await temperatureApi.recordRound({
        storeId,
        shift: roundShift,
        conductedBy: roundConductedBy,
        notes: roundNotes || undefined,
        readings: readingsToSubmit,
      });

      if (res.round.status === 'EXCURSION_DETECTED') {
        showFeedback(
          `⚠️ Ronda concluída com ALERTA SANITÁRIO! ${res.round.excursions_count} desvio(s) térmico(s) detectado(s). Verifique a aba de Incidentes.`,
          'error'
        );
      } else {
        showFeedback(`Ronda (${roundShift}) registrada com sucesso! Todos os ${readingsToSubmit.length} setores conformes.`);
      }

      setRoundInputs({});
      setRoundNotes('');
      await loadData();
    } catch (err: any) {
      showFeedback(err.message || 'Erro ao registrar ronda multissetorial', 'error');
    } finally {
      setIsSubmittingRound(false);
    }
  };

  // Submeter Leitura Avulsa
  const handleRecordReading = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSensorId) {
      showFeedback('Selecione um sensor.', 'error');
      return;
    }
    const tempNum = parseFloat(readingTemp);
    if (isNaN(tempNum)) {
      showFeedback('Informe uma temperatura válida.', 'error');
      return;
    }

    try {
      setIsSubmittingReading(true);
      const res = await temperatureApi.recordReading({
        sensorId: selectedSensorId,
        storeId,
        temperature: tempNum,
        humidity: readingHumidity ? parseFloat(readingHumidity) : undefined,
        recordedBy: readingRecordedBy,
        notes: readingNotes || undefined,
      });

      if (res.isExcursion) {
        showFeedback(
          `⚠️ Alerta Sanitário! Leitura de ${tempNum}°C fora da faixa. Incidente #${res.excursionId} aberto.`,
          'error'
        );
      } else {
        showFeedback(`Leitura de ${tempNum}°C gravada com sucesso! Faixa conforme.`);
      }

      setReadingTemp('');
      setReadingHumidity('');
      setReadingNotes('');
      await loadData();
    } catch (err: any) {
      showFeedback(err.message || 'Erro ao registrar leitura', 'error');
    } finally {
      setIsSubmittingReading(false);
    }
  };

  // Submeter Novo Sensor
  const handleAddSensor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sensorName) {
      showFeedback('Nome do sensor é obrigatório.', 'error');
      return;
    }

    try {
      await temperatureApi.registerSensor({
        storeId,
        name: sensorName,
        locationType: sensorLocationType,
        sectorCode: sensorSectorCode,
        floorLocation: sensorFloorLocation,
        minAllowedTemp: customMinTemp ? parseFloat(customMinTemp) : undefined,
        maxAllowedTemp: customMaxTemp ? parseFloat(customMaxTemp) : undefined,
        serialNumber: sensorSerial || undefined,
        calibrationCertNumber: sensorCert || undefined,
        calibrationDueDate: sensorDueDate || undefined,
      });

      showFeedback('Sensor cadastrado com sucesso!');
      setShowAddSensorModal(false);
      setSensorName('');
      setSensorSerial('');
      setSensorCert('');
      setSensorDueDate('');
      setCustomMinTemp('');
      setCustomMaxTemp('');
      await loadData();
    } catch (err: any) {
      showFeedback(err.message || 'Erro ao cadastrar sensor', 'error');
    }
  };

  // Resolver Incidente de Excursão
  const handleResolveExcursion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingExcursion) return;
    if (!pharmacistCrf.trim()) {
      showFeedback('O CRF do farmacêutico responsável é obrigatório.', 'error');
      return;
    }
    if (!actionTaken.trim()) {
      showFeedback('Descreva o laudo / ação corretiva tomada.', 'error');
      return;
    }

    try {
      setIsSubmittingResolve(true);
      await temperatureApi.resolveExcursion(resolvingExcursion.id, {
        actionTaken,
        pharmacistCrf,
      });

      showFeedback(`Incidente #${resolvingExcursion.id} resolvido e homologado pelo RT!`);
      setResolvingExcursion(null);
      setActionTaken('');
      await loadData();
    } catch (err: any) {
      showFeedback(err.message || 'Erro ao resolver incidente de excursão', 'error');
    } finally {
      setIsSubmittingResolve(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          data-testid="notification-toast"
          className={`p-4 rounded-lg flex items-center justify-between text-white font-medium ${
            notification.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'
          }`}
        >
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)} className="text-white hover:opacity-80">
            ×
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Thermometer className="h-7 w-7 text-emerald-600" />
            Termômetro & Higrômetro Digital — RDC 44/2009 e RDC 430/2020
          </h1>
          <p className="text-sm text-gray-500">
            Controle multissetorial contínuo: Hall de Medicamentos, Estoque, Geladeiras, Consultório e Triagem
          </p>
        </div>
        <div className="flex items-center gap-3">
          {sensors.length === 0 && (
            <button
              onClick={handleSeedDefaultSectors}
              disabled={isSeedingSectors}
              data-testid="btn-seed-sectors"
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors"
            >
              <Sparkles className="h-4 w-4" />
              {isSeedingSectors ? 'Gerando Setores...' : 'Gerar 5 Setores Físicos'}
            </button>
          )}
          <button
            onClick={() => loadData()}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm font-medium transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </button>
          <button
            onClick={() => setShowAddSensorModal(true)}
            data-testid="btn-add-sensor"
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm font-medium transition-colors"
          >
            <Plus className="h-4 w-4" />
            Novo Sensor
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Card 1: Geladeira Cadeia de Frio */}
        <div
          data-testid="kpi-fridge"
          className={`p-4 rounded-xl border ${
            kpis.cold_chain_status === 'EXCURSION'
              ? 'bg-red-50 border-red-200'
              : 'bg-white border-gray-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-gray-500">Cadeia de Frio (+2°C a +8°C)</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                kpis.cold_chain_status === 'EXCURSION'
                  ? 'bg-red-100 text-red-800'
                  : kpis.cold_chain_status === 'NORMAL'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {kpis.cold_chain_status === 'EXCURSION' ? 'EXCURSÃO TÉRMICA' : kpis.cold_chain_status === 'NORMAL' ? 'NORMAL' : 'SEM DADOS'}
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-gray-900">
              {kpis.current_fridge_temp !== null ? `${kpis.current_fridge_temp.toFixed(1)}°C` : '--'}
            </span>
            <span className="text-xs text-gray-500">Termolábeis / Vacinas</span>
          </div>
        </div>

        {/* Card 2: Salão de Vendas / Hall */}
        <div
          data-testid="kpi-ambient"
          className={`p-4 rounded-xl border ${
            kpis.ambient_status === 'EXCURSION'
              ? 'bg-red-50 border-red-200'
              : 'bg-white border-gray-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-gray-500">Hall & Salão (+15°C a +30°C)</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                kpis.ambient_status === 'EXCURSION'
                  ? 'bg-red-100 text-red-800'
                  : kpis.ambient_status === 'NORMAL'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {kpis.ambient_status === 'EXCURSION' ? 'DESVIO' : kpis.ambient_status === 'NORMAL' ? 'NORMAL' : 'SEM DADOS'}
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-gray-900">
              {kpis.current_sales_floor_temp !== null ? `${kpis.current_sales_floor_temp.toFixed(1)}°C` : '--'}
            </span>
            {kpis.current_sales_floor_humidity !== null && (
              <span className="text-sm font-semibold text-blue-600 flex items-center">
                <Droplets className="h-4 w-4 mr-0.5" />
                {kpis.current_sales_floor_humidity.toFixed(0)}% UR
              </span>
            )}
          </div>
        </div>

        {/* Card 3: Sensores Ativos */}
        <div data-testid="kpi-sensors" className="p-4 rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-gray-500">Setores Monitorados</span>
            <Building2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2">
            <span className="text-3xl font-extrabold text-gray-900">{kpis.active_sensors_count}</span>
            <span className="text-xs text-gray-500 ml-2">com certificado RBC</span>
          </div>
        </div>

        {/* Card 4: Incidentes de Excursão Abertos */}
        <div
          data-testid="kpi-excursions"
          className={`p-4 rounded-xl border ${
            kpis.open_excursions_count > 0 ? 'bg-amber-50 border-amber-300' : 'bg-white border-gray-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-gray-500">Excursões Pendentes RT</span>
            <AlertTriangle className={`h-4 w-4 ${kpis.open_excursions_count > 0 ? 'text-amber-600' : 'text-gray-400'}`} />
          </div>
          <div className="mt-2">
            <span className={`text-3xl font-extrabold ${kpis.open_excursions_count > 0 ? 'text-amber-700' : 'text-gray-900'}`}>
              {kpis.open_excursions_count}
            </span>
            <span className="text-xs text-gray-500 ml-2">aguardando laudo</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-6">
          <button
            data-testid="tab-sector-rounds"
            onClick={() => setActiveTab('SECTOR_ROUNDS')}
            className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'SECTOR_ROUNDS'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <ClipboardCheck className="h-4 w-4" />
            Ronda Diária por Setores (Checklist Rápido)
          </button>
          <button
            data-testid="tab-sensors"
            onClick={() => setActiveTab('SENSORS')}
            className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'SENSORS'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Layers className="h-4 w-4" />
            Setores & Sensores ({sensors.length})
          </button>
          <button
            data-testid="tab-reading-entry"
            onClick={() => setActiveTab('READING_ENTRY')}
            className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'READING_ENTRY'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Activity className="h-4 w-4" />
            Aferição Avulsa
          </button>
          <button
            data-testid="tab-excursions"
            onClick={() => setActiveTab('EXCURSIONS')}
            className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'EXCURSIONS'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <ShieldAlert className="h-4 w-4" />
            Incidentes de Excursão ({excursions.length})
          </button>
          <button
            data-testid="tab-audit-log"
            onClick={() => setActiveTab('AUDIT_LOG')}
            className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'AUDIT_LOG'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText className="h-4 w-4" />
            Histórico VISA
          </button>
        </nav>
      </div>

      {/* Tab 0: Ronda Diária por Setores (Checklist Rápido) */}
      {activeTab === 'SECTOR_ROUNDS' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 pb-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-emerald-600" />
                  Ronda Sanitária Multissetorial — Registro Diário
                </h2>
                <p className="text-xs text-gray-500">
                  Preencha as temperaturas de todos os setores físicos da farmácia (Hall de Medicamentos, Estoque, Geladeira, etc.) de uma única vez.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-0.5">Turno:</label>
                  <select
                    data-testid="select-round-shift"
                    value={roundShift}
                    onChange={(e) => setRoundShift(e.target.value as any)}
                    className="border border-gray-300 rounded-md px-3 py-1.5 text-xs font-semibold bg-white"
                  >
                    <option value="MORNING">☀️ Manhã (08:00)</option>
                    <option value="AFTERNOON">⛅ Tarde (14:00)</option>
                    <option value="NIGHT">🌙 Noite (20:00)</option>
                    <option value="SPECIAL">⚡ Extraordinária</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-0.5">Responsável:</label>
                  <input
                    type="text"
                    data-testid="input-round-conducted-by"
                    value={roundConductedBy}
                    onChange={(e) => setRoundConductedBy(e.target.value)}
                    placeholder="Nome do Farmacêutico ou Operador"
                    className="border border-gray-300 rounded-md px-3 py-1.5 text-xs w-48"
                  />
                </div>
              </div>
            </div>

            {sensors.length === 0 ? (
              <div className="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-300">
                <Building2 className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                <h3 className="text-sm font-semibold text-gray-700">Nenhum setor físico configurado ainda</h3>
                <p className="text-xs text-gray-500 mb-4">Clique abaixo para gerar automaticamente os 5 setores padrão da drogaria.</p>
                <button
                  onClick={handleSeedDefaultSectors}
                  disabled={isSeedingSectors}
                  data-testid="btn-empty-seed-sectors"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold"
                >
                  {isSeedingSectors ? 'Gerando...' : 'Gerar Setores Padrão'}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitSectorRound} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sensors.map((sensor) => {
                    const isFridge = sensor.location_type === 'REFRIGERATOR_COLD_CHAIN';
                    const currentInput = roundInputs[sensor.id] || { temp: '', humidity: '' };
                    const currentTempNum = parseFloat(currentInput.temp);
                    const isOutOfBounds =
                      !isNaN(currentTempNum) &&
                      (currentTempNum < sensor.min_allowed_temp || currentTempNum > sensor.max_allowed_temp);

                    return (
                      <div
                        key={sensor.id}
                        data-testid={`round-sector-card-${sensor.id}`}
                        className={`p-4 rounded-xl border transition-all ${
                          isOutOfBounds
                            ? 'bg-red-50 border-red-400 ring-2 ring-red-200'
                            : 'bg-white border-gray-200 hover:border-emerald-300'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                              {sensor.sector_code || 'SETOR'}
                            </span>
                            <h4 className="font-bold text-gray-900 text-sm mt-1">{sensor.name}</h4>
                            <p className="text-[11px] text-gray-500">{sensor.floor_location || 'Térreo'}</p>
                          </div>
                          <span className="text-[11px] font-mono text-gray-500">
                            {sensor.min_allowed_temp}°C a {sensor.max_allowed_temp}°C
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mt-3">
                          <div>
                            <label className="block text-[10px] font-semibold text-gray-600 uppercase mb-0.5">
                              Temp (°C) *
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              data-testid={`round-temp-input-${sensor.id}`}
                              placeholder={isFridge ? 'Ex: 4.5' : 'Ex: 22.0'}
                              value={currentInput.temp}
                              onChange={(e) => {
                                const val = e.target.value;
                                setRoundInputs((prev) => ({
                                  ...prev,
                                  [sensor.id]: {
                                    ...prev[sensor.id],
                                    temp: val,
                                    humidity: prev[sensor.id]?.humidity || '',
                                  },
                                }));
                              }}
                              className={`w-full border rounded-md px-2.5 py-1.5 text-sm font-bold ${
                                isOutOfBounds
                                  ? 'border-red-500 text-red-700 bg-white'
                                  : 'border-gray-300 text-gray-900'
                              }`}
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-gray-600 uppercase mb-0.5">
                              Umidade (% UR)
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              disabled={isFridge}
                              data-testid={`round-humid-input-${sensor.id}`}
                              placeholder={isFridge ? 'N/A' : 'Ex: 55'}
                              value={isFridge ? '' : currentInput.humidity}
                              onChange={(e) => {
                                const val = e.target.value;
                                setRoundInputs((prev) => ({
                                  ...prev,
                                  [sensor.id]: {
                                    ...prev[sensor.id],
                                    temp: prev[sensor.id]?.temp || '',
                                    humidity: val,
                                  },
                                }));
                              }}
                              className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm font-semibold disabled:bg-gray-100 disabled:text-gray-400"
                            />
                          </div>
                        </div>

                        {isOutOfBounds && (
                          <div className="mt-2 text-[11px] font-bold text-red-600 flex items-center gap-1">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Fora dos limites sanitários! Gerará excursão.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-100">
                  <div className="w-full md:w-2/3">
                    <input
                      type="text"
                      data-testid="input-round-notes"
                      value={roundNotes}
                      onChange={(e) => setRoundNotes(e.target.value)}
                      placeholder="Observações da ronda (ex: Ar condicionado ligado, porta da geladeira vedada)..."
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-xs"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmittingRound}
                    data-testid="btn-submit-sector-round"
                    className="w-full md:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm font-bold shadow-sm transition-colors disabled:opacity-50"
                  >
                    {isSubmittingRound ? 'Gravando Ronda...' : 'Salvar Ronda Sanitária Completa'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Histórico de Rondas Realizadas */}
          {rounds.length > 0 && (
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Clock className="h-4 w-4 text-emerald-600" />
                Histórico Recente de Rondas Sanitárias
              </h3>
              <div className="divide-y divide-gray-100">
                {rounds.map((r) => (
                  <div key={r.id} data-testid={`round-history-item-${r.id}`} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 text-sm">
                          Ronda #{r.id} — {r.shift === 'MORNING' ? '☀️ Manhã' : r.shift === 'AFTERNOON' ? '⛅ Tarde' : r.shift === 'NIGHT' ? '🌙 Noite' : '⚡ Extra'}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                            r.status === 'EXCURSION_DETECTED'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {r.status === 'EXCURSION_DETECTED' ? `${r.excursions_count} Desvio(s)` : '100% Conforme'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Realizado por: <strong>{r.conducted_by}</strong> em {r.recorded_at} ({r.readings_count} setores aferidos)
                      </p>
                      {r.notes && <p className="text-xs text-gray-400 italic mt-0.5">"{r.notes}"</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 1: Sensores */}
      {activeTab === 'SENSORS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sensors.map((sensor) => {
            const isFridge = sensor.location_type === 'REFRIGERATOR_COLD_CHAIN';
            const lastReading = sensor.last_reading;
            const hasExcursion = lastReading?.is_excursion;

            return (
              <div
                key={sensor.id}
                data-testid={`sensor-card-${sensor.id}`}
                className={`p-5 rounded-xl border bg-white shadow-sm flex flex-col justify-between ${
                  hasExcursion ? 'border-red-400 ring-2 ring-red-100' : 'border-gray-200'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-gray-900 text-base">{sensor.name}</h3>
                      <p className="text-xs text-gray-500">
                        {isFridge ? 'Geladeira Termolábeis' : sensor.location_type === 'SALES_FLOOR' ? 'Salão de Vendas' : 'Depósito'}
                        {sensor.sector_code && ` • ${sensor.sector_code}`}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                        hasExcursion
                          ? 'bg-red-100 text-red-800'
                          : lastReading
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {hasExcursion ? 'DESVIO' : lastReading ? 'CONFORME' : 'SEM LEITURA'}
                    </span>
                  </div>

                  {/* Detalhes de Leitura */}
                  <div className="my-4 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-gray-500">Última Temperatura:</span>
                      <span className={`text-xl font-black ${hasExcursion ? 'text-red-600' : 'text-gray-900'}`}>
                        {lastReading ? `${lastReading.temperature.toFixed(1)}°C` : '--'}
                      </span>
                    </div>
                    {!isFridge && lastReading?.humidity !== null && lastReading?.humidity !== undefined && (
                      <div className="flex items-baseline justify-between mt-1">
                        <span className="text-xs text-gray-500">Umidade Relativa:</span>
                        <span className="text-sm font-semibold text-blue-600">
                          {lastReading.humidity.toFixed(0)}% UR
                        </span>
                      </div>
                    )}
                    <div className="mt-2 text-xs text-gray-400">
                      {lastReading?.recorded_at ? `Aferido em: ${lastReading.recorded_at}` : 'Nenhuma medição registrada'}
                    </div>
                  </div>

                  {/* Limites Regulatórios */}
                  <div className="space-y-1 text-xs text-gray-600">
                    <div className="flex justify-between">
                      <span>Faixa Permitida:</span>
                      <span className="font-semibold text-gray-800">
                        {sensor.min_allowed_temp}°C a {sensor.max_allowed_temp}°C
                      </span>
                    </div>
                    {!isFridge && (
                      <div className="flex justify-between">
                        <span>Umidade Permitida:</span>
                        <span className="font-semibold text-gray-800">
                          {sensor.min_allowed_humidity}% a {sensor.max_allowed_humidity}% UR
                        </span>
                      </div>
                    )}
                    {sensor.calibration_cert_number && (
                      <div className="flex justify-between">
                        <span>Certificado RBC:</span>
                        <span className="font-mono text-gray-700">{sensor.calibration_cert_number}</span>
                      </div>
                    )}
                    {sensor.calibration_due_date && (
                      <div className="flex justify-between">
                        <span>Validade Calibração:</span>
                        <span className="text-gray-700">{sensor.calibration_due_date}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedSensorId(sensor.id);
                      setActiveTab('READING_ENTRY');
                    }}
                    data-testid={`btn-quick-read-${sensor.id}`}
                    className="flex-1 py-1.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded text-xs font-semibold transition-colors"
                  >
                    Registrar Aferição
                  </button>
                  <button
                    onClick={() => {
                      setAuditSensorId(sensor.id);
                      setActiveTab('AUDIT_LOG');
                    }}
                    className="py-1.5 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-medium transition-colors"
                  >
                    Histórico
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 2: Registro Rápido de Aferição Avulsa */}
      {activeTab === 'READING_ENTRY' && (
        <div className="max-w-2xl bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
            <Clock className="h-5 w-5 text-emerald-600" />
            Registro de Aferição Avulsa de Temperatura e Umidade
          </h2>
          <p className="text-xs text-gray-500 mb-6">
            Conforme RDC 44/2009 e boas práticas farmacêuticas. Registre os dados verificados no display do equipamento.
          </p>

          <form onSubmit={handleRecordReading} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                Termômetro / Setor
              </label>
              <select
                data-testid="input-reading-sensor"
                value={selectedSensorId || ''}
                onChange={(e) => setSelectedSensorId(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500"
              >
                {sensors.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.location_type === 'REFRIGERATOR_COLD_CHAIN' ? '+2°C a +8°C' : '+15°C a +30°C'})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  Temperatura Instantânea (°C) *
                </label>
                <input
                  type="number"
                  step="0.1"
                  data-testid="input-reading-temp"
                  value={readingTemp}
                  onChange={(e) => setReadingTemp(e.target.value)}
                  placeholder="Ex: 4.5 ou 22.0"
                  required
                  className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  Umidade Relativa (% UR - se aplicável)
                </label>
                <input
                  type="number"
                  step="0.1"
                  data-testid="input-reading-humidity"
                  value={readingHumidity}
                  onChange={(e) => setReadingHumidity(e.target.value)}
                  placeholder="Ex: 55.0 (apenas ambiente)"
                  className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                Responsável pela Leitura *
              </label>
              <input
                type="text"
                data-testid="input-reading-recorded-by"
                value={readingRecordedBy}
                onChange={(e) => setReadingRecordedBy(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                Observações / Condições Ambientais
              </label>
              <textarea
                rows={2}
                data-testid="input-reading-notes"
                value={readingNotes}
                onChange={(e) => setReadingNotes(e.target.value)}
                placeholder="Ex: Aferição extraordinária após oscilação no ar-condicionado."
                className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmittingReading}
              data-testid="btn-submit-reading"
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {isSubmittingReading ? 'Registrando...' : 'Gravar Aferição'}
            </button>
          </form>
        </div>
      )}

      {/* Tab 3: Incidentes de Excursão */}
      {activeTab === 'EXCURSIONS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500 uppercase">Filtrar por Status:</span>
              <select
                value={excursionFilter}
                onChange={(e) => setExcursionFilter(e.target.value as any)}
                className="border border-gray-300 rounded-md px-2 py-1 text-xs"
              >
                <option value="OPEN">Abertos / Pendentes</option>
                <option value="RESOLVED">Resolvidos</option>
                <option value="ALL">Todos os Incidentes</option>
              </select>
            </div>
          </div>

          {excursions.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-xl border border-gray-200 text-gray-500">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
              <p className="font-semibold">Nenhum incidente de excursão térmica pendente!</p>
              <p className="text-xs text-gray-400">Todas as geladeiras e ambientes estão dentro das conformidades.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                  <tr>
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Sensor / Local</th>
                    <th className="px-4 py-3">Severidade</th>
                    <th className="px-4 py-3">Pico Atingido</th>
                    <th className="px-4 py-3">Horário</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Ação RT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {excursions.map((exc) => (
                    <tr key={exc.id} data-testid={`excursion-row-${exc.id}`}>
                      <td className="px-4 py-3 font-mono text-xs">#{exc.id}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{exc.sensor_name || `Sensor #${exc.sensor_id}`}</div>
                        <div className="text-xs text-gray-500">
                          {exc.location_type === 'REFRIGERATOR_COLD_CHAIN' ? 'Geladeira Termolábeis' : 'Salão de Vendas'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                            exc.severity === 'CRITICAL' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {exc.severity === 'CRITICAL' ? 'CRÍTICO' : 'LEVE'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-red-600">
                        {exc.peak_temp.toFixed(1)}°C
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{exc.started_at}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                            exc.status === 'OPEN' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {exc.status === 'OPEN' ? 'ABERTO' : 'RESOLVIDO'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {exc.status === 'OPEN' ? (
                          <button
                            onClick={() => setResolvingExcursion(exc)}
                            data-testid={`btn-resolve-exc-${exc.id}`}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold transition-colors"
                          >
                            Resolver com Laudo
                          </button>
                        ) : (
                          <div className="text-xs text-gray-500">
                            <div>Resp: {exc.pharmacist_crf}</div>
                            <div className="truncate max-w-xs text-gray-400">{exc.action_taken}</div>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Histórico & Auditoria VISA */}
      {activeTab === 'AUDIT_LOG' && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-gray-200">
            <span className="text-xs font-semibold text-gray-500 uppercase">Selecione o Sensor:</span>
            <select
              value={auditSensorId}
              onChange={(e) => setAuditSensorId(Number(e.target.value))}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
            >
              {sensors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3">Data / Hora</th>
                  <th className="px-4 py-3">Temperatura</th>
                  <th className="px-4 py-3">Umidade UR</th>
                  <th className="px-4 py-3">Conformidade</th>
                  <th className="px-4 py-3">Responsável</th>
                  <th className="px-4 py-3">Observações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {readings.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 text-xs font-mono">{r.recorded_at}</td>
                    <td className={`px-4 py-3 font-bold ${r.is_excursion ? 'text-red-600' : 'text-gray-900'}`}>
                      {r.temperature.toFixed(1)}°C
                    </td>
                    <td className="px-4 py-3 text-xs text-blue-600">
                      {r.humidity !== null && r.humidity !== undefined ? `${r.humidity.toFixed(0)}%` : '--'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                          r.is_excursion ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {r.is_excursion ? 'EXCURSÃO' : 'NORMAL'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">{r.recorded_by}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{r.notes || '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Cadastro de Novo Sensor */}
      {showAddSensorModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Plus className="h-5 w-5 text-emerald-600" />
              Cadastrar Termômetro / Sensor
            </h3>

            <form onSubmit={handleAddSensor} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Nome do Equipamento *</label>
                <input
                  type="text"
                  data-testid="input-new-sensor-name"
                  value={sensorName}
                  onChange={(e) => setSensorName(e.target.value)}
                  placeholder="Ex: Hall de Medicamentos - Balcão 01"
                  required
                  className="w-full border border-gray-300 rounded-md p-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Setor Físico *</label>
                <select
                  data-testid="input-new-sensor-sector"
                  value={sensorSectorCode}
                  onChange={(e) => {
                    const sec = e.target.value;
                    setSensorSectorCode(sec);
                    if (sec === 'GELADEIRA_TERMOLABEIS') {
                      setSensorLocationType('REFRIGERATOR_COLD_CHAIN');
                    } else if (sec === 'ESTOQUE_CENTRAL' || sec === 'QUARENTENA_RECEBIMENTO') {
                      setSensorLocationType('STORAGE_ROOM');
                    } else {
                      setSensorLocationType('SALES_FLOOR');
                    }
                  }}
                  className="w-full border border-gray-300 rounded-md p-2 text-sm"
                >
                  <option value="HALL_MEDICAMENTOS">🏢 Hall / Balcão de Medicamentos</option>
                  <option value="ESTOQUE_CENTRAL">📦 Estoque Central / Almoxarifado</option>
                  <option value="GELADEIRA_TERMOLABEIS">❄️ Geladeira de Termolábeis (+2°C a +8°C)</option>
                  <option value="SALA_INJETAVEIS">🩺 Consultório / Sala de Injetáveis</option>
                  <option value="QUARENTENA_RECEBIMENTO">🛑 Doca de Entrada / Quarentena</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Localização Física / Andar</label>
                <input
                  type="text"
                  value={sensorFloorLocation}
                  onChange={(e) => setSensorFloorLocation(e.target.value)}
                  placeholder="Ex: Térreo Balcão Central ou 1º Andar"
                  className="w-full border border-gray-300 rounded-md p-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Nº Série</label>
                  <input
                    type="text"
                    value={sensorSerial}
                    onChange={(e) => setSensorSerial(e.target.value)}
                    placeholder="Ex: S-99881"
                    className="w-full border border-gray-300 rounded-md p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Certificado RBC</label>
                  <input
                    type="text"
                    value={sensorCert}
                    onChange={(e) => setSensorCert(e.target.value)}
                    placeholder="Ex: RBC-2026/04"
                    className="w-full border border-gray-300 rounded-md p-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Vencimento da Calibração</label>
                <input
                  type="date"
                  value={sensorDueDate}
                  onChange={(e) => setSensorDueDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-md p-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddSensorModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  data-testid="btn-confirm-add-sensor"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm font-semibold"
                >
                  Salvar Sensor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Resolução de Excursão Térmica com Laudo do Farmacêutico RT */}
      {resolvingExcursion && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-600" />
              Laudo Sanitário de Excursão Térmica #{resolvingExcursion.id}
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Local: <strong>{resolvingExcursion.sensor_name || `Sensor #${resolvingExcursion.sensor_id}`}</strong> | Pico:{' '}
              <strong className="text-red-600">{resolvingExcursion.peak_temp.toFixed(1)}°C</strong> | Severidade:{' '}
              <strong>{resolvingExcursion.severity}</strong>
            </p>

            <form onSubmit={handleResolveExcursion} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  CRF do Farmacêutico RT *
                </label>
                <input
                  type="text"
                  data-testid="input-resolve-crf"
                  value={pharmacistCrf}
                  onChange={(e) => setPharmacistCrf(e.target.value)}
                  placeholder="Ex: CRF-SP 12345"
                  required
                  className="w-full border border-gray-300 rounded-md p-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  Ação Corretiva / Parecer Técnico *
                </label>
                <textarea
                  rows={4}
                  data-testid="input-resolve-action"
                  value={actionTaken}
                  onChange={(e) => setActionTaken(e.target.value)}
                  placeholder="Descreva as medidas tomadas, inspeção visual dos medicamentos, integridade dos lacres e tempo total de excursão."
                  required
                  className="w-full border border-gray-300 rounded-md p-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setResolvingExcursion(null)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingResolve}
                  data-testid="btn-confirm-resolve-excursion"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm font-semibold disabled:opacity-50"
                >
                  {isSubmittingResolve ? 'Homologando...' : 'Homologar Resolução'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemperatureMonitoringPage;
