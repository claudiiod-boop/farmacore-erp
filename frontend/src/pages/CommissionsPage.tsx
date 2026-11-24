import React, { useState, useEffect, useCallback } from 'react';
import {
  Award,
  DollarSign,
  TrendingUp,
  Target,
  Users,
  Percent,
  Calendar,
  Search,
  Plus,
  RefreshCw,
  CheckCircle,
  Clock,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  FileText,
} from 'lucide-react';
import { commissionApi } from '../services/api';
import {
  Seller,
  CommissionRule,
  CommissionCampaign,
  SalesGoal,
  CommissionStatement,
  CommissionKpis,
  PharmaceuticalCategory,
} from '../types/commission';

export const CommissionsPage: React.FC = () => {
  const currentMonthDefault = new Date().toISOString().slice(0, 7);
  const [activeTab, setActiveTab] = useState<'sellers' | 'campaigns' | 'rules'>('sellers');
  const [periodMonth, setPeriodMonth] = useState(currentMonthDefault);
  const [kpis, setKpis] = useState<CommissionKpis | null>(null);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [goals, setGoals] = useState<SalesGoal[]>([]);
  const [campaigns, setCampaigns] = useState<CommissionCampaign[]>([]);
  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Modais
  const [isSellerModalOpen, setIsSellerModalOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);

  // Extrato do Vendedor Modal
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
  const [sellerStatements, setSellerStatements] = useState<CommissionStatement[]>([]);
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);

  // Form Novo Vendedor
  const [sellerName, setSellerName] = useState('');
  const [sellerCpf, setSellerCpf] = useState('');
  const [sellerRole, setSellerRole] = useState<'BALCONISTA' | 'FARMACEUTICO' | 'CAIXA' | 'GERENTE'>('BALCONISTA');

  // Form Meta
  const [goalSellerId, setGoalSellerId] = useState<number | ''>('');
  const [goalTargetAmount, setGoalTargetAmount] = useState<number>(30000);

  // Form Campanha
  const [campName, setCampName] = useState('Campanha Eurofarma Inverno');
  const [campManufacturer, setCampManufacturer] = useState('Eurofarma');
  const [campBonus, setCampBonus] = useState<number>(2.0);
  const [campStart, setCampStart] = useState(`${currentMonthDefault}-01`);
  const [campEnd, setCampEnd] = useState(`${currentMonthDefault}-28`);

  // Form Regra
  const [ruleCategory, setRuleCategory] = useState<PharmaceuticalCategory>('GENERICO');
  const [rulePercentage, setRulePercentage] = useState<number>(6.0);
  const [ruleDescription, setRuleDescription] = useState('');

  // Carregar dados
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [kpiRes, sellerList, goalList, campList, ruleList] = await Promise.all([
        commissionApi.getCommissionKpis(periodMonth),
        commissionApi.listSellers(),
        commissionApi.listGoals(periodMonth),
        commissionApi.listCampaigns(),
        commissionApi.listRules(),
      ]);
      setKpis(kpiRes);
      setSellers(sellerList);
      setGoals(goalList);
      setCampaigns(campList);
      setRules(ruleList);
    } catch (err) {
      console.error('Erro ao carregar dados de comissões:', err);
    } finally {
      setLoading(false);
    }
  }, [periodMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Abrir Extrato do Vendedor
  const handleOpenStatement = async (seller: Seller) => {
    try {
      setSelectedSeller(seller);
      const stmts = await commissionApi.getSellerStatement(seller.id, periodMonth);
      setSellerStatements(stmts);
      setIsStatementModalOpen(true);
    } catch (err: any) {
      alert(`Erro ao buscar extrato: ${err.message}`);
    }
  };

  // Fechar Comissões do Vendedor
  const handleCloseStatement = async (status: 'APPROVED' | 'PAID') => {
    if (!selectedSeller) return;
    try {
      const res = await commissionApi.closeMonthlyCommissions({
        sellerId: selectedSeller.id,
        periodMonth,
        status,
      });
      alert(`Fechamento concluído! ${res.updatedCount} lançamentos marcados como ${status}. Total: R$ ${res.totalAmount.toFixed(2)}`);
      setIsStatementModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(`Erro no fechamento: ${err.message}`);
    }
  };

  // Submit Novo Vendedor
  const handleCreateSeller = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await commissionApi.createSeller({
        store_id: 1,
        name: sellerName,
        cpf: sellerCpf,
        role: sellerRole,
      });
      setSellerName('');
      setSellerCpf('');
      setIsSellerModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(`Erro ao criar vendedor: ${err.message}`);
    }
  };

  // Submit Nova Meta
  const handleSetGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalSellerId) return;
    try {
      await commissionApi.setSalesGoal({
        seller_id: Number(goalSellerId),
        store_id: 1,
        period_month: periodMonth,
        target_amount: Number(goalTargetAmount),
      });
      setIsGoalModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(`Erro ao definir meta: ${err.message}`);
    }
  };

  // Submit Nova Campanha
  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await commissionApi.createCampaign({
        name: campName,
        manufacturer: campManufacturer,
        bonus_per_unit: Number(campBonus),
        start_date: campStart,
        end_date: campEnd,
      });
      setIsCampaignModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(`Erro ao criar campanha: ${err.message}`);
    }
  };

  // Submit Regra
  const handleUpdateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await commissionApi.updateRule({
        categoryType: ruleCategory,
        percentage: Number(rulePercentage),
        description: ruleDescription,
      });
      setIsRuleModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(`Erro ao atualizar regra: ${err.message}`);
    }
  };

  const filteredSellers = sellers.filter(
    (s) => s.name.toLowerCase().includes(searchTerm.toLowerCase()) || (s.cpf && s.cpf.includes(searchTerm))
  );

  return (
    <div className="flex-1 bg-slate-50 min-h-screen p-6 text-slate-800">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-md">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Gestão de Comissões, Metas & Campanhas
              </h1>
              <p className="text-sm text-slate-500">
                Remuneração Comercial Farmacêutica, Aceleradores de Metas & Prêmios por Caixa
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 border border-slate-300 rounded-lg shadow-sm">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="month"
              value={periodMonth}
              onChange={(e) => setPeriodMonth(e.target.value)}
              className="text-sm font-semibold text-slate-700 focus:outline-none"
            />
          </div>

          <button
            onClick={() => setIsSellerModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-medium rounded-lg shadow-sm text-xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Novo Vendedor</span>
          </button>
          <button
            onClick={() => setIsGoalModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm text-xs transition"
          >
            <Target className="w-3.5 h-3.5" />
            <span>Definir Meta</span>
          </button>
          <button
            onClick={() => setIsCampaignModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg shadow-sm text-xs transition"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Nova Campanha</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-sm font-medium">Comissões no Mês</span>
            <DollarSign className="w-5 h-5 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            R$ {kpis?.totalCommissionsCurrentMonth.toFixed(2) ?? '0.00'}
          </div>
          <div className="text-xs text-slate-500 mt-1">Apuração do período</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-sm font-medium">Vendas Realizadas</span>
            <TrendingUp className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            R$ {kpis?.totalSalesAchievedCurrentMonth.toFixed(2) ?? '0.00'}
          </div>
          <div className="text-xs text-emerald-600 mt-1">Total de balcão</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-sm font-medium">Meta Global Loja</span>
            <Target className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {kpis?.globalGoalProgressPercent.toFixed(1) ?? '0.0'}%
          </div>
          <div className="text-xs text-indigo-600 mt-1">Atingimento consolidado</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-sm font-medium">Top Vendedor(a)</span>
            <Award className="w-5 h-5 text-rose-500" />
          </div>
          <div className="text-lg font-bold text-slate-900 truncate">
            {kpis?.topSellerName || '—'}
          </div>
          <div className="text-xs text-rose-600 mt-1">
            R$ {kpis?.topSellerCommission.toFixed(2) ?? '0.00'} comissão
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-sm font-medium">Campanhas Ativas</span>
            <Sparkles className="w-5 h-5 text-teal-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {kpis?.activeCampaignsCount ?? 0}
          </div>
          <div className="text-xs text-teal-600 mt-1">Bônus por caixa</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 mb-6">
        <button
          onClick={() => setActiveTab('sellers')}
          className={`flex items-center gap-2 px-4 py-3 font-semibold text-sm border-b-2 transition ${
            activeTab === 'sellers'
              ? 'border-amber-500 text-amber-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Ranking de Vendedores & Metas</span>
        </button>

        <button
          onClick={() => setActiveTab('campaigns')}
          className={`flex items-center gap-2 px-4 py-3 font-semibold text-sm border-b-2 transition ${
            activeTab === 'campaigns'
              ? 'border-amber-500 text-amber-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Campanhas por Caixa & Fabricante</span>
        </button>

        <button
          onClick={() => setActiveTab('rules')}
          className={`flex items-center gap-2 px-4 py-3 font-semibold text-sm border-b-2 transition ${
            activeTab === 'rules'
              ? 'border-amber-500 text-amber-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Percent className="w-4 h-4" />
          <span>Regras por Categoria Farmacêutica</span>
        </button>
      </div>

      {/* TAB 1: VENDEDORES & METAS */}
      {activeTab === 'sellers' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Buscar vendedor por nome ou CPF..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div className="text-xs text-slate-500 font-medium">
              Aceleradores: &ge;80% da meta (+10%) | &ge;100% da meta (+25%)
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Vendedor / Balconista</th>
                  <th className="py-3 px-4">Cargo / Função</th>
                  <th className="py-3 px-4">Vendas no Mês</th>
                  <th className="py-3 px-4">Meta Mensal</th>
                  <th className="py-3 px-4">Progresso & Acelerador</th>
                  <th className="py-3 px-4">Comissão Acumulada</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSellers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400">
                      Nenhum vendedor encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredSellers.map((seller) => {
                    const sellerGoal = goals.find((g) => g.seller_id === seller.id);
                    const target = sellerGoal?.target_amount || 0;
                    const achieved = seller.current_month_sales || sellerGoal?.achieved_amount || 0;
                    const progress = target > 0 ? Math.min(100, (achieved / target) * 100) : 0;
                    const accelerator = sellerGoal?.accelerator_multiplier || (achieved >= target && target > 0 ? 1.25 : 1.0);

                    return (
                      <tr key={seller.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{seller.name}</div>
                          <div className="text-xs text-slate-500">{seller.cpf || 'Sem CPF'}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-semibold">
                            {seller.role}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          R$ {achieved.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-600">
                          {target > 0 ? `R$ ${target.toFixed(2)}` : 'Não definida'}
                        </td>
                        <td className="py-3 px-4 w-48">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-bold text-slate-700">{progress.toFixed(0)}%</span>
                            <span className={`font-mono text-xs font-bold ${
                              accelerator > 1.0 ? 'text-emerald-600' : 'text-slate-400'
                            }`}>
                              {accelerator.toFixed(2)}x
                            </span>
                          </div>
                          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                progress >= 100
                                  ? 'bg-emerald-500'
                                  : progress >= 80
                                  ? 'bg-amber-500'
                                  : 'bg-indigo-500'
                              }`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </td>
                        <td className="py-3 px-4 font-bold text-amber-600">
                          R$ {(seller.current_month_commission || 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleOpenStatement(seller)}
                            className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-xs font-semibold transition"
                          >
                            Extrato
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: CAMPANHAS POR CAIXA & FABRICANTE */}
      {activeTab === 'campaigns' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Campanhas Promocionais de Laboratórios</h2>
              <p className="text-xs text-slate-500">Premiações em dinheiro por caixa vendida pagas diretamente aos balconistas.</p>
            </div>
            <button
              onClick={() => setIsCampaignModalOpen(true)}
              className="flex items-center gap-2 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Campanha</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Nome da Campanha</th>
                  <th className="py-3 px-4">Fabricante / Laboratório</th>
                  <th className="py-3 px-4">Produto Alvo</th>
                  <th className="py-3 px-4">Bônus por Unidade</th>
                  <th className="py-3 px-4">Período de Vigência</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {campaigns.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-400">
                      Nenhuma campanha cadastrada.
                    </td>
                  </tr>
                ) : (
                  campaigns.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-bold text-slate-900">{c.name}</td>
                      <td className="py-3 px-4 font-semibold text-slate-700">{c.manufacturer || 'Todos'}</td>
                      <td className="py-3 px-4 text-xs text-slate-500">{c.product_name || 'Toda a linha do fabricante'}</td>
                      <td className="py-3 px-4 font-bold text-emerald-600">
                        + R$ {c.bonus_per_unit.toFixed(2)} / cx
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-600">
                        {c.start_date} até {c.end_date}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          c.is_active === 1 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {c.is_active === 1 ? 'Ativa' : 'Encerrada'}
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

      {/* TAB 3: REGRAS POR CATEGORIA FARMACÊUTICA */}
      {activeTab === 'rules' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden p-6">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900">Regras de Comissionamento por Classe Farmacêutica</h2>
            <p className="text-xs text-slate-500">
              Percentuais incidentes sobre o valor faturado no PDV, direcionando a rentabilidade da farmácia.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Classe Farmacêutica</th>
                  <th className="py-3 px-4">Comissão Base (%)</th>
                  <th className="py-3 px-4">Descrição Estratégica</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rules.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      <span className="px-2.5 py-1 bg-amber-50 text-amber-900 border border-amber-200 rounded-lg text-xs font-bold">
                        {r.category_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-lg text-amber-600">
                      {r.percentage.toFixed(1)}%
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500">{r.description || '—'}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => {
                          setRuleCategory(r.category_type);
                          setRulePercentage(r.percentage);
                          setRuleDescription(r.description || '');
                          setIsRuleModalOpen(true);
                        }}
                        className="px-3 py-1.5 border border-slate-300 hover:bg-slate-100 rounded text-xs font-medium"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL EXTRATO DO VENDEDOR */}
      {isStatementModalOpen && selectedSeller && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Extrato de Comissões: {selectedSeller.name}</h3>
                <p className="text-xs text-slate-500">Período de Apuração: {periodMonth}</p>
              </div>
              <button
                onClick={() => setIsStatementModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="overflow-x-auto mb-6">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Produto</th>
                    <th className="py-2.5 px-3">Classe</th>
                    <th className="py-2.5 px-3">Venda Total</th>
                    <th className="py-2.5 px-3">% Base</th>
                    <th className="py-2.5 px-3">Comissão Base</th>
                    <th className="py-2.5 px-3">Bônus Caixa</th>
                    <th className="py-2.5 px-3">Acelerador</th>
                    <th className="py-2.5 px-3">Comissão Final</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sellerStatements.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-6 text-slate-400">
                        Nenhum item comissionado no período.
                      </td>
                    </tr>
                  ) : (
                    sellerStatements.map((stmt) => (
                      <tr key={stmt.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-medium text-slate-900">{stmt.product_name}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-600">{stmt.category_type}</td>
                        <td className="py-2.5 px-3">R$ {stmt.item_total.toFixed(2)}</td>
                        <td className="py-2.5 px-3">{stmt.base_commission_percent.toFixed(1)}%</td>
                        <td className="py-2.5 px-3">R$ {stmt.base_commission_amount.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-emerald-600 font-medium">
                          {stmt.campaign_bonus_amount > 0 ? `+ R$ ${stmt.campaign_bonus_amount.toFixed(2)}` : '—'}
                        </td>
                        <td className="py-2.5 px-3 font-mono">{stmt.accelerator_multiplier.toFixed(2)}x</td>
                        <td className="py-2.5 px-3 font-bold text-amber-700">
                          R$ {stmt.final_commission_amount.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            stmt.status === 'PAID'
                              ? 'bg-emerald-100 text-emerald-800'
                              : stmt.status === 'APPROVED'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {stmt.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              <div className="text-sm font-bold text-slate-900">
                Total a Pagar:{' '}
                <span className="text-amber-600 text-lg">
                  R$ {sellerStatements.reduce((acc, curr) => acc + curr.final_commission_amount, 0).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCloseStatement('APPROVED')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm"
                >
                  Aprovar Fechamento
                </button>
                <button
                  onClick={() => handleCloseStatement('PAID')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm"
                >
                  Confirmar Pagamento (Folha)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOVO VENDEDOR */}
      {isSellerModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">Cadastrar Vendedor / Atendente</h3>
              <button onClick={() => setIsSellerModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleCreateSeller} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={sellerName}
                  onChange={(e) => setSellerName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">CPF</label>
                <input
                  type="text"
                  placeholder="000.000.000-00"
                  value={sellerCpf}
                  onChange={(e) => setSellerCpf(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Função / Cargo</label>
                <select
                  value={sellerRole}
                  onChange={(e) => setSellerRole(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="BALCONISTA">Balconista</option>
                  <option value="FARMACEUTICO">Farmacêutico(a)</option>
                  <option value="CAIXA">Operador de Caixa</option>
                  <option value="GERENTE">Gerente de Loja</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsSellerModalOpen(false)} className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-xs shadow-sm">Salvar Vendedor</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DEFINIR META */}
      {isGoalModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">Definir Meta Mensal de Venda</h3>
              <button onClick={() => setIsGoalModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleSetGoal} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Vendedor</label>
                <select
                  required
                  value={goalSellerId}
                  onChange={(e) => setGoalSellerId(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="">Selecione o vendedor...</option>
                  {sellers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Meta de Faturamento (R$)</label>
                <input
                  type="number"
                  min={100}
                  required
                  value={goalTargetAmount}
                  onChange={(e) => setGoalTargetAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsGoalModalOpen(false)} className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs shadow-sm">Salvar Meta</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL NOVA CAMPANHA */}
      {isCampaignModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">Nova Campanha por Caixa</h3>
              <button onClick={() => setIsCampaignModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleCreateCampaign} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nome da Campanha</label>
                <input
                  type="text"
                  required
                  value={campName}
                  onChange={(e) => setCampName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Laboratório / Fabricante</label>
                <input
                  type="text"
                  required
                  value={campManufacturer}
                  onChange={(e) => setCampManufacturer(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Bônus por Caixa Vendida (R$)</label>
                <input
                  type="number"
                  step="0.5"
                  min={0.1}
                  required
                  value={campBonus}
                  onChange={(e) => setCampBonus(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Data Início</label>
                  <input
                    type="date"
                    required
                    value={campStart}
                    onChange={(e) => setCampStart(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Data Fim</label>
                  <input
                    type="date"
                    required
                    value={campEnd}
                    onChange={(e) => setCampEnd(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsCampaignModalOpen(false)} className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs shadow-sm">Cadastrar Campanha</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDITAR REGRA */}
      {isRuleModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">Editar Regra: {ruleCategory}</h3>
              <button onClick={() => setIsRuleModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleUpdateRule} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Percentual de Comissão (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  max={100}
                  required
                  value={rulePercentage}
                  onChange={(e) => setRulePercentage(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Descrição</label>
                <textarea
                  rows={2}
                  value={ruleDescription}
                  onChange={(e) => setRuleDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsRuleModalOpen(false)} className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-xs shadow-sm">Salvar Alterações</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommissionsPage;
