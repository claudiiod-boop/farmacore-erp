import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Calendar,
  AlertTriangle,
  FileText,
  Printer,
  Upload,
  Plus,
  CheckCircle,
  Building2
} from 'lucide-react';
import { cardReconciliationApi } from '../services/api';
import type {
  AcquirerContract,
  ReceivablesCalendarDay,
  DivergenceReport,
  CardReconciliationBatch,
  CardSettlementEntry
} from '../types/card-reconciliation';

export const CardReconciliationPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'calendar' | 'import' | 'divergences' | 'contracts'>('calendar');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Estados de dados
  const [contracts, setContracts] = useState<AcquirerContract[]>([]);
  const [calendar, setCalendar] = useState<ReceivablesCalendarDay[]>([]);
  const [divergences, setDivergences] = useState<DivergenceReport | null>(null);

  // Filtros de data
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 2, 0).toISOString().slice(0, 10);
  });

  // Modais
  const [showNewContractModal, setShowNewContractModal] = useState(false);
  const [showAddRuleModal, setShowAddRuleModal] = useState<number | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [printSlipContent, setPrintSlipContent] = useState<string | null>(null);
  const [selectedBatchDetails, setSelectedBatchDetails] = useState<{
    batch: CardReconciliationBatch;
    entries: CardSettlementEntry[];
  } | null>(null);

  // Form states
  const [contractForm, setContractForm] = useState({
    acquirerName: 'STONE',
    acquirerCnpj: '16.501.555/0001-57',
    merchantCode: '',
    defaultBankName: 'Banco Itaú',
    defaultBankAgency: '0057',
    defaultBankAccount: '12345-6',
    debitSettlementDays: 1,
    creditSettlementDays: 30,
    pixSettlementDays: 0
  });

  const [ruleForm, setRuleForm] = useState({
    brandName: 'VISA',
    operationType: 'DEBIT',
    installmentMin: 1,
    installmentMax: 1,
    mdrRate: 1.25,
    fixedFee: 0.10,
    settlementDays: 1
  });

  const [importForm, setImportForm] = useState({
    acquirerContractId: '',
    fileName: 'EXTRATO_MOCK.csv',
    fileType: 'EXTRATO_CSV',
    rawItemsJson: JSON.stringify([
      {
        nsu: '100200300',
        authorizationCode: 'AUTH01',
        transactionDate: new Date().toISOString().replace('T', ' ').slice(0, 19),
        settlementDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        brandName: 'VISA',
        operationType: 'DEBIT',
        grossAmount: 150.00,
        chargedMdrRate: 1.25,
        chargedFeeAmount: 1.98,
        netAmount: 148.02
      }
    ], null, 2)
  });

  // Carrega dados iniciais
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [contractsData, calendarData, divergencesData] = await Promise.all([
        cardReconciliationApi.listContracts(1),
        cardReconciliationApi.getReceivablesCalendar(1, startDate, endDate),
        cardReconciliationApi.getDivergences(1)
      ]);
      setContracts(contractsData);
      setCalendar(calendarData);
      setDivergences(divergencesData);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados de conciliação');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [startDate, endDate]);

  // Ações
  const handleCreateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await cardReconciliationApi.createContract({
        storeId: 1,
        ...contractForm
      });
      setShowNewContractModal(false);
      setSuccess('Contrato de adquirente cadastrado com sucesso!');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Erro ao cadastrar contrato');
    }
  };

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAddRuleModal) return;
    try {
      await cardReconciliationApi.addFeeRule(showAddRuleModal, {
        brandName: ruleForm.brandName,
        operationType: ruleForm.operationType,
        installmentMin: Number(ruleForm.installmentMin),
        installmentMax: Number(ruleForm.installmentMax),
        mdrRate: Number(ruleForm.mdrRate),
        fixedFee: Number(ruleForm.fixedFee),
        settlementDays: ruleForm.settlementDays ? Number(ruleForm.settlementDays) : undefined
      });
      setShowAddRuleModal(null);
      setSuccess('Regra de taxa MDR adicionada com sucesso!');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Erro ao adicionar regra');
    }
  };

  const handleImportStatement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsedItems = JSON.parse(importForm.rawItemsJson);
      const batch = await cardReconciliationApi.importStatement({
        storeId: 1,
        acquirerContractId: importForm.acquirerContractId ? Number(importForm.acquirerContractId) : undefined,
        fileName: importForm.fileName,
        fileType: importForm.fileType,
        items: parsedItems
      });
      setShowImportModal(false);
      setSuccess(`Lote ${batch.batchCode} importado com sucesso!`);
      const details = await cardReconciliationApi.getBatchDetails(batch.id);
      setSelectedBatchDetails(details);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Erro ao processar extrato');
    }
  };

  const handlePrintDailySlip = async (date: string) => {
    try {
      const res = await cardReconciliationApi.printCalendarSlip(1, date);
      setPrintSlipContent(res.slipText);
    } catch (err: any) {
      setError(err.message || 'Erro ao gerar extrato diário');
    }
  };

  const handlePrintDivergences = async () => {
    try {
      const res = await cardReconciliationApi.printDivergenceSlip(1);
      setPrintSlipContent(res.slipText);
    } catch (err: any) {
      setError(err.message || 'Erro ao emitir comprovante de divergências');
    }
  };

  // KPIs do Calendário
  const totalCalendarGross = calendar.reduce((acc, curr) => acc + curr.totalGross, 0);
  const totalCalendarFee = calendar.reduce((acc, curr) => acc + curr.totalFee, 0);
  const totalCalendarNet = calendar.reduce((acc, curr) => acc + curr.totalNet, 0);
  const totalCalendarCount = calendar.reduce((acc, curr) => acc + curr.transactionCount, 0);

  return (
    <div className="p-6 bg-slate-50 min-h-screen text-slate-800">
      {/* HEADER */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CreditCard className="w-8 h-8 text-indigo-600" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Conciliação de Cartões, TEF & Taxas MDR
              {loading && <span className="text-xs text-indigo-600 font-normal ml-3 animate-pulse">Sincronizando...</span>}
            </h1>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Gestão de Recebíveis D+1/D+30, Extratos EDI de Adquirentes e Auditoria de Cobranças Indevidas
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors text-sm"
          >
            <Upload className="w-4 h-4" />
            Importar Extrato EDI / CSV
          </button>
          <button
            onClick={() => setShowNewContractModal(true)}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Novo Contrato Adquirente
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

      {/* ABAS */}
      <div className="flex border-b border-slate-200 mb-6 space-x-1">
        <button
          onClick={() => setActiveTab('calendar')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'calendar'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Calendário de Recebíveis (D+1 / D+30)
        </button>

        <button
          onClick={() => setActiveTab('import')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'import'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <FileText className="w-4 h-4" />
          Lotes e Extratos de Cartões
        </button>

        <button
          onClick={() => setActiveTab('divergences')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'divergences'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          Auditoria de Divergências MDR
          {divergences && divergences.totalDivergentCount > 0 && (
            <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
              {divergences.totalDivergentCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('contracts')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'contracts'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Contratos & Taxas Contratuais
        </button>
      </div>

      {/* ABA 1: CALENDÁRIO DE RECEBÍVEIS */}
      {activeTab === 'calendar' && (
        <div className="space-y-6">
          {/* BARRA DE FILTROS */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-slate-700">Período de Liquidação:</span>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
              />
              <span className="text-slate-400">até</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
              />
            </div>
            <button
              onClick={() => loadData()}
              className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Atualizar Dados
            </button>
          </div>

          {/* KPIS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Valor Bruto Previsto</span>
              <p className="text-2xl font-bold text-slate-900 mt-2">
                R$ {totalCalendarGross.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <span className="text-xs text-slate-500 mt-1 block">{totalCalendarCount} transações no período</span>
            </div>

            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-600">Taxas MDR Retidas</span>
              <p className="text-2xl font-bold text-amber-600 mt-2">
                R$ {totalCalendarFee.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <span className="text-xs text-slate-500 mt-1 block">
                {totalCalendarGross > 0 ? ((totalCalendarFee / totalCalendarGross) * 100).toFixed(2) : '0.00'}% taxa média
              </span>
            </div>

            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Líquido a Depositar</span>
              <p className="text-2xl font-bold text-emerald-600 mt-2">
                R$ {totalCalendarNet.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <span className="text-xs text-emerald-600 mt-1 block">Depósito em conta corrente</span>
            </div>

            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Dias com Liquidação</span>
              <p className="text-2xl font-bold text-indigo-600 mt-2">{calendar.length}</p>
              <span className="text-xs text-slate-500 mt-1 block">Conforme calendário bancário</span>
            </div>
          </div>

          {/* TABELA DE DIAS DO CALENDÁRIO */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">Cronograma Diário de Repasses Bancários</h2>
              <span className="text-xs text-slate-500">Agrupado por data de vencimento e adquirente</span>
            </div>

            {calendar.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                Nenhum recebível previsto para o período selecionado.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {calendar.map(day => (
                  <div key={day.date} className="p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex flex-col items-center justify-center font-bold text-xs">
                          <span>{day.date.split('-')[2]}</span>
                          <span className="text-[10px] uppercase font-normal">{day.date.split('-')[1]}</span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {day.date.split('-').reverse().join('/')}
                          </p>
                          <p className="text-xs text-slate-500">
                            {day.transactionCount} transações agendadas
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <span className="text-xs text-slate-400 block">Bruto</span>
                          <span className="text-sm font-medium text-slate-700">
                            R$ {day.totalGross.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-slate-400 block">Taxa</span>
                          <span className="text-sm font-medium text-amber-600">
                            R$ {day.totalFee.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-slate-400 block">Líquido</span>
                          <span className="text-sm font-bold text-emerald-600">
                            R$ {day.totalNet.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        <button
                          onClick={() => handlePrintDailySlip(day.date)}
                          className="flex items-center gap-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-medium transition-colors"
                          title="Imprimir Extrato Térmico ESC/POS"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Imprimir
                        </button>
                      </div>
                    </div>

                    {/* Detalhamento por adquirente */}
                    <div className="mt-3 pl-12 flex flex-wrap gap-2">
                      {Object.entries(day.byAcquirer).map(([acq, acqData]) => (
                        <div key={acq} className="bg-slate-100 px-2.5 py-1 rounded text-xs text-slate-600 flex items-center gap-2">
                          <span className="font-semibold text-slate-800">{acq}:</span>
                          <span>R$ {acqData.net.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          <span className="text-slate-400">({acqData.count} trans.)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ABA 2: LOTES E EXTRATOS */}
      {activeTab === 'import' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-base font-semibold text-slate-900 mb-2">Importação de Extratos Eletrônicos (EDI / CSV)</h2>
            <p className="text-sm text-slate-600 mb-4">
              Realize o batimento automático de vendas em cartão cruzando o NSU e código de autorização contra as transações registradas no TEF da farmácia.
            </p>
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Upload className="w-4 h-4" />
              Carregar Novo Arquivo de Extrato
            </button>
          </div>

          {selectedBatchDetails && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-4">
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">
                    Lote: {selectedBatchDetails.batch.batchCode}
                  </h3>
                  <span className="text-xs text-slate-500">
                    Arquivo: {selectedBatchDetails.batch.fileName} ({selectedBatchDetails.batch.fileType})
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-1 rounded-full font-semibold">
                    {selectedBatchDetails.batch.conciliatedCount} Conciliadas
                  </span>
                  <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-1 rounded-full font-semibold">
                    {selectedBatchDetails.batch.divergentCount} Divergentes
                  </span>
                  <span className="bg-red-100 text-red-800 text-xs px-2.5 py-1 rounded-full font-semibold">
                    {selectedBatchDetails.batch.chargebackCount} Chargebacks
                  </span>
                  <span className="bg-slate-100 text-slate-800 text-xs px-2.5 py-1 rounded-full font-semibold">
                    {selectedBatchDetails.batch.notFoundCount} Não Encontradas
                  </span>
                </div>
              </div>

              {/* Tabela de Lançamentos */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">NSU / Autorização</th>
                      <th className="py-2.5 px-3">Data Venda</th>
                      <th className="py-2.5 px-3">Liquidação</th>
                      <th className="py-2.5 px-3">Bandeira/Tipo</th>
                      <th className="py-2.5 px-3 text-right">Bruto (R$)</th>
                      <th className="py-2.5 px-3 text-right">Taxa Cobrada</th>
                      <th className="py-2.5 px-3 text-right">Taxa Contrato</th>
                      <th className="py-2.5 px-3 text-right">Diferença (R$)</th>
                      <th className="py-2.5 px-3 text-right">Líquido (R$)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedBatchDetails.entries.map(entry => (
                      <tr key={entry.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3">
                          {entry.reconciliationStatus === 'CONCILIATED' && (
                            <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-semibold text-[11px]">
                              CONCILIADO
                            </span>
                          )}
                          {entry.reconciliationStatus === 'DIVERGENT_FEE' && (
                            <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-semibold text-[11px]">
                              TAXA DIVERGENTE
                            </span>
                          )}
                          {entry.reconciliationStatus === 'CHARGEBACK' && (
                            <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded font-semibold text-[11px]">
                              CHARGEBACK
                            </span>
                          )}
                          {entry.reconciliationStatus === 'NOT_FOUND_IN_ERP' && (
                            <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-semibold text-[11px]">
                              NÃO LOCALIZADO
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono">
                          {entry.nsu} {entry.authorizationCode ? `(${entry.authorizationCode})` : ''}
                        </td>
                        <td className="py-2.5 px-3">{entry.transactionDate.substring(0, 16)}</td>
                        <td className="py-2.5 px-3">{entry.settlementDate}</td>
                        <td className="py-2.5 px-3">{entry.brandName} / {entry.operationType}</td>
                        <td className="py-2.5 px-3 text-right font-medium">{entry.grossAmount.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-right text-slate-600">{entry.chargedFeeAmount.toFixed(2)} ({entry.chargedMdrRate.toFixed(2)}%)</td>
                        <td className="py-2.5 px-3 text-right text-slate-600">
                          {entry.expectedFeeAmount != null ? `${entry.expectedFeeAmount.toFixed(2)} (${entry.contractMdrRate?.toFixed(2)}%)` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-red-600">
                          {entry.divergenceAmount > 0 ? `+${entry.divergenceAmount.toFixed(2)}` : '0.00'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-emerald-600">{entry.netAmount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ABA 3: AUDITORIA DE DIVERGÊNCIAS */}
      {activeTab === 'divergences' && (
        <div className="space-y-6">
          {/* CARD DE ALERTA DE RESSARCIMENTO */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-red-700 font-bold text-lg">
                <AlertTriangle className="w-6 h-6" />
                <span>Cobrança Indevida de Taxas MDR Identificada</span>
              </div>
              <p className="text-sm text-red-600 mt-1">
                As operadoras cobraram valores acima das taxas cadastradas em contrato. Utilize o comprovante para abertura de protocolo de contestação.
              </p>
              <div className="mt-3 flex items-center gap-4">
                <span className="text-xs font-semibold uppercase text-red-800">Total a Reaver:</span>
                <span className="text-2xl font-black text-red-700">
                  R$ {(divergences?.totalOverchargedAmount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-xs text-red-600">({divergences?.totalDivergentCount || 0} lançamentos)</span>
              </div>
            </div>

            <button
              onClick={handlePrintDivergences}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-lg font-medium shadow transition-colors text-sm"
            >
              <Printer className="w-4 h-4" />
              Emitir Comprovante de Contestação
            </button>
          </div>

          {/* TABELA DE ITENS COM DIVERGÊNCIA */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-800">Transações Auditadas com Cobrança Indevida</h3>
            </div>

            {(!divergences || divergences.items.length === 0) ? (
              <div className="p-8 text-center text-slate-500">
                Nenhuma divergência de taxa encontrada. Todas as transações batem com os contratos acordados!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-semibold">
                    <tr>
                      <th className="py-3 px-4">Lote / NSU</th>
                      <th className="py-3 px-4">Data Venda</th>
                      <th className="py-3 px-4">Adquirente / Bandeira</th>
                      <th className="py-3 px-4 text-right">Valor Venda</th>
                      <th className="py-3 px-4 text-right">Taxa Cobrada</th>
                      <th className="py-3 px-4 text-right">Taxa Contratual</th>
                      <th className="py-3 px-4 text-right">Cobrado a Maior</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {divergences.items.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono">
                          <span className="text-slate-500 block text-[10px]">{item.batchCode}</span>
                          <span className="font-bold text-slate-800">NSU: {item.nsu}</span>
                        </td>
                        <td className="py-3 px-4">{item.transactionDate}</td>
                        <td className="py-3 px-4 font-semibold text-slate-800">
                          {item.acquirerName} - {item.brandName}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-slate-900">
                          R$ {item.grossAmount.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right text-red-600 font-semibold">
                          {item.chargedMdrRate.toFixed(2)}% (R$ {item.chargedFeeAmount.toFixed(2)})
                        </td>
                        <td className="py-3 px-4 text-right text-emerald-600 font-medium">
                          {item.contractMdrRate.toFixed(2)}% (R$ {item.expectedFeeAmount.toFixed(2)})
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-red-600 text-sm">
                          R$ {item.divergenceAmount.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ABA 4: CONTRATOS & REGRAS */}
      {activeTab === 'contracts' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-semibold text-slate-900">Contratos de Adquirentes e Taxas Negociadas</h2>
            <button
              onClick={() => setShowNewContractModal(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Novo Contrato
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {contracts.map(contract => (
              <div key={contract.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg font-bold">
                        {contract.acquirerName}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-base">{contract.acquirerName}</h3>
                        <span className="text-xs text-slate-500">CNPJ: {contract.acquirerCnpj}</span>
                      </div>
                    </div>
                    <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                      ATIVO
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 space-y-1 mb-4">
                    <p><strong>Banco Padrão:</strong> {contract.defaultBankName} (Ag: {contract.defaultBankAgency} / CC: {contract.defaultBankAccount})</p>
                    <p><strong>Prazos Padrão:</strong> Débito D+{contract.debitSettlementDays} | Crédito D+{contract.creditSettlementDays} | PIX D+{contract.pixSettlementDays}</p>
                  </div>

                  {/* Regras cadastradas */}
                  <div className="border-t border-slate-100 pt-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-700 uppercase">Regras de Taxa MDR</span>
                      <button
                        onClick={() => setShowAddRuleModal(contract.id)}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Adicionar Regra
                      </button>
                    </div>

                    {(!contract.rules || contract.rules.length === 0) ? (
                      <p className="text-xs text-slate-400 italic">Nenhuma regra cadastrada ainda.</p>
                    ) : (
                      <div className="divide-y divide-slate-100 text-xs">
                        {contract.rules.map(r => (
                          <div key={r.id} className="py-1.5 flex items-center justify-between">
                            <span className="font-medium text-slate-800">
                              {r.operationType} ({r.brandName}) - {r.installmentMin}x a {r.installmentMax}x
                            </span>
                            <span className="font-semibold text-slate-900">
                              {r.mdrRate.toFixed(2)}% {r.fixedFee > 0 ? `+ R$ ${r.fixedFee.toFixed(2)}` : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: NOVO CONTRATO */}
      {showNewContractModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Novo Contrato com Adquirente</h3>
            <form onSubmit={handleCreateContract} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Adquirente</label>
                  <select
                    value={contractForm.acquirerName}
                    onChange={e => setContractForm({ ...contractForm, acquirerName: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  >
                    <option value="STONE">STONE</option>
                    <option value="CIELO">CIELO</option>
                    <option value="REDE">REDE</option>
                    <option value="PAGBANK">PAGBANK</option>
                    <option value="GETNET">GETNET</option>
                    <option value="OUTROS">OUTROS</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">CNPJ Adquirente</label>
                  <input
                    type="text"
                    value={contractForm.acquirerCnpj}
                    onChange={e => setContractForm({ ...contractForm, acquirerCnpj: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Banco Padrão</label>
                  <input
                    type="text"
                    value={contractForm.defaultBankName}
                    onChange={e => setContractForm({ ...contractForm, defaultBankName: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Agência</label>
                  <input
                    type="text"
                    value={contractForm.defaultBankAgency}
                    onChange={e => setContractForm({ ...contractForm, defaultBankAgency: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Conta Corrente</label>
                  <input
                    type="text"
                    value={contractForm.defaultBankAccount}
                    onChange={e => setContractForm({ ...contractForm, defaultBankAccount: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Débito (Dias)</label>
                  <input
                    type="number"
                    value={contractForm.debitSettlementDays}
                    onChange={e => setContractForm({ ...contractForm, debitSettlementDays: Number(e.target.value) })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Crédito (Dias)</label>
                  <input
                    type="number"
                    value={contractForm.creditSettlementDays}
                    onChange={e => setContractForm({ ...contractForm, creditSettlementDays: Number(e.target.value) })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">PIX (Dias)</label>
                  <input
                    type="number"
                    value={contractForm.pixSettlementDays}
                    onChange={e => setContractForm({ ...contractForm, pixSettlementDays: Number(e.target.value) })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewContractModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
                >
                  Salvar Contrato
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NOVA REGRA DE TAXA */}
      {showAddRuleModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Adicionar Regra de Taxa MDR</h3>
            <form onSubmit={handleAddRule} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Modalidade</label>
                  <select
                    value={ruleForm.operationType}
                    onChange={e => setRuleForm({ ...ruleForm, operationType: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  >
                    <option value="DEBIT">Débito</option>
                    <option value="CREDIT">Crédito</option>
                    <option value="PIX">PIX</option>
                    <option value="VOUCHER">Voucher</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Bandeira</label>
                  <select
                    value={ruleForm.brandName}
                    onChange={e => setRuleForm({ ...ruleForm, brandName: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  >
                    <option value="VISA">VISA</option>
                    <option value="MASTERCARD">MASTERCARD</option>
                    <option value="ELO">ELO</option>
                    <option value="HIPERCARD">HIPERCARD</option>
                    <option value="AMEX">AMEX</option>
                    <option value="ALL">TODAS (Fallback)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Parcela Mín.</label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={ruleForm.installmentMin}
                    onChange={e => setRuleForm({ ...ruleForm, installmentMin: Number(e.target.value) })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Parcela Máx.</label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={ruleForm.installmentMax}
                    onChange={e => setRuleForm({ ...ruleForm, installmentMax: Number(e.target.value) })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Taxa MDR (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={ruleForm.mdrRate}
                    onChange={e => setRuleForm({ ...ruleForm, mdrRate: Number(e.target.value) })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Taxa Fixa (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={ruleForm.fixedFee}
                    onChange={e => setRuleForm({ ...ruleForm, fixedFee: Number(e.target.value) })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddRuleModal(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
                >
                  Salvar Regra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: IMPORTAR EXTRATO */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Importar Extrato EDI / CSV</h3>
            <p className="text-xs text-slate-500 mb-4">
              Cole o array JSON de transações exportado pela adquirente ou use o modelo padrão.
            </p>
            <form onSubmit={handleImportStatement} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Adquirente Vinculada</label>
                  <select
                    value={importForm.acquirerContractId}
                    onChange={e => setImportForm({ ...importForm, acquirerContractId: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  >
                    <option value="">Selecione a adquirente...</option>
                    {contracts.map(c => (
                      <option key={c.id} value={c.id}>{c.acquirerName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Nome do Arquivo</label>
                  <input
                    type="text"
                    value={importForm.fileName}
                    onChange={e => setImportForm({ ...importForm, fileName: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Registros do Extrato (JSON)</label>
                <textarea
                  rows={8}
                  value={importForm.rawItemsJson}
                  onChange={e => setImportForm({ ...importForm, rawItemsJson: e.target.value })}
                  className="w-full font-mono text-xs border border-slate-300 rounded-lg p-3"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
                >
                  Processar e Conciliar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE IMPRESSÃO TÉRMICA ESC/POS */}
      {printSlipContent && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-indigo-600" />
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

export default CardReconciliationPage;
