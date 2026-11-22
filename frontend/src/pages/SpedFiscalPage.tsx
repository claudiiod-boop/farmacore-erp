import React, { useState, useEffect } from 'react';
import {
  FileCode,
  Download,
  Printer,
  AlertTriangle,
  CheckCircle,
  FileText,
  Boxes,
  UserCheck,
  Play,
  RotateCcw
} from 'lucide-react';
import { spedApi } from '../services/api';
import type {
  AccountingParameters,
  SpedGenerationRecord,
  SpedValidationResult,
  SpedInventoryResponse
} from '../types/sped';

export const SpedFiscalPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'generator' | 'inventory' | 'audit' | 'accounting'>('generator');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Estados de dados
  const [history, setHistory] = useState<SpedGenerationRecord[]>([]);
  const [inventory, setInventory] = useState<SpedInventoryResponse | null>(null);
  const [auditResult, setAuditResult] = useState<SpedValidationResult | null>(null);
  const [accountingParams, setAccountingParams] = useState<AccountingParameters>({
    storeId: 1,
    accountantName: '',
    accountantCpf: '',
    accountantCrc: '',
    accountantCnpj: '',
    accountantEmail: '',
    accountantPhone: '',
    accountantCep: '',
    accountantAddress: '',
    accountantCityCode: 3550308,
    spedProfile: 'A',
    spedVersion: '018'
  });

  // Formulário de geração
  const now = new Date();
  const currentMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().substring(0, 10);

  const [genForm, setGenForm] = useState({
    generationType: 'SPED_EFD' as 'SPED_EFD' | 'SINTEGRA',
    periodStart: currentMonthStart,
    periodEnd: currentMonthEnd,
    purpose: 0 as 0 | 1,
    includeInventory: true,
    inventoryDate: currentMonthEnd,
    notes: 'Escrituração Fiscal e Estoque Farmacêutico'
  });

  // Modal de Comprovante Térmico / Conteúdo
  const [viewingRecord, setViewingRecord] = useState<SpedGenerationRecord | null>(null);
  const [printSlipContent, setPrintSlipContent] = useState<string | null>(null);

  // Carregar dados
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [hist, acc, inv, aud] = await Promise.all([
        spedApi.getHistory(1),
        spedApi.getParameters(1),
        spedApi.getInventory(1),
        spedApi.runAudit(1)
      ]);
      setHistory(hist);
      if (acc && acc.accountantName) {
        setAccountingParams(acc);
      }
      setInventory(inv);
      setAuditResult(aud);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados fiscais');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handlers
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const record = await spedApi.generate({
        storeId: 1,
        ...genForm
      });
      setSuccess(`Arquivo ${record.fileName} gerado com sucesso (${record.totalLines} linhas escrituradas)!`);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Erro ao gerar arquivo fiscal');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAccounting = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await spedApi.saveParameters(accountingParams);
      setSuccess('Parâmetros do contabilista atualizados com sucesso!');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar parâmetros contábeis');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintSlip = async (id: number) => {
    try {
      const res = await spedApi.printSlip(id);
      setPrintSlipContent(res.slipText);
    } catch (err: any) {
      setError(err.message || 'Erro ao gerar comprovante térmico');
    }
  };

  const handleDownloadFile = (record: SpedGenerationRecord) => {
    const blob = new Blob([record.fileContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = record.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen text-slate-800">
      {/* CABEÇALHO */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileCode className="w-8 h-8 text-emerald-600" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              SPED Fiscal EFD ICMS/IPI & Sintegra
              {loading && <span className="text-xs text-emerald-600 font-normal ml-3 animate-pulse">Sincronizando...</span>}
            </h1>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Escrituração Fiscal Digital, Apuração de ICMS-ST Farmacêutico, Bloco H (Inventário) e Validação PVA
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setActiveTab('audit');
              spedApi.runAudit(1).then(setAuditResult);
            }}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors text-sm"
          >
            <RotateCcw className="w-4 h-4" />
            Auditar PVA
          </button>
        </div>
      </div>

      {/* ALERTAS */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 text-sm font-semibold">✕</button>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{success}</span>
          </div>
          <button onClick={() => setSuccess(null)} className="text-emerald-500 hover:text-emerald-700 text-sm font-semibold">✕</button>
        </div>
      )}

      {/* NAVEGAÇÃO POR ABAS */}
      <div className="flex border-b border-slate-200 mb-6 space-x-1">
        <button
          onClick={() => setActiveTab('generator')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'generator'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Play className="w-4 h-4" />
          Gerador & Histórico
        </button>

        <button
          onClick={() => setActiveTab('inventory')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'inventory'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Boxes className="w-4 h-4" />
          Bloco H (Inventário Contábil)
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'audit'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          Auditoria Pré-PVA
          {auditResult && auditResult.totalErrors > 0 && (
            <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-1">
              {auditResult.totalErrors}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('accounting')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'accounting'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          Parâmetros do Contabilista
        </button>
      </div>

      {/* ABA 1: GERADOR & HISTÓRICO */}
      {activeTab === 'generator' && (
        <div className="space-y-6">
          {/* Formulário de Geração */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600" />
              Parâmetros para Geração do Arquivo Digital
            </h2>

            <form onSubmit={handleGenerate} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Tipo de Arquivo</label>
                <select
                  value={genForm.generationType}
                  onChange={e => setGenForm({ ...genForm, generationType: e.target.value as any })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white"
                >
                  <option value="SPED_EFD">SPED Fiscal EFD ICMS/IPI (Layout Oficial)</option>
                  <option value="SINTEGRA">Sintegra (Convênio ICMS 57/95)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Data Início (Competência)</label>
                <input
                  type="date"
                  value={genForm.periodStart}
                  onChange={e => setGenForm({ ...genForm, periodStart: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Data Fim (Competência)</label>
                <input
                  type="date"
                  value={genForm.periodEnd}
                  onChange={e => setGenForm({ ...genForm, periodEnd: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Finalidade do Arquivo</label>
                <select
                  value={genForm.purpose}
                  onChange={e => setGenForm({ ...genForm, purpose: Number(e.target.value) as any })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white"
                >
                  <option value={0}>0 - Remessa do Arquivo Original</option>
                  <option value={1}>1 - Remessa do Arquivo Substituto (Retificador)</option>
                </select>
              </div>

              <div className="flex items-center gap-3 pt-6">
                <input
                  type="checkbox"
                  id="includeInv"
                  checked={genForm.includeInventory}
                  onChange={e => setGenForm({ ...genForm, includeInventory: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <label htmlFor="includeInv" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Incluir Bloco H (Inventário)
                </label>
              </div>

              {genForm.includeInventory && (
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Data Posição Estoque</label>
                  <input
                    type="date"
                    value={genForm.inventoryDate}
                    onChange={e => setGenForm({ ...genForm, inventoryDate: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                    required
                  />
                </div>
              )}

              <div className="md:col-span-2 lg:col-span-2">
                <label className="text-xs font-semibold text-slate-700 block mb-1">Observações / Histórico</label>
                <input
                  type="text"
                  value={genForm.notes}
                  onChange={e => setGenForm({ ...genForm, notes: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                />
              </div>

              <div className="md:col-span-3 lg:col-span-4 flex justify-end gap-2 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg font-semibold text-sm shadow transition-colors disabled:opacity-50"
                >
                  <Play className="w-4 h-4" />
                  Gerar Arquivo Digital
                </button>
              </div>
            </form>
          </div>

          {/* Histórico de Gerações */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-800">Histórico de Arquivos Digitais Gerados</h3>
                <span className="text-xs text-slate-500">
                  Arquivos prontos para transmissão pelo PVA da Receita Federal ou validação no Sintegra
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Tipo</th>
                    <th className="py-2.5 px-4">Nome do Arquivo</th>
                    <th className="py-2.5 px-4">Competência</th>
                    <th className="py-2.5 px-4 text-center">Finalidade</th>
                    <th className="py-2.5 px-4 text-right">Qtd Linhas</th>
                    <th className="py-2.5 px-4 text-right">Estoque Bloco H</th>
                    <th className="py-2.5 px-4 text-center">Status</th>
                    <th className="py-2.5 px-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        Nenhum arquivo digital gerado até o momento.
                      </td>
                    </tr>
                  ) : (
                    history.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-bold text-slate-900">
                          <span className={`px-2 py-0.5 rounded text-[11px] ${
                            item.generationType === 'SPED_EFD' ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {item.generationType}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-slate-700">
                          {item.fileName}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {item.periodStart.split('-').reverse().join('/')} a {item.periodEnd.split('-').reverse().join('/')}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {item.purpose === 0 ? 'Original' : 'Retificador'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                          {item.totalLines.toLocaleString('pt-BR')}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-emerald-600">
                          {item.totalInventoryValue > 0
                            ? `R$ ${item.totalInventoryValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                            : '-'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                            {item.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleDownloadFile(item)}
                              title="Baixar Arquivo .txt"
                              className="p-1.5 hover:bg-slate-200 rounded text-slate-700"
                            >
                              <Download className="w-4 h-4 text-emerald-600" />
                            </button>
                            <button
                              onClick={() => handlePrintSlip(item.id)}
                              title="Imprimir Comprovante Térmico"
                              className="p-1.5 hover:bg-slate-200 rounded text-slate-700"
                            >
                              <Printer className="w-4 h-4 text-slate-600" />
                            </button>
                            <button
                              onClick={() => setViewingRecord(item)}
                              title="Visualizar Texto"
                              className="p-1.5 hover:bg-slate-200 rounded text-slate-700"
                            >
                              <FileText className="w-4 h-4 text-indigo-600" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: BLOCO H (INVENTÁRIO CONTÁBIL) */}
      {activeTab === 'inventory' && inventory && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Itens em Estoque</span>
              <p className="text-2xl font-bold text-slate-900 mt-2">{inventory.totalItems} medicamentos</p>
              <span className="text-xs text-slate-500 mt-1 block">Posição contábil atualizada</span>
            </div>

            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Valor Total do Estoque (Custo)</span>
              <p className="text-2xl font-bold text-emerald-600 mt-2">
                R$ {inventory.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <span className="text-xs text-emerald-600 mt-1 block">Valoração por custo médio ponderado</span>
            </div>

            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Registro Bloco H</span>
              <p className="text-2xl font-bold text-indigo-600 mt-2">H005 / H010</p>
              <span className="text-xs text-indigo-600 mt-1 block">Código de Posse 0 (Própria em seu poder)</span>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-800">Demonstrativo do Inventário Físico (Bloco H)</h3>
                <span className="text-xs text-slate-500">
                  Totalização de lotes com NCM, CEST e custo médio contábil para o SPED Fiscal
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Código</th>
                    <th className="py-2.5 px-4">Medicamento / Descrição</th>
                    <th className="py-2.5 px-4">EAN</th>
                    <th className="py-2.5 px-4">NCM</th>
                    <th className="py-2.5 px-4">CEST</th>
                    <th className="py-2.5 px-4 text-right">Saldo Físico</th>
                    <th className="py-2.5 px-4 text-right">Custo Médio (R$)</th>
                    <th className="py-2.5 px-4 text-right">Valor Total (R$)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inventory.items.map(item => (
                    <tr key={item.productId} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-mono text-slate-700">{item.internalCode}</td>
                      <td className="py-2.5 px-4 font-medium text-slate-900">{item.description}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-600">{item.ean}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-600">{item.ncm}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-600">{item.cest || '-'}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-slate-900">
                        {item.quantity.toLocaleString('pt-BR')} {item.unit}
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-600">
                        R$ {item.averageCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-emerald-600">
                        R$ {item.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ABA 3: AUDITORIA PRÉ-PVA */}
      {activeTab === 'audit' && auditResult && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              {auditResult.isValid ? (
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-8 h-8" />
                </div>
              ) : (
                <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-8 h-8" />
                </div>
              )}
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {auditResult.isValid
                    ? 'Dados Fiscais e Cadastrais Prontos para o PVA'
                    : 'Inconsistências Detectadas na Pré-Validação'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {auditResult.totalErrors} erros impeditivos | {auditResult.totalWarnings} advertências
                </p>
              </div>
            </div>

            <button
              onClick={() => spedApi.runAudit(1).then(setAuditResult)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Reexecutar Auditoria
            </button>
          </div>

          {/* Tabela de Inconsistências */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-800">Divergências Identificadas</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Severidade</th>
                    <th className="py-2.5 px-4">Entidade</th>
                    <th className="py-2.5 px-4">Campo</th>
                    <th className="py-2.5 px-4">Descrição da Divergência</th>
                    <th className="py-2.5 px-4">Recomendação de Correção</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditResult.divergences.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-emerald-600 font-semibold">
                        Nenhuma divergência encontrada! Base 100% aderente ao Guia Prático do SPED.
                      </td>
                    </tr>
                  ) : (
                    auditResult.divergences.map((div, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            div.severity === 'ERROR'
                              ? 'bg-red-100 text-red-800'
                              : div.severity === 'WARNING'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {div.severity}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-700">{div.entityType}</td>
                        <td className="py-3 px-4 font-mono text-slate-600">{div.fieldName || '-'}</td>
                        <td className="py-3 px-4 text-slate-900 font-medium">{div.description}</td>
                        <td className="py-3 px-4 text-slate-600 italic">{div.recommendation || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ABA 4: PARÂMETROS DO CONTABILISTA */}
      {activeTab === 'accounting' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-3xl">
          <h2 className="text-base font-bold text-slate-900 mb-2 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-emerald-600" />
            Cadastro do Contabilista Responsável (Bloco 0100)
          </h2>
          <p className="text-xs text-slate-500 mb-6">
            Dados obrigatórios para validação e assinatura da EFD ICMS/IPI exigidos pela Receita Federal.
          </p>

          <form onSubmit={handleSaveAccounting} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Nome do Contador</label>
                <input
                  type="text"
                  value={accountingParams.accountantName}
                  onChange={e => setAccountingParams({ ...accountingParams, accountantName: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">CPF do Contador</label>
                <input
                  type="text"
                  value={accountingParams.accountantCpf}
                  onChange={e => setAccountingParams({ ...accountingParams, accountantCpf: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  placeholder="000.000.000-00"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Registro CRC</label>
                <input
                  type="text"
                  value={accountingParams.accountantCrc}
                  onChange={e => setAccountingParams({ ...accountingParams, accountantCrc: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  placeholder="CRC-SP 123456/O"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">CNPJ do Escritório Contábil</label>
                <input
                  type="text"
                  value={accountingParams.accountantCnpj || ''}
                  onChange={e => setAccountingParams({ ...accountingParams, accountantCnpj: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  placeholder="00.000.000/0001-00"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">E-mail</label>
                <input
                  type="email"
                  value={accountingParams.accountantEmail || ''}
                  onChange={e => setAccountingParams({ ...accountingParams, accountantEmail: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Telefone</label>
                <input
                  type="text"
                  value={accountingParams.accountantPhone || ''}
                  onChange={e => setAccountingParams({ ...accountingParams, accountantPhone: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Perfil SPED EFD</label>
                <select
                  value={accountingParams.spedProfile}
                  onChange={e => setAccountingParams({ ...accountingParams, spedProfile: e.target.value as any })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white"
                >
                  <option value="A">Perfil A (Mais detalhado)</option>
                  <option value="B">Perfil B (Padrão varejo/drogarias)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Versão do Layout</label>
                <input
                  type="text"
                  value={accountingParams.spedVersion}
                  onChange={e => setAccountingParams({ ...accountingParams, spedVersion: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg font-semibold text-sm transition-colors"
              >
                Salvar Parâmetros Contábeis
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: VISUALIZAR TEXTO DO ARQUIVO */}
      {viewingRecord && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full p-6 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-base">{viewingRecord.fileName}</h3>
              </div>
              <button onClick={() => setViewingRecord(null)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <pre className="bg-slate-900 text-emerald-400 p-4 rounded-lg font-mono text-xs overflow-auto flex-1 whitespace-pre">
              {viewingRecord.fileContent}
            </pre>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => handleDownloadFile(viewingRecord)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium"
              >
                <Download className="w-4 h-4" />
                Baixar Arquivo .txt
              </button>
              <button
                onClick={() => setViewingRecord(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-medium"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: COMPROVANTE TÉRMICO ESC/POS */}
      {printSlipContent && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-base">Comprovante Térmico ESC/POS</h3>
              </div>
              <button onClick={() => setPrintSlipContent(null)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <pre className="bg-slate-900 text-emerald-400 p-4 rounded-lg font-mono text-xs overflow-x-auto max-h-96 whitespace-pre">
              {printSlipContent}
            </pre>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setPrintSlipContent(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-medium"
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

export default SpedFiscalPage;
