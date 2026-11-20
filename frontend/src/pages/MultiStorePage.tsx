import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  ArrowRightLeft,
  Package,
  Plus,
  CheckCircle2,
  AlertCircle,
  Truck,
  FileText,
  Printer,
  Copy,
  Check,
  X,
  MapPin,
  Phone,
  Mail,
  Loader2,
  RefreshCw,
  Ban,
} from 'lucide-react';
import { useStore, isHeadquartersStore } from '../contexts/StoreContext';
import type {
  Store,
  CreateStoreInput,
  TransferWithItems,
  TransferStatus,
  CreateTransferInput,
  NetworkStockItem,
  Product,
  TransferSlipResult,
  FiscalTransferResult,
} from '../types';
import { api } from '../services/api';
import ProductSearch from '../components/ProductSearch';

export type MultiStoreTab = 'stores' | 'transfers' | 'stock';

export default function MultiStorePage() {
  const { stores, currentStore, setCurrentStore, refreshStores } = useStore();

  const [activeTab, setActiveTab] = useState<MultiStoreTab>('stores');
  const [loadingTransfers, setLoadingTransfers] = useState<boolean>(false);
  const [transfers, setTransfers] = useState<TransferWithItems[]>([]);
  const [transferFilterStatus, setTransferFilterStatus] = useState<string>('TODOS');
  const [alertSuccess, setAlertSuccess] = useState<string | null>(null);
  const [alertError, setAlertError] = useState<string | null>(null);

  // Modals state
  const [isNewStoreModalOpen, setIsNewStoreModalOpen] = useState<boolean>(false);
  const [isNewTransferModalOpen, setIsNewTransferModalOpen] = useState<boolean>(false);
  const [selectedTransferForSlip, setSelectedTransferForSlip] = useState<number | null>(null);
  const [slipResult, setSlipResult] = useState<TransferSlipResult | null>(null);
  const [loadingSlip, setLoadingSlip] = useState<boolean>(false);

  // Dispatch modal state
  const [dispatchTransferId, setDispatchTransferId] = useState<number | null>(null);
  const [dispatchedBy, setDispatchedBy] = useState<string>('');
  const [carrierName, setCarrierName] = useState<string>('');
  const [trackingCode, setTrackingCode] = useState<string>('');
  const [isSubmittingDispatch, setIsSubmittingDispatch] = useState<boolean>(false);

  // Receive modal state
  const [receiveTransferId, setReceiveTransferId] = useState<number | null>(null);
  const [receivedBy, setReceivedBy] = useState<string>('');
  const [isSubmittingReceive, setIsSubmittingReceive] = useState<boolean>(false);

  // Cancel modal state
  const [cancelTransferId, setCancelTransferId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [isSubmittingCancel, setIsSubmittingCancel] = useState<boolean>(false);

  // Stock lookup tab state
  const [searchedProduct, setSearchedProduct] = useState<Product | null>(null);
  const [networkStock, setNetworkStock] = useState<NetworkStockItem[]>([]);
  const [loadingStock, setLoadingStock] = useState<boolean>(false);

  // Transfer pre-fill state from stock tab
  const [prefillSourceStoreId, setPrefillSourceStoreId] = useState<number | null>(null);
  const [prefillProduct, setPrefillProduct] = useState<Product | null>(null);

  // Load transfers list
  const loadTransfers = useCallback(async () => {
    setLoadingTransfers(true);
    setAlertError(null);
    try {
      const filters = transferFilterStatus !== 'TODOS' ? { status: transferFilterStatus as TransferStatus } : undefined;
      const res = await api.getTransfers(filters);
      setTransfers(res.transfers);
    } catch (err: any) {
      setAlertError(err?.message || 'Falha ao carregar transferências');
    } finally {
      setLoadingTransfers(false);
    }
  }, [transferFilterStatus]);

  useEffect(() => {
    if (activeTab === 'transfers') {
      loadTransfers();
    }
  }, [activeTab, loadTransfers]);

  // Load slip
  const handleOpenSlip = async (transferId: number) => {
    setSelectedTransferForSlip(transferId);
    setLoadingSlip(true);
    try {
      const res = await api.getTransferSlip(transferId);
      setSlipResult(res);
    } catch (err: any) {
      setAlertError(err?.message || 'Falha ao gerar romaneio');
      setSelectedTransferForSlip(null);
    } finally {
      setLoadingSlip(false);
    }
  };

  // Emit NF-e
  const handleEmitNfe = async (transferId: number) => {
    if (!window.confirm(`Deseja emitir a NF-e Modelo 55 para a transferência #${transferId}?`)) {
      return;
    }
    setAlertError(null);
    setAlertSuccess(null);
    try {
      const res: FiscalTransferResult = await api.emitTransferNfe(transferId);
      setAlertSuccess(`NF-e emitida com sucesso! Chave: ${res.nfeKey} (Protocolo: ${res.protocol})`);
      loadTransfers();
    } catch (err: any) {
      setAlertError(err?.message || 'Falha na emissão da NF-e de transferência');
    }
  };

  // Dispatch confirm
  const handleConfirmDispatch = async () => {
    if (!dispatchTransferId || !dispatchedBy.trim()) return;
    setIsSubmittingDispatch(true);
    setAlertError(null);
    try {
      await api.dispatchTransfer(dispatchTransferId, {
        dispatchedBy: dispatchedBy.trim(),
        carrierName: carrierName.trim() || undefined,
        trackingCode: trackingCode.trim() || undefined,
      });
      setAlertSuccess(`Transferência #${dispatchTransferId} despachada com sucesso! Lotes deduzidos por FEFO.`);
      setDispatchTransferId(null);
      setDispatchedBy('');
      setCarrierName('');
      setTrackingCode('');
      loadTransfers();
    } catch (err: any) {
      setAlertError(err?.message || 'Erro ao despachar transferência');
    } finally {
      setIsSubmittingDispatch(false);
    }
  };

  // Receive confirm
  const handleConfirmReceive = async () => {
    if (!receiveTransferId || !receivedBy.trim()) return;
    setIsSubmittingReceive(true);
    setAlertError(null);
    try {
      await api.receiveTransfer(receiveTransferId, {
        receivedBy: receivedBy.trim(),
      });
      setAlertSuccess(`Transferência #${receiveTransferId} recebida com sucesso! Estoque incorporado na loja destino.`);
      setReceiveTransferId(null);
      setReceivedBy('');
      loadTransfers();
    } catch (err: any) {
      setAlertError(err?.message || 'Erro ao receber transferência');
    } finally {
      setIsSubmittingReceive(false);
    }
  };

  // Cancel confirm
  const handleConfirmCancel = async () => {
    if (!cancelTransferId || !cancelReason.trim()) return;
    setIsSubmittingCancel(true);
    setAlertError(null);
    try {
      await api.cancelTransfer(cancelTransferId, {
        reason: cancelReason.trim(),
      });
      setAlertSuccess(`Transferência #${cancelTransferId} cancelada com sucesso.`);
      setCancelTransferId(null);
      setCancelReason('');
      loadTransfers();
    } catch (err: any) {
      setAlertError(err?.message || 'Erro ao cancelar transferência');
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  // Stock lookup in tab 3
  const handleSelectProductForStock = async (product: Product) => {
    setSearchedProduct(product);
    setLoadingStock(true);
    setAlertError(null);
    try {
      const items = await api.getNetworkProductStock(product.id);
      setNetworkStock(items);
    } catch (err: any) {
      setAlertError(err?.message || 'Erro ao consultar estoque da rede');
    } finally {
      setLoadingStock(false);
    }
  };

  const getStatusBadge = (status: TransferStatus) => {
    switch (status) {
      case 'DRAFT':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-200 text-slate-800">Rascunho</span>;
      case 'REQUESTED':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-300">Solicitada</span>;
      case 'IN_TRANSIT':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">Em Trânsito</span>;
      case 'RECEIVED':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">Recebida</span>;
      case 'CANCELLED':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-800 border border-red-300">Cancelada</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-900 text-slate-100 min-h-0 overflow-y-auto">
      {/* Top Header Banner */}
      <div className="bg-slate-950 border-b border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-950 rounded-xl border border-emerald-600/60 text-emerald-400 shadow-sm">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              Gestão Multi-Loja & Transferências em Rede
            </h1>
            <p className="text-xs text-slate-400">
              Arquitetura corporativa de drogarias: Matriz, Filiais, Transferências FEFO e Romaneios fiscais
            </p>
          </div>
        </div>

        {/* Global Tab Navigation */}
        <div className="flex items-center space-x-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            data-testid="tab-stores"
            onClick={() => setActiveTab('stores')}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'stores'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Rede & Filiais ({stores.length})</span>
          </button>

          <button
            type="button"
            data-testid="tab-transfers"
            onClick={() => setActiveTab('transfers')}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'transfers'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Transferências entre Filiais</span>
          </button>

          <button
            type="button"
            data-testid="tab-stock"
            onClick={() => setActiveTab('stock')}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'stock'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Consulta Global de Estoque</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Area */}
      <div className="p-6 max-w-7xl w-full mx-auto flex-1 flex flex-col space-y-4">
        {/* Alerts */}
        {alertSuccess && (
          <div className="p-3 bg-emerald-950/80 border border-emerald-600 rounded-lg text-emerald-200 text-sm flex items-center justify-between shadow-sm animate-fade-in">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <span>{alertSuccess}</span>
            </div>
            <button type="button" onClick={() => setAlertSuccess(null)} className="text-emerald-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {alertError && (
          <div className="p-3 bg-red-950/80 border border-red-600 rounded-lg text-red-200 text-sm flex items-center justify-between shadow-sm animate-fade-in">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <span>{alertError}</span>
            </div>
            <button type="button" onClick={() => setAlertError(null)} className="text-red-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ===================== TAB 1: REDE & FILIAIS ===================== */}
        {activeTab === 'stores' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">Lojas Cadastradas na Rede</h2>
                <p className="text-xs text-slate-400">
                  Gerencie as unidades da drogaria e comute instantaneamente a loja ativa do terminal
                </p>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={refreshStores}
                  className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Atualizar</span>
                </button>

                <button
                  type="button"
                  data-testid="new-store-button"
                  onClick={() => setIsNewStoreModalOpen(true)}
                  className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nova Loja / Filial</span>
                </button>
              </div>
            </div>

            {/* Grid of Stores */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stores.map((s) => {
                const isHq = isHeadquartersStore(s);
                const isActiveTerminal = currentStore?.id === s.id;

                return (
                  <div
                    key={s.id}
                    className={`bg-slate-950 rounded-xl border p-5 flex flex-col justify-between transition shadow-md ${
                      isActiveTerminal
                        ? 'border-emerald-500 ring-1 ring-emerald-500/50'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      {/* Top badge line */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              isHq
                                ? 'bg-amber-950 text-amber-300 border border-amber-600/60'
                                : 'bg-blue-950 text-blue-300 border border-blue-600/60'
                            }`}
                          >
                            {isHq ? 'Matriz' : 'Filial'}
                          </span>
                          <span className="font-mono text-xs text-slate-400 font-bold">{s.code}</span>
                        </div>

                        {isActiveTerminal && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-600/70">
                            Loja Ativa
                          </span>
                        )}
                      </div>

                      {/* Store Name & Company */}
                      <h3 className="text-base font-bold text-white truncate" title={s.name}>
                        {s.name}
                      </h3>
                      <p className="text-xs text-slate-400 truncate mb-4" title={s.companyName}>
                        {s.companyName}
                      </p>

                      {/* Fiscal Info */}
                      <div className="bg-slate-900/80 rounded-lg p-3 border border-slate-800/80 text-xs space-y-1.5 mb-4">
                        <div className="flex justify-between">
                          <span className="text-slate-400">CNPJ:</span>
                          <span className="font-mono text-slate-200 font-bold">{s.cnpj}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">IE:</span>
                          <span className="font-mono text-slate-200">{s.ie}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Regime:</span>
                          <span className="text-slate-200">{s.taxRegime}</span>
                        </div>
                      </div>

                      {/* Address & Contact */}
                      <div className="text-xs text-slate-400 space-y-1">
                        <p className="flex items-start gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-500 mt-0.5 flex-shrink-0" />
                          <span>
                            {s.street}, {s.number} - {s.neighborhood}, {s.city}/{s.state} (CEP: {s.zipCode})
                          </span>
                        </p>
                        {s.phone && (
                          <p className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                            <span>{s.phone}</span>
                          </p>
                        )}
                        {s.email && (
                          <p className="flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                            <span>{s.email}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Action button */}
                    <div className="mt-5 pt-3 border-t border-slate-800 flex justify-end">
                      {isActiveTerminal ? (
                        <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                          <Check className="w-4 h-4" /> Posto Ativo Conectado
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentStore(s);
                            setAlertSuccess(`Loja ativa comutada para [${s.code}] ${s.name}`);
                          }}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold transition border border-slate-700 cursor-pointer"
                        >
                          Definir como Loja Ativa
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ===================== TAB 2: TRANSFERÊNCIAS ENTRE FILIAIS ===================== */}
        {activeTab === 'transfers' && (
          <div className="space-y-4">
            {/* Top Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
              {/* Filter by status */}
              <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                <span className="text-xs font-semibold text-slate-400 mr-1">Status:</span>
                {['TODOS', 'DRAFT', 'REQUESTED', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    data-testid={`status-filter-${st.toLowerCase()}`}
                    onClick={() => setTransferFilterStatus(st)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      transferFilterStatus === st
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {st === 'TODOS' ? 'Todos' : st}
                  </button>
                ))}
              </div>

              {/* Actions */}
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={loadTransfers}
                  disabled={loadingTransfers}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingTransfers ? 'animate-spin' : ''}`} />
                  <span>Atualizar</span>
                </button>

                <button
                  type="button"
                  data-testid="new-transfer-button"
                  onClick={() => {
                    setPrefillSourceStoreId(null);
                    setPrefillProduct(null);
                    setIsNewTransferModalOpen(true);
                  }}
                  className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nova Transferência</span>
                </button>
              </div>
            </div>

            {/* Transfers Table */}
            {loadingTransfers ? (
              <div className="py-16 flex flex-col items-center justify-center text-slate-400 space-y-3 bg-slate-950 rounded-xl border border-slate-800">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                <p className="text-sm font-medium">Carregando histórico de transferências...</p>
              </div>
            ) : transfers.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-sm bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <ArrowRightLeft className="w-10 h-10 mx-auto text-slate-600" />
                <p>Nenhuma transferência encontrada com os filtros selecionados.</p>
              </div>
            ) : (
              <div className="overflow-x-auto bg-slate-950 rounded-xl border border-slate-800 shadow-md">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-slate-400 font-bold uppercase tracking-wider text-[11px] border-b border-slate-800">
                      <th className="py-3 px-4">Nº / Data</th>
                      <th className="py-3 px-3">Origem</th>
                      <th className="py-3 px-3">Destino</th>
                      <th className="py-3 px-3 text-center">Itens / Qtd</th>
                      <th className="py-3 px-3 text-center">CFOP</th>
                      <th className="py-3 px-3 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 font-medium text-slate-200">
                    {transfers.map((tr) => {
                      const totalQty = (tr.items || []).reduce((acc, it) => acc + (it.requestedQuantity ?? (it as any).requested_quantity ?? 0), 0);
                      const sourceName = tr.sourceStore?.name || `Loja #${tr.sourceStoreId ?? (tr as any).source_store_id}`;
                      const targetName = tr.targetStore?.name || `Loja #${tr.targetStoreId ?? (tr as any).target_store_id}`;

                      return (
                        <tr key={tr.id} className="hover:bg-slate-900/60 transition">
                          <td className="py-3 px-4">
                            <span className="font-mono font-bold text-emerald-400">
                              {tr.transferNumber || (tr as any).transfer_number || `#${tr.id}`}
                            </span>
                            <p className="text-[11px] text-slate-500 font-normal">
                              {tr.createdAt ? new Date(tr.createdAt).toLocaleDateString('pt-BR') : '-'}
                            </p>
                          </td>

                          <td className="py-3 px-3 font-semibold text-slate-300">
                            {sourceName}
                          </td>

                          <td className="py-3 px-3 font-semibold text-slate-300">
                            {targetName}
                          </td>

                          <td className="py-3 px-3 text-center font-mono">
                            <span className="text-slate-100 font-bold">{tr.items?.length || 0}</span> itens
                            <span className="text-slate-500 block text-[11px]">({totalQty} un)</span>
                          </td>

                          <td className="py-3 px-3 text-center font-mono text-slate-400">
                            {tr.cfop}
                          </td>

                          <td className="py-3 px-3 text-center">
                            {getStatusBadge(tr.status)}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end space-x-1.5 flex-wrap gap-y-1">
                              {/* DRAFT / REQUESTED actions */}
                              {(tr.status === 'DRAFT' || tr.status === 'REQUESTED') && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDispatchTransferId(tr.id);
                                    setDispatchedBy('Farmacêutico / Expedição');
                                  }}
                                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-semibold transition cursor-pointer"
                                >
                                  Despachar
                                </button>
                              )}

                              {/* IN_TRANSIT actions */}
                              {tr.status === 'IN_TRANSIT' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setReceiveTransferId(tr.id);
                                      setReceivedBy('Recebedor / Balconista');
                                    }}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold transition cursor-pointer"
                                  >
                                    Receber
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleEmitNfe(tr.id)}
                                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold transition cursor-pointer"
                                  >
                                    Emitir NF-e
                                  </button>
                                </>
                              )}

                              {/* Romaneio available for IN_TRANSIT and RECEIVED */}
                              {(tr.status === 'IN_TRANSIT' || tr.status === 'RECEIVED') && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenSlip(tr.id)}
                                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-semibold border border-slate-700 transition cursor-pointer"
                                >
                                  Romaneio
                                </button>
                              )}

                              {/* NF-e protocol badge if already emitted */}
                              {tr.nfeKey && (
                                <span
                                  className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-950 text-blue-300 border border-blue-600/60"
                                  title={`NF-e: ${tr.nfeKey}`}
                                >
                                  NF-e OK
                                </span>
                              )}

                              {/* Cancel action */}
                              {(tr.status === 'DRAFT' || tr.status === 'REQUESTED' || tr.status === 'IN_TRANSIT') && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCancelTransferId(tr.id);
                                    setCancelReason('');
                                  }}
                                  className="px-2 py-1 bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-700/60 rounded text-xs transition cursor-pointer"
                                >
                                  Cancelar
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ===================== TAB 3: CONSULTA GLOBAL DE ESTOQUE EM REDE ===================== */}
        {activeTab === 'stock' && (
          <div className="space-y-4">
            <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4">
              <div>
                <h2 className="text-base font-bold text-white">Consulta Global de Estoque em Rede</h2>
                <p className="text-xs text-slate-400">
                  Verifique a disponibilidade física e saldos disponíveis em todas as lojas simultaneamente
                </p>
              </div>

              {/* Product search box */}
              <div className="max-w-2xl">
                <ProductSearch
                  onSelectProduct={handleSelectProductForStock}
                  placeholder="Pesquisar medicamento por Nome, EAN ou Princípio Ativo..."
                />
              </div>
            </div>

            {/* Results table */}
            {loadingStock ? (
              <div className="py-16 flex flex-col items-center justify-center text-slate-400 space-y-3 bg-slate-950 rounded-xl border border-slate-800">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                <p className="text-sm font-medium">Buscando saldos em todas as filiais...</p>
              </div>
            ) : searchedProduct && networkStock.length > 0 ? (
              <div className="space-y-3">
                {/* Product details card */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold text-white">{searchedProduct.name}</h3>
                    <p className="text-xs text-slate-400">
                      EAN: <span className="font-mono text-slate-200">{searchedProduct.ean}</span> | Registro MS:{' '}
                      <span className="font-mono text-slate-200">{searchedProduct.msRegistration}</span>
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-slate-400">Saldo Total Rede:</span>
                    <p className="text-xl font-bold font-mono text-emerald-400">
                      {networkStock.reduce((acc, it) => acc + (it.availableQuantity ?? (it as any).available_quantity ?? 0), 0)} un
                    </p>
                  </div>
                </div>

                {/* Comparative table */}
                <div className="overflow-x-auto bg-slate-950 rounded-xl border border-slate-800 shadow-md">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-900 text-slate-400 font-bold uppercase tracking-wider text-[11px] border-b border-slate-800">
                        <th className="py-3 px-4">Loja / Filial</th>
                        <th className="py-3 px-3">Cidade / UF</th>
                        <th className="py-3 px-3 text-center">Físico</th>
                        <th className="py-3 px-3 text-center">Reservado</th>
                        <th className="py-3 px-3 text-center">Disponível</th>
                        <th className="py-3 px-3">Validade Próxima</th>
                        <th className="py-3 px-4 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 font-medium text-slate-200">
                      {networkStock.map((it) => {
                        const storeId = it.storeId ?? (it as any).store_id;
                        const isHq = Boolean(it.isHeadquarters || (it as any).is_headquarters);
                        const avail = it.availableQuantity ?? (it as any).available_quantity ?? 0;
                        const total = it.totalQuantity ?? (it as any).total_quantity ?? 0;
                        const reserved = it.reservedQuantity ?? (it as any).reserved_quantity ?? 0;

                        return (
                          <tr key={storeId} className="hover:bg-slate-900/60 transition">
                            <td className="py-3 px-4">
                              <div className="flex items-center space-x-2">
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                                    isHq
                                      ? 'bg-amber-950 text-amber-300 border border-amber-600/60'
                                      : 'bg-blue-950 text-blue-300 border border-blue-600/60'
                                  }`}
                                >
                                  {isHq ? 'Matriz' : 'Filial'}
                                </span>
                                <span className="font-bold text-white">{it.storeName ?? (it as any).store_name}</span>
                              </div>
                            </td>

                            <td className="py-3 px-3 text-slate-400">
                              {it.storeCity ?? (it as any).store_city}
                              {it.storeState ?? (it as any).store_state ? `/${it.storeState ?? (it as any).store_state}` : ''}
                            </td>

                            <td className="py-3 px-3 text-center font-mono">{total}</td>
                            <td className="py-3 px-3 text-center font-mono text-amber-400">{reserved > 0 ? reserved : '-'}</td>

                            <td className="py-3 px-3 text-center">
                              <span
                                className={`inline-block px-2 py-0.5 rounded font-mono font-bold text-xs ${
                                  avail > 0
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-600/60'
                                    : 'bg-red-950 text-red-300 border border-red-800/60'
                                }`}
                              >
                                {avail}
                              </span>
                            </td>

                            <td className="py-3 px-3 font-mono text-slate-400">
                              {it.earliestExpiry ?? (it as any).earliest_expiry ?? '-'}
                            </td>

                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                disabled={avail <= 0 || (currentStore?.id === storeId)}
                                onClick={() => {
                                  setPrefillSourceStoreId(storeId);
                                  setPrefillProduct(searchedProduct);
                                  setIsNewTransferModalOpen(true);
                                }}
                                className={`px-2.5 py-1 rounded text-xs font-semibold transition cursor-pointer ${
                                  avail > 0 && currentStore?.id !== storeId
                                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                }`}
                              >
                                Solicitar Transferência
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : searchedProduct ? (
              <div className="py-12 text-center text-slate-400 text-sm bg-slate-950 rounded-xl border border-slate-800">
                Nenhum lote em estoque encontrado na rede para este produto.
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* ===================== MODAL: NOVA LOJA / FILIAL ===================== */}
      {isNewStoreModalOpen && (
        <NewStoreModal
          onClose={() => setIsNewStoreModalOpen(false)}
          onSuccess={async () => {
            setIsNewStoreModalOpen(false);
            setAlertSuccess('Nova filial cadastrada com sucesso!');
            await refreshStores();
          }}
        />
      )}

      {/* ===================== MODAL: NOVA TRANSFERÊNCIA ===================== */}
      {isNewTransferModalOpen && (
        <NewTransferModal
          stores={stores}
          initialSourceStoreId={prefillSourceStoreId}
          initialProduct={prefillProduct}
          onClose={() => setIsNewTransferModalOpen(false)}
          onSuccess={async () => {
            setIsNewTransferModalOpen(false);
            setAlertSuccess('Transferência criada com sucesso!');
            setActiveTab('transfers');
            loadTransfers();
          }}
        />
      )}

      {/* ===================== MODAL: ROMANEIO DE TRANSFERÊNCIA ===================== */}
      {selectedTransferForSlip && (
        <TransferSlipModal
          transferId={selectedTransferForSlip}
          slip={slipResult}
          loading={loadingSlip}
          onClose={() => {
            setSelectedTransferForSlip(null);
            setSlipResult(null);
          }}
        />
      )}

      {/* ===================== MODAL: DESPACHAR ===================== */}
      {dispatchTransferId && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl text-slate-100 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Truck className="w-5 h-5 text-amber-400" />
                Despachar Transferência #{dispatchTransferId}
              </h3>
              <button type="button" onClick={() => setDispatchTransferId(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              O despacho atualizará o status para <strong className="text-amber-400">EM TRÂNSITO</strong> e deduzirá
              automaticamente os lotes de estoque da loja de origem seguindo a regra FEFO.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Responsável pelo Despacho *</label>
                <input
                  type="text"
                  value={dispatchedBy}
                  onChange={(e) => setDispatchedBy(e.target.value)}
                  placeholder="Nome do operador / farmacêutico"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Transportadora (opcional)</label>
                <input
                  type="text"
                  value={carrierName}
                  onChange={(e) => setCarrierName(e.target.value)}
                  placeholder="Nome da transportadora ou motoboy"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Código de Rastreamento (opcional)</label>
                <input
                  type="text"
                  value={trackingCode}
                  onChange={(e) => setTrackingCode(e.target.value)}
                  placeholder="Código de rastreamento ou protocolo"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDispatchTransferId(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={isSubmittingDispatch || !dispatchedBy.trim()}
                onClick={handleConfirmDispatch}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition shadow-sm disabled:opacity-50"
              >
                {isSubmittingDispatch ? 'Despachando...' : 'Confirmar Despacho'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL: RECEBER ===================== */}
      {receiveTransferId && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl text-slate-100 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                Receber Transferência #{receiveTransferId}
              </h3>
              <button type="button" onClick={() => setReceiveTransferId(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              A confirmação incorporará os lotes transferidos diretamente no estoque físico da loja destino,
              preservando lote, fabricante e data de validade.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Responsável pelo Recebimento *</label>
                <input
                  type="text"
                  value={receivedBy}
                  onChange={(e) => setReceivedBy(e.target.value)}
                  placeholder="Nome do conferente / farmacêutico"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setReceiveTransferId(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={isSubmittingReceive || !receivedBy.trim()}
                onClick={handleConfirmReceive}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-sm disabled:opacity-50"
              >
                {isSubmittingReceive ? 'Recebendo...' : 'Confirmar Recebimento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL: CANCELAR ===================== */}
      {cancelTransferId && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl text-slate-100 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base flex items-center gap-2 text-red-400">
                <Ban className="w-5 h-5" />
                Cancelar Transferência #{cancelTransferId}
              </h3>
              <button type="button" onClick={() => setCancelTransferId(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Caso a carga já estivesse em trânsito, o estoque deduzido será estornado automaticamente para a loja de origem.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Motivo do Cancelamento *</label>
                <textarea
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Explique o motivo do cancelamento da transferência..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-red-500"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setCancelTransferId(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={isSubmittingCancel || !cancelReason.trim()}
                onClick={handleConfirmCancel}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition shadow-sm disabled:opacity-50"
              >
                {isSubmittingCancel ? 'Cancelando...' : 'Confirmar Cancelamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// SUBCOMPONENT: NewStoreModal
// =========================================================================
interface NewStoreModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function NewStoreModal({ onClose, onSuccess }: NewStoreModalProps) {
  const [formData, setFormData] = useState<CreateStoreInput>({
    code: '',
    name: '',
    companyName: '',
    cnpj: '',
    ie: '',
    isHeadquarters: false,
    phone: '',
    email: '',
    street: '',
    number: '',
    neighborhood: '',
    city: '',
    state: 'SP',
    zipCode: '',
    ibgeCode: '',
    taxRegime: 'SIMPLES_NACIONAL',
    isActive: true,
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.createStore(formData);
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Falha ao cadastrar loja');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      data-testid="new-store-modal"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-2xl w-full shadow-2xl text-slate-100 space-y-4 animate-fade-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="font-bold text-base flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-400" />
            Cadastrar Nova Loja / Filial
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-950/80 border border-red-600 rounded text-red-200 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Código da Loja *</label>
              <input
                type="text"
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="Ex: LJ02"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-slate-300 font-semibold mb-1">Nome Fantasia *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: FarmaCore Filial Jardins"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Razão Social *</label>
            <input
              type="text"
              required
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              placeholder="Ex: FarmaCore Drogaria e Perfumaria Ltda"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">CNPJ *</label>
              <input
                type="text"
                required
                value={formData.cnpj}
                onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                placeholder="00.000.000/0000-00"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Inscrição Estadual *</label>
              <input
                type="text"
                required
                value={formData.ie}
                onChange={(e) => setFormData({ ...formData, ie: e.target.value })}
                placeholder="000.000.000.000"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Regime Tributário</label>
              <select
                value={formData.taxRegime}
                onChange={(e) => setFormData({ ...formData, taxRegime: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
              >
                <option value="SIMPLES_NACIONAL">Simples Nacional</option>
                <option value="LUCRO_PRESUMIDO">Lucro Presumido</option>
                <option value="LUCRO_REAL">Lucro Real</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Telefone</label>
              <input
                type="text"
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(00) 0000-0000"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">E-mail</label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="loja@farmacore.com.br"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block text-slate-300 font-semibold mb-1">Logradouro *</label>
              <input
                type="text"
                required
                value={formData.street}
                onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                placeholder="Rua / Avenida"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Número *</label>
              <input
                type="text"
                required
                value={formData.number}
                onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                placeholder="123"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Bairro *</label>
              <input
                type="text"
                required
                value={formData.neighborhood}
                onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                placeholder="Centro"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Cidade *</label>
              <input
                type="text"
                required
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="São Paulo"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">UF *</label>
              <input
                type="text"
                required
                maxLength={2}
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
                placeholder="SP"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">CEP *</label>
              <input
                type="text"
                required
                value={formData.zipCode}
                onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                placeholder="00000-000"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Código IBGE Município *</label>
              <input
                type="text"
                required
                value={formData.ibgeCode}
                onChange={(e) => setFormData({ ...formData, ibgeCode: e.target.value })}
                placeholder="3550308"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
              />
            </div>

            <div className="flex items-center space-x-2 pt-4">
              <input
                type="checkbox"
                id="isHeadquarters"
                checked={formData.isHeadquarters}
                onChange={(e) => setFormData({ ...formData, isHeadquarters: e.target.checked })}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 bg-slate-950 border-slate-700"
              />
              <label htmlFor="isHeadquarters" className="text-slate-300 font-semibold cursor-pointer">
                Definir como Loja Matriz
              </label>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold transition shadow-sm disabled:opacity-50"
            >
              {loading ? 'Salvando...' : 'Salvar Loja'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =========================================================================
// SUBCOMPONENT: NewTransferModal
// =========================================================================
interface NewTransferModalProps {
  stores: Store[];
  initialSourceStoreId?: number | null;
  initialProduct?: Product | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface TransferItemDraft {
  product: Product;
  requestedQuantity: number;
  unitCost: number;
}

function NewTransferModal({
  stores,
  initialSourceStoreId,
  initialProduct,
  onClose,
  onSuccess,
}: NewTransferModalProps) {
  const [sourceStoreId, setSourceStoreId] = useState<number>(() => {
    if (initialSourceStoreId) return initialSourceStoreId;
    return stores[0]?.id || 1;
  });

  const [targetStoreId, setTargetStoreId] = useState<number>(() => {
    const other = stores.find((s) => s.id !== (initialSourceStoreId || stores[0]?.id));
    return other?.id || (stores.length > 1 ? stores[1].id : 2);
  });

  const [requestedBy, setRequestedBy] = useState<string>('Farmacêutico Solicitante');
  const [notes, setNotes] = useState<string>('');
  const [items, setItems] = useState<TransferItemDraft[]>(() => {
    if (initialProduct) {
      return [{ product: initialProduct, requestedQuantity: 5, unitCost: initialProduct.pf || 10 }];
    }
    return [];
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddProduct = (product: Product) => {
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.product.id === product.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx].requestedQuantity += 1;
        return copy;
      }
      return [...prev, { product, requestedQuantity: 1, unitCost: product.pf || 10 }];
    });
  };

  const handleUpdateQty = (productId: number, qty: number) => {
    if (qty <= 0) return;
    setItems((prev) =>
      prev.map((it) => (it.product.id === productId ? { ...it, requestedQuantity: qty } : it))
    );
  };

  const handleRemoveItem = (productId: number) => {
    setItems((prev) => prev.filter((it) => it.product.id !== productId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sourceStoreId === targetStoreId) {
      setError('A loja de origem e destino devem ser diferentes');
      return;
    }
    if (items.length === 0) {
      setError('Adicione ao menos um produto para transferir');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload: CreateTransferInput = {
        sourceStoreId,
        targetStoreId,
        requestedBy: requestedBy.trim(),
        notes: notes.trim() || undefined,
        items: items.map((it) => ({
          productId: it.product.id,
          requestedQuantity: it.requestedQuantity,
          unitCost: it.unitCost,
        })),
      };

      await api.createTransfer(payload);
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Falha ao registrar transferência');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      data-testid="new-transfer-modal"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-2xl w-full shadow-2xl text-slate-100 space-y-4 animate-fade-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="font-bold text-base flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-emerald-400" />
            Nova Transferência entre Filiais
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-950/80 border border-red-600 rounded text-red-200 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Loja de Origem (Sai Estoque) *</label>
              <select
                value={sourceStoreId}
                onChange={(e) => setSourceStoreId(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    [{s.code}] {s.name} ({s.city}/{s.state})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Loja de Destino (Entra Estoque) *</label>
              <select
                value={targetStoreId}
                onChange={(e) => setTargetStoreId(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    [{s.code}] {s.name} ({s.city}/{s.state})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Solicitante *</label>
              <input
                type="text"
                required
                value={requestedBy}
                onChange={(e) => setRequestedBy(e.target.value)}
                placeholder="Nome do operador / farmacêutico"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Observações (opcional)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Motivo ou dados adicionais da carga"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
              />
            </div>
          </div>

          {/* Add product section */}
          <div className="border-t border-slate-800 pt-3 space-y-2">
            <label className="block text-slate-300 font-semibold">Adicionar Medicamentos à Transferência</label>
            <ProductSearch
              onSelectProduct={handleAddProduct}
              placeholder="Buscar medicamento para transferir..."
            />
          </div>

          {/* Items table */}
          <div>
            <h4 className="font-semibold text-slate-300 mb-2">Itens da Carga ({items.length})</h4>
            {items.length === 0 ? (
              <p className="text-slate-500 italic py-3 text-center border border-dashed border-slate-800 rounded-lg">
                Nenhum produto adicionado à carga ainda. Use a busca acima para adicionar.
              </p>
            ) : (
              <div className="overflow-x-auto border border-slate-800 rounded-lg">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 text-[11px] uppercase border-b border-slate-800">
                      <th className="py-2 px-3">Produto</th>
                      <th className="py-2 px-3">EAN</th>
                      <th className="py-2 px-3 text-center w-24">Qtd</th>
                      <th className="py-2 px-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {items.map((it) => (
                      <tr key={it.product.id}>
                        <td className="py-2 px-3 text-white font-medium">{it.product.name}</td>
                        <td className="py-2 px-3 font-mono text-slate-400">{it.product.ean}</td>
                        <td className="py-2 px-3 text-center">
                          <input
                            type="number"
                            min={1}
                            value={it.requestedQuantity}
                            onChange={(e) => handleUpdateQty(it.product.id, Number(e.target.value))}
                            className="w-16 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-center text-white"
                          />
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(it.product.id)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || items.length === 0}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold transition shadow-sm disabled:opacity-50"
            >
              {loading ? 'Salvando...' : 'Criar Transferência'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =========================================================================
// SUBCOMPONENT: TransferSlipModal
// =========================================================================
interface TransferSlipModalProps {
  transferId: number;
  slip: TransferSlipResult | null;
  loading: boolean;
  onClose: () => void;
}

function TransferSlipModal({ transferId, slip, loading, onClose }: TransferSlipModalProps) {
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopy = () => {
    if (!slip?.textSlip) return;
    navigator.clipboard.writeText(slip.textSlip);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      data-testid="transfer-slip-modal"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-3xl w-full shadow-2xl text-slate-100 space-y-4 animate-fade-in max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="font-bold text-base flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-400" />
            Romaneio de Transferência #{transferId}
          </h3>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center space-x-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado!' : 'Copiar'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center space-x-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir</span>
            </button>

            <button type="button" onClick={onClose} className="text-slate-400 hover:text-white ml-2">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center text-slate-400 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            <p className="text-xs">Gerando romaneio de carga...</p>
          </div>
        ) : slip ? (
          <div className="flex-1 overflow-y-auto bg-slate-950 border border-slate-800 rounded-lg p-4">
            <pre className="font-mono text-xs text-slate-200 whitespace-pre-wrap leading-relaxed select-all">
              {slip.textSlip}
            </pre>
          </div>
        ) : (
          <p className="text-slate-400 text-xs text-center py-8">Não foi possível carregar o romaneio.</p>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
