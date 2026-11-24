import React, { useState, useEffect, useCallback } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  Building2, 
  FileSpreadsheet, 
  PlusCircle, 
  CheckCircle2, 
  Calendar, 
  PieChart,
  RefreshCw,
  Archive,
  ArrowDownRight,
  ArrowUpRight,
  AlertCircle
} from 'lucide-react';
import { dreApi, storesApi } from '../services/api';
import type { 
  DreReport, 
  CostCenter, 
  OperationalExpense, 
  BranchProfitabilityRankingItem,
  ExpenseType,
  DreRegime
} from '../types';

export const DreAnalyticsPage: React.FC = () => {
  const [periodMonth, setPeriodMonth] = useState<string>('2026-11');
  const [selectedStoreId, setSelectedStoreId] = useState<number | undefined>(undefined);
  const [regime, setRegime] = useState<DreRegime>('COMPETENCIA');
  const [activeTab, setActiveTab] = useState<'DRE' | 'EXPENSES' | 'BRANCHES'>('DRE');

  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<DreReport | null>(null);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [expenses, setExpenses] = useState<OperationalExpense[]>([]);
  const [branchRanking, setBranchRanking] = useState<BranchProfitabilityRankingItem[]>([]);
  const [stores, setStores] = useState<Array<{ id: number; name: string }>>([]);

  // Modal de Lançamento de Despesa
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [newStoreId, setNewStoreId] = useState<number>(1);
  const [newCostCenterId, setNewCostCenterId] = useState<number>(1);
  const [newExpenseType, setNewExpenseType] = useState<ExpenseType>('ADMINISTRATIVA');
  const [newDescription, setNewDescription] = useState('');
  const [newAmount, setNewAmount] = useState<number>(0);
  const [newDueDate, setNewDueDate] = useState<string>('2026-11-15');
  const [newPaymentDate, setNewPaymentDate] = useState<string>('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [reportData, ccData, expData, rankData, storesData] = await Promise.all([
        dreApi.getReport(periodMonth, selectedStoreId, regime),
        dreApi.listCostCenters(selectedStoreId),
        dreApi.listExpenses({ storeId: selectedStoreId }),
        dreApi.getBranchRanking(periodMonth),
        storesApi.listStores().catch(() => []),
      ]);

      setReport(reportData);
      setCostCenters(ccData);
      setExpenses(expData);
      setBranchRanking(rankData);
      if (storesData && storesData.length > 0) {
        setStores(storesData);
        if (!newStoreId && storesData[0]) setNewStoreId(storesData[0].id);
      }
      if (ccData && ccData.length > 0 && !newCostCenterId) {
        setNewCostCenterId(ccData[0].id);
      }
    } catch (err: any) {
      console.error('Erro ao carregar dados DRE:', err);
    } finally {
      setLoading(false);
    }
  }, [periodMonth, selectedStoreId, regime]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSnapshot = async () => {
    try {
      await dreApi.saveSnapshot(periodMonth, selectedStoreId, regime);
      alert(`Snapshot oficial de ${periodMonth} congelado com sucesso!`);
      loadData();
    } catch (err: any) {
      alert(`Erro ao congelar snapshot: ${err.message}`);
    }
  };

  const handlePayExpense = async (expenseId: number) => {
    try {
      await dreApi.payExpense(expenseId);
      loadData();
    } catch (err: any) {
      alert(`Erro ao baixar despesa: ${err.message}`);
    }
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDescription || newAmount <= 0) {
      alert('Preencha a descrição e um valor positivo.');
      return;
    }

    try {
      await dreApi.createExpense({
        storeId: newStoreId,
        costCenterId: newCostCenterId,
        expenseType: newExpenseType,
        description: newDescription,
        amount: newAmount,
        dueDate: newDueDate,
        paymentDate: newPaymentDate || undefined,
      });

      setIsExpenseModalOpen(false);
      setNewDescription('');
      setNewAmount(0);
      setNewPaymentDate('');
      loadData();
    } catch (err: any) {
      alert(`Erro ao cadastrar despesa: ${err.message}`);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-900 text-slate-100 p-6 overflow-y-auto">
      {/* Header com Filtros e Ações Executivas */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-800 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-emerald-400" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                DRE Gerencial & Lucratividade Farmacêutica
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium border border-emerald-500/30">
                  Fase 26
                </span>
              </h1>
              <p className="text-sm text-slate-400">
                Demonstração de Resultados, Centros de Custos e Break-Even Point por Filial
              </p>
            </div>
          </div>
        </div>

        {/* Barra de Controles e Filtros */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Seletor de Mês */}
          <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="month"
              data-testid="dre-month-input"
              value={periodMonth}
              onChange={(e) => setPeriodMonth(e.target.value)}
              className="bg-transparent text-sm text-slate-200 outline-none cursor-pointer"
            />
          </div>

          {/* Seletor de Filial */}
          <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
            <Building2 className="w-4 h-4 text-slate-400" />
            <select
              data-testid="dre-store-select"
              value={selectedStoreId || ''}
              onChange={(e) => setSelectedStoreId(e.target.value ? Number(e.target.value) : undefined)}
              className="bg-transparent text-sm text-slate-200 outline-none cursor-pointer"
            >
              <option value="" className="bg-slate-800 text-slate-200">Todas as Lojas (Rede)</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id} className="bg-slate-800 text-slate-200">
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Seletor de Regime */}
          <div className="flex bg-slate-800 rounded-lg p-0.5 border border-slate-700 text-xs font-medium">
            <button
              data-testid="regime-competencia-button"
              onClick={() => setRegime('COMPETENCIA')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                regime === 'COMPETENCIA' ? 'bg-emerald-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Competência
            </button>
            <button
              data-testid="regime-caixa-button"
              onClick={() => setRegime('CAIXA')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                regime === 'CAIXA' ? 'bg-emerald-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Caixa
            </button>
          </div>

          {/* Botão de Congelar Snapshot */}
          <button
            data-testid="save-snapshot-button"
            onClick={handleSnapshot}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 rounded-lg text-sm font-medium transition-colors"
            title="Congelar snapshot oficial para auditoria"
          >
            <Archive className="w-4 h-4" />
            Congelar DRE
          </button>

          {/* Botão Nova Despesa */}
          <button
            data-testid="open-expense-modal-button"
            onClick={() => setIsExpenseModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium shadow-sm transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            Lançar Despesa
          </button>
        </div>
      </div>

      {/* Cards de KPIs Principais */}
      {report && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-6">
          {/* 1. Receita Líquida */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Receita Líquida</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <span className="text-2xl font-bold text-white tracking-tight" data-testid="kpi-net-revenue">
                R$ {report.net_revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
              <div className="text-xs text-slate-400 mt-1">
                Bruta: R$ {report.gross_revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* 2. Lucro Bruto */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Lucro Bruto</span>
              <TrendingUp className="w-4 h-4 text-sky-400" />
            </div>
            <div>
              <span className="text-2xl font-bold text-white tracking-tight" data-testid="kpi-gross-profit">
                R$ {report.gross_profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
              <div className="text-xs text-sky-300 font-medium mt-1">
                Margem: {report.gross_margin_percent.toFixed(1)}% (CMV: R$ {report.cmv_amount.toFixed(2)})
              </div>
            </div>
          </div>

          {/* 3. EBITDA */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">EBITDA / LAJIDA</span>
              <BarChart3 className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <span className="text-2xl font-bold text-white tracking-tight" data-testid="kpi-ebitda">
                R$ {report.ebitda_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
              <div className="text-xs text-purple-300 font-medium mt-1">
                Margem EBITDA: {report.ebitda_margin_percent.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* 4. Lucro Líquido Final */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Resultado Líquido</span>
              {report.net_profit >= 0 ? (
                <ArrowUpRight className="w-4 h-4 text-emerald-400" />
              ) : (
                <ArrowDownRight className="w-4 h-4 text-rose-400" />
              )}
            </div>
            <div>
              <span 
                className={`text-2xl font-bold tracking-tight ${report.net_profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                data-testid="kpi-net-profit"
              >
                R$ {report.net_profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
              <div className="text-xs text-slate-400 mt-1">
                Margem Líquida: {report.net_margin_percent.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* 5. Break-Even */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Ponto de Equilíbrio</span>
              <PieChart className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <span className="text-2xl font-bold text-amber-300 tracking-tight" data-testid="kpi-break-even">
                R$ {report.break_even_point.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
              <div className="text-xs text-slate-400 mt-1">
                Margem Contrib.: {report.contribution_margin_percent.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navegação por Abas */}
      <div className="flex border-b border-slate-800 mt-8">
        <button
          data-testid="tab-dre"
          onClick={() => setActiveTab('DRE')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-sm font-semibold transition-colors ${
            activeTab === 'DRE'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Demonstração Contábil (DRE)
        </button>
        <button
          data-testid="tab-expenses"
          onClick={() => setActiveTab('EXPENSES')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-sm font-semibold transition-colors ${
            activeTab === 'EXPENSES'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <PieChart className="w-4 h-4" />
          Centros de Custos & Despesas
        </button>
        <button
          data-testid="tab-branches"
          onClick={() => setActiveTab('BRANCHES')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-sm font-semibold transition-colors ${
            activeTab === 'BRANCHES'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Comparativo de Filiais (Rede)
        </button>
      </div>

      {/* Conteúdo das Abas */}
      <div className="mt-6">
        {loading && (
          <div className="flex items-center justify-center p-12 text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
            Carregando demonstrações contábeis...
          </div>
        )}

        {!loading && report && activeTab === 'DRE' && (
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden shadow-lg">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-800/80 text-slate-300 font-semibold border-b border-slate-700">
                  <th className="py-3 px-6">Estrutura Contábil / Linha DRE</th>
                  <th className="py-3 px-6 text-right">Valor Nominal (R$)</th>
                  <th className="py-3 px-6 text-right">% Receita Líquida</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                {/* 1. Receita Bruta */}
                <tr className="bg-slate-800/20 font-bold text-white">
                  <td className="py-3 px-6">(=) 1. RECEITA OPERACIONAL BRUTA</td>
                  <td className="py-3 px-6 text-right font-mono" data-testid="dre-gross-revenue">
                    R$ {report.gross_revenue.toFixed(2)}
                  </td>
                  <td className="py-3 px-6 text-right text-slate-400">
                    {report.net_revenue > 0 ? ((report.gross_revenue / report.net_revenue) * 100).toFixed(1) : '100.0'}%
                  </td>
                </tr>
                <tr className="text-slate-300 text-xs">
                  <td className="py-2 px-8">↳ Balcão de Medicamentos (Éticos, Genéricos, Similares, OTC)</td>
                  <td className="py-2 px-6 text-right font-mono">R$ {report.revenue_breakdown.medicamentos_balcao.toFixed(2)}</td>
                  <td className="py-2 px-6 text-right text-slate-400">
                    {report.net_revenue > 0 ? ((report.revenue_breakdown.medicamentos_balcao / report.net_revenue) * 100).toFixed(1) : '0.0'}%
                  </td>
                </tr>
                <tr className="text-slate-300 text-xs">
                  <td className="py-2 px-8">↳ Perfumaria, Cosméticos e Higiene Pessoal</td>
                  <td className="py-2 px-6 text-right font-mono">R$ {report.revenue_breakdown.perfumaria_conveniencia.toFixed(2)}</td>
                  <td className="py-2 px-6 text-right text-slate-400">
                    {report.net_revenue > 0 ? ((report.revenue_breakdown.perfumaria_conveniencia / report.net_revenue) * 100).toFixed(1) : '0.0'}%
                  </td>
                </tr>
                <tr className="text-slate-300 text-xs">
                  <td className="py-2 px-8">↳ Manipulação Magistral (Fórmulas RDC 67)</td>
                  <td className="py-2 px-6 text-right font-mono">R$ {report.revenue_breakdown.manipulacao_magistral.toFixed(2)}</td>
                  <td className="py-2 px-6 text-right text-slate-400">
                    {report.net_revenue > 0 ? ((report.revenue_breakdown.manipulacao_magistral / report.net_revenue) * 100).toFixed(1) : '0.0'}%
                  </td>
                </tr>
                <tr className="text-slate-300 text-xs">
                  <td className="py-2 px-8">↳ Consultório Farmacêutico Clínico (Aferições, Aplicações)</td>
                  <td className="py-2 px-6 text-right font-mono">R$ {report.revenue_breakdown.servicos_clinicos.toFixed(2)}</td>
                  <td className="py-2 px-6 text-right text-slate-400">
                    {report.net_revenue > 0 ? ((report.revenue_breakdown.servicos_clinicos / report.net_revenue) * 100).toFixed(1) : '0.0'}%
                  </td>
                </tr>
                <tr className="text-slate-300 text-xs">
                  <td className="py-2 px-8">↳ Tele-Entrega & Taxas de Delivery</td>
                  <td className="py-2 px-6 text-right font-mono">R$ {report.revenue_breakdown.taxas_tele_entrega.toFixed(2)}</td>
                  <td className="py-2 px-6 text-right text-slate-400">
                    {report.net_revenue > 0 ? ((report.revenue_breakdown.taxas_tele_entrega / report.net_revenue) * 100).toFixed(1) : '0.0'}%
                  </td>
                </tr>

                {/* 2. Deduções */}
                <tr className="bg-slate-800/10 text-rose-300 font-semibold">
                  <td className="py-3 px-6">(-) 2. DEDUÇÕES DA RECEITA BRUTA</td>
                  <td className="py-3 px-6 text-right font-mono" data-testid="dre-deductions">
                    (R$ {report.deductions_amount.toFixed(2)})
                  </td>
                  <td className="py-3 px-6 text-right text-rose-400">
                    {report.net_revenue > 0 ? ((report.deductions_amount / report.net_revenue) * 100).toFixed(1) : '0.0'}%
                  </td>
                </tr>
                <tr className="text-slate-400 text-xs">
                  <td className="py-1.5 px-8">↳ Descontos Comerciais e Fidelidade no PDV</td>
                  <td className="py-1.5 px-6 text-right font-mono">(R$ {report.deductions_breakdown.descontos_concedidos.toFixed(2)})</td>
                  <td className="py-1.5 px-6 text-right text-slate-500">-</td>
                </tr>
                <tr className="text-slate-400 text-xs">
                  <td className="py-1.5 px-8">↳ Impostos s/ Vendas (ICMS/PIS/COFINS Estimados)</td>
                  <td className="py-1.5 px-6 text-right font-mono">(R$ {report.deductions_breakdown.impostos_vendas.toFixed(2)})</td>
                  <td className="py-1.5 px-6 text-right text-slate-500">-</td>
                </tr>

                {/* 3. Receita Líquida */}
                <tr className="bg-emerald-950/20 font-bold text-emerald-300 text-base border-t border-b border-emerald-500/30">
                  <td className="py-3 px-6">(=) 3. RECEITA OPERACIONAL LÍQUIDA</td>
                  <td className="py-3 px-6 text-right font-mono" data-testid="dre-net-revenue">
                    R$ {report.net_revenue.toFixed(2)}
                  </td>
                  <td className="py-3 px-6 text-right font-semibold">100.0%</td>
                </tr>

                {/* 4. CMV */}
                <tr className="text-amber-300 font-semibold">
                  <td className="py-3 px-6">(-) 4. CUSTO DAS MERCADORIAS VENDIDAS (CMV)</td>
                  <td className="py-3 px-6 text-right font-mono" data-testid="dre-cmv">
                    (R$ {report.cmv_amount.toFixed(2)})
                  </td>
                  <td className="py-3 px-6 text-right text-amber-400">
                    {report.net_revenue > 0 ? ((report.cmv_amount / report.net_revenue) * 100).toFixed(1) : '0.0'}%
                  </td>
                </tr>

                {/* 5. Lucro Bruto */}
                <tr className="bg-sky-950/20 font-bold text-sky-300">
                  <td className="py-3 px-6">(=) 5. LUCRO BRUTO</td>
                  <td className="py-3 px-6 text-right font-mono" data-testid="dre-gross-profit">
                    R$ {report.gross_profit.toFixed(2)}
                  </td>
                  <td className="py-3 px-6 text-right font-semibold text-sky-400">
                    {report.gross_margin_percent.toFixed(1)}%
                  </td>
                </tr>

                {/* 6. Despesas Operacionais */}
                <tr className="bg-slate-800/10 text-rose-300 font-semibold">
                  <td className="py-3 px-6">(-) 6. DESPESAS OPERACIONAIS POR CENTRO DE CUSTO</td>
                  <td className="py-3 px-6 text-right font-mono" data-testid="dre-operating-expenses">
                    (R$ {report.total_operating_expenses.toFixed(2)})
                  </td>
                  <td className="py-3 px-6 text-right text-rose-400">
                    {report.net_revenue > 0 ? ((report.total_operating_expenses / report.net_revenue) * 100).toFixed(1) : '0.0'}%
                  </td>
                </tr>
                {report.expenses_by_cost_center.map((cc) => (
                  <tr key={cc.cost_center_id} className="text-slate-400 text-xs">
                    <td className="py-1.5 px-8">↳ {cc.name} ({cc.code})</td>
                    <td className="py-1.5 px-6 text-right font-mono">(R$ {cc.amount.toFixed(2)})</td>
                    <td className="py-1.5 px-6 text-right text-slate-500">
                      {report.net_revenue > 0 ? ((cc.amount / report.net_revenue) * 100).toFixed(1) : '0.0'}%
                    </td>
                  </tr>
                ))}
                {report.commissions_amount > 0 && (
                  <tr className="text-slate-400 text-xs">
                    <td className="py-1.5 px-8">↳ Comissões & Metas Comerciais de Balcão</td>
                    <td className="py-1.5 px-6 text-right font-mono">(R$ {report.commissions_amount.toFixed(2)})</td>
                    <td className="py-1.5 px-6 text-right text-slate-500">
                      {report.net_revenue > 0 ? ((report.commissions_amount / report.net_revenue) * 100).toFixed(1) : '0.0'}%
                    </td>
                  </tr>
                )}

                {/* 7. EBITDA */}
                <tr className="bg-purple-950/20 font-bold text-purple-300 text-base border-t border-b border-purple-500/30">
                  <td className="py-3 px-6">(=) 7. EBITDA / LAJIDA OPERACIONAL</td>
                  <td className="py-3 px-6 text-right font-mono" data-testid="dre-ebitda">
                    R$ {report.ebitda_amount.toFixed(2)}
                  </td>
                  <td className="py-3 px-6 text-right font-semibold text-purple-400">
                    {report.ebitda_margin_percent.toFixed(1)}%
                  </td>
                </tr>

                {/* 8. Despesas Financeiras */}
                <tr className="text-slate-400 font-semibold">
                  <td className="py-3 px-6">(-) 8. DESPESAS FINANCEIRAS & TAXAS BANCÁRIAS</td>
                  <td className="py-3 px-6 text-right font-mono" data-testid="dre-financial-expenses">
                    (R$ {report.financial_expenses_amount.toFixed(2)})
                  </td>
                  <td className="py-3 px-6 text-right text-slate-500">
                    {report.net_revenue > 0 ? ((report.financial_expenses_amount / report.net_revenue) * 100).toFixed(1) : '0.0'}%
                  </td>
                </tr>

                {/* 9. Lucro Líquido */}
                <tr className="bg-slate-800 font-extrabold text-white text-base">
                  <td className="py-4 px-6">(=) 9. LUCRO LÍQUIDO DO EXERCÍCIO</td>
                  <td 
                    className={`py-4 px-6 text-right font-mono text-lg ${report.net_profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                    data-testid="dre-net-profit"
                  >
                    R$ {report.net_profit.toFixed(2)}
                  </td>
                  <td className={`py-4 px-6 text-right text-lg ${report.net_profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {report.net_margin_percent.toFixed(1)}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {!loading && activeTab === 'EXPENSES' && (
          <div className="space-y-6">
            {/* Cards de Centros de Custos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {costCenters.map((cc) => {
                const totalInCC = expenses
                  .filter((e) => e.cost_center_id === cc.id)
                  .reduce((acc, curr) => acc + curr.amount, 0);

                return (
                  <div key={cc.id} className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                        {cc.code}
                      </span>
                      <span className="text-xs text-slate-400 uppercase font-mono">{cc.department_type}</span>
                    </div>
                    <h3 className="font-semibold text-white">{cc.name}</h3>
                    <div className="mt-3 text-lg font-bold text-slate-200">
                      R$ {totalInCC.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Tabela de Lançamentos de Despesas */}
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-700/60 flex items-center justify-between">
                <h3 className="font-semibold text-white">Lançamentos de Despesas Operacionais</h3>
                <span className="text-xs text-slate-400">{expenses.length} lançamentos encontrados</span>
              </div>
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-800/80 text-slate-400 text-xs border-b border-slate-700">
                    <th className="py-2.5 px-4">Vencimento</th>
                    <th className="py-2.5 px-4">Descrição</th>
                    <th className="py-2.5 px-4">Centro de Custo</th>
                    <th className="py-2.5 px-4">Tipo</th>
                    <th className="py-2.5 px-4 text-right">Valor</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300 text-xs">
                  {expenses.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        Nenhuma despesa lançada para o período.
                      </td>
                    </tr>
                  ) : (
                    expenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-mono">{exp.due_date}</td>
                        <td className="py-3 px-4 font-medium text-white">{exp.description}</td>
                        <td className="py-3 px-4">{exp.cost_center_name || exp.cost_center_code}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                            {exp.expense_type}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-white">
                          R$ {exp.amount.toFixed(2)}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                              exp.status === 'PAID'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {exp.status === 'PAID' ? 'PAGO' : 'PENDENTE'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {exp.status === 'PENDING' && (
                            <button
                              data-testid={`pay-expense-button-${exp.id}`}
                              onClick={() => handlePayExpense(exp.id)}
                              className="px-2.5 py-1 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 rounded text-xs transition-colors"
                            >
                              Baixar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && activeTab === 'BRANCHES' && (
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-700/60 flex items-center justify-between">
              <h3 className="font-semibold text-white">Ranking de Rentabilidade e Margem EBITDA por Filial</h3>
              <span className="text-xs text-slate-400">Ordenado pelo maior EBITDA gerado no mês</span>
            </div>
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-800/80 text-slate-400 text-xs border-b border-slate-700">
                  <th className="py-3 px-4">Filial / Loja</th>
                  <th className="py-3 px-4 text-right">Rec. Bruta</th>
                  <th className="py-3 px-4 text-right">Rec. Líquida</th>
                  <th className="py-3 px-4 text-right">CMV</th>
                  <th className="py-3 px-4 text-right">Despesas Operacionais</th>
                  <th className="py-3 px-4 text-right">EBITDA</th>
                  <th className="py-3 px-4 text-right">Margem EBITDA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300 text-xs">
                {branchRanking.map((branch, idx) => (
                  <tr key={branch.store_id} className="hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-medium text-white flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-[10px] text-slate-300">
                        {idx + 1}
                      </span>
                      {branch.store_name}
                    </td>
                    <td className="py-3 px-4 text-right font-mono">R$ {branch.gross_revenue.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right font-mono">R$ {branch.net_revenue.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right font-mono">R$ {branch.cmv_amount.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right font-mono text-rose-300">R$ {branch.operating_expenses.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-purple-300">
                      R$ {branch.ebitda.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-purple-400">
                      {branch.ebitda_margin_percent.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Lançamento de Despesa */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-emerald-400" />
              Lançar Despesa Operacional
            </h2>
            <form onSubmit={handleCreateExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Filial / Loja</label>
                <select
                  data-testid="expense-store-select"
                  value={newStoreId}
                  onChange={(e) => setNewStoreId(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none"
                >
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Centro de Custo</label>
                <select
                  data-testid="expense-cost-center-select"
                  value={newCostCenterId}
                  onChange={(e) => setNewCostCenterId(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none"
                >
                  {costCenters.map((cc) => (
                    <option key={cc.id} value={cc.id}>{cc.name} ({cc.code})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Categoria de Despesa</label>
                  <select
                    data-testid="expense-type-select"
                    value={newExpenseType}
                    onChange={(e) => setNewExpenseType(e.target.value as ExpenseType)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none"
                  >
                    <option value="PESSOAL">Pessoal / Folha</option>
                    <option value="ADMINISTRATIVA">Administrativa</option>
                    <option value="VENDAS_LOGISTICA">Vendas & Logística</option>
                    <option value="TRIBUTARIA">Tributária</option>
                    <option value="FINANCEIRA">Financeira (Juros/Taxas)</option>
                    <option value="OPERACIONAL_OUTRAS">Outras Operacionais</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Valor Nominal (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    data-testid="expense-amount-input"
                    value={newAmount || ''}
                    onChange={(e) => setNewAmount(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none font-mono"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Descrição Detalhada</label>
                <input
                  type="text"
                  data-testid="expense-description-input"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none"
                  placeholder="Ex: Aluguel da Farmácia, Energia Elétrica, Taxas TEF..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Data de Vencimento</label>
                  <input
                    type="date"
                    data-testid="expense-due-date-input"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Data de Pagamento (Opcional)</label>
                  <input
                    type="date"
                    data-testid="expense-payment-date-input"
                    value={newPaymentDate}
                    onChange={(e) => setNewPaymentDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  data-testid="expense-submit-button"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Salvar Despesa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
