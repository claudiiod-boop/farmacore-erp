import React, { useState, useEffect } from 'react';
import { compoundingApi } from '../services/api';
import {
  RawMaterial,
  RawMaterialBatch,
  CompoundingOrder,
  CapsuleCalculationResult,
} from '../types/compounding';

export const CompoundingPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'quote' | 'orders' | 'quarantine' | 'label'>('quote');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Estados de Matérias-Primas e Lotes
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [batches, setBatches] = useState<RawMaterialBatch[]>([]);

  // Estados de Orçamento & Calculadora
  const [patientName, setPatientName] = useState('Mariana Silva');
  const [prescriberName, setPrescriberName] = useState('Dr. Carlos Eduardo');
  const [prescriberCrm, setPrescriberCrm] = useState('123456');
  const [prescriberUf, setPrescriberUf] = useState('SP');
  const [directions, setDirections] = useState('Tomar 1 cápsula 1x ao dia pela manhã.');
  const [totalUnits, setTotalUnits] = useState(30);
  const [selectedMatId, setSelectedMatId] = useState<number>(0);
  const [doseMg, setDoseMg] = useState(100);
  const [quoteItems, setQuoteItems] = useState<Array<{ rawMaterialId: number; name: string; prescribedDose: number; apparentDensity: number }>>([]);
  const [capsuleCalc, setCapsuleCalc] = useState<CapsuleCalculationResult | null>(null);

  // Estados de Ordens & Ficha de Pesagem
  const [orders, setOrders] = useState<CompoundingOrder[]>([]);
  const [orderStatusFilter, setOrderStatusFilter] = useState('TODOS');
  const [selectedOrder, setSelectedOrder] = useState<CompoundingOrder | null>(null);
  const [weighingInputs, setWeighingInputs] = useState<Record<number, number>>({});
  const [qcWeightInput, setQcWeightInput] = useState<number>(0);

  // Estados do Rótulo
  const [labelText, setLabelText] = useState<string>('');

  // Estados de Novo Lote na Quarentena
  const [newBatchMatId, setNewBatchMatId] = useState<number>(0);
  const [newBatchNumber, setNewBatchNumber] = useState('');
  const [newBatchSupplier, setNewBatchSupplier] = useState('');
  const [newBatchPotency, setNewBatchPotency] = useState(99.0);
  const [newBatchMoisture, setNewBatchMoisture] = useState(0.5);
  const [newBatchReportNum, setNewBatchReportNum] = useState('');
  const [newBatchExpDate, setNewBatchExpDate] = useState('2028-12-31');
  const [newBatchStock, setNewBatchStock] = useState(500);

  useEffect(() => {
    loadInitialData();
  }, [activeTab]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const mats = await compoundingApi.listRawMaterials();
      setRawMaterials(mats);
      if (mats.length > 0 && selectedMatId === 0) {
        setSelectedMatId(mats[0].id);
        setNewBatchMatId(mats[0].id);
      }

      if (activeTab === 'orders') {
        const ords = await compoundingApi.listOrders(1);
        setOrders(ords);
        if (selectedOrder) {
          const reloaded = await compoundingApi.getOrder(selectedOrder.id);
          setSelectedOrder(reloaded);
        }
      } else if (activeTab === 'quarantine') {
        const bts = await compoundingApi.listBatches();
        setBatches(bts);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao carregar dados' });
    } finally {
      setLoading(false);
    }
  };

  // ===================== AÇÕES ORÇAMENTO & CÁPSULAS =====================
  const handleAddItemToQuote = () => {
    const mat = rawMaterials.find((m) => m.id === Number(selectedMatId));
    if (!mat || doseMg <= 0) return;

    const existing = quoteItems.find((i) => i.rawMaterialId === mat.id);
    if (existing) {
      setMessage({ type: 'error', text: 'Esta matéria-prima já foi adicionada à fórmula.' });
      return;
    }

    setQuoteItems([
      ...quoteItems,
      {
        rawMaterialId: mat.id,
        name: mat.name,
        prescribedDose: Number(doseMg),
        apparentDensity: mat.apparent_density || 0.60,
      },
    ]);
  };

  const handleCalculateCapsule = async () => {
    if (quoteItems.length === 0) {
      setMessage({ type: 'error', text: 'Adicione ao menos um componente à fórmula.' });
      return;
    }

    try {
      setLoading(true);
      setMessage(null);
      const res = await compoundingApi.calculateCapsule(
        quoteItems.map((i) => ({ massMg: i.prescribedDose, apparentDensity: i.apparentDensity })),
        totalUnits
      );
      setCapsuleCalc(res);
      setMessage({
        type: 'success',
        text: `Cálculo realizado! Cápsula ideal: Nº ${res.selectedCapsuleSize} (Capacidade: ${res.capsuleCapacityMl} mL).`,
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro na cubagem da fórmula' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quoteItems.length === 0) {
      setMessage({ type: 'error', text: 'Adicione ao menos um componente à fórmula.' });
      return;
    }

    try {
      setLoading(true);
      setMessage(null);
      const newOrder = await compoundingApi.createOrder(
        {
          patient_name: patientName,
          prescriber_name: prescriberName,
          prescriber_crm: prescriberCrm,
          prescriber_uf: prescriberUf,
          pharmaceutical_form: 'CAPSULA',
          total_units: Number(totalUnits),
          directions,
        },
        quoteItems.map((i) => ({
          rawMaterialId: i.rawMaterialId,
          prescribedDose: i.prescribedDose,
        }))
      );

      setMessage({
        type: 'success',
        text: `Ordem de Manipulação ${newOrder.order_number} criada com sucesso! Ficha de pesagem disponível.`,
      });
      setQuoteItems([]);
      setCapsuleCalc(null);
      setSelectedOrder(newOrder);
      setActiveTab('orders');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao gerar ordem' });
    } finally {
      setLoading(false);
    }
  };

  // ===================== AÇÕES FICHA DE PESAGEM & CQ =====================
  const handleWeighItem = async (itemId: number) => {
    if (!selectedOrder) return;
    const weighed = weighingInputs[itemId];
    if (!weighed || weighed <= 0) {
      setMessage({ type: 'error', text: 'Informe o peso registrado na balança.' });
      return;
    }

    try {
      setLoading(true);
      setMessage(null);
      const updated = await compoundingApi.weighItem(
        selectedOrder.id,
        itemId,
        weighed,
        'MANIPULADOR_BALCAO'
      );
      setSelectedOrder(updated);
      setMessage({ type: 'success', text: 'Pesagem do componente confirmada com sucesso!' });
      await loadInitialData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao registrar pesagem' });
    } finally {
      setLoading(false);
    }
  };

  const handleQualityControl = async () => {
    if (!selectedOrder || qcWeightInput <= 0) return;
    try {
      setLoading(true);
      setMessage(null);
      const updated = await compoundingApi.evaluateQualityControl(
        selectedOrder.id,
        Number(qcWeightInput),
        'FARMACEUTICO_RT'
      );
      setSelectedOrder(updated);
      setMessage({
        type: 'success',
        text: '🎉 Controle de qualidade APROVADO! Fórmula pronta para dispensação e rotulagem.',
      });
      await loadInitialData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro no controle de qualidade' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenLabel = async (orderId: number) => {
    try {
      setLoading(true);
      const res = await compoundingApi.getLabel(orderId);
      setLabelText(res.labelText);
      setActiveTab('label');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao carregar rótulo' });
    } finally {
      setLoading(false);
    }
  };

  // ===================== AÇÕES DE QUARENTENA =====================
  const handleReleaseBatch = async (batchId: number) => {
    try {
      setLoading(true);
      setMessage(null);
      await compoundingApi.releaseBatch(batchId, 'FARMACEUTICO_RT');
      setMessage({ type: 'success', text: 'Lote aprovado e liberado para manipulação com sucesso!' });
      await loadInitialData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao aprovar lote' });
    } finally {
      setLoading(false);
    }
  };

  const handleRejectBatch = async (batchId: number) => {
    const reason = window.prompt('Informe o motivo técnico da reprovação do lote:');
    if (!reason) return;

    try {
      setLoading(true);
      setMessage(null);
      await compoundingApi.rejectBatch(batchId, reason, 'FARMACEUTICO_RT');
      setMessage({ type: 'error', text: 'Lote reprovado e retido no almoxarifado!' });
      await loadInitialData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao reprovar lote' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBatchNumber || !newBatchSupplier || !newBatchReportNum) {
      setMessage({ type: 'error', text: 'Preencha todos os campos obrigatórios do laudo analítico.' });
      return;
    }

    try {
      setLoading(true);
      setMessage(null);
      await compoundingApi.createBatch({
        raw_material_id: Number(newBatchMatId),
        batch_number: newBatchNumber,
        supplier: newBatchSupplier,
        potency_percent: Number(newBatchPotency),
        moisture_percent: Number(newBatchMoisture),
        report_number: newBatchReportNum,
        expiration_date: newBatchExpDate,
        current_stock: Number(newBatchStock),
        status: 'QUARANTINE',
      });

      setMessage({
        type: 'success',
        text: `Lote ${newBatchNumber} cadastrado com sucesso e retido em Quarentena para análise farmacêutica.`,
      });
      setNewBatchNumber('');
      setNewBatchSupplier('');
      setNewBatchReportNum('');
      await loadInitialData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao registrar lote' });
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter((o) =>
    orderStatusFilter === 'TODOS' ? true : o.status === orderStatusFilter
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-800">
              Laboratório Magistral & Manipulação
            </h1>
            <span className="bg-purple-100 text-purple-800 text-xs font-semibold px-2.5 py-1 rounded-full border border-purple-300">
              Boas Práticas de Manipulação (RDC 67/2007)
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Controle analítico de matérias-primas com quarentena, cálculos estequiométricos de FC/FEq, dimensionamento de cápsulas e rotulagem magistral oficial.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded text-center">
            <div className="text-xs text-slate-500 font-medium">Matérias-Primas</div>
            <div className="text-sm font-bold text-slate-700">{rawMaterials.length}</div>
          </div>
          <div className="bg-amber-50 border border-amber-200 px-3 py-1.5 rounded text-center">
            <div className="text-xs text-amber-700 font-medium">Em Quarentena</div>
            <div className="text-sm font-bold text-amber-800">
              {batches.filter((b) => b.status === 'QUARANTINE').length}
            </div>
          </div>
        </div>
      </div>

      {/* Alertas */}
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

      {/* Abas de Navegação */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('quote')}
          className={`pb-3 px-4 font-medium text-sm border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'quote'
              ? 'border-purple-600 text-purple-700 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          1. Orçamento & Calculadora de Cápsulas
        </button>
        <button
          onClick={() => {
            setActiveTab('orders');
            setSelectedOrder(null);
          }}
          className={`pb-3 px-4 font-medium text-sm border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'orders'
              ? 'border-purple-600 text-purple-700 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          2. Ficha de Pesagem & Manipulação
        </button>
        <button
          onClick={() => setActiveTab('quarantine')}
          className={`pb-3 px-4 font-medium text-sm border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'quarantine'
              ? 'border-purple-600 text-purple-700 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          3. Quarentena & Laudos de Matéria-Prima
        </button>
        <button
          onClick={() => setActiveTab('label')}
          className={`pb-3 px-4 font-medium text-sm border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'label'
              ? 'border-purple-600 text-purple-700 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          4. Rótulo Magistral Oficial (RDC 67)
        </button>
      </div>

      {/* ===================== ABA 1: ORÇAMENTO & CÁPSULAS ===================== */}
      {activeTab === 'quote' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Formulário Prescritivo */}
          <div className="md:col-span-2 bg-white p-6 rounded-lg shadow-sm border border-slate-200 space-y-4 text-xs">
            <h2 className="text-base font-bold text-slate-800 border-b border-slate-200 pb-2">
              Dados da Prescrição Médica
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Nome do Paciente:</label>
                <input
                  type="text"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-xs"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Prescritor (Médico):</label>
                <input
                  type="text"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-xs"
                  value={prescriberName}
                  onChange={(e) => setPrescriberName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">CRM / UF:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 border border-slate-300 rounded px-3 py-2 text-xs"
                    value={prescriberCrm}
                    onChange={(e) => setPrescriberCrm(e.target.value)}
                  />
                  <input
                    type="text"
                    className="w-16 border border-slate-300 rounded px-3 py-2 text-xs uppercase"
                    value={prescriberUf}
                    onChange={(e) => setPrescriberUf(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Qtd de Cápsulas:</label>
                <input
                  type="number"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-xs"
                  value={totalUnits}
                  onChange={(e) => setTotalUnits(Number(e.target.value))}
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Posologia Oficial:</label>
              <textarea
                className="w-full border border-slate-300 rounded px-3 py-2 text-xs"
                rows={2}
                value={directions}
                onChange={(e) => setDirections(e.target.value)}
              />
            </div>

            {/* Inserir Matéria-Prima */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
              <h3 className="font-bold text-slate-800">Adicionar Ativo à Fórmula</h3>
              <div className="flex flex-col md:flex-row gap-2 items-end">
                <div className="flex-1">
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Matéria-Prima:
                  </label>
                  <select
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs"
                    value={selectedMatId}
                    onChange={(e) => setSelectedMatId(Number(e.target.value))}
                  >
                    {rawMaterials.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} (Densidade: {m.apparent_density} g/mL)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="w-32">
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Dose Prescrita (mg):
                  </label>
                  <input
                    type="number"
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs"
                    value={doseMg}
                    onChange={(e) => setDoseMg(Number(e.target.value))}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleAddItemToQuote}
                  className="bg-purple-700 text-white font-semibold px-4 py-1.5 rounded hover:bg-purple-800"
                >
                  Adicionar
                </button>
              </div>
            </div>

            {/* Lista de Componentes da Fórmula */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-semibold text-left">
                    <th className="p-2">Componente</th>
                    <th className="p-2 text-right">Dose / Cápsula</th>
                    <th className="p-2 text-right">Densidade</th>
                    <th className="p-2 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {quoteItems.map((item, idx) => (
                    <tr key={idx}>
                      <td className="p-2 font-medium text-slate-800">{item.name}</td>
                      <td className="p-2 text-right font-bold text-slate-800">
                        {item.prescribedDose} mg
                      </td>
                      <td className="p-2 text-right text-slate-600 font-mono">
                        {item.apparentDensity} g/mL
                      </td>
                      <td className="p-2 text-center">
                        <button
                          onClick={() => setQuoteItems(quoteItems.filter((_, i) => i !== idx))}
                          className="text-red-600 hover:underline font-bold text-[11px]"
                        >
                          Remover
                        </button>
                      </td>
                    </tr>
                  ))}
                  {quoteItems.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-slate-400">
                        Nenhum componente adicionado à fórmula ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={handleCalculateCapsule}
                disabled={loading || quoteItems.length === 0}
                className="bg-slate-800 text-white font-bold px-4 py-2 rounded hover:bg-slate-900"
              >
                Calcular Cubagem Farmacotécnica
              </button>

              <button
                type="button"
                onClick={handleCreateOrder}
                disabled={loading || quoteItems.length === 0}
                className="bg-purple-600 text-white font-bold px-5 py-2 rounded hover:bg-purple-700 shadow-sm"
              >
                Gerar Ordem de Manipulação (Ficha de Pesagem)
              </button>
            </div>
          </div>

          {/* Painel de Resultados da Cubagem */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 space-y-4 text-xs">
            <h2 className="text-base font-bold text-slate-800 border-b border-slate-200 pb-2">
              Resultado da Cubagem (Cápsulas)
            </h2>

            {capsuleCalc ? (
              <div className="space-y-3">
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200 text-center">
                  <div className="text-xs text-purple-700 font-semibold uppercase">
                    Cápsula Ideal Selecionada:
                  </div>
                  <div className="text-3xl font-extrabold text-purple-900 mt-1">
                    Nº {capsuleCalc.selectedCapsuleSize}
                  </div>
                  <div className="text-[11px] text-purple-600 mt-1 font-mono">
                    Capacidade: {capsuleCalc.capsuleCapacityMl} mL
                  </div>
                </div>

                <div className="space-y-2 divide-y divide-slate-100">
                  <div className="flex justify-between pt-1">
                    <span className="text-slate-500">Massa dos Ativos / Cápsula:</span>
                    <span className="font-bold text-slate-800">
                      {capsuleCalc.totalMassPerCapsuleMg} mg
                    </span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-slate-500">Volume Ocupado / Cápsula:</span>
                    <span className="font-bold text-slate-800 font-mono">
                      {capsuleCalc.totalVolumePerCapsuleMl} mL
                    </span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-slate-500">Excipiente q.s.p. / Cápsula:</span>
                    <span className="font-bold text-purple-800">
                      {capsuleCalc.excipientMassPerCapsuleMg} mg
                    </span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-slate-500">Total Excipiente a Pesar (Lote):</span>
                    <span className="font-bold text-purple-800 font-mono">
                      {capsuleCalc.totalExcipientToWeighG} g
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-200 text-sm">
                    <span className="font-bold text-slate-800">Peso Médio Teórico:</span>
                    <span className="font-extrabold text-emerald-700">
                      {capsuleCalc.targetCapsuleWeightMg} mg
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400">
                Adicione os componentes da fórmula e clique em "Calcular Cubagem" para dimensionar o invólucro ideal.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================== ABA 2: FICHA DE PESAGEM & MANIPULAÇÃO ===================== */}
      {activeTab === 'orders' && (
        <div className="space-y-6">
          {selectedOrder ? (
            /* Painel da Ordem Selecionada */
            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-200 gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-lg font-bold text-purple-800">
                      {selectedOrder.order_number}
                    </span>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                        selectedOrder.status === 'READY'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : selectedOrder.status === 'QUALITY_CONTROL'
                          ? 'bg-blue-100 text-blue-800 border border-blue-300'
                          : 'bg-amber-100 text-amber-800 border border-amber-300'
                      }`}
                    >
                      {selectedOrder.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    Paciente: <strong>{selectedOrder.patient_name}</strong> | Prescritor: {selectedOrder.prescriber_name} (CRM: {selectedOrder.prescriber_crm}/{selectedOrder.prescriber_uf})
                  </div>
                  <div className="text-xs text-slate-500">
                    Forma: {selectedOrder.pharmaceutical_form} ({selectedOrder.total_units} un) | Cápsula Nº {selectedOrder.capsule_size || '-'} | Peso Teórico: {selectedOrder.target_weight_per_unit || 0} mg
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedOrder(null)}
                    className="border border-slate-300 text-slate-700 px-4 py-2 rounded text-xs font-semibold hover:bg-slate-50"
                  >
                    Voltar à Fila
                  </button>
                  <button
                    onClick={() => handleOpenLabel(selectedOrder.id)}
                    className="bg-purple-700 text-white font-bold px-4 py-2 rounded text-xs hover:bg-purple-800"
                  >
                    Visualizar Rótulo Oficial
                  </button>
                </div>
              </div>

              {/* Ficha Técnica de Pesagem */}
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-3">
                  Ficha de Pesagem Analítica (Matérias-Primas, FC e FEq)
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-semibold text-left">
                        <th className="p-3">Matéria-Prima</th>
                        <th className="p-3">Lote MP</th>
                        <th className="p-3 text-right">Dose Prescrita</th>
                        <th className="p-3 text-right">FC (Teor/Umid)</th>
                        <th className="p-3 text-right">FEq (Sal/Base)</th>
                        <th className="p-3 text-right">Dose Corrigida</th>
                        <th className="p-3 text-right">Peso Total a Pesar</th>
                        <th className="p-3 text-right">Peso Aferido</th>
                        <th className="p-3 text-center">Status</th>
                        <th className="p-3 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedOrder.items?.map((item) => (
                        <tr key={item.id} className={item.status === 'WEIGHED' ? 'bg-emerald-50/50' : ''}>
                          <td className="p-3 font-semibold text-slate-800">{item.raw_material_name}</td>
                          <td className="p-3 font-mono text-slate-600">{item.batch_number || '-'}</td>
                          <td className="p-3 text-right font-bold text-slate-800">
                            {item.prescribed_dose} {item.unit}
                          </td>
                          <td className="p-3 text-right font-mono text-slate-600">
                            {item.factor_correction}
                          </td>
                          <td className="p-3 text-right font-mono text-slate-600">
                            {item.factor_equivalence}
                          </td>
                          <td className="p-3 text-right font-bold text-purple-900 font-mono">
                            {item.corrected_dose_per_unit} mg
                          </td>
                          <td className="p-3 text-right font-bold text-slate-900 font-mono">
                            {item.total_dose_to_weigh} mg
                          </td>
                          <td className="p-3 text-right">
                            {item.status === 'WEIGHED' ? (
                              <span className="font-mono font-bold text-emerald-700">
                                {item.weighed_amount} mg
                              </span>
                            ) : (
                              <input
                                type="number"
                                className="w-24 border border-slate-300 rounded px-2 py-1 text-xs text-right font-mono"
                                placeholder="mg"
                                value={weighingInputs[item.id] || ''}
                                onChange={(e) =>
                                  setWeighingInputs({
                                    ...weighingInputs,
                                    [item.id]: Number(e.target.value),
                                  })
                                }
                              />
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                                item.status === 'WEIGHED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {item.status}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            {item.status !== 'WEIGHED' && (
                              <button
                                onClick={() => handleWeighItem(item.id)}
                                className="bg-purple-600 text-white font-semibold px-2.5 py-1 rounded text-[11px] hover:bg-purple-700"
                              >
                                Confirmar Pesagem
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Seção de Controle de Qualidade (Farmacopeia Brasileira) */}
              {(selectedOrder.status === 'QUALITY_CONTROL' || selectedOrder.status === 'READY') && (
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3 text-xs">
                  <h3 className="font-bold text-slate-800">
                    Controle de Qualidade em Processo (Farmacopeia Brasileira)
                  </h3>
                  <div className="flex flex-col md:flex-row items-center gap-4">
                    <div>
                      <span className="text-slate-600">Peso Médio Teórico:</span>{' '}
                      <strong className="text-slate-800 font-mono">
                        {selectedOrder.target_weight_per_unit || 0} mg
                      </strong>{' '}
                      <span className="text-slate-500">
                        (Tolerância:{' '}
                        {(selectedOrder.target_weight_per_unit || 0) < 300 ? '±10%' : '±7.5%'})
                      </span>
                    </div>

                    {selectedOrder.status === 'QUALITY_CONTROL' ? (
                      <div className="flex items-center gap-2">
                        <label className="font-semibold text-slate-700">Peso Médio Aferido (mg):</label>
                        <input
                          type="number"
                          className="border border-slate-300 rounded px-2.5 py-1.5 w-28 bg-white font-mono"
                          placeholder="Ex: 305"
                          value={qcWeightInput || ''}
                          onChange={(e) => setQcWeightInput(Number(e.target.value))}
                        />
                        <button
                          type="button"
                          onClick={handleQualityControl}
                          className="bg-emerald-600 text-white font-bold px-4 py-1.5 rounded hover:bg-emerald-700"
                        >
                          Aprovar Controle de Qualidade
                        </button>
                      </div>
                    ) : (
                      <div className="text-emerald-700 font-bold">
                        ✅ Aprovado (Peso Médio Real: {selectedOrder.actual_average_weight} mg) | Farm. Resp: {selectedOrder.pharmacist_responsible}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Lista de Ordens */
            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h2 className="text-base font-bold text-slate-800">Fila de Ordens de Manipulação</h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">Filtrar:</span>
                  {['TODOS', 'AWAITING_WEIGHING', 'IN_MANIPULATION', 'QUALITY_CONTROL', 'READY'].map(
                    (st) => (
                      <button
                        key={st}
                        onClick={() => setOrderStatusFilter(st)}
                        className={`text-xs px-3 py-1 rounded font-medium transition-colors ${
                          orderStatusFilter === st
                            ? 'bg-purple-700 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {st}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-semibold text-left">
                      <th className="p-3">Ordem (OM)</th>
                      <th className="p-3">Paciente</th>
                      <th className="p-3">Prescritor</th>
                      <th className="p-3">Forma / Unidades</th>
                      <th className="p-3">Cápsula</th>
                      <th className="p-3 text-right">Valor Total</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredOrders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-slate-50">
                        <td className="p-3 font-mono font-bold text-purple-900">{ord.order_number}</td>
                        <td className="p-3 font-medium text-slate-800">{ord.patient_name}</td>
                        <td className="p-3 text-slate-600">
                          {ord.prescriber_name} (CRM {ord.prescriber_crm})
                        </td>
                        <td className="p-3 text-slate-700">
                          {ord.pharmaceutical_form} ({ord.total_units} un)
                        </td>
                        <td className="p-3 font-bold text-slate-800">Nº {ord.capsule_size || '-'}</td>
                        <td className="p-3 text-right font-bold text-slate-800">
                          R$ {Number(ord.total_amount).toFixed(2)}
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                              ord.status === 'READY'
                                ? 'bg-emerald-100 text-emerald-800'
                                : ord.status === 'QUALITY_CONTROL'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {ord.status}
                          </span>
                        </td>
                        <td className="p-3 text-center space-x-1">
                          <button
                            onClick={() => setSelectedOrder(ord)}
                            className="bg-purple-600 text-white font-semibold px-3 py-1 rounded text-[11px] hover:bg-purple-700"
                          >
                            Abrir Ficha de Pesagem
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredOrders.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-400">
                          Nenhuma ordem de manipulação encontrada.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================== ABA 3: QUIZ / CONTROLE DE QUALIDADE & LAUDOS ===================== */}
      {activeTab === 'quarantine' && (
        <div className="space-y-6">
          {/* Formulário de Novo Lote */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 space-y-4 text-xs">
            <h2 className="text-base font-bold text-slate-800 border-b border-slate-200 pb-2">
              Entrada de Matéria-Prima & Cadastro de Laudo Analítico
            </h2>
            <form onSubmit={handleCreateBatch} className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Matéria-Prima:</label>
                <select
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs"
                  value={newBatchMatId}
                  onChange={(e) => setNewBatchMatId(Number(e.target.value))}
                >
                  {rawMaterials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Número do Lote:</label>
                <input
                  type="text"
                  className="w-full border border-slate-300 rounded px-3 py-1.5 font-mono"
                  placeholder="Ex: LOTE-2026-001"
                  value={newBatchNumber}
                  onChange={(e) => setNewBatchNumber(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Fornecedor / Fabricante:</label>
                <input
                  type="text"
                  className="w-full border border-slate-300 rounded px-3 py-1.5"
                  placeholder="Ex: Fagron, Galena, Infinity"
                  value={newBatchSupplier}
                  onChange={(e) => setNewBatchSupplier(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Nº do Laudo Analítico:</label>
                <input
                  type="text"
                  className="w-full border border-slate-300 rounded px-3 py-1.5 font-mono"
                  placeholder="Ex: LAUDO-99887"
                  value={newBatchReportNum}
                  onChange={(e) => setNewBatchReportNum(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Teor / Potência (%):</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full border border-slate-300 rounded px-3 py-1.5 font-mono"
                  value={newBatchPotency}
                  onChange={(e) => setNewBatchPotency(Number(e.target.value))}
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Umidade (%):</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full border border-slate-300 rounded px-3 py-1.5 font-mono"
                  value={newBatchMoisture}
                  onChange={(e) => setNewBatchMoisture(Number(e.target.value))}
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Data de Validade:</label>
                <input
                  type="date"
                  className="w-full border border-slate-300 rounded px-3 py-1.5 font-mono"
                  value={newBatchExpDate}
                  onChange={(e) => setNewBatchExpDate(e.target.value)}
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Estoque Inicial (g):</label>
                <input
                  type="number"
                  className="w-full border border-slate-300 rounded px-3 py-1.5 font-mono"
                  value={newBatchStock}
                  onChange={(e) => setNewBatchStock(Number(e.target.value))}
                />
              </div>

              <div className="md:col-span-4 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-purple-700 text-white font-bold px-5 py-2 rounded text-xs hover:bg-purple-800"
                >
                  Registrar Lote em Quarentena
                </button>
              </div>
            </form>
          </div>

          {/* Tabela de Lotes & Quarentena */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 space-y-4">
            <h2 className="text-base font-bold text-slate-800">
              Lotes de Matérias-Primas & Controle de Quarentena
            </h2>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-semibold text-left">
                    <th className="p-3">Matéria-Prima</th>
                    <th className="p-3">Lote</th>
                    <th className="p-3">Fornecedor</th>
                    <th className="p-3">Laudo</th>
                    <th className="p-3 text-right">Teor (%)</th>
                    <th className="p-3 text-right">Umidade (%)</th>
                    <th className="p-3">Validade</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Ações do Farmacêutico</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {batches.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="p-3 font-semibold text-slate-800">{b.raw_material_name}</td>
                      <td className="p-3 font-mono font-bold text-slate-700">{b.batch_number}</td>
                      <td className="p-3 text-slate-600">{b.supplier}</td>
                      <td className="p-3 font-mono text-slate-600">{b.report_number}</td>
                      <td className="p-3 text-right font-mono font-bold text-slate-800">
                        {b.potency_percent}%
                      </td>
                      <td className="p-3 text-right font-mono text-slate-600">
                        {b.moisture_percent}%
                      </td>
                      <td className="p-3 font-mono text-slate-700">{b.expiration_date}</td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                            b.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : b.status === 'REJECTED'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}
                        >
                          {b.status}
                        </span>
                      </td>
                      <td className="p-3 text-center space-x-1">
                        {b.status === 'QUARANTINE' && (
                          <>
                            <button
                              onClick={() => handleReleaseBatch(b.id)}
                              className="bg-emerald-600 text-white font-semibold px-2.5 py-1 rounded text-[11px] hover:bg-emerald-700"
                            >
                              Aprovar Laudo
                            </button>
                            <button
                              onClick={() => handleRejectBatch(b.id)}
                              className="bg-red-600 text-white font-semibold px-2.5 py-1 rounded text-[11px] hover:bg-red-700"
                            >
                              Reprovar
                            </button>
                          </>
                        )}
                        {b.status === 'APPROVED' && (
                          <span className="text-[10px] text-slate-400">Liberado por {b.released_by}</span>
                        )}
                        {b.status === 'REJECTED' && (
                          <span className="text-[10px] text-red-600 font-semibold">Reprovado</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {batches.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400">
                        Nenhum lote de matéria-prima cadastrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================== ABA 4: RÓTULO MAGISTRAL OFICIAL ===================== */}
      {activeTab === 'label' && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 max-w-2xl mx-auto space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h2 className="text-base font-bold text-slate-800">
              Visualização de Rótulo Magistral Oficial (RDC 67/2007)
            </h2>
            <button
              onClick={() => window.print()}
              disabled={!labelText}
              className="bg-purple-700 text-white font-bold px-4 py-1.5 rounded text-xs hover:bg-purple-800"
            >
              Imprimir Etiqueta Térmica
            </button>
          </div>

          {labelText ? (
            <div className="bg-slate-900 text-emerald-400 font-mono text-xs p-6 rounded-lg overflow-x-auto whitespace-pre shadow-inner">
              {labelText}
            </div>
          ) : (
            <div className="p-12 text-center text-slate-400 text-xs">
              Selecione uma ordem de manipulação na aba "Ficha de Pesagem" e clique em "Visualizar Rótulo Oficial".
            </div>
          )}
        </div>
      )}
    </div>
  );
};
