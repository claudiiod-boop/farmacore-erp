import React, { useState, useEffect, useCallback } from 'react';
import {
  QrCode,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Send,
  Plus,
  Search,
  Package,
  Layers,
  FileText,
  AlertOctagon,
  RefreshCw
} from 'lucide-react';
import { sncmApi } from '../services/api';
import type {
  SncmItem,
  SncmEvent,
  SncmItemWithHistory,
  SncmKpis,
  ParsedDataMatrix
} from '../types';

export const SncmTraceabilityPage: React.FC = () => {
  const [storeId] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'CHECK' | 'RECEIPT' | 'DISPENSE' | 'EVENTS'>('CHECK');

  const [kpis, setKpis] = useState<SncmKpis>({
    total_in_stock: 0,
    dispensed_today: 0,
    pending_transmission: 0,
    quarantined_items: 0,
  });

  // Aba 1: Validação & Consulta Rápida
  const [queryInput, setQueryInput] = useState('');
  const [queriedItem, setQueriedItem] = useState<SncmItemWithHistory | null>(null);
  const [parsedData, setParsedData] = useState<ParsedDataMatrix | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);

  // Aba 2: Recebimento de Carga
  const [nfeAccessKey, setNfeAccessKey] = useState('');
  const [operatorName, setOperatorName] = useState('Conferente');
  const [receiptScanInput, setReceiptScanInput] = useState('');
  const [scannedItems, setScannedItems] = useState<Array<{ raw: string; parsed: ParsedDataMatrix }>>([]);

  // Aba 3: Dispensação PDV
  const [dispenseScanInput, setDispenseScanInput] = useState('');
  const [dispenseDoc, setDispenseDoc] = useState('NFC-e 001');
  const [dispenseSuccess, setDispenseSuccess] = useState<string | null>(null);
  const [dispenseError, setDispenseError] = useState<string | null>(null);

  // Aba 4: Eventos Sanitários
  const [eventsList, setEventsList] = useState<SncmEvent[]>([]);

  // Protocolo de Transmissão
  const [transmitMessage, setTransmitMessage] = useState<string | null>(null);

  const loadKpisAndEvents = useCallback(async () => {
    try {
      const [kpiData, events] = await Promise.all([
        sncmApi.getKpis(storeId),
        sncmApi.listEvents(storeId, 30),
      ]);
      setKpis(kpiData);
      setEventsList(events);
    } catch (err) {
      console.error('Erro ao carregar dados do SNCM:', err);
    }
  }, [storeId]);

  useEffect(() => {
    loadKpisAndEvents();
  }, [loadKpisAndEvents]);

  // Consulta por código DataMatrix ou Serial
  const handleQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryInput.trim()) return;

    setQueryError(null);
    setQueriedItem(null);
    setParsedData(null);

    try {
      // Tenta parse se contiver padrão DataMatrix
      let serialToFind = queryInput.trim();
      let gtinToFind: string | undefined = undefined;

      if (queryInput.includes('(01)') || queryInput.startsWith('01')) {
        const parsed = await sncmApi.parseDataMatrix(queryInput.trim());
        setParsedData(parsed);
        serialToFind = parsed.serialNumber;
        gtinToFind = parsed.gtin;
      }

      const item = await sncmApi.getItemBySerial(serialToFind, gtinToFind);
      setQueriedItem(item);
    } catch (err: any) {
      setQueryError(err.message || 'Unidade não encontrada no estoque rastreado.');
    }
  };

  // Quarentena
  const handleQuarantine = async (serial: string, gtin?: string) => {
    const reason = window.prompt('Motivo da retenção sanitária em Quarentena:', 'Embalagem avariada ou suspeita de desvio');
    if (!reason) return;

    try {
      const updated = await sncmApi.quarantineItem(serial, reason, gtin);
      setQueriedItem(updated);
      await loadKpisAndEvents();
      alert('Unidade colocada em quarentena sanitária com sucesso.');
    } catch (err: any) {
      alert(`Erro ao reter item: ${err.message}`);
    }
  };

  // Adicionar item lido no recebimento
  const handleAddReceiptScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiptScanInput.trim()) return;

    try {
      const parsed = await sncmApi.parseDataMatrix(receiptScanInput.trim());
      setScannedItems((prev) => [
        { raw: receiptScanInput.trim(), parsed },
        ...prev,
      ]);
      setReceiptScanInput('');
    } catch (err: any) {
      alert(`Erro na leitura do DataMatrix: ${err.message}`);
    }
  };

  // Confirmar recebimento de carga
  const handleConfirmReceipt = async () => {
    if (scannedItems.length === 0) return;
    try {
      await sncmApi.registerReceipt({
        storeId,
        nfeAccessKey: nfeAccessKey || undefined,
        operatorName,
        items: scannedItems.map((it) => ({
          rawDataMatrix: it.raw,
        })),
      });

      alert(`Sucesso! ${scannedItems.length} unidades registradas no SNCM.`);
      setScannedItems([]);
      setNfeAccessKey('');
      await loadKpisAndEvents();
    } catch (err: any) {
      alert(`Erro ao registrar carga: ${err.message}`);
    }
  };

  // Dispensar unidade
  const handleDispense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispenseScanInput.trim()) return;

    setDispenseError(null);
    setDispenseSuccess(null);

    try {
      const res = await sncmApi.dispenseItem({
        storeId,
        rawDataMatrix: dispenseScanInput.includes('(01)') || dispenseScanInput.startsWith('01') ? dispenseScanInput.trim() : undefined,
        serialNumber: !dispenseScanInput.includes('(01)') && !dispenseScanInput.startsWith('01') ? dispenseScanInput.trim() : undefined,
        fiscalDocNumber: dispenseDoc || undefined,
      });

      setDispenseSuccess(`Unidade ${res.item.serial_number} dispensada com sucesso! Evento gerado.`);
      setDispenseScanInput('');
      await loadKpisAndEvents();
    } catch (err: any) {
      setDispenseError(err.message || 'Erro ao dispensar unidade.');
    }
  };

  // Transmitir eventos para a ANVISA
  const handleTransmit = async () => {
    try {
      const res = await sncmApi.transmitEvents(storeId);
      setTransmitMessage(`Transmissão concluída: ${res.transmittedCount} eventos confirmados pela ANVISA sob protocolo ${res.protocol}`);
      await loadKpisAndEvents();
    } catch (err: any) {
      alert(`Erro na transmissão: ${err.message}`);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-y-auto">
      {/* Header SNCM */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-900/30">
            <QrCode className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white flex items-center gap-2">
              Rastreabilidade SNCM & DataMatrix
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/30">
                Lei 13.410/2016 e RDC 157/2017
              </span>
            </h1>
            <p className="text-xs text-slate-400">Controle Individual por Serial (IUM), Desativação e Eventos ANVISA</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            data-testid="transmit-anvisa-button"
            onClick={handleTransmit}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-cyan-900/30 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            Sincronizar com ANVISA
          </button>
        </div>
      </div>

      {/* Grid de KPIs Regulatórios */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-6 pb-2">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium">Estoque Rastreável</span>
          <div className="text-2xl font-black text-white mt-1" data-testid="kpi-in-stock">
            {kpis.total_in_stock}
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Dispensados Hoje
          </span>
          <div className="text-2xl font-black text-emerald-400 mt-1" data-testid="kpi-dispensed-today">
            {kpis.dispensed_today}
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-xs text-amber-400 font-medium flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            Pendentes ANVISA
          </span>
          <div className="text-2xl font-black text-amber-400 mt-1" data-testid="kpi-pending-tx">
            {kpis.pending_transmission}
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-xs text-rose-400 font-medium flex items-center gap-1">
            <AlertOctagon className="w-3.5 h-3.5" />
            Em Quarentena
          </span>
          <div className="text-2xl font-black text-rose-400 mt-1" data-testid="kpi-quarantine">
            {kpis.quarantined_items}
          </div>
        </div>
      </div>

      {/* Mensagem de Transmissão */}
      {transmitMessage && (
        <div className="mx-6 p-3 bg-cyan-950/40 border border-cyan-800/60 rounded-xl text-xs text-cyan-300 flex items-center justify-between">
          <span>{transmitMessage}</span>
          <button onClick={() => setTransmitMessage(null)} className="font-bold underline text-slate-400 hover:text-white">
            Fechar
          </button>
        </div>
      )}

      {/* Botoeira de Abas */}
      <div className="px-6 pt-4 flex gap-2 border-b border-slate-800">
        <button
          data-testid="tab-check-button"
          onClick={() => setActiveTab('CHECK')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'CHECK'
              ? 'border-cyan-500 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Search className="w-4 h-4" />
          Validar & Consultar DataMatrix
        </button>
        <button
          data-testid="tab-receipt-button"
          onClick={() => setActiveTab('RECEIPT')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'RECEIPT'
              ? 'border-cyan-500 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          Recebimento de Carga
        </button>
        <button
          data-testid="tab-dispense-button"
          onClick={() => setActiveTab('DISPENSE')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'DISPENSE'
              ? 'border-cyan-500 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Dispensar no PDV
        </button>
        <button
          data-testid="tab-events-button"
          onClick={() => setActiveTab('EVENTS')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'EVENTS'
              ? 'border-cyan-500 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          Eventos Sanitários ({eventsList.length})
        </button>
      </div>

      {/* Conteúdo das Abas */}
      <div className="flex-1 p-6 max-w-5xl mx-auto w-full">
        {/* ===================== ABA 1: CONSULTAR / VALIDAR ===================== */}
        {activeTab === 'CHECK' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <QrCode className="w-5 h-5 text-cyan-400" />
                Leitura Óptica do Código GS1 DataMatrix (IUM)
              </h2>
              <p className="text-xs text-slate-400">
                Bipe o leitor 2D ou cole o código DataMatrix da caixinha para validar procedência, lote e validade.
              </p>

              <form onSubmit={handleQuery} className="flex gap-2">
                <input
                  type="text"
                  data-testid="sncm-query-input"
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
                  placeholder="Ex: (01)07891234567890(21)SER12345(17)280531(10)LOTE01 ou Serial"
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-cyan-500"
                  autoFocus
                />
                <button
                  type="submit"
                  data-testid="sncm-query-submit-button"
                  className="px-5 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition-all"
                >
                  Consultar
                </button>
              </form>

              {queryError && (
                <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-300">
                  {queryError}
                </div>
              )}
            </div>

            {/* Resultado do Item Consultado */}
            {queriedItem && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-4 border-b border-slate-800">
                  <div>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                      GTIN: {queriedItem.gtin}
                    </span>
                    <h3 className="text-xl font-bold text-white mt-1" data-testid="queried-product-name">
                      {queriedItem.product_name}
                    </h3>
                    <p className="text-xs text-slate-400 font-mono">
                      Serial: <span className="text-white font-bold">{queriedItem.serial_number}</span> | Lote: {queriedItem.batch_number}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      data-testid="queried-status-badge"
                      className={`text-xs px-3 py-1 rounded-lg font-bold ${
                        queriedItem.status === 'IN_STOCK'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : queriedItem.status === 'DISPENSED'
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {queriedItem.status}
                    </span>

                    {queriedItem.status === 'IN_STOCK' && (
                      <button
                        data-testid="quarantine-button"
                        onClick={() => handleQuarantine(queriedItem.serial_number, queriedItem.gtin)}
                        className="px-3 py-1 bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-700 rounded-lg text-xs font-semibold transition-all"
                      >
                        Quarentena
                      </button>
                    )}
                  </div>
                </div>

                {/* Validade */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs">
                  <div>
                    <span className="text-slate-400">Data de Validade:</span>
                    <div className="text-sm font-bold font-mono text-white mt-0.5">
                      {queriedItem.expiration_date}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400">Conformidade Sanitária:</span>
                    <div className="mt-0.5 font-bold">
                      {queriedItem.is_expired ? (
                        <span className="text-rose-400 flex items-center gap-1">
                          <AlertTriangle className="w-4 h-4" /> VENCIDO — DISPENSAÇÃO PROIBIDA
                        </span>
                      ) : (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" /> PRODUTO APTO / REGULAR
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Histórico de Eventos da Unidade */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Histórico de Eventos Sanitários ({queriedItem.events.length})
                  </span>
                  <div className="border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800 text-xs">
                    {queriedItem.events.map((ev) => (
                      <div key={ev.id} className="p-3 bg-slate-950/40 flex justify-between items-center">
                        <div>
                          <span className="font-bold text-cyan-400">{ev.event_type}</span>
                          <span className="text-slate-500 font-mono text-[11px] ml-2">
                            {ev.event_date.substring(0, 19).replace('T', ' ')}
                          </span>
                          {ev.fiscal_doc_number && (
                            <div className="text-[11px] text-slate-400 mt-0.5">Doc: {ev.fiscal_doc_number}</div>
                          )}
                        </div>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                            ev.transmission_status === 'CONFIRMED'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {ev.transmission_status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===================== ABA 2: RECEBIMENTO DE CARGA ===================== */}
        {activeTab === 'RECEIPT' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-cyan-400" />
              Recebimento de Carga Serializada
            </h2>
            <p className="text-xs text-slate-400">
              Conferência física de caixinhas individuais com leitura do código GS1 DataMatrix.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-400 font-semibold">Chave de Acesso da NF-e (44 dígitos)</label>
                <input
                  type="text"
                  data-testid="receipt-nfe-key-input"
                  value={nfeAccessKey}
                  onChange={(e) => setNfeAccessKey(e.target.value)}
                  placeholder="3526..."
                  className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono outline-none"
                />
              </div>
              <div>
                <label className="text-slate-400 font-semibold">Conferente Responsável</label>
                <input
                  type="text"
                  value={operatorName}
                  onChange={(e) => setOperatorName(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none"
                />
              </div>
            </div>

            {/* Bipar DataMatrix */}
            <form onSubmit={handleAddReceiptScan} className="flex gap-2 pt-2">
              <input
                type="text"
                data-testid="receipt-scan-input"
                value={receiptScanInput}
                onChange={(e) => setReceiptScanInput(e.target.value)}
                placeholder="Bipe o código GS1 DataMatrix da caixa aqui..."
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white font-mono outline-none focus:border-cyan-500"
              />
              <button
                type="submit"
                data-testid="receipt-add-button"
                className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Adicionar
              </button>
            </form>

            {/* Lista de Caixas Lidas */}
            <div className="space-y-2 pt-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-300">Caixas Escaneadas ({scannedItems.length})</span>
                {scannedItems.length > 0 && (
                  <button
                    onClick={() => setScannedItems([])}
                    className="text-rose-400 hover:underline"
                  >
                    Limpar Lista
                  </button>
                )}
              </div>

              <div className="border border-slate-800 rounded-xl max-h-56 overflow-y-auto divide-y divide-slate-800 text-xs">
                {scannedItems.length === 0 ? (
                  <div className="p-6 text-center text-slate-500">Nenhuma caixa lida ainda.</div>
                ) : (
                  scannedItems.map((it, idx) => (
                    <div key={idx} className="p-2.5 bg-slate-950/40 flex justify-between items-center font-mono">
                      <div>
                        <span className="text-white font-bold">{it.parsed.serialNumber}</span>
                        <span className="text-slate-400 text-[11px] ml-2">Lote: {it.parsed.batchNumber}</span>
                      </div>
                      <span className="text-emerald-400 text-[11px]">Val: {it.parsed.expirationDate}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button
              data-testid="confirm-receipt-button"
              onClick={handleConfirmReceipt}
              disabled={scannedItems.length === 0}
              className={`w-full py-3 rounded-xl text-xs font-bold transition-all ${
                scannedItems.length > 0
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-lg'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              Confirmar Recebimento de Carga no SNCM ({scannedItems.length} caixas)
            </button>
          </div>
        )}

        {/* ===================== ABA 3: DISPENSAR NO PDV ===================== */}
        {activeTab === 'DISPENSE' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              Dispensação & Desativação Sanitária no PDV
            </h2>
            <p className="text-xs text-slate-400">
              Desativação de serial no ato da venda para o consumidor final com verificação sanitária.
            </p>

            <form onSubmit={handleDispense} className="space-y-3">
              <div>
                <label className="text-slate-400 font-semibold text-xs">Código DataMatrix ou Serial</label>
                <input
                  type="text"
                  data-testid="dispense-scan-input"
                  value={dispenseScanInput}
                  onChange={(e) => setDispenseScanInput(e.target.value)}
                  placeholder="Bipe a caixinha que está sendo entregue ao cliente..."
                  className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-emerald-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-slate-400 font-semibold text-xs">Número do Cupom Fiscal / NFC-e</label>
                <input
                  type="text"
                  data-testid="dispense-doc-input"
                  value={dispenseDoc}
                  onChange={(e) => setDispenseDoc(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono outline-none"
                />
              </div>

              <button
                type="submit"
                data-testid="submit-dispense-button"
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-900/30"
              >
                Dispensar e Registrar Evento Sanitário
              </button>
            </form>

            {dispenseSuccess && (
              <div data-testid="dispense-success-alert" className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-xs text-emerald-300">
                {dispenseSuccess}
              </div>
            )}

            {dispenseError && (
              <div data-testid="dispense-error-alert" className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-300">
                {dispenseError}
              </div>
            )}
          </div>
        )}

        {/* ===================== ABA 4: EVENTOS SANITÁRIOS ===================== */}
        {activeTab === 'EVENTS' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-400" />
                Log de Eventos Sanitários Transmitidos
              </h2>
              <button
                onClick={loadKpisAndEvents}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="border border-slate-800 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-800/80 text-slate-400 border-b border-slate-700">
                    <th className="py-2.5 px-3">Evento</th>
                    <th className="py-2.5 px-3">Data</th>
                    <th className="py-2.5 px-3">Documento</th>
                    <th className="py-2.5 px-3">Protocolo ANVISA</th>
                    <th className="py-2.5 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {eventsList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-500">
                        Nenhum evento registrado.
                      </td>
                    </tr>
                  ) : (
                    eventsList.map((ev) => (
                      <tr key={ev.id} className="hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-bold text-white">{ev.event_type}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                          {ev.event_date.substring(0, 16).replace('T', ' ')}
                        </td>
                        <td className="py-2.5 px-3 font-mono">{ev.fiscal_doc_number || ev.nfe_access_key?.substring(0, 10) || '-'}</td>
                        <td className="py-2.5 px-3 font-mono text-cyan-400">{ev.anvisa_protocol || '-'}</td>
                        <td className="py-2.5 px-3 text-right">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                              ev.transmission_status === 'CONFIRMED'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-amber-500/20 text-amber-300'
                            }`}
                          >
                            {ev.transmission_status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SncmTraceabilityPage;
