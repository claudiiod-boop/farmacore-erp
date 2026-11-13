import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  AlertTriangle,
  CheckCircle,
  Eye,
  X,
  Search,
  Building2,
  Calendar,
  Layers,
  ArrowRight,
  RefreshCw,
  Loader2,
  ShieldCheck,
  Package,
} from 'lucide-react';
import { purchasesApi } from '../services/api';
import type {
  PurchaseInvoiceSummary,
  PurchasePreviewResult,
  PurchaseInvoiceDetails,
} from '../types';

export default function PurchasesPage() {
  const [invoices, setInvoices] = useState<PurchaseInvoiceSummary[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Upload & Preview state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [previewData, setPreviewData] = useState<PurchasePreviewResult | null>(null);
  const [rawXml, setRawXml] = useState<string | null>(null);
  const [autoRegister, setAutoRegister] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Details Modal state
  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoiceDetails | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadInvoices = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await purchasesApi.getInvoices();
      setInvoices(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao carregar histórico de notas fiscais.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const readFileAsText = (file: File): Promise<string> => {
    if (typeof (file as any).text === 'function') {
      return (file as any).text();
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(new Error('Falha ao ler arquivo XML'));
      reader.readAsText(file);
    });
  };

  const handleProcessXmlFile = async (file: File) => {
    if (!file) return;
    setIsAnalyzing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const text = await readFileAsText(file);
      setRawXml(text);
      const preview = await purchasesApi.previewXml(text);
      setPreviewData(preview);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao processar arquivo XML.');
      setPreviewData(null);
      setRawXml(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessXmlFile(file);
    }
    // reset input so same file can be selected again
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.xml') || file.type.includes('xml'))) {
      handleProcessXmlFile(file);
    } else {
      setErrorMessage('Por favor, selecione um arquivo no formato XML.');
    }
  };

  const handleConfirmImport = async () => {
    if (!rawXml) return;
    setIsImporting(true);
    setErrorMessage(null);

    try {
      const result = await purchasesApi.importXml(rawXml, {
        autoRegisterProducts: autoRegister,
      });

      setSuccessMessage(
        `Nota fiscal importada com sucesso! (${result.batchesCreatedCount} lotes criados, ${result.productsRegisteredCount} produtos cadastrados).`
      );
      setPreviewData(null);
      setRawXml(null);
      loadInvoices();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao efetivar entrada de nota fiscal.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleOpenDetails = async (id: number) => {
    setIsLoadingDetails(true);
    setErrorMessage(null);
    try {
      const details = await purchasesApi.getInvoiceById(id);
      setSelectedInvoice(details);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao carregar detalhes da nota fiscal.');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    const q = searchTerm.toLowerCase();
    return (
      inv.supplierName.toLowerCase().includes(q) ||
      inv.supplierCnpj.includes(q) ||
      String(inv.invoiceNumber).includes(q) ||
      inv.accessKey.includes(q)
    );
  });

  return (
    <div className="flex-1 bg-slate-900 text-slate-100 flex flex-col overflow-y-auto">
      {/* Header Banner */}
      <header className="bg-slate-950 border-b border-slate-800 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded">
              ESTAÇÃO F3
            </span>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-amber-400" />
              Entrada de Notas Fiscais (NF-e)
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Recepção de XML de fornecedores, conferência de lotes e alertas de teto de preço CMED.
          </p>
        </div>

        <button
          onClick={loadInvoices}
          disabled={isLoading}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium border border-slate-700 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Atualizar Listagem</span>
        </button>
      </header>

      {/* Main Container */}
      <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Messages */}
        {errorMessage && (
          <div className="p-4 bg-red-950/70 border border-red-800 text-red-200 rounded-xl flex items-center justify-between text-sm shadow-md animate-fade-in">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-400 hover:text-red-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {successMessage && (
          <div className="p-4 bg-emerald-950/70 border border-emerald-800 text-emerald-200 rounded-xl flex items-center justify-between text-sm shadow-md animate-fade-in">
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button
              onClick={() => setSuccessMessage(null)}
              className="text-emerald-400 hover:text-emerald-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Upload Dropzone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition cursor-pointer flex flex-col items-center justify-center space-y-3 ${
            isDragOver
              ? 'border-amber-400 bg-amber-950/20 shadow-lg'
              : 'border-slate-700 hover:border-slate-500 bg-slate-950/50 hover:bg-slate-900/60'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xml"
            aria-label="Selecionar arquivo XML"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="p-4 rounded-full bg-slate-800/80 text-amber-400 shadow-inner">
            {isAnalyzing ? (
              <Loader2 className="w-8 h-8 animate-spin" />
            ) : (
              <UploadCloud className="w-8 h-8" />
            )}
          </div>

          <div>
            <h3 className="text-base font-semibold text-slate-200">
              {isAnalyzing
                ? 'Analisando XML da NF-e...'
                : 'Arraste o arquivo XML da NF-e ou clique para selecionar'}
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Suporta NF-e modelo 55 padrão SEFAZ. O FarmaCore faz dry-run para conferência de itens,
              reconhecimento de lotes e validação contra o banco CMED.
            </p>
          </div>

          <div className="pt-2">
            <span className="px-3 py-1 bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 rounded-md">
              Selecionar XML (.xml)
            </span>
          </div>
        </div>

        {/* Recent Invoices Table */}
        <section className="bg-slate-950/60 rounded-xl border border-slate-800 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <FileText className="w-4 h-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-200">
                Histórico de Notas Fiscais Recebidas
              </h2>
              <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full font-mono">
                {filteredInvoices.length}
              </span>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por fornecedor, chave, número..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800">
                  <th className="py-2.5 px-4">Nota / Série</th>
                  <th className="py-2.5 px-4">Fornecedor</th>
                  <th className="py-2.5 px-4">Emissão</th>
                  <th className="py-2.5 px-4 text-center">Itens</th>
                  <th className="py-2.5 px-4 text-right">Valor Total</th>
                  <th className="py-2.5 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                      Carregando notas fiscais...
                    </td>
                  </tr>
                ) : filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      Nenhuma nota fiscal encontrada no histórico.
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => (
                    <tr
                      key={inv.id}
                      className="hover:bg-slate-800/40 transition group"
                    >
                      <td className="py-3 px-4 font-mono font-medium text-slate-200">
                        {inv.invoiceNumber} / {inv.invoiceSeries}
                        <div className="text-[10px] text-slate-500 truncate max-w-[140px]" title={inv.accessKey}>
                          {inv.accessKey}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-200">{inv.supplierName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          CNPJ: {inv.supplierCnpj}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {new Date(inv.issueDate).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded-full font-mono text-[11px]">
                          {inv.itemsCount}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                        R$ {inv.totalInvoiceAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleOpenDetails(inv.id)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded border border-slate-700 transition flex items-center space-x-1 mx-auto text-xs"
                          title="Ver detalhes da nota"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Ver Detalhes</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* ===================== PREVIEW MODAL ===================== */}
      {previewData && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                  <Package className="w-5 h-5 text-amber-400" />
                  <span>Conferência de NF-e (Pré-Visualização)</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Verifique os itens, divergências regulatórias e lotes antes de efetivar o lançamento no estoque.
                </p>
              </div>

              <button
                onClick={() => setPreviewData(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-[11px] text-slate-400 font-semibold block">Fornecedor</span>
                  <span className="text-xs font-bold text-white block truncate" title={previewData.supplierName}>
                    {previewData.supplierName}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    CNPJ: {previewData.supplierCnpj}
                  </span>
                </div>

                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-[11px] text-slate-400 font-semibold block">Nota / Série</span>
                  <span className="text-sm font-bold text-white">
                    {previewData.invoiceNumber} / {previewData.invoiceSeries}
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    Emissão: {new Date(previewData.issueDate).toLocaleDateString('pt-BR')}
                  </span>
                </div>

                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-[11px] text-slate-400 font-semibold block">Itens e Produtos</span>
                  <div className="flex items-center space-x-2 mt-0.5">
                    <span className="text-xs px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded font-semibold">
                      {previewData.existingProductsCount} No Catálogo
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-blue-950 text-blue-400 border border-blue-800 rounded font-semibold">
                      {previewData.newProductsCount} A Cadastrar
                    </span>
                  </div>
                </div>

                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-[11px] text-slate-400 font-semibold block">Valor Total</span>
                  <span className="text-sm font-mono font-bold text-emerald-400">
                    R$ {previewData.totalInvoiceAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-slate-400 block font-mono">
                    ST: R$ {previewData.totalIcmsSt.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* CMED Alert Banner */}
              {previewData.hasCmedAlerts && (
                <div className="p-4 bg-amber-950/60 border border-amber-700/80 rounded-xl flex items-start space-x-3 text-amber-200 shadow-sm">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <span className="font-bold block text-sm text-amber-300">
                      Alerta CMED — Divergência Regulatória de Preço
                    </span>
                    <p>
                      Um ou mais itens desta nota fiscal apresentam custo unitário ou preço superior ao teto
                      Preço Máximo ao Consumidor (PMC) ou margem atípica segundo a tabela oficial da CMED.
                      Verifique os avisos individuais na tabela abaixo antes de confirmar.
                    </p>
                  </div>
                </div>
              )}

              {/* Items Preview Table */}
              <div className="border border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">EAN / Código</th>
                      <th className="py-2.5 px-3">Descrição do Produto</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3">Lote / Validade</th>
                      <th className="py-2.5 px-3 text-right">Qtd</th>
                      <th className="py-2.5 px-3 text-right">Custo Un.</th>
                      <th className="py-2.5 px-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {previewData.items.map((item) => (
                      <tr
                        key={item.itemIndex}
                        className={`hover:bg-slate-800/30 ${
                          item.cmedWarning ? 'bg-amber-950/20' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 text-slate-500 font-mono">{item.itemIndex}</td>
                        <td className="py-2.5 px-3 font-mono">
                          <span className="text-slate-200 block">{item.ean || 'SEM GTIN'}</span>
                          <span className="text-[10px] text-slate-500">{item.supplierProductCode}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-slate-100">{item.productName}</div>
                          {item.anvisaRegistration && (
                            <span className="text-[10px] text-slate-400 font-mono block">
                              Reg. MS: {item.anvisaRegistration}
                            </span>
                          )}
                          {item.cmedWarning && (
                            <div className="flex items-center space-x-1 mt-1 text-amber-400 font-semibold text-[11px]">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              <span>{item.cmedWarning}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {item.isExistingProduct ? (
                            <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-full font-semibold text-[10px]">
                              Existente
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-blue-950 text-blue-400 border border-blue-800 rounded-full font-semibold text-[10px]">
                              Novo Produto
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px]">
                          <span className="text-slate-300 block">{item.batchNumber || 'S/ LOTE'}</span>
                          <span className="text-[10px] text-slate-500">
                            Val: {item.expirationDate ? new Date(item.expirationDate).toLocaleDateString('pt-BR') : '-'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-200">
                          {item.quantity}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                          R$ {item.unitCost.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                          R$ {item.totalCost.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Options */}
              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex items-center justify-between">
                <label className="flex items-center space-x-3 cursor-pointer text-xs select-none">
                  <input
                    type="checkbox"
                    checked={autoRegister}
                    onChange={(e) => setAutoRegister(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 text-amber-500 focus:ring-amber-500 bg-slate-900"
                  />
                  <div>
                    <span className="font-semibold text-slate-200 block">
                      Cadastrar novos produtos automaticamente
                    </span>
                    <span className="text-[11px] text-slate-400 block">
                      Cria cadastros no catálogo para itens desconhecidos usando os dados da NF-e e CMED.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-950 px-6 py-4 border-t border-slate-800 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setPreviewData(null)}
                disabled={isImporting}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={isImporting}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center space-x-2 shadow-sm"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Importando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Confirmar Entrada</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== INVOICE DETAILS MODAL ===================== */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                  <FileText className="w-5 h-5 text-amber-400" />
                  <span>Detalhes da Nota Fiscal #{selectedInvoice.invoiceNumber}</span>
                </h3>
                <span className="text-[11px] font-mono text-slate-400">
                  Chave: {selectedInvoice.accessKey}
                </span>
              </div>

              <button
                onClick={() => setSelectedInvoice(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Details Content */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs">
                  <span className="text-slate-400 font-semibold block">Fornecedor</span>
                  <span className="font-bold text-slate-100 block">{selectedInvoice.supplierName}</span>
                  <span className="text-slate-400 font-mono text-[11px]">
                    CNPJ: {selectedInvoice.supplierCnpj}
                  </span>
                </div>

                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs">
                  <span className="text-slate-400 font-semibold block">Data de Emissão</span>
                  <span className="font-bold text-slate-100 block">
                    {new Date(selectedInvoice.issueDate).toLocaleDateString('pt-BR')}
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    Série: {selectedInvoice.invoiceSeries}
                  </span>
                </div>

                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs">
                  <span className="text-slate-400 font-semibold block">Valor Total</span>
                  <span className="font-bold font-mono text-emerald-400 text-sm block">
                    R$ {selectedInvoice.totalInvoiceAmount.toFixed(2)}
                  </span>
                  <span className="text-slate-400 font-mono text-[11px]">
                    ST: R$ {selectedInvoice.totalIcmsSt.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                      <th className="py-2.5 px-3">Item</th>
                      <th className="py-2.5 px-3">EAN / Descrição</th>
                      <th className="py-2.5 px-3">Lote / Validade</th>
                      <th className="py-2.5 px-3">Reg. Anvisa</th>
                      <th className="py-2.5 px-3 text-right">Qtd</th>
                      <th className="py-2.5 px-3 text-right">Custo Un.</th>
                      <th className="py-2.5 px-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {selectedInvoice.items.map((it) => (
                      <tr key={it.id} className="hover:bg-slate-800/30">
                        <td className="py-2.5 px-3 font-mono text-slate-500">{it.itemIndex}</td>
                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-slate-200 block">{it.productName}</span>
                          <span className="text-[10px] text-slate-500 font-mono">{it.ean}</span>
                        </td>
                        <td className="py-2.5 px-3 font-mono">
                          <span className="text-slate-200 font-bold block">
                            {it.batch?.batchNumber || it.batchNumber || '-'}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Val:{' '}
                            {it.batch?.expirationDate || it.expirationDate
                              ? new Date(
                                  it.batch?.expirationDate || it.expirationDate!
                                ).toLocaleDateString('pt-BR')
                              : '-'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-300">
                          {it.anvisaRegistration || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-200">
                          {it.quantity}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                          R$ {it.unitCost.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                          R$ {it.totalCost.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-950 px-6 py-3 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
