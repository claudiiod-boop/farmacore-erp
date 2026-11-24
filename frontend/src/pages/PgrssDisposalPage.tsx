import React, { useState, useEffect, useCallback } from 'react';
import {
  Trash2,
  FileCheck2,
  Truck,
  Flame,
  AlertTriangle,
  PlusCircle,
  FileText,
  Printer,
  Calendar,
  Building2,
  RefreshCw,
  CheckCircle2,
  ShieldAlert,
  Scale
} from 'lucide-react';
import { pgrssApi, storesApi, searchProducts, getAvailableBatches } from '../services/api';
import type {
  PgrssDisposalRecord,
  PgrssManifest,
  PgrssKpis,
  WasteGroup,
  DisposalReason
} from '../types';

export const PgrssDisposalPage: React.FC = () => {
  const [selectedStoreId, setSelectedStoreId] = useState<number | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<'ABRIGO' | 'MANIFESTS' | 'HISTORY'>('ABRIGO');

  const [loading, setLoading] = useState(false);
  const [kpis, setKpis] = useState<PgrssKpis | null>(null);
  const [storedRecords, setStoredRecords] = useState<PgrssDisposalRecord[]>([]);
  const [manifests, setManifests] = useState<PgrssManifest[]>([]);
  const [allRecords, setAllRecords] = useState<PgrssDisposalRecord[]>([]);
  const [stores, setStores] = useState<Array<{ id: number; name: string }>>([]);

  // Seleção de itens para despacho
  const [selectedRecordIds, setSelectedRecordIds] = useState<number[]>([]);

  // Modal de Segregação
  const [isSegregateModalOpen, setIsSegregateModalOpen] = useState(false);
  const [segStoreId, setSegStoreId] = useState<number>(1);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [availableBatches, setAvailableBatches] = useState<any[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<number | undefined>(undefined);
  const [wasteGroup, setWasteGroup] = useState<WasteGroup>('GRUPO_B_QUIMICO');
  const [reason, setReason] = useState<DisposalReason>('VENCIDO');
  const [quantity, setQuantity] = useState<number>(1);
  const [weightKg, setWeightKg] = useState<number>(0.1);
  const [pharmacistName, setPharmacistName] = useState('Farmacêutico Responsável');
  const [pharmacistCrf, setPharmacistCrf] = useState('CRF-SP 00000');
  const [notes, setNotes] = useState('');

  // Modal de Emissão MTR
  const [isMtrModalOpen, setIsMtrModalOpen] = useState(false);
  const [collectorName, setCollectorName] = useState('Biotrat Ambiental & Incineração');
  const [collectorCnpj, setCollectorCnpj] = useState('12.345.678/0001-99');
  const [environmentalLicense, setEnvironmentalLicense] = useState('LO-IBAMA-7890/2026');
  const [vehiclePlate, setVehiclePlate] = useState('ABC-1234');
  const [driverName, setDriverName] = useState('Marcos Motorista');

  // Modal de CDF
  const [isCdfModalOpen, setIsCdfModalOpen] = useState(false);
  const [cdfManifestId, setCdfManifestId] = useState<number | null>(null);
  const [cdfNumber, setCdfNumber] = useState('');
  const [certificateDate, setCertificateDate] = useState('2026-11-23');
  const [incinerationPlant, setIncinerationPlant] = useState('Usina Termo-Ambiental SP-01');

  // Modal de Espelho de Impressão MTR
  const [isDocumentModalOpen, setIsDocumentModalOpen] = useState(false);
  const [documentContent, setDocumentContent] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [kpisData, storedData, manifestsData, allData, storesData] = await Promise.all([
        pgrssApi.getKpis(selectedStoreId),
        pgrssApi.listRecords({ store_id: selectedStoreId, status: 'STORED' }),
        pgrssApi.listManifests(selectedStoreId),
        pgrssApi.listRecords({ store_id: selectedStoreId }),
        storesApi.listStores().catch(() => []),
      ]);

      setKpis(kpisData);
      setStoredRecords(storedData);
      setManifests(manifestsData);
      setAllRecords(allData);
      if (storesData && storesData.length > 0) {
        setStores(storesData);
        if (!segStoreId && storesData[0]) setSegStoreId(storesData[0].id);
      }
    } catch (err: any) {
      console.error('Erro ao carregar dados PGRSS:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId, segStoreId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Busca de produto no modal de segregação
  useEffect(() => {
    if (productSearchTerm.trim().length >= 2) {
      searchProducts(productSearchTerm)
        .then((res) => setSearchResults(res))
        .catch(() => setSearchResults([]));
    } else {
      setSearchResults([]);
    }
  }, [productSearchTerm]);

  // Carrega lotes do produto selecionado
  useEffect(() => {
    if (selectedProduct) {
      getAvailableBatches(selectedProduct.id)
        .then((batches) => {
          setAvailableBatches(batches);
          if (batches.length > 0) setSelectedBatchId(batches[0].id);
        })
        .catch(() => setAvailableBatches([]));
    }
  }, [selectedProduct]);

  const toggleSelectRecord = (id: number) => {
    setSelectedRecordIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllStored = () => {
    if (selectedRecordIds.length === storedRecords.length) {
      setSelectedRecordIds([]);
    } else {
      setSelectedRecordIds(storedRecords.map((r) => r.id));
    }
  };

  const handleSegregateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) {
      alert('Selecione um produto.');
      return;
    }
    if (quantity <= 0 || weightKg <= 0) {
      alert('Quantidade e peso devem ser maiores que zero.');
      return;
    }

    try {
      await pgrssApi.segregateWaste({
        store_id: segStoreId,
        product_id: selectedProduct.id,
        batch_id: selectedBatchId,
        waste_group: wasteGroup,
        reason,
        quantity,
        weight_kg: weightKg,
        pharmacist_name: pharmacistName,
        pharmacist_crf: pharmacistCrf,
        notes,
      });

      alert('Resíduo segregado e armazenado no abrigo sanitário com sucesso!');
      setIsSegregateModalOpen(false);
      setSelectedProduct(null);
      setProductSearchTerm('');
      setNotes('');
      loadData();
    } catch (err: any) {
      alert(`Erro ao segregar resíduo: ${err.message}`);
    }
  };

  const handleMtrSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRecordIds.length === 0) {
      alert('Selecione ao menos um resíduo no abrigo.');
      return;
    }

    try {
      const manifest = await pgrssApi.createManifest({
        store_id: segStoreId,
        collector_name: collectorName,
        collector_cnpj: collectorCnpj,
        environmental_license: environmentalLicense,
        vehicle_plate: vehiclePlate,
        driver_name: driverName,
        disposal_record_ids: selectedRecordIds,
      });

      alert(`Manifesto MTR ${manifest.manifest_number} emitido com sucesso!`);
      setIsMtrModalOpen(false);
      setSelectedRecordIds([]);
      loadData();
    } catch (err: any) {
      alert(`Erro ao emitir MTR: ${err.message}`);
    }
  };

  const handleOpenCdfModal = (manifestId: number) => {
    setCdfManifestId(manifestId);
    setCdfNumber('');
    setIsCdfModalOpen(true);
  };

  const handleCdfSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cdfManifestId || !cdfNumber.trim()) {
      alert('Informe o número do certificado CDF.');
      return;
    }

    try {
      await pgrssApi.finalizeCdf(cdfManifestId, {
        cdf_number: cdfNumber,
        certificate_date: certificateDate,
        incineration_plant: incinerationPlant,
      });

      alert('Certificado de Destinação Final (CDF) registrado com sucesso! Ciclo de incineração encerrado.');
      setIsCdfModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(`Erro ao registrar CDF: ${err.message}`);
    }
  };

  const handleViewDocument = async (manifestId: number) => {
    try {
      const res = await pgrssApi.getManifestDocument(manifestId);
      setDocumentContent(res.document);
      setIsDocumentModalOpen(true);
    } catch (err: any) {
      alert(`Erro ao obter documento: ${err.message}`);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-900 text-slate-100 p-6 overflow-y-auto">
      {/* Header com Identificação Sanitária e Ações */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-800 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Trash2 className="w-8 h-8 text-rose-400" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Descarte Sanitário & PGRSS
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-medium border border-rose-500/30">
                  RDC 222/2018 ANVISA
                </span>
              </h1>
              <p className="text-sm text-slate-400">
                Gerenciamento de Resíduos Químicos (Grupo B), Manifesto MTR e Certificados CDF
              </p>
            </div>
          </div>
        </div>

        {/* Filtros e Ações Rápidas */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Seletor de Filial */}
          <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
            <Building2 className="w-4 h-4 text-slate-400" />
            <select
              data-testid="pgrss-store-select"
              value={selectedStoreId || ''}
              onChange={(e) => setSelectedStoreId(e.target.value ? Number(e.target.value) : undefined)}
              className="bg-transparent text-sm text-slate-200 outline-none cursor-pointer"
            >
              <option value="" className="bg-slate-800 text-slate-200">Todas as Lojas</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id} className="bg-slate-800 text-slate-200">
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Botão Segregar Medicamento */}
          <button
            data-testid="open-segregate-modal-button"
            onClick={() => setIsSegregateModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-sm font-medium shadow-sm transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            Segregar Resíduo
          </button>

          {/* Botão Emitir MTR */}
          <button
            data-testid="open-mtr-modal-button"
            onClick={() => setIsMtrModalOpen(true)}
            disabled={selectedRecordIds.length === 0}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              selectedRecordIds.length > 0
                ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-sm'
                : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
            }`}
          >
            <Truck className="w-4 h-4" />
            Emitir MTR ({selectedRecordIds.length})
          </button>
        </div>
      </div>

      {/* Cards de KPIs Sanitários */}
      {kpis && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {/* 1. Resíduos no Abrigo */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">No Abrigo (Aguardando)</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <span className="text-2xl font-bold text-amber-300 tracking-tight" data-testid="kpi-stored-weight">
                {kpis.stored_weight_kg.toFixed(3)} kg
              </span>
              <div className="text-xs text-slate-400 mt-1">
                {kpis.stored_records_count} itens segregados em custódia
              </div>
            </div>
          </div>

          {/* 2. Resíduos Despachados */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Em Transporte (MTR)</span>
              <Truck className="w-4 h-4 text-sky-400" />
            </div>
            <div>
              <span className="text-2xl font-bold text-sky-300 tracking-tight" data-testid="kpi-dispatched-weight">
                {kpis.dispatched_weight_kg.toFixed(3)} kg
              </span>
              <div className="text-xs text-slate-400 mt-1">
                {kpis.active_manifests_count} manifestos em trânsito
              </div>
            </div>
          </div>

          {/* 3. Resíduos Incinerados */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Destinados (CDF Finalizado)</span>
              <Flame className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <span className="text-2xl font-bold text-emerald-300 tracking-tight" data-testid="kpi-incinerated-weight">
                {kpis.incinerated_weight_kg.toFixed(3)} kg
              </span>
              <div className="text-xs text-slate-400 mt-1">
                {kpis.incinerated_records_count} itens incinerados comprovados
              </div>
            </div>
          </div>

          {/* 4. Total de Manifestos */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Conformidade Sanitária</span>
              <ShieldAlert className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <span className="text-2xl font-bold text-purple-300 tracking-tight">
                100% Conforme
              </span>
              <div className="text-xs text-slate-400 mt-1">
                {kpis.finalized_manifests_count} CDFs auditados
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navegação por Abas */}
      <div className="flex border-b border-slate-800 mt-8">
        <button
          data-testid="tab-abrigo"
          onClick={() => setActiveTab('ABRIGO')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-sm font-semibold transition-colors ${
            activeTab === 'ABRIGO'
              ? 'border-rose-500 text-rose-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          Abrigo de Resíduos ({storedRecords.length})
        </button>
        <button
          data-testid="tab-manifests"
          onClick={() => setActiveTab('MANIFESTS')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-sm font-semibold transition-colors ${
            activeTab === 'MANIFESTS'
              ? 'border-rose-500 text-rose-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Truck className="w-4 h-4" />
          Manifestos MTR & CDF ({manifests.length})
        </button>
        <button
          data-testid="tab-history"
          onClick={() => setActiveTab('HISTORY')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-sm font-semibold transition-colors ${
            activeTab === 'HISTORY'
              ? 'border-rose-500 text-rose-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          Histórico Completo ({allRecords.length})
        </button>
      </div>

      {/* Conteúdo das Abas */}
      <div className="mt-6">
        {loading && (
          <div className="flex items-center justify-center p-12 text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
            Carregando registros sanitários PGRSS...
          </div>
        )}

        {!loading && activeTab === 'ABRIGO' && (
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-700/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  data-testid="select-all-stored"
                  checked={storedRecords.length > 0 && selectedRecordIds.length === storedRecords.length}
                  onChange={handleSelectAllStored}
                  className="rounded bg-slate-800 border-slate-700 text-rose-500 focus:ring-0 cursor-pointer"
                />
                <h3 className="font-semibold text-white">Resíduos Químicos Armazenados no Abrigo</h3>
              </div>
              <span className="text-xs text-slate-400">
                Selecione os resíduos e clique em "Emitir MTR" para transferir para a transportadora
              </span>
            </div>
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-800/80 text-slate-400 text-xs border-b border-slate-700">
                  <th className="py-2.5 px-4 w-10"></th>
                  <th className="py-2.5 px-4">Medicamento / Resíduo</th>
                  <th className="py-2.5 px-4">Lote</th>
                  <th className="py-2.5 px-4">Grupo PGRSS</th>
                  <th className="py-2.5 px-4">Motivo</th>
                  <th className="py-2.5 px-4 text-right">Qtd</th>
                  <th className="py-2.5 px-4 text-right">Peso (kg)</th>
                  <th className="py-2.5 px-4">Responsável CRF</th>
                  <th className="py-2.5 px-4">Data Segregação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300 text-xs">
                {storedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-500">
                      Nenhum resíduo aguardando coleta no abrigo.
                    </td>
                  </tr>
                ) : (
                  storedRecords.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          data-testid={`select-record-${rec.id}`}
                          checked={selectedRecordIds.includes(rec.id)}
                          onChange={() => toggleSelectRecord(rec.id)}
                          className="rounded bg-slate-800 border-slate-700 text-rose-500 focus:ring-0 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-4 font-medium text-white">{rec.product_name}</td>
                      <td className="py-3 px-4 font-mono text-slate-400">{rec.batch_number || 'S/LOTE'}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          {rec.waste_group === 'GRUPO_B_QUIMICO' ? 'Grupo B (Químico)' : rec.waste_group}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[11px] bg-slate-800 text-slate-300 border border-slate-700">
                          {rec.reason}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono">{rec.quantity}</td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-white">
                        {rec.weight_kg.toFixed(3)} kg
                      </td>
                      <td className="py-3 px-4 text-slate-400">{rec.pharmacist_crf}</td>
                      <td className="py-3 px-4 font-mono text-slate-500">{rec.created_at.substring(0, 10)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {!loading && activeTab === 'MANIFESTS' && (
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-700/60 flex items-center justify-between">
              <h3 className="font-semibold text-white">Manifestos de Transporte de Resíduos (MTR)</h3>
              <span className="text-xs text-slate-400">{manifests.length} manifestos emitidos</span>
            </div>
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-800/80 text-slate-400 text-xs border-b border-slate-700">
                  <th className="py-2.5 px-4">Número MTR</th>
                  <th className="py-2.5 px-4">Transportadora Coletora</th>
                  <th className="py-2.5 px-4">Veículo / Placa</th>
                  <th className="py-2.5 px-4 text-right">Volumes</th>
                  <th className="py-2.5 px-4 text-right">Peso Total</th>
                  <th className="py-2.5 px-4">Data Expedição</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Certificado CDF</th>
                  <th className="py-2.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300 text-xs">
                {manifests.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-500">
                      Nenhum manifesto MTR emitido ainda.
                    </td>
                  </tr>
                ) : (
                  manifests.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono font-semibold text-white">{m.manifest_number}</td>
                      <td className="py-3 px-4 font-medium text-slate-200">{m.collector_name}</td>
                      <td className="py-3 px-4 font-mono">{m.vehicle_plate}</td>
                      <td className="py-3 px-4 text-right font-mono">{m.total_items}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-white">
                        {m.total_weight_kg.toFixed(3)} kg
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400">{m.dispatch_date}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                            m.status === 'DESTINED'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                          }`}
                        >
                          {m.status === 'DESTINED' ? 'FINALIZADO (CDF)' : 'EM TRÂNSITO'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-emerald-400">
                        {m.cdf_number || '-'}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          data-testid={`view-document-button-${m.id}`}
                          onClick={() => handleViewDocument(m.id)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded text-xs transition-colors"
                          title="Visualizar documento MTR"
                        >
                          Espelho MTR
                        </button>
                        {m.status === 'DISPATCHED' && (
                          <button
                            data-testid={`open-cdf-modal-button-${m.id}`}
                            onClick={() => handleOpenCdfModal(m.id)}
                            className="px-2.5 py-1 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 rounded text-xs transition-colors"
                          >
                            Informar CDF
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

        {!loading && activeTab === 'HISTORY' && (
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-700/60 flex items-center justify-between">
              <h3 className="font-semibold text-white">Rastreabilidade Completa de Resíduos Sanitários</h3>
              <span className="text-xs text-slate-400">{allRecords.length} registros no histórico</span>
            </div>
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-800/80 text-slate-400 text-xs border-b border-slate-700">
                  <th className="py-2.5 px-4">Medicamento / Resíduo</th>
                  <th className="py-2.5 px-4">Lote</th>
                  <th className="py-2.5 px-4">Grupo</th>
                  <th className="py-2.5 px-4">Motivo</th>
                  <th className="py-2.5 px-4 text-right">Qtd</th>
                  <th className="py-2.5 px-4 text-right">Peso (kg)</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Farmacêutico</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300 text-xs">
                {allRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-medium text-white">{rec.product_name}</td>
                    <td className="py-3 px-4 font-mono text-slate-400">{rec.batch_number || 'S/LOTE'}</td>
                    <td className="py-3 px-4">{rec.waste_group}</td>
                    <td className="py-3 px-4">{rec.reason}</td>
                    <td className="py-3 px-4 text-right font-mono">{rec.quantity}</td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-white">{rec.weight_kg.toFixed(3)}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          rec.status === 'INCINERATED'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : rec.status === 'DISPATCHED'
                            ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {rec.status === 'INCINERATED' ? 'INCINERADO' : rec.status === 'DISPATCHED' ? 'DESPACHADO' : 'NO ABRIGO'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400">{rec.pharmacist_crf}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Segregação de Resíduo */}
      {isSegregateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-rose-400" />
              Segregar Medicamento para Descarte Sanitário
            </h2>
            <form onSubmit={handleSegregateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Filial / Loja</label>
                <select
                  data-testid="segregate-store-select"
                  value={segStoreId}
                  onChange={(e) => setSegStoreId(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none"
                >
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Buscar Medicamento no Catálogo</label>
                <input
                  type="text"
                  data-testid="segregate-product-search-input"
                  value={productSearchTerm}
                  onChange={(e) => setProductSearchTerm(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none"
                  placeholder="Digite nome, princípio ativo ou EAN..."
                />
                {searchResults.length > 0 && !selectedProduct && (
                  <div className="mt-1 bg-slate-800 border border-slate-700 rounded-lg max-h-40 overflow-y-auto divide-y divide-slate-700">
                    {searchResults.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => {
                          setSelectedProduct(p);
                          setSearchResults([]);
                          setProductSearchTerm(p.name);
                        }}
                        className="p-2 text-xs text-slate-200 hover:bg-slate-700 cursor-pointer flex justify-between"
                      >
                        <span className="font-medium">{p.name}</span>
                        <span className="text-slate-400 font-mono">{p.ean}</span>
                      </div>
                    ))}
                  </div>
                )}
                {selectedProduct && (
                  <div className="mt-1 text-xs text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Selecionado: {selectedProduct.name}
                  </div>
                )}
              </div>

              {availableBatches.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Lote Físico no Estoque</label>
                  <select
                    data-testid="segregate-batch-select"
                    value={selectedBatchId}
                    onChange={(e) => setSelectedBatchId(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none font-mono"
                  >
                    {availableBatches.map((b) => (
                      <option key={b.id} value={b.id}>
                        Lote: {b.batch_number} (Saldo: {b.quantity} un) - Venc: {b.expiration_date}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Grupo de Resíduo (PGRSS)</label>
                  <select
                    data-testid="segregate-group-select"
                    value={wasteGroup}
                    onChange={(e) => setWasteGroup(e.target.value as WasteGroup)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none"
                  >
                    <option value="GRUPO_B_QUIMICO">Grupo B - Químico</option>
                    <option value="GRUPO_A_BIOLOGICO">Grupo A - Biológico</option>
                    <option value="GRUPO_E_PERFUROCORTANTE">Grupo E - Perfurocortante</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Motivo do Descarte</label>
                  <select
                    data-testid="segregate-reason-select"
                    value={reason}
                    onChange={(e) => setReason(e.target.value as DisposalReason)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none"
                  >
                    <option value="VENCIDO">Medicamento Vencido</option>
                    <option value="AVARIADO">Avariado / Quebrado</option>
                    <option value="RECALL_ANVISA">Recall Sanitário ANVISA</option>
                    <option value="SOBRA_MANIPULACAO">Sobra de Manipulação</option>
                    <option value="CONTAMINADO">Contaminado</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Quantidade (unidades)</label>
                  <input
                    type="number"
                    min="1"
                    data-testid="segregate-quantity-input"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Peso Estimado (kg)</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    data-testid="segregate-weight-input"
                    value={weightKg}
                    onChange={(e) => setWeightKg(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Farmacêutico RT</label>
                  <input
                    type="text"
                    data-testid="segregate-pharmacist-name-input"
                    value={pharmacistName}
                    onChange={(e) => setPharmacistName(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">CRF / UF</label>
                  <input
                    type="text"
                    data-testid="segregate-pharmacist-crf-input"
                    value={pharmacistCrf}
                    onChange={(e) => setPharmacistCrf(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsSegregateModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  data-testid="segregate-submit-button"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Segregar para Abrigo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Emissão MTR */}
      {isMtrModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Truck className="w-5 h-5 text-amber-400" />
              Emitir Manifesto de Transporte de Resíduos (MTR)
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Você está despachando <strong>{selectedRecordIds.length}</strong> resíduo(s) selecionado(s) do abrigo sanitário.
            </p>
            <form onSubmit={handleMtrSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Transportadora Especializada</label>
                <input
                  type="text"
                  data-testid="mtr-collector-name-input"
                  value={collectorName}
                  onChange={(e) => setCollectorName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">CNPJ da Coletora</label>
                  <input
                    type="text"
                    data-testid="mtr-collector-cnpj-input"
                    value={collectorCnpj}
                    onChange={(e) => setCollectorCnpj(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Licença Ambiental (LO)</label>
                  <input
                    type="text"
                    data-testid="mtr-environmental-license-input"
                    value={environmentalLicense}
                    onChange={(e) => setEnvironmentalLicense(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Placa do Veículo</label>
                  <input
                    type="text"
                    data-testid="mtr-vehicle-plate-input"
                    value={vehiclePlate}
                    onChange={(e) => setVehiclePlate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Nome do Motorista</label>
                  <input
                    type="text"
                    data-testid="mtr-driver-name-input"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsMtrModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  data-testid="mtr-submit-button"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Gerar MTR Oficial
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Informar CDF */}
      {isCdfModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Flame className="w-5 h-5 text-emerald-400" />
              Registrar Certificado de Destinação Final (CDF)
            </h2>
            <form onSubmit={handleCdfSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Número do CDF Oficial</label>
                <input
                  type="text"
                  data-testid="cdf-number-input"
                  value={cdfNumber}
                  onChange={(e) => setCdfNumber(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none font-mono"
                  placeholder="Ex: CDF-2026-998877"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Usina de Incineração / Coprocessamento</label>
                <input
                  type="text"
                  data-testid="cdf-plant-input"
                  value={incinerationPlant}
                  onChange={(e) => setIncinerationPlant(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Data da Destinação Térmica</label>
                <input
                  type="date"
                  data-testid="cdf-date-input"
                  value={certificateDate}
                  onChange={(e) => setCertificateDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none font-mono"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCdfModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  data-testid="cdf-submit-button"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Confirmar CDF & Baixa Final
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Espelho de Documento MTR */}
      {isDocumentModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-3xl w-full p-6 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-400" />
                Espelho do Manifesto de Transporte de Resíduos (MTR)
              </h2>
              <button
                onClick={() => setIsDocumentModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto mt-4 p-4 bg-slate-950 rounded-lg font-mono text-xs text-slate-300 whitespace-pre border border-slate-800">
              {documentContent}
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800 mt-4">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium transition-colors"
              >
                <Printer className="w-4 h-4" />
                Imprimir MTR
              </button>
              <button
                type="button"
                onClick={() => setIsDocumentModalOpen(false)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-sm font-medium transition-colors"
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
