import React, { useState, useEffect } from 'react';
import {
  Building2,
  TrendingUp,
  FileText,
  Upload,
  Plus,
  Printer,
  CheckCircle,
  AlertTriangle,
  Check
} from 'lucide-react';
import { bankReconciliationApi, cashFlowApi } from '../services/api';
import type {
  BankAccount,
  BankStatementBatch,
  BankStatementEntry,
  CashFlowOverview
} from '../types/bank-reconciliation';

export const BankReconciliationPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'ofx' | 'cashflow' | 'accounts'>('ofx');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Dados
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [currentBatchDetails, setCurrentBatchDetails] = useState<{
    batch: BankStatementBatch;
    entries: BankStatementEntry[];
  } | null>(null);
  const [cashFlow, setCashFlow] = useState<CashFlowOverview | null>(null);

  // Modais
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showOfxModal, setShowOfxModal] = useState(false);
  const [manualMatchEntry, setManualMatchEntry] = useState<BankStatementEntry | null>(null);
  const [printSlipContent, setPrintSlipContent] = useState<string | null>(null);

  // Formulários
  const [accountForm, setAccountForm] = useState({
    bankCode: '341',
    bankName: 'Banco Itaú Unibanco',
    agencyNumber: '0057',
    accountNumber: '12345-6',
    accountType: 'CHECKING' as const,
    initialBalance: 10000.00,
    notes: 'Conta principal recebimento TEF e pagamento fornecedores'
  });

  const [ofxForm, setOfxForm] = useState({
    fileName: 'extrato_itau.ofx',
    ofxContent: `OFXHEADER:100\n<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>\n<STMTTRN>\n<TRNTYPE>CREDIT\n<DTPOSTED>20260602100000\n<TRNAMT>2500.00\n<FITID>OFX-STONE-01\n<MEMO>LIQ STONE CARTAO\n</STMTTRN>\n<STMTTRN>\n<TRNTYPE>DEBIT\n<DTPOSTED>20260602120000\n<TRNAMT>-35.00\n<FITID>OFX-TAR-02\n<MEMO>TARIFA MENSALIDADE CONTA\n</STMTTRN>\n</BANKTRANLIST><LEDGERBAL><BALAMT>12465.00</BALAMT></LEDGERBAL></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`
  });

  const [matchForm, setMatchForm] = useState({
    reconciliationType: 'TEF_SETTLEMENT',
    matchedEntityId: '',
    notes: 'Vinculação manual de comprovante'
  });

  // Carregamento de dados
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [accList, cfOverview] = await Promise.all([
        bankReconciliationApi.listAccounts(1),
        cashFlowApi.getOverview(1, 30)
      ]);
      setAccounts(accList);
      if (accList.length > 0 && !selectedAccountId) {
        setSelectedAccountId(accList[0].id);
      }
      setCashFlow(cfOverview);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados bancários');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handlers
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await bankReconciliationApi.createAccount({
        storeId: 1,
        ...accountForm
      });
      setShowAccountModal(false);
      setSuccess('Conta bancária cadastrada com sucesso!');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Erro ao cadastrar conta bancária');
    }
  };

  const handleUploadOfx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountId) {
      setError('Selecione uma conta bancária de destino');
      return;
    }
    try {
      const batch = await bankReconciliationApi.uploadOfx({
        bankAccountId: selectedAccountId,
        fileName: ofxForm.fileName,
        ofxContent: ofxForm.ofxContent
      });
      setShowOfxModal(false);
      setSuccess(`Extrato ${batch.batchCode} processado com sucesso!`);
      const details = await bankReconciliationApi.getBatchDetails(batch.id);
      setCurrentBatchDetails(details);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Erro ao processar extrato OFX');
    }
  };

  const handleManualMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualMatchEntry) return;
    try {
      await bankReconciliationApi.manualMatch(manualMatchEntry.id, {
        reconciliationType: matchForm.reconciliationType,
        matchedEntityId: matchForm.matchedEntityId ? Number(matchForm.matchedEntityId) : undefined,
        notes: matchForm.notes
      });
      setManualMatchEntry(null);
      setSuccess('Lançamento conciliado manualmente com sucesso!');
      if (currentBatchDetails) {
        const details = await bankReconciliationApi.getBatchDetails(currentBatchDetails.batch.id);
        setCurrentBatchDetails(details);
      }
      loadData();
    } catch (err: any) {
      setError(err.message || 'Erro ao conciliar lançamento');
    }
  };

  const handlePrintBatch = async () => {
    if (!currentBatchDetails) return;
    try {
      const res = await bankReconciliationApi.printBatchSlip(currentBatchDetails.batch.id);
      setPrintSlipContent(res.slipText);
    } catch (err: any) {
      setError(err.message || 'Erro ao gerar comprovante do extrato');
    }
  };

  const handlePrintCashFlow = async () => {
    try {
      const res = await cashFlowApi.printCashFlowSlip(1);
      setPrintSlipContent(res.slipText);
    } catch (err: any) {
      setError(err.message || 'Erro ao emitir extrato de liquidez');
    }
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen text-slate-800">
      {/* HEADER */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-8 h-8 text-emerald-600" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Conciliação Bancária OFX & Fluxo de Caixa
              {loading && <span className="text-xs text-emerald-600 font-normal ml-3 animate-pulse">Sincronizando...</span>}
            </h1>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Importação de Extratos Multi-Banco, Batimento Automático com TEF/PDV e Gestão de Liquidez
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowOfxModal(true)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors text-sm"
          >
            <Upload className="w-4 h-4" />
            Importar Extrato OFX
          </button>
          <button
            onClick={() => setShowAccountModal(true)}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Nova Conta Bancária
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
          onClick={() => setActiveTab('ofx')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'ofx'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <FileText className="w-4 h-4" />
          Extratos & Conciliação OFX
        </button>

        <button
          onClick={() => setActiveTab('cashflow')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'cashflow'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Fluxo de Caixa Realizado vs Projetado
        </button>

        <button
          onClick={() => setActiveTab('accounts')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'accounts'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Contas Bancárias ({accounts.length})
        </button>
      </div>

      {/* ABA 1: EXTRATOS & CONCILIAÇÃO OFX */}
      {activeTab === 'ofx' && (
        <div className="space-y-6">
          {/* SELETOR DE CONTA E AÇÕES */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-slate-700">Conta Bancária:</span>
              <select
                value={selectedAccountId || ''}
                onChange={e => setSelectedAccountId(Number(e.target.value))}
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-800"
              >
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.bankName} (Ag: {acc.agencyNumber} / CC: {acc.accountNumber}) - Saldo: R$ {acc.currentBalance.toFixed(2)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowOfxModal(true)}
                className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors"
              >
                <Upload className="w-4 h-4 text-slate-600" />
                Carregar Arquivo OFX
              </button>
              {currentBatchDetails && (
                <button
                  onClick={handlePrintBatch}
                  className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors"
                >
                  <Printer className="w-4 h-4 text-indigo-600" />
                  Imprimir Comprovante
                </button>
              )}
            </div>
          </div>

          {/* VISUALIZAÇÃO DO LOTE PROCESSADO */}
          {currentBatchDetails ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Lote de Extrato: {currentBatchDetails.batch.batchCode}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Arquivo: {currentBatchDetails.batch.fileName} | Período: {currentBatchDetails.batch.periodStart} a {currentBatchDetails.batch.periodEnd}
                  </p>
                </div>
                <div className="flex gap-2">
                  <span className="bg-emerald-100 text-emerald-800 text-xs px-3 py-1 rounded-full font-bold">
                    {currentBatchDetails.batch.matchedEntries} Conciliados
                  </span>
                  <span className="bg-amber-100 text-amber-800 text-xs px-3 py-1 rounded-full font-bold">
                    {currentBatchDetails.batch.unmatchedEntries} Pendentes
                  </span>
                  <span className="bg-slate-100 text-slate-800 text-xs px-3 py-1 rounded-full font-bold">
                    Saldo OFX: R$ {(currentBatchDetails.batch.ledgerBalance ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Tabela de Transações */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Data</th>
                      <th className="py-2.5 px-3">FITID / Documento</th>
                      <th className="py-2.5 px-3">Descrição / Histórico</th>
                      <th className="py-2.5 px-3 text-right">Valor (R$)</th>
                      <th className="py-2.5 px-3">Origem / Vínculo</th>
                      <th className="py-2.5 px-3 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentBatchDetails.entries.map(entry => (
                      <tr key={entry.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3">
                          {entry.reconciliationStatus === 'MATCHED' && (
                            <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-semibold text-[11px] flex items-center gap-1 w-max">
                              <Check className="w-3 h-3" /> CONCILIADO
                            </span>
                          )}
                          {entry.reconciliationStatus === 'BANK_FEE' && (
                            <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-semibold text-[11px] flex items-center gap-1 w-max">
                              TARIFA BANCÁRIA
                            </span>
                          )}
                          {entry.reconciliationStatus === 'MANUAL_MATCH' && (
                            <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-semibold text-[11px] flex items-center gap-1 w-max">
                              VÍNCULO MANUAL
                            </span>
                          )}
                          {entry.reconciliationStatus === 'UNMATCHED' && (
                            <span className="bg-rose-100 text-rose-800 px-2 py-0.5 rounded font-semibold text-[11px] flex items-center gap-1 w-max">
                              PENDENTE
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono">{entry.postedDate}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">
                          {entry.fitid}
                          {entry.documentNumber && <span className="block text-[10px] text-slate-400">Doc: {entry.documentNumber}</span>}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-800">{entry.memo}</td>
                        <td className={`py-2.5 px-3 text-right font-bold ${entry.amount > 0 ? 'text-emerald-600' : 'text-slate-800'}`}>
                          {entry.amount > 0 ? `+${entry.amount.toFixed(2)}` : entry.amount.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {entry.reconciliationType ? (
                            <div>
                              <span className="font-semibold text-slate-700 block">[{entry.reconciliationType}]</span>
                              <span className="text-[11px] text-slate-500">{entry.matchedNotes}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Sem batimento automático</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {entry.reconciliationStatus === 'UNMATCHED' && (
                            <button
                              onClick={() => setManualMatchEntry(entry)}
                              className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded font-medium transition-colors"
                            >
                              Vincular
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
              <Upload className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="font-semibold text-slate-800 text-base">Nenhum Extrato OFX Carregado na Sessão</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                Clique no botão "Carregar Arquivo OFX" para importar o extrato bancário oficial e realizar a conciliação automática com o caixa e cartões.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ABA 2: FLUXO DE CAIXA REALIZADO VS PROJETADO */}
      {activeTab === 'cashflow' && cashFlow && (
        <div className="space-y-6">
          {/* CARDS DE LIQUIDEZ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Saldo Total em Bancos</span>
              <p className="text-2xl font-bold text-slate-900 mt-2">
                R$ {cashFlow.totalLiquidBankBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <span className="text-xs text-slate-500 mt-1 block">
                {cashFlow.currentBankBalances.length} contas correntes ativas
              </span>
            </div>

            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-600">Saldo Gaveta PDV (Dinheiro)</span>
              <p className="text-2xl font-bold text-amber-600 mt-2">
                R$ {cashFlow.totalCashDrawerBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <span className="text-xs text-slate-500 mt-1 block">Caixas físicos em operação</span>
            </div>

            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Ativo Circulante Imediato</span>
              <p className="text-2xl font-bold text-emerald-600 mt-2">
                R$ {cashFlow.totalCurrentAssets.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <span className="text-xs text-emerald-600 mt-1 block">Liquidez imediata total</span>
            </div>

            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Comprovante de Tesouraria</span>
              <button
                onClick={handlePrintCashFlow}
                className="mt-2 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Printer className="w-4 h-4" />
                Imprimir Posição Diária
              </button>
            </div>
          </div>

          {/* TABELA DE PROJEÇÃO DIA A DIA (30 DIAS) */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-800">Projeção de Fluxo de Caixa (Próximos 30 Dias)</h3>
                <span className="text-xs text-slate-500">
                  Cruzamento automático de recebíveis TEF D+1/D+30, crediário e boletos de fornecedores
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Data</th>
                    <th className="py-2.5 px-4 text-right">Saldo Inicial (R$)</th>
                    <th className="py-2.5 px-4 text-right">Entradas Previstas</th>
                    <th className="py-2.5 px-4 text-right">Saídas Previstas</th>
                    <th className="py-2.5 px-4 text-right">Saldo Final Projetado</th>
                    <th className="py-2.5 px-4 text-center">Status de Liquidez</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cashFlow.projections30Days.map(day => (
                    <tr key={day.date} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-mono font-semibold text-slate-900">
                        {day.date.split('-').reverse().join('/')}
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-600">
                        {day.openingBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-4 text-right text-emerald-600 font-semibold">
                        {day.projectedInflow > 0 ? `+${day.projectedInflow.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
                      </td>
                      <td className="py-2.5 px-4 text-right text-rose-600 font-semibold">
                        {day.projectedOutflow > 0 ? `-${day.projectedOutflow.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
                      </td>
                      <td className={`py-2.5 px-4 text-right font-bold text-sm ${day.projectedClosingBalance < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                        R$ {day.projectedClosingBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        {day.status === 'SURPLUS' && (
                          <span className="bg-emerald-100 text-emerald-800 text-[11px] px-2.5 py-0.5 rounded-full font-bold">
                            SUPERÁVIT
                          </span>
                        )}
                        {day.status === 'WARNING' && (
                          <span className="bg-amber-100 text-amber-800 text-[11px] px-2.5 py-0.5 rounded-full font-bold">
                            ATENÇÃO
                          </span>
                        )}
                        {day.status === 'DEFICIT' && (
                          <span className="bg-rose-100 text-rose-800 text-[11px] px-2.5 py-0.5 rounded-full font-bold animate-pulse">
                            DÉFICIT
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ABA 3: CONTAS BANCÁRIAS */}
      {activeTab === 'accounts' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-semibold text-slate-900">Contas Correntes Cadastradas</h2>
            <button
              onClick={() => setShowAccountModal(true)}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nova Conta Bancária
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map(acc => (
              <div key={acc.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                  <div>
                    <span className="text-xs font-bold text-emerald-600 uppercase">Banco {acc.bankCode}</span>
                    <h3 className="font-bold text-slate-900 text-base">{acc.bankName}</h3>
                  </div>
                  <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                    {acc.accountType}
                  </span>
                </div>

                <div className="text-xs text-slate-600 space-y-1 mb-4">
                  <p><strong>Agência:</strong> {acc.agencyNumber}</p>
                  <p><strong>Conta Corrente:</strong> {acc.accountNumber}</p>
                  {acc.notes && <p className="text-slate-400 italic">{acc.notes}</p>}
                </div>

                <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
                  <span className="text-xs text-slate-500">Saldo Atual Conciliado:</span>
                  <span className="text-base font-bold text-slate-900">
                    R$ {acc.currentBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: NOVA CONTA BANCÁRIA */}
      {showAccountModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Cadastrar Conta Bancária</h3>
            <form onSubmit={handleCreateAccount} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Cód. Banco</label>
                  <input
                    type="text"
                    value={accountForm.bankCode}
                    onChange={e => setAccountForm({ ...accountForm, bankCode: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Nome do Banco</label>
                  <input
                    type="text"
                    value={accountForm.bankName}
                    onChange={e => setAccountForm({ ...accountForm, bankName: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Agência</label>
                  <input
                    type="text"
                    value={accountForm.agencyNumber}
                    onChange={e => setAccountForm({ ...accountForm, agencyNumber: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Conta Corrente</label>
                  <input
                    type="text"
                    value={accountForm.accountNumber}
                    onChange={e => setAccountForm({ ...accountForm, accountNumber: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Saldo Inicial (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={accountForm.initialBalance}
                  onChange={e => setAccountForm({ ...accountForm, initialBalance: Number(e.target.value) })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAccountModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium"
                >
                  Salvar Conta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: UPLOAD DE EXTRATO OFX */}
      {showOfxModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Importar Extrato OFX</h3>
            <p className="text-xs text-slate-500 mb-4">
              Cole o conteúdo do arquivo .OFX baixado do Internet Banking para processamento automático.
            </p>
            <form onSubmit={handleUploadOfx} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Nome do Arquivo</label>
                <input
                  type="text"
                  value={ofxForm.fileName}
                  onChange={e => setOfxForm({ ...ofxForm, fileName: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Conteúdo OFX (SGML / XML)</label>
                <textarea
                  rows={8}
                  value={ofxForm.ofxContent}
                  onChange={e => setOfxForm({ ...ofxForm, ofxContent: e.target.value })}
                  className="w-full font-mono text-xs border border-slate-300 rounded-lg p-3"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowOfxModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium"
                >
                  Processar e Conciliar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONCILIAÇÃO MANUAL */}
      {manualMatchEntry && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Vincular Lançamento Manualmente</h3>
            <p className="text-xs text-slate-500 mb-4">
              {manualMatchEntry.postedDate} - R$ {manualMatchEntry.amount.toFixed(2)} ({manualMatchEntry.memo})
            </p>
            <form onSubmit={handleManualMatch} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Tipo de Vínculo</label>
                <select
                  value={matchForm.reconciliationType}
                  onChange={e => setMatchForm({ ...matchForm, reconciliationType: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                >
                  <option value="TEF_SETTLEMENT">Repasse de Cartão / TEF</option>
                  <option value="CASH_DRAWER">Depósito / Sangria de Caixa PDV</option>
                  <option value="PURCHASE_PAYMENT">Pagamento de Fornecedor / NF-e</option>
                  <option value="CUSTOMER_CREDIT">Recebimento de Crediário / Convênio</option>
                  <option value="BANK_FEE">Tarifa / Encargo Bancário</option>
                  <option value="MANUAL">Outros / Ajuste de Tesouraria</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">ID da Entidade Associada (Opcional)</label>
                <input
                  type="number"
                  value={matchForm.matchedEntityId}
                  onChange={e => setMatchForm({ ...matchForm, matchedEntityId: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  placeholder="Ex: ID da NF, do TEF ou da Sangria"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Justificativa / Observações</label>
                <textarea
                  rows={2}
                  value={matchForm.notes}
                  onChange={e => setMatchForm({ ...matchForm, notes: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setManualMatchEntry(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
                >
                  Confirmar Vínculo
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

export default BankReconciliationPage;
