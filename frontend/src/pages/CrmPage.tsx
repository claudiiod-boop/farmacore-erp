import { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Tag,
  HeartHandshake,
  Search,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  PhoneCall,
  Printer,
  Receipt,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ShoppingBag,
  Percent,
} from 'lucide-react';
import { api } from '../services/api';
import { formatBrl } from '../components/ProductSearch';
import CashbackRedeemModal from '../components/crm/CashbackRedeemModal';
import PromotionFormModal from '../components/crm/PromotionFormModal';
import RefillContactModal from '../components/crm/RefillContactModal';
import type {
  LoyaltyProgram,
  LoyaltyWallet,
  LoyaltyTransaction,
  PromotionWithProducts,
  PromotionType,
  UpcomingRefillItem,
  CartEvaluationResult,
} from '../types/crm';
import type { Customer } from '../types/credit';

export default function CrmPage() {
  const [activeTab, setActiveTab] = useState<'LOYALTY' | 'PROMOTIONS' | 'TREATMENTS'>('LOYALTY');

  // Feedback states
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  // =========================================================================
  // ABA 1: CLUBE & CARTEIRAS DE CASHBACK
  // =========================================================================
  const [loyaltyProgram, setLoyaltyProgram] = useState<LoyaltyProgram | null>(null);
  const [searchCpf, setSearchCpf] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [wallet, setWallet] = useState<LoyaltyWallet | null>(null);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [thermalStatement, setThermalStatement] = useState<string | null>(null);
  const [isSearchingWallet, setIsSearchingWallet] = useState(false);
  const [isRedeemModalOpen, setIsRedeemModalOpen] = useState(false);
  const [isStatementOpen, setIsStatementOpen] = useState(false);

  // =========================================================================
  // ABA 2: CAMPANHAS & PROMOÇÕES
  // =========================================================================
  const [promotions, setPromotions] = useState<PromotionWithProducts[]>([]);
  const [isLoadingPromotions, setIsLoadingPromotions] = useState(false);
  const [promoTypeFilter, setPromoTypeFilter] = useState<string>('ALL');
  const [promoActiveOnly, setPromoActiveOnly] = useState(false);
  const [promoSearchQuery, setPromoSearchQuery] = useState('');
  const [promotionToEdit, setPromotionToEdit] = useState<PromotionWithProducts | null>(null);
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);

  // Simulador de Carrinho
  const [simCartProduct1Qty, setSimCartProduct1Qty] = useState(3);
  const [simCartProduct1Price, setSimCartProduct1Price] = useState(25.0);
  const [simCartResult, setSimCartResult] = useState<CartEvaluationResult | null>(null);
  const [isEvaluatingCart, setIsEvaluatingCart] = useState(false);

  // =========================================================================
  // ABA 3: ADESÃO A TRATAMENTO & RECOMPRA PREDITIVA
  // =========================================================================
  const [refills, setRefills] = useState<UpcomingRefillItem[]>([]);
  const [isLoadingRefills, setIsLoadingRefills] = useState(false);
  const [refillDaysAhead, setRefillDaysAhead] = useState<number>(7);
  const [selectedRefillForContact, setSelectedRefillForContact] = useState<UpcomingRefillItem | null>(null);
  const [isRefillContactModalOpen, setIsRefillContactModalOpen] = useState(false);

  // Load Loyalty Program Config
  const loadLoyaltyProgram = useCallback(async () => {
    try {
      const prog = await api.crm.getLoyaltyProgram();
      setLoyaltyProgram(prog);
    } catch {
      // ignore
    }
  }, []);

  // Load Promotions
  const loadPromotions = useCallback(async () => {
    setIsLoadingPromotions(true);
    try {
      const list = await api.crm.getPromotions({
        activeOnly: promoActiveOnly,
        type: promoTypeFilter !== 'ALL' ? (promoTypeFilter as PromotionType) : undefined,
        search: promoSearchQuery.trim() || undefined,
      });
      setPromotions(list);
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao listar promoções.');
    } finally {
      setIsLoadingPromotions(false);
    }
  }, [promoActiveOnly, promoTypeFilter, promoSearchQuery]);

  // Load Refills
  const loadRefills = useCallback(async () => {
    setIsLoadingRefills(true);
    try {
      const list = await api.crm.getUpcomingRefills({ daysAhead: refillDaysAhead });
      setRefills(list);
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao buscar alertas de tratamento.');
    } finally {
      setIsLoadingRefills(false);
    }
  }, [refillDaysAhead]);

  useEffect(() => {
    loadLoyaltyProgram();
  }, [loadLoyaltyProgram]);

  useEffect(() => {
    if (activeTab === 'PROMOTIONS') {
      loadPromotions();
    } else if (activeTab === 'TREATMENTS') {
      loadRefills();
    }
  }, [activeTab, loadPromotions, loadRefills]);

  // Busca de Carteira por CPF
  const handleSearchWallet = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanCpf = searchCpf.replace(/\D/g, '');
    if (!cleanCpf) {
      setErrorMessage('Informe um CPF válido para consulta no Clube.');
      return;
    }

    setIsSearchingWallet(true);
    setErrorMessage(null);
    setNoticeMessage(null);
    setThermalStatement(null);

    try {
      const cust = await api.credit.getCustomerByCpf(cleanCpf);
      setSelectedCustomer(cust);
      const w = await api.crm.getWallet(cust.id);
      setWallet(w);
      const stmt = await api.crm.getWalletStatement(cust.id);
      setTransactions(stmt.transactions || []);
      setThermalStatement(stmt.textReceipt || null);
    } catch (err: any) {
      setSelectedCustomer(null);
      setWallet(null);
      setTransactions([]);
      setThermalStatement(null);
      setErrorMessage(err.message || 'Cliente não localizado com o CPF informado.');
    } finally {
      setIsSearchingWallet(false);
    }
  };

  // Excluir promoção
  const handleDeletePromotion = async (id: number) => {
    if (!window.confirm(`Deseja realmente excluir a promoção #${id}?`)) return;
    try {
      await api.crm.deletePromotion(id);
      setNoticeMessage(`Promoção #${id} excluída com sucesso.`);
      loadPromotions();
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao excluir promoção.');
    }
  };

  // Ativar / Desativar promoção
  const handleTogglePromotion = async (promo: PromotionWithProducts) => {
    const nextActive = !promo.isActive && !(promo as any).is_active;
    try {
      await api.crm.updatePromotion(promo.id, { isActive: nextActive });
      setNoticeMessage(`Promoção #${promo.id} ${nextActive ? 'ativada' : 'pausada'} com sucesso.`);
      loadPromotions();
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao alterar status da promoção.');
    }
  };

  // Testar avaliação no Simulador
  const handleRunSimulator = async () => {
    setIsEvaluatingCart(true);
    try {
      const res = await api.crm.evaluateCart({
        items: [
          {
            productId: 1,
            quantity: Number(simCartProduct1Qty),
            unitPrice: Number(simCartProduct1Price),
          },
        ],
        customerId: selectedCustomer?.id,
      });
      setSimCartResult(res);
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha na simulação do carrinho.');
    } finally {
      setIsEvaluatingCart(false);
    }
  };

  const currentBal = wallet?.currentBalance ?? wallet?.current_balance ?? 0;

  return (
    <div className="flex-1 flex flex-col bg-slate-900 text-slate-100 overflow-hidden">
      {/* Top Header */}
      <header className="bg-slate-950 border-b border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-indigo-950/80 border border-indigo-600/50 text-indigo-400 rounded-xl shadow-inner">
            <Sparkles className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-black text-white tracking-wide">
                Posto [F10] CRM, Fidelidade & Campanhas
              </h1>
              <span className="bg-emerald-950 text-emerald-400 border border-emerald-700/50 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                Módulo FarmaCore CRM
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Clube de Vantagens, Carteiras de Cashback, Motor Promocional e Adesão a Tratamento Contínuo
            </p>
          </div>
        </div>

        {/* Informação do Programa */}
        {loyaltyProgram && (
          <div className="hidden lg:flex items-center space-x-4 bg-slate-900 border border-slate-800 px-3.5 py-1.5 rounded-lg text-xs">
            <div>
              <span className="text-slate-500 text-[10px] uppercase font-bold block">Cashback Padrão</span>
              <span className="font-mono font-bold text-emerald-400">
                {loyaltyProgram.cashbackPercent ?? loyaltyProgram.cashback_percent ?? 5}%
              </span>
            </div>
            <div className="border-l border-slate-800 pl-4">
              <span className="text-slate-500 text-[10px] uppercase font-bold block">Validade</span>
              <span className="font-mono font-bold text-slate-200">
                {loyaltyProgram.validityDays ?? loyaltyProgram.validity_days ?? 90} dias
              </span>
            </div>
            <div className="border-l border-slate-800 pl-4">
              <span className="text-slate-500 text-[10px] uppercase font-bold block">Teto Resgate</span>
              <span className="font-mono font-bold text-slate-200">
                {loyaltyProgram.maxRedeemPercent ?? loyaltyProgram.max_redeem_percent ?? 50}% da venda
              </span>
            </div>
          </div>
        )}
      </header>

      {/* Navegação por Abas */}
      <nav
        className="bg-slate-950/60 border-b border-slate-800 px-6 flex space-x-2 text-xs select-none"
        aria-label="Abas do Posto CRM"
      >
        <button
          type="button"
          data-testid="tab-loyalty"
          onClick={() => setActiveTab('LOYALTY')}
          className={`flex items-center space-x-2 px-4 py-3 font-bold border-b-2 transition cursor-pointer ${
            activeTab === 'LOYALTY'
              ? 'border-emerald-500 text-emerald-400 bg-slate-900/40'
              : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-900/20'
          }`}
        >
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>Clube & Carteiras de Cashback</span>
        </button>

        <button
          type="button"
          data-testid="tab-promotions"
          onClick={() => setActiveTab('PROMOTIONS')}
          className={`flex items-center space-x-2 px-4 py-3 font-bold border-b-2 transition cursor-pointer ${
            activeTab === 'PROMOTIONS'
              ? 'border-indigo-500 text-indigo-400 bg-slate-900/40'
              : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-900/20'
          }`}
        >
          <Tag className="w-4 h-4 text-indigo-400" />
          <span>Campanhas & Promoções Combinadas</span>
        </button>

        <button
          type="button"
          data-testid="tab-treatments"
          onClick={() => setActiveTab('TREATMENTS')}
          className={`flex items-center space-x-2 px-4 py-3 font-bold border-b-2 transition cursor-pointer ${
            activeTab === 'TREATMENTS'
              ? 'border-rose-500 text-rose-400 bg-slate-900/40'
              : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-900/20'
          }`}
        >
          <HeartHandshake className="w-4 h-4 text-rose-400" />
          <span>Adesão a Tratamento & Recompra Preditiva</span>
        </button>
      </nav>

      {/* Banners de Notificação e Erro */}
      <div className="px-6 pt-3 space-y-2">
        {errorMessage && (
          <div
            data-testid="crm-global-error"
            className="p-3 bg-rose-950/80 border border-rose-700/60 rounded-lg flex items-center justify-between text-xs text-rose-200"
          >
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-rose-400 hover:text-white font-bold ml-2"
            >
              x
            </button>
          </div>
        )}

        {noticeMessage && (
          <div
            data-testid="crm-global-notice"
            className="p-3 bg-emerald-950/80 border border-emerald-700/60 rounded-lg flex items-center justify-between text-xs text-emerald-200"
          >
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{noticeMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setNoticeMessage(null)}
              className="text-emerald-400 hover:text-white font-bold ml-2"
            >
              x
            </button>
          </div>
        )}
      </div>

      {/* Conteúdo Principal Rolável */}
      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* ================================================================= */}
        {/* ABA 1: CLUBE & CARTEIRAS DE CASHBACK                              */}
        {/* ================================================================= */}
        {activeTab === 'LOYALTY' && (
          <div className="space-y-6">
            {/* Bloco de Busca por CPF */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Search className="w-4 h-4 text-emerald-400" />
                    <span>Consulta de Carteira & Saldo do Cliente</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Digite o CPF do cliente para visualizar saldo acumulado, extrato e autorizar resgate
                  </p>
                </div>

                <button
                  type="button"
                  data-testid="open-redeem-modal-btn"
                  onClick={() => setIsRedeemModalOpen(true)}
                  className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Resgate Rápido de Cashback</span>
                </button>
              </div>

              <form onSubmit={handleSearchWallet} className="flex items-center space-x-3 max-w-xl">
                <input
                  type="text"
                  data-testid="loyalty-search-cpf"
                  value={searchCpf}
                  onChange={(e) => setSearchCpf(e.target.value)}
                  placeholder="Informe o CPF do cliente (somente números)..."
                  className="flex-1 px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-white outline-hidden focus:border-emerald-500"
                />
                <button
                  type="submit"
                  data-testid="loyalty-search-btn"
                  disabled={isSearchingWallet}
                  className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSearchingWallet ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  <span>Consultar Saldo</span>
                </button>
              </form>
            </div>

            {/* Painel de Resultados do Cliente */}
            {selectedCustomer && wallet && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Card de Resumo da Carteira */}
                <div
                  data-testid="crm-customer-summary"
                  className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-slate-400 text-xs block">Titular do Clube</span>
                      <h3 className="text-base font-bold text-white">{selectedCustomer.name}</h3>
                      <p className="text-xs font-mono text-slate-400">CPF: {selectedCustomer.cpf}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-700 font-mono">
                      ID #{selectedCustomer.id}
                    </span>
                  </div>

                  <div className="p-4 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-center">
                    <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider block">
                      Saldo Disponível para Resgate
                    </span>
                    <span
                      data-testid="wallet-current-balance"
                      className="text-3xl font-black text-emerald-400 font-mono block mt-1"
                    >
                      {formatBrl(currentBal)}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 block uppercase font-semibold">Total Ganho</span>
                      <span className="font-bold text-slate-200 font-mono">
                        {formatBrl(wallet.totalEarned ?? wallet.total_earned ?? 0)}
                      </span>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 block uppercase font-semibold">Resgatado</span>
                      <span className="font-bold text-slate-200 font-mono">
                        {formatBrl(wallet.totalRedeemed ?? wallet.total_redeemed ?? 0)}
                      </span>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 block uppercase font-semibold">Expirado</span>
                      <span className="font-bold text-rose-400 font-mono">
                        {formatBrl(wallet.totalExpired ?? wallet.total_expired ?? 0)}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-col gap-2">
                    <button
                      type="button"
                      data-testid="open-redeem-direct-btn"
                      onClick={() => setIsRedeemModalOpen(true)}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer shadow-sm"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Resgatar Cashback Deste Cliente</span>
                    </button>
                    <button
                      type="button"
                      data-testid="open-statement-modal-btn"
                      onClick={() => setIsStatementOpen((prev) => !prev)}
                      className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      <span>{isStatementOpen ? 'Ocultar Extrato Térmico' : 'Ver Extrato Térmico Completo'}</span>
                    </button>
                  </div>
                </div>

                {/* Tabela de Histórico de Transações */}
                <div className="lg:col-span-2 bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-emerald-400" />
                      <span>Histórico Recente de Lançamentos ({transactions.length})</span>
                    </h3>
                  </div>

                  {transactions.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-lg">
                      Nenhuma transação de cashback registrada para este cliente ainda.
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-80 overflow-y-auto">
                      <table className="w-full text-xs text-left" data-testid="loyalty-transactions-table">
                        <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] font-bold sticky top-0">
                          <tr>
                            <th className="py-2 px-3">Data</th>
                            <th className="py-2 px-3">Tipo</th>
                            <th className="py-2 px-3 text-right">Valor</th>
                            <th className="py-2 px-3 text-right">Saldo Pós</th>
                            <th className="py-2 px-3">Venda #</th>
                            <th className="py-2 px-3">Observações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 font-mono">
                          {transactions.map((tx) => (
                            <tr key={tx.id} className="hover:bg-slate-900/50">
                              <td className="py-2 px-3 text-slate-400">
                                {tx.createdAt?.slice(0, 19).replace('T', ' ') || '-'}
                              </td>
                              <td className="py-2 px-3">
                                {tx.type === 'EARN' ? (
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold">
                                    + CRÉDITO
                                  </span>
                                ) : tx.type === 'REDEEM' ? (
                                  <span className="px-1.5 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800 text-[10px] font-bold">
                                    - RESGATE
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800 text-[10px] font-bold">
                                    EXPIRADO
                                  </span>
                                )}
                              </td>
                              <td
                                className={`py-2 px-3 text-right font-bold ${
                                  tx.type === 'EARN' ? 'text-emerald-400' : 'text-slate-300'
                                }`}
                              >
                                {tx.type === 'EARN' ? '+' : '-'} {formatBrl(tx.amount)}
                              </td>
                              <td className="py-2 px-3 text-right text-slate-300">
                                {formatBrl(tx.balanceAfter ?? tx.balance_after ?? 0)}
                              </td>
                              <td className="py-2 px-3 text-slate-400">
                                {tx.saleId ?? tx.sale_id ? `#${tx.saleId ?? tx.sale_id}` : '-'}
                              </td>
                              <td className="py-2 px-3 text-slate-400 font-sans truncate max-w-xs">
                                {tx.notes || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Filipeta Térmica Inline */}
                  {isStatementOpen && thermalStatement && (
                    <div className="pt-3 border-t border-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span className="font-bold text-emerald-400">Extrato Térmico ESC/POS 48 Colunas:</span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(thermalStatement);
                            setNoticeMessage('Extrato térmico copiado com sucesso.');
                          }}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-bold text-[11px]"
                        >
                          Copiar Extrato
                        </button>
                      </div>
                      <pre
                        data-testid="crm-thermal-statement-preview"
                        className="p-3 bg-slate-900 border border-slate-800 rounded font-mono text-[11px] text-emerald-300 whitespace-pre-wrap max-h-52 overflow-y-auto"
                      >
                        {thermalStatement}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* ABA 2: CAMPANHAS & PROMOÇÕES COMBINADAS                           */}
        {/* ================================================================= */}
        {activeTab === 'PROMOTIONS' && (
          <div className="space-y-6">
            {/* Barra de Filtros e Ação "Nova Campanha" */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-3 flex-wrap gap-y-2">
                <input
                  type="text"
                  placeholder="Filtrar por nome ou categoria..."
                  value={promoSearchQuery}
                  onChange={(e) => setPromoSearchQuery(e.target.value)}
                  className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white outline-hidden focus:border-indigo-500 w-64"
                />

                <select
                  data-testid="promotion-type-filter"
                  value={promoTypeFilter}
                  onChange={(e) => setPromoTypeFilter(e.target.value)}
                  className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white outline-hidden focus:border-indigo-500"
                >
                  <option value="ALL">Todos os Tipos</option>
                  <option value="TAKE_MORE_PAY_LESS">Leve Mais Pague Menos</option>
                  <option value="PROGRESSIVE_DISCOUNT">Desconto Progressivo</option>
                  <option value="COMBO_CROSS_SELL">Combo / Venda Casada</option>
                  <option value="CLUB_SPECIAL_PRICE">Preço Clube</option>
                  <option value="BIRTHDAY_DISCOUNT">Aniversariante</option>
                </select>

                <label className="flex items-center space-x-1.5 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={promoActiveOnly}
                    onChange={(e) => setPromoActiveOnly(e.target.checked)}
                    className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Somente Ativas</span>
                </label>

                <button
                  type="button"
                  onClick={loadPromotions}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                  title="Recarregar promoções"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                data-testid="new-promotion-btn"
                onClick={() => {
                  setPromotionToEdit(null);
                  setIsPromoModalOpen(true);
                }}
                className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Nova Campanha Promocional</span>
              </button>
            </div>

            {/* Grid de Promoções */}
            {isLoadingPromotions ? (
              <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                <span className="text-xs">Carregando campanhas cadastradas...</span>
              </div>
            ) : promotions.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                Nenhuma promoção encontrada com os filtros selecionados. Clique em "Nova Campanha Promocional" para cadastrar.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="promotions-grid">
                {promotions.map((promo) => {
                  const isActive =
                    promo.isActive !== undefined ? promo.isActive : Boolean((promo as any).is_active);
                  return (
                    <div
                      key={promo.id}
                      className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3 hover:border-slate-700 transition shadow-sm"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-950 text-indigo-400 border border-indigo-800">
                            {promo.type === 'TAKE_MORE_PAY_LESS'
                              ? 'Leve + Pague -'
                              : promo.type === 'PROGRESSIVE_DISCOUNT'
                                ? 'Desconto Progressivo'
                                : promo.type === 'COMBO_CROSS_SELL'
                                  ? 'Combo Cross-Sell'
                                  : promo.type === 'CLUB_SPECIAL_PRICE'
                                    ? 'Preço Clube'
                                    : 'Aniversariante'}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isActive
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {isActive ? 'ATIVA' : 'PAUSADA'}
                          </span>
                        </div>

                        <h3 className="text-sm font-bold text-white mt-2">{promo.name}</h3>
                        {promo.description && (
                          <p className="text-xs text-slate-400 mt-1 line-clamp-2">{promo.description}</p>
                        )}
                      </div>

                      <div className="space-y-1.5 pt-2 border-t border-slate-900 text-xs text-slate-400">
                        <div className="flex items-center justify-between text-[11px]">
                          <span>Vigência:</span>
                          <span className="font-mono text-slate-300">
                            {promo.startDate?.slice(0, 10) || (promo as any).start_date?.slice(0, 10)} até{' '}
                            {promo.endDate?.slice(0, 10) || (promo as any).end_date?.slice(0, 10)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span>Prioridade:</span>
                          <span className="font-mono text-slate-300">{promo.priority ?? 0}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span>Produtos vinculados:</span>
                          <span className="font-mono text-slate-300">{promo.products?.length || 0}</span>
                        </div>
                      </div>

                      {/* Ações */}
                      <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-900">
                        <button
                          type="button"
                          data-testid="toggle-promo-btn"
                          onClick={() => handleTogglePromotion(promo)}
                          className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded text-xs transition"
                        >
                          {isActive ? 'Pausar' : 'Ativar'}
                        </button>
                        <button
                          type="button"
                          data-testid="edit-promo-btn"
                          onClick={() => {
                            setPromotionToEdit(promo);
                            setIsPromoModalOpen(true);
                          }}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded"
                          title="Editar promoção"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          data-testid="delete-promo-btn"
                          onClick={() => handleDeletePromotion(promo.id)}
                          className="p-1.5 bg-rose-950/60 hover:bg-rose-900 text-rose-300 rounded"
                          title="Excluir promoção"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Simulador de Motor Promocional Integrado */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-indigo-400" />
                    <span>Simulador do Motor de Precificação Promocional</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Teste como as regras ativas avaliam uma cesta de itens e aplicam descontos automaticamente
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-900 p-3 rounded-lg border border-slate-800 text-xs">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Produto ID Teste</label>
                  <input
                    type="number"
                    value={1}
                    readOnly
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-400 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Quantidade no Carrinho</label>
                  <input
                    type="number"
                    min="1"
                    data-testid="sim-cart-qty"
                    value={simCartProduct1Qty}
                    onChange={(e) => setSimCartProduct1Qty(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Preço Unitário Normal (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    data-testid="sim-cart-price"
                    value={simCartProduct1Price}
                    onChange={(e) => setSimCartProduct1Price(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white font-mono"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    data-testid="sim-cart-evaluate-btn"
                    onClick={handleRunSimulator}
                    disabled={isEvaluatingCart}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isEvaluatingCart ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Percent className="w-3.5 h-3.5" />}
                    <span>Avaliar Cesta</span>
                  </button>
                </div>
              </div>

              {simCartResult && (
                <div data-testid="sim-cart-result" className="p-4 bg-slate-900 border border-slate-800 rounded-lg text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Subtotal Original:</span>
                    <span className="font-mono text-slate-300 font-bold">{formatBrl(simCartResult.subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-emerald-400 font-bold">
                    <span>Desconto Promocional Aplicado:</span>
                    <span className="font-mono">- {formatBrl(simCartResult.totalDiscount)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm font-black text-white pt-2 border-t border-slate-800">
                    <span>Total Final com Promoções:</span>
                    <span className="font-mono text-emerald-400">{formatBrl(simCartResult.finalTotal)}</span>
                  </div>
                  {simCartResult.appliedPromotions.length > 0 && (
                    <div className="pt-2 text-[11px] text-slate-400">
                      Campanhas ativadas nesta compra:{' '}
                      {simCartResult.appliedPromotions.map((p) => p.name).join(', ')}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* ABA 3: ADESÃO A TRATAMENTO & RECOMPRA PREDITIVA                   */}
        {/* ================================================================= */}
        {activeTab === 'TREATMENTS' && (
          <div className="space-y-6">
            {/* Filtros e Ações */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                  Antecedência da Recompra:
                </span>
                <select
                  data-testid="refill-days-filter"
                  value={refillDaysAhead}
                  onChange={(e) => setRefillDaysAhead(Number(e.target.value))}
                  className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white outline-hidden focus:border-rose-500 font-semibold"
                >
                  <option value={3}>Próximos 3 Dias (Urgência Alta)</option>
                  <option value={7}>Próximos 7 Dias (Semana)</option>
                  <option value={15}>Próximos 15 Dias</option>
                  <option value={30}>Próximos 30 Dias (Mês)</option>
                </select>
                <button
                  type="button"
                  onClick={loadRefills}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                  title="Atualizar lista"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs text-slate-400">
                Total de alertas de recompra previstos: <strong className="text-white">{refills.length}</strong>
              </div>
            </div>

            {/* Tabela de Pacientes e Medicamentos Contínuos */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <HeartHandshake className="w-4 h-4 text-rose-400" />
                  <span>Painel de Pacientes em Tratamento Contínuo com Término Iminente</span>
                </h3>
              </div>

              {isLoadingRefills ? (
                <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin text-rose-500" />
                  <span className="text-xs">Calculando previsões de término de caixas...</span>
                </div>
              ) : refills.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-lg">
                  Nenhum paciente com recompra prevista para os próximos {refillDaysAhead} dias.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left" data-testid="refills-table">
                    <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] font-bold">
                      <tr>
                        <th className="py-3 px-4">Paciente</th>
                        <th className="py-3 px-4">Telefone</th>
                        <th className="py-3 px-4">Medicamento</th>
                        <th className="py-3 px-4">Posologia / Duração</th>
                        <th className="py-3 px-4">Data Prevista Término</th>
                        <th className="py-3 px-4">Dias Restantes</th>
                        <th className="py-3 px-4 text-right">Ações Farmacêuticas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {refills.map((item) => {
                        const isCritical = item.daysUntilRefill <= 3;
                        const isWarning = item.daysUntilRefill <= 7 && !isCritical;
                        return (
                          <tr key={item.treatmentId} className="hover:bg-slate-900/50">
                            <td className="py-3 px-4 font-bold text-white">{item.customerName}</td>
                            <td className="py-3 px-4 font-mono text-slate-400">
                              {item.customerPhone || 'Não informado'}
                            </td>
                            <td className="py-3 px-4 text-slate-200">
                              <span className="font-bold">{item.productName}</span>
                              {item.dosage && (
                                <span className="text-[11px] text-slate-400 block font-mono">
                                  {item.dosage}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-300">
                              {item.dailyDose} dose/dia ({item.totalDaysSupply} dias)
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-300">
                              {item.expectedRefillDate?.slice(0, 10)}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                                  isCritical
                                    ? 'bg-rose-950 text-rose-300 border border-rose-700'
                                    : isWarning
                                      ? 'bg-amber-950 text-amber-300 border border-amber-700'
                                      : 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                                }`}
                              >
                                {item.daysUntilRefill <= 0
                                  ? 'Vence hoje'
                                  : `${item.daysUntilRefill} dias`}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end space-x-2">
                                <button
                                  type="button"
                                  data-testid="open-contact-modal-btn"
                                  onClick={() => {
                                    setSelectedRefillForContact(item);
                                    setIsRefillContactModalOpen(true);
                                  }}
                                  className="flex items-center space-x-1 px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded font-bold text-xs transition cursor-pointer"
                                >
                                  <PhoneCall className="w-3.5 h-3.5" />
                                  <span>Registrar Contato</span>
                                </button>
                                <button
                                  type="button"
                                  data-testid="open-slip-modal-btn"
                                  onClick={() => {
                                    setSelectedRefillForContact(item);
                                    setIsRefillContactModalOpen(true);
                                  }}
                                  className="flex items-center space-x-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-bold text-xs transition cursor-pointer"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                  <span>Filipeta</span>
                                </button>
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
          </div>
        )}
      </main>

      {/* Modais Integrados */}
      <CashbackRedeemModal
        isOpen={isRedeemModalOpen}
        onClose={() => setIsRedeemModalOpen(false)}
        initialCustomerId={selectedCustomer?.id}
        onRedeemSuccess={(tx) => {
          setNoticeMessage(`Resgate de cashback de ${formatBrl(tx.amount)} realizado com sucesso!`);
          if (selectedCustomer?.cpf) {
            handleSearchWallet();
          }
        }}
      />

      <PromotionFormModal
        isOpen={isPromoModalOpen}
        onClose={() => setIsPromoModalOpen(false)}
        promotionToEdit={promotionToEdit}
        onSaveSuccess={(saved) => {
          setNoticeMessage(`Campanha "${saved.name}" salva com sucesso!`);
          loadPromotions();
        }}
      />

      <RefillContactModal
        isOpen={isRefillContactModalOpen}
        onClose={() => setIsRefillContactModalOpen(false)}
        treatment={selectedRefillForContact}
        onSuccess={() => {
          setNoticeMessage('Ação farmacêutica registrada com sucesso.');
          loadRefills();
        }}
      />
    </div>
  );
}
