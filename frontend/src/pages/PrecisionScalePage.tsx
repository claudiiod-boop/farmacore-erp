import React, { useState, useEffect, useCallback } from 'react';
import { scaleApi } from '../services/api';
import type {
  ScaleDevice,
  ScaleReadingResult,
  DecodedWeightedBarcodeResult,
  WeighingLabelResult,
  ScaleKpis,
  ScaleProtocol,
} from '../types/scale';

export const PrecisionScalePage: React.FC = () => {
  const [kpis, setKpis] = useState<ScaleKpis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Leitura Serial
  const [selectedDeviceId, setSelectedDeviceId] = useState<number>(1);
  const [simulatedGross, setSimulatedGross] = useState<string>('350');
  const [simulatedTare, setSimulatedTare] = useState<string>('20');
  const [lastReading, setLastReading] = useState<ScaleReadingResult | null>(null);
  const [isReading, setIsReading] = useState(false);

  // Decodificador de Código de Barras EAN-13
  const [barcodeInput, setBarcodeInput] = useState<string>('2000420016009');
  const [decodedResult, setDecodedResult] = useState<DecodedWeightedBarcodeResult | null>(null);
  const [isDecoding, setIsDecoding] = useState(false);

  // Emissão de Etiqueta Térmica ZPL
  const [labelProductId, setLabelProductId] = useState<string>('42');
  const [labelBatch, setLabelBatch] = useState<string>('LOTE-MANIP-2026');
  const [labelGross, setLabelGross] = useState<string>('250');
  const [labelTare, setLabelTare] = useState<string>('20');
  const [generatedLabel, setGeneratedLabel] = useState<WeighingLabelResult | null>(null);
  const [isGeneratingLabel, setIsGeneratingLabel] = useState(false);

  // Modal Cadastro de Balança
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
  const [deviceName, setDeviceName] = useState('Toledo Prix 3 Fit - Balcão 1');
  const [serialPort, setSerialPort] = useState('COM1');
  const [baudRate, setBaudRate] = useState<number>(9600);
  const [protocol, setProtocol] = useState<ScaleProtocol>('TOLEDO_PR4');
  const [sealNumber, setSealNumber] = useState('INMETRO-SP-2026-9988');
  const [capacityKg, setCapacityKg] = useState<string>('15.0');
  const [precisionGrams, setPrecisionGrams] = useState<string>('5.0');
  const [deviceSubmitting, setDeviceSubmitting] = useState(false);

  const loadKpis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await scaleApi.getKpis(1);
      if (res.success && res.data) {
        setKpis(res.data);
      }
    } catch (err: any) {
      setError(err.message || 'Falha ao carregar KPIs de balança');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKpis();
  }, [loadKpis]);

  // Executar Leitura Serial Direta
  const handleReadScale = async () => {
    setIsReading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const grossNum = Number(simulatedGross);
      const tareNum = Number(simulatedTare);
      const res = await scaleApi.readWeight(selectedDeviceId, grossNum, tareNum);
      if (res.success && res.data) {
        setLastReading(res.data);
        setSuccessMsg(`Peso capturado com sucesso da balança serial: ${res.data.net_weight_grams}g (Líquido)`);
      } else {
        setError(res.error || 'Erro ao comunicar com a balança serial');
      }
    } catch (err: any) {
      setError(err.message || 'Falha de comunicação serial');
    } finally {
      setIsReading(false);
    }
  };

  // Zerar Tara
  const handleZeroTare = () => {
    setSimulatedTare('0');
    setSuccessMsg('Tara zerada no display metrológico.');
  };

  // Decodificar Código de Barras Pesável EAN-13
  const handleDecodeBarcode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!barcodeInput.trim()) return;

    setIsDecoding(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await scaleApi.decodeBarcode(barcodeInput.trim(), 1);
      if (res.success && res.data) {
        setDecodedResult(res.data);
        setSuccessMsg(`Código EAN-13 pesável decodificado: ${res.data.product_name}`);
      } else {
        setError(res.error || 'Código de barras pesável inválido ou produto não cadastrado');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao decodificar código de barras');
    } finally {
      setIsDecoding(false);
    }
  };

  // Gerar Etiqueta Térmica ZPL
  const handleGenerateLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGeneratingLabel(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const pId = Number(labelProductId);
      const grossG = Number(labelGross);
      const tareG = Number(labelTare);
      const res = await scaleApi.generateLabel({
        product_id: pId,
        store_id: 1,
        gross_weight_grams: grossG,
        tare_grams: tareG,
        scale_device_id: selectedDeviceId,
        operator_name: 'Operador Balcão'
      });
      if (res.success && res.data) {
        setGeneratedLabel(res.data);
        setSuccessMsg(`Etiqueta gerada com código ${res.data.barcode} e comando térmico ZPL pronto para impressão.`);
        await loadKpis();
      } else {
        setError(res.error || 'Erro ao gerar etiqueta térmica de pesagem');
      }
    } catch (err: any) {
      setError(err.message || 'Falha na emissão da etiqueta');
    } finally {
      setIsGeneratingLabel(false);
    }
  };

  // Cadastrar Nova Balança Serial INMETRO
  const handleRegisterDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeviceSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await scaleApi.registerDevice({
        store_id: 1,
        name: deviceName,
        serial_port: serialPort,
        baud_rate: baudRate,
        protocol: protocol,
        inmetro_seal_number: sealNumber,
        capacity_kg: Number(capacityKg),
        precision_grams: Number(precisionGrams)
      });
      if (res.success && res.data) {
        setSuccessMsg(`Balança ${res.data.name} homologada com selo ${res.data.inmetro_seal_number} cadastrada com sucesso!`);
        setIsDeviceModalOpen(false);
        await loadKpis();
      } else {
        setError(res.error || 'Erro ao cadastrar balança serial');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao registrar dispositivo');
    } finally {
      setDeviceSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Balança de Precisão & Checkout Pesável
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
              INMETRO Portaria 236/1994
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-950 text-sky-400 border border-sky-800">
              RDC 67/2007 Manipulados & Fracionados
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Comunicação serial RS232/USB (Toledo, Filizola, Urano), desconto metrológico de tara e código de barras pesável EAN-13 GS1.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            data-testid="refresh-scales-btn"
            onClick={loadKpis}
            disabled={loading}
            className="px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300 text-sm font-medium transition cursor-pointer"
          >
            {loading ? 'Atualizando...' : 'Atualizar Dados'}
          </button>
          <button
            type="button"
            data-testid="open-register-scale-modal"
            onClick={() => setIsDeviceModalOpen(true)}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-sm transition cursor-pointer"
          >
            + Nova Balança Serial
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div data-testid="scales-error-alert" className="p-4 rounded-lg bg-red-950/80 border border-red-800 text-red-300 text-sm">
          {error}
        </div>
      )}
      {successMsg && (
        <div data-testid="scales-success-alert" className="p-4 rounded-lg bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-sm">
          {successMsg}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div data-testid="kpi-total-scales" className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
          <span className="text-xs font-medium text-slate-400">Balanças Homologadas</span>
          <div className="text-2xl font-bold text-white mt-1">
            {kpis?.active_scales ?? 0} <span className="text-xs font-normal text-slate-400">/ {kpis?.total_scales ?? 0} total</span>
          </div>
          <span className="text-xs text-emerald-400 mt-1 block">Metrologia Conforme</span>
        </div>

        <div data-testid="kpi-weighings-today" className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
          <span className="text-xs font-medium text-slate-400">Pesagens Hoje</span>
          <div className="text-2xl font-bold text-sky-400 mt-1">
            {kpis?.total_weighings_today ?? 0}
          </div>
          <span className="text-xs text-slate-400 mt-1 block">Operações registradas</span>
        </div>

        <div data-testid="kpi-weight-today" className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
          <span className="text-xs font-medium text-slate-400">Volume Total Pesado</span>
          <div className="text-2xl font-bold text-amber-400 mt-1">
            {(kpis?.total_weight_kg_today ?? 0).toFixed(3)} <span className="text-xs font-normal text-slate-400">kg</span>
          </div>
          <span className="text-xs text-slate-400 mt-1 block">Líquido aferido</span>
        </div>

        <div data-testid="kpi-sales-amount-today" className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
          <span className="text-xs font-medium text-slate-400">Vendas Pesáveis Hoje</span>
          <div className="text-2xl font-bold text-emerald-400 mt-1">
            {(kpis?.total_weighted_sales_amount_today ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
          <span className="text-xs text-slate-400 mt-1 block">Checkout ponderal</span>
        </div>
      </div>

      {/* Main Grid: 3 Work Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel 1: Leitura Serial Direta da Balança */}
        <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-5 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-semibold text-white">1. Leitura Serial & Tara</h2>
              <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded">RS232 / USB</span>
            </div>

            <div className="space-y-3 mt-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Dispositivo de Balança</label>
                <select
                  data-testid="scale-device-select"
                  value={selectedDeviceId}
                  onChange={(e) => setSelectedDeviceId(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                >
                  <option value={1}>Balança Balcão Toledo (COM1)</option>
                  <option value={2}>Balança Manipulação Urano (COM3)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Peso Bruto (g)</label>
                  <input
                    type="number"
                    data-testid="simulated-gross-input"
                    value={simulatedGross}
                    onChange={(e) => setSimulatedGross(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Tara Embalagem (g)</label>
                  <input
                    type="number"
                    data-testid="simulated-tare-input"
                    value={simulatedTare}
                    onChange={(e) => setSimulatedTare(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <button
                  type="button"
                  data-testid="read-scale-btn"
                  onClick={handleReadScale}
                  disabled={isReading}
                  className="flex-1 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold transition cursor-pointer"
                >
                  {isReading ? 'Lendo...' : 'Capturar Peso'}
                </button>
                <button
                  type="button"
                  data-testid="zero-tare-btn"
                  onClick={handleZeroTare}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition cursor-pointer"
                >
                  Zerar Tara
                </button>
              </div>
            </div>
          </div>

          {/* Digital Display */}
          <div className="mt-4 p-4 rounded-xl bg-slate-950 border-2 border-emerald-500/50 flex flex-col items-center justify-center space-y-1">
            <span className="text-xs uppercase tracking-wider text-emerald-400 font-mono">Display Digital Metrológico</span>
            <div data-testid="display-net-weight" className="text-4xl font-extrabold text-emerald-400 font-mono tracking-tight">
              {lastReading ? `${(lastReading.net_weight_grams / 1000).toFixed(3)} kg` : '0.000 kg'}
            </div>
            <div className="flex items-center space-x-4 text-xs font-mono text-slate-400">
              <span data-testid="display-tare-weight">
                Tara: {lastReading ? `${lastReading.tare_grams} g` : '0 g'}
              </span>
              <span>•</span>
              <span>Bruto: {lastReading ? `${lastReading.gross_weight_grams} g` : '0 g'}</span>
            </div>
            <div data-testid="display-stability-status" className="mt-2 text-xs font-semibold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
              {lastReading?.is_stable ? 'ESTÁVEL (PORTARIA INMETRO 236/94)' : 'AGUARDANDO ESTABILIDADE'}
            </div>
          </div>
        </div>

        {/* Panel 2: Decodificador de Código de Barras Pesável EAN-13 */}
        <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-5 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-semibold text-white">2. Checkout Pesável EAN-13</h2>
              <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded">GS1 Padrão 2</span>
            </div>

            <form onSubmit={handleDecodeBarcode} className="space-y-3 mt-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Código de Barras Scanner (EAN-13 iniciado com '2')
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    data-testid="barcode-input"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    placeholder="Ex: 2000420016009"
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono"
                  />
                  <button
                    type="submit"
                    data-testid="decode-barcode-btn"
                    disabled={isDecoding}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition cursor-pointer"
                  >
                    {isDecoding ? 'Decodificando...' : 'Decodificar'}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Resultado Decodificado */}
          <div data-testid="decoded-result-card" className="mt-4 p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-medium">Item Decodificado no PDV</span>
            {decodedResult ? (
              <div className="space-y-2">
                <div data-testid="decoded-product-name" className="text-base font-bold text-white">
                  {decodedResult.product_name}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 border-t border-slate-800 pt-2">
                  <div>
                    <span className="text-slate-400">Total a Pagar:</span>
                    <div data-testid="decoded-total-price" className="text-lg font-bold text-emerald-400">
                      {decodedResult.total_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400">Peso Apurado:</span>
                    <div data-testid="decoded-calculated-weight" className="text-base font-semibold text-sky-400">
                      {decodedResult.calculated_quantity.toFixed(3)} kg
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-400 pt-1">
                  <span>Preço por kg:</span>
                  <span data-testid="decoded-price-per-kg" className="font-semibold text-slate-200">
                    {decodedResult.price_per_kg.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/kg
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500 text-center py-6">
                Passe o código de barras ou digite o EAN-13 para conferência imediata de peso e valor.
              </div>
            )}
          </div>
        </div>

        {/* Panel 3: Emissor de Etiquetas Térmicas ZPL */}
        <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-5 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-semibold text-white">3. Etiqueta Térmica ZPL</h2>
              <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded">Zebra / Argox</span>
            </div>

            <form onSubmit={handleGenerateLabel} className="space-y-3 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">ID Produto</label>
                  <input
                    type="number"
                    data-testid="label-product-id-input"
                    value={labelProductId}
                    onChange={(e) => setLabelProductId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Lote</label>
                  <input
                    type="text"
                    data-testid="label-batch-input"
                    value={labelBatch}
                    onChange={(e) => setLabelBatch(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Bruto (g)</label>
                  <input
                    type="number"
                    data-testid="label-gross-input"
                    value={labelGross}
                    onChange={(e) => setLabelGross(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Tara (g)</label>
                  <input
                    type="number"
                    data-testid="label-tare-input"
                    value={labelTare}
                    onChange={(e) => setLabelTare(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                  />
                </div>
              </div>

              <button
                type="submit"
                data-testid="generate-label-btn"
                disabled={isGeneratingLabel}
                className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition cursor-pointer"
              >
                {isGeneratingLabel ? 'Gerando...' : 'Gerar Etiqueta com EAN-13'}
              </button>
            </form>
          </div>

          {/* Preview da Etiqueta */}
          <div data-testid="label-preview-card" className="mt-4 p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-medium">Pré-visualização Térmica</span>
            {generatedLabel ? (
              <div className="space-y-2 text-xs">
                <div className="flex justify-between border-b border-slate-800 pb-1">
                  <span className="text-slate-400">EAN-13:</span>
                  <span data-testid="label-generated-barcode" className="font-mono font-bold text-sky-400">
                    {generatedLabel.barcode}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Líquido:</span>
                  <span data-testid="label-net-weight" className="font-semibold text-slate-200">
                    {generatedLabel.net_weight_grams} g
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total:</span>
                  <span data-testid="label-total-price" className="font-bold text-emerald-400">
                    {generatedLabel.total_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
                <div className="pt-2">
                  <span className="text-slate-500 block mb-1">Comando ZPL:</span>
                  <pre data-testid="label-zpl-code" className="bg-slate-900 p-2 rounded text-[10px] font-mono text-slate-400 overflow-x-auto max-h-20">
                    {generatedLabel.thermal_label_zpl}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500 text-center py-6">
                Informe o peso e gere a etiqueta para inspecionar o código ZPL e EAN-13.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Cadastro de Balança INMETRO */}
      {isDeviceModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white">Cadastrar Balança Serial INMETRO</h3>
              <button
                type="button"
                data-testid="close-device-modal-btn"
                onClick={() => setIsDeviceModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRegisterDevice} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Nome do Equipamento</label>
                <input
                  type="text"
                  data-testid="device-name-input"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Porta Serial</label>
                  <input
                    type="text"
                    data-testid="device-port-input"
                    value={serialPort}
                    onChange={(e) => setSerialPort(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono"
                    placeholder="COM1"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Baud Rate</label>
                  <select
                    data-testid="device-baud-select"
                    value={baudRate}
                    onChange={(e) => setBaudRate(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                  >
                    <option value={9600}>9600 bps</option>
                    <option value={4800}>4800 bps</option>
                    <option value={2400}>2400 bps</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Protocolo Metrológico</label>
                  <select
                    data-testid="device-protocol-select"
                    value={protocol}
                    onChange={(e) => setProtocol(e.target.value as ScaleProtocol)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                  >
                    <option value="TOLEDO_PR4">Toledo Prix (PR4)</option>
                    <option value="FILIZOLA">Filizola</option>
                    <option value="URANO">Urano Pop-Z</option>
                    <option value="BALMAK">Balmak</option>
                    <option value="GENERICA_CONTINUA">Genérica Contínua</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Selo INMETRO</label>
                  <input
                    type="text"
                    data-testid="device-seal-input"
                    value={sealNumber}
                    onChange={(e) => setSealNumber(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Capacidade (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    data-testid="device-capacity-input"
                    value={capacityKg}
                    onChange={(e) => setCapacityKg(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Divisão / Precisão (g)</label>
                  <input
                    type="number"
                    step="0.1"
                    data-testid="device-precision-input"
                    value={precisionGrams}
                    onChange={(e) => setPrecisionGrams(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsDeviceModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  data-testid="save-device-btn"
                  disabled={deviceSubmitting}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition cursor-pointer"
                >
                  {deviceSubmitting ? 'Salvando...' : 'Salvar Homologação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrecisionScalePage;
