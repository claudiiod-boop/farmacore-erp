import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Barcode,
  Users,
  ShoppingCart,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer,
  ChevronRight,
  TrendingDown,
  Sparkles,
  ShieldAlert,
  Plus,
  Minus,
  Trash2,
  MonitorCheck
} from 'lucide-react';
import { kioskApi, searchProducts } from '../services/api';
import type {
  PriceCheckResult,
  QueueTicket,
  ServiceType,
  KioskKpis,
  ExpressPreSaleResult
} from '../types';

export const KioskPage: React.FC = () => {
  const [activeMode, setActiveMode] = useState<'PRICE_CHECK' | 'QUEUE' | 'SELF_ORDER' | 'CALL_PANEL'>('PRICE_CHECK');
  const [storeId] = useState<number>(1);

  // Consulta de Preços
  const [priceSearchTerm, setPriceSearchTerm] = useState('');
  const [priceCpf, setPriceCpf] = useState('');
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceResult, setPriceResult] = useState<PriceCheckResult | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);

  // Retirada de Senha
  const [ticketCustomerName, setTicketCustomerName] = useState('');
  const [ticketCustomerCpf, setTicketCustomerCpf] = useState('');
  const [issuedTicketReceipt, setIssuedTicketReceipt] = useState<string | null>(null);

  // Fila do Balcão
  const [queueTickets, setQueueTickets] = useState<QueueTicket[]>([]);

  // Self-Order / Pré-venda Express
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [cart, setCart] = useState<Array<{ product: any; quantity: number }>>([]);
  const [orderCpf, setOrderCpf] = useState('');
  const [expressReceipt, setExpressReceipt] = useState<string | null>(null);

  // KPIs
  const [kpis, setKpis] = useState<KioskKpis | null>(null);

  const loadKpis = useCallback(async () => {
    try {
      const data = await kioskApi.getKpis(storeId);
      setKpis(data);
    } catch (err) {
      console.error('Erro ao carregar KPIs do Totem:', err);
    }
  }, [storeId]);

  const loadQueue = useCallback(async () => {
    try {
      const list = await kioskApi.listQueueTickets(storeId);
      setQueueTickets(list);
    } catch (err) {
      console.error('Erro ao carregar fila:', err);
    }
  }, [storeId]);

  useEffect(() => {
    loadKpis();
    if (activeMode === 'CALL_PANEL') {
      loadQueue();
    }
  }, [activeMode, loadKpis, loadQueue]);

  // Consulta de Preço
  const handlePriceSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!priceSearchTerm.trim()) return;

    setPriceLoading(true);
    setPriceError(null);
    setPriceResult(null);

    try {
      const res = await kioskApi.priceCheck(priceSearchTerm, priceCpf || undefined, storeId);
      setPriceResult(res);
    } catch (err: any) {
      setPriceError(err.message || 'Produto não encontrado.');
    } finally {
      setPriceLoading(false);
    }
  };

  // Emissão de Senha
  const handleIssueTicket = async (serviceType: ServiceType) => {
    try {
      const { ticket, receipt } = await kioskApi.issueQueueTicket({
        store_id: storeId,
        service_type: serviceType,
        customer_name: ticketCustomerName || undefined,
        customer_cpf: ticketCustomerCpf || undefined,
      });

      setIssuedTicketReceipt(receipt);
      setTicketCustomerName('');
      setTicketCustomerCpf('');
      loadKpis();
    } catch (err: any) {
      alert(`Erro ao emitir senha: ${err.message}`);
    }
  };

  // Chamada de Senha no Balcão
  const handleCallTicket = async (id: number) => {
    try {
      await kioskApi.callQueueTicket(id, 'Balcão Farmacêutico');
      loadQueue();
    } catch (err: any) {
      alert(`Erro ao chamar senha: ${err.message}`);
    }
  };

  const handleCompleteTicket = async (id: number) => {
    try {
      await kioskApi.completeQueueTicket(id);
      loadQueue();
    } catch (err: any) {
      alert(`Erro ao concluir atendimento: ${err.message}`);
    }
  };

  // Busca do Catálogo Express
  const handleSearchCatalog = async (term: string) => {
    setCatalogSearch(term);
    if (term.trim().length >= 2) {
      try {
        const prods = await searchProducts(term);
        // Filtra apenas itens permitidos no autoatendimento
        setCatalogItems(prods.filter((p) => p.stripe !== 'PRETA' && p.control_type === 'NONE'));
      } catch {
        setCatalogItems([]);
      }
    } else {
      setCatalogItems([]);
    }
  };

  const addToCart = (product: any) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as Array<{ product: any; quantity: number }>
    );
  };

  const handleCreateExpressOrder = async () => {
    if (cart.length === 0) return;

    try {
      const res: ExpressPreSaleResult = await kioskApi.createExpressPreSale({
        store_id: storeId,
        customer_cpf: orderCpf || undefined,
        items: cart.map((c) => ({ productId: c.product.id, quantity: c.quantity })),
      });

      setExpressReceipt(res.ticket_receipt);
      setCart([]);
      setOrderCpf('');
      loadKpis();
    } catch (err: any) {
      alert(`Erro ao gerar pré-venda expressa: ${err.message}`);
    }
  };

  const cartSubtotal = cart.reduce((acc, curr) => acc + curr.product.price * curr.quantity, 0);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 select-none overflow-y-auto">
      {/* Topbar Quiosque Touch */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-sky-500 flex items-center justify-center shadow-lg shadow-emerald-900/30">
            <MonitorCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
              FarmaCore Autoatendimento
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                Totem Inteligente
              </span>
            </h1>
            <p className="text-xs text-slate-400">Terminal Interativo de Loja — Fase 28</p>
          </div>
        </div>

        {/* Botoeira de Modos do Totem */}
        <div className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-700/80 gap-1">
          <button
            data-testid="mode-price-button"
            onClick={() => setActiveMode('PRICE_CHECK')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              activeMode === 'PRICE_CHECK'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Barcode className="w-4 h-4" />
            Consultar Preço
          </button>
          <button
            data-testid="mode-queue-button"
            onClick={() => setActiveMode('QUEUE')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              activeMode === 'QUEUE'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Users className="w-4 h-4" />
            Retirar Senha
          </button>
          <button
            data-testid="mode-self-order-button"
            onClick={() => setActiveMode('SELF_ORDER')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              activeMode === 'SELF_ORDER'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            Comprar Express
          </button>
          <button
            data-testid="mode-call-panel-button"
            onClick={() => setActiveMode('CALL_PANEL')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeMode === 'CALL_PANEL'
                ? 'bg-slate-700 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Painel Balcão
          </button>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="flex-1 p-6 flex flex-col justify-center items-center max-w-5xl mx-auto w-full">
        {/* ===================== MODO 1: CONSULTAR PREÇO ===================== */}
        {activeMode === 'PRICE_CHECK' && (
          <div className="w-full max-w-3xl space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-extrabold text-white">Consulta Rápida de Preços</h2>
              <p className="text-slate-400 text-sm">
                Aproxime o código de barras do leitor ou digite o nome do produto
              </p>
            </div>

            <form onSubmit={handlePriceSearch} className="space-y-3">
              <div className="relative">
                <input
                  type="text"
                  data-testid="price-search-input"
                  value={priceSearchTerm}
                  onChange={(e) => setPriceSearchTerm(e.target.value)}
                  placeholder="Código de barras EAN ou nome do medicamento..."
                  className="w-full bg-slate-900 border-2 border-slate-700 focus:border-emerald-500 rounded-2xl py-4 px-12 text-lg text-white font-medium outline-none shadow-xl transition-all"
                  autoFocus
                />
                <Barcode className="w-6 h-6 text-slate-400 absolute left-4 top-5" />
                <button
                  type="submit"
                  data-testid="price-search-submit-button"
                  className="absolute right-3 top-3 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold shadow-md transition-all"
                >
                  Consultar
                </button>
              </div>

              <div className="flex items-center gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                <span className="text-xs font-semibold text-slate-400">Cliente Clube FarmaCore?</span>
                <input
                  type="text"
                  data-testid="price-cpf-input"
                  value={priceCpf}
                  onChange={(e) => setPriceCpf(e.target.value)}
                  placeholder="Digite seu CPF para ver o preço com desconto"
                  className="flex-1 bg-transparent text-sm text-slate-200 outline-none font-mono"
                />
              </div>
            </form>

            {priceLoading && (
              <div className="p-8 text-center text-slate-400">Consultando catálogo...</div>
            )}

            {priceError && (
              <div className="p-4 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-center flex items-center justify-center gap-2">
                <AlertCircle className="w-5 h-5" />
                <span>{priceError}</span>
              </div>
            )}

            {priceResult && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6 animate-fadeIn">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                  <div>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                      EAN: {priceResult.ean}
                    </span>
                    <h3 className="text-2xl font-bold text-white mt-1" data-testid="queried-product-name">
                      {priceResult.name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Princípio Ativo: {priceResult.active_ingredient}
                    </p>
                  </div>
                  {priceResult.requires_prescription && (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-rose-950/60 text-rose-300 border border-rose-800 rounded-lg text-xs font-semibold">
                      <ShieldAlert className="w-4 h-4 text-rose-400" />
                      Retenção de Receita Obrigatória
                    </div>
                  )}
                </div>

                {/* Preço em Destaque Gigante */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-950/60 p-5 rounded-xl border border-slate-800">
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      {priceResult.club_member ? 'Preço Clube Fidelidade' : 'Preço Normal'}
                    </span>
                    <div className="text-4xl font-extrabold text-emerald-400 mt-1 font-mono" data-testid="queried-final-price">
                      R$ {priceResult.final_price.toFixed(2)}
                    </div>
                    {priceResult.discount_amount > 0 && (
                      <span className="text-xs text-emerald-300 font-medium">
                        Economia de R$ {priceResult.discount_amount.toFixed(2)} ({priceResult.discount_percentage}%)
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col justify-center sm:text-right text-xs text-slate-400 space-y-1">
                    {priceResult.discount_amount > 0 && (
                      <div>Preço Balcão sem Desconto: R$ {priceResult.original_price.toFixed(2)}</div>
                    )}
                    <div>PMC (Preço Máximo ANVISA): R$ {priceResult.pmc.toFixed(2)}</div>
                  </div>
                </div>

                {/* Sugestão de Genéricos Equivalentes */}
                {priceResult.generic_alternatives.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <div className="flex items-center gap-2 text-xs font-bold text-sky-400">
                      <Sparkles className="w-4 h-4" />
                      Genéricos Equivalentes Mais Baratos:
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {priceResult.generic_alternatives.map((alt) => (
                        <div
                          key={alt.id}
                          className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 flex flex-col justify-between"
                        >
                          <div>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-semibold">
                              Genérico
                            </span>
                            <div className="text-xs font-semibold text-white mt-1 line-clamp-2">
                              {alt.name}
                            </div>
                          </div>
                          <div className="mt-2 pt-2 border-t border-slate-700/40 flex justify-between items-baseline">
                            <span className="text-base font-bold text-sky-300 font-mono">
                              R$ {alt.price.toFixed(2)}
                            </span>
                            <span className="text-[11px] text-emerald-400 font-semibold flex items-center">
                              <TrendingDown className="w-3 h-3 mr-0.5" />
                              -{alt.savings_percentage}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===================== MODO 2: RETIRAR SENHA ===================== */}
        {activeMode === 'QUEUE' && (
          <div className="w-full max-w-4xl space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-extrabold text-white">Retirada de Senha</h2>
              <p className="text-slate-400 text-sm">
                Selecione o tipo de atendimento desejado para emissão do bilhete
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Normal */}
              <button
                data-testid="ticket-normal-button"
                onClick={() => handleIssueTicket('NORMAL')}
                className="bg-slate-900 hover:bg-slate-800 border-2 border-slate-800 hover:border-emerald-500 rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-3 transition-all transform active:scale-95 shadow-xl group"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                  <Users className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Atendimento Geral</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Balcão de medicamentos, perfumaria e orientações
                  </p>
                </div>
                <span className="text-xs font-mono font-semibold text-emerald-400 bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-800">
                  Senha Normal (N-XXX)
                </span>
              </button>

              {/* Preferencial */}
              <button
                data-testid="ticket-preferential-button"
                onClick={() => handleIssueTicket('PREFERENCIAL')}
                className="bg-slate-900 hover:bg-slate-800 border-2 border-slate-800 hover:border-amber-500 rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-3 transition-all transform active:scale-95 shadow-xl group"
              >
                <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400 group-hover:bg-amber-500 group-hover:text-white transition-all">
                  <Sparkles className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Prioridade por Lei</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Idosos (60+), Gestantes, Lactantes e PCD (Lei 10.048/00)
                  </p>
                </div>
                <span className="text-xs font-mono font-semibold text-amber-400 bg-amber-950/40 px-3 py-1 rounded-full border border-amber-800">
                  Senha Prioritária (P-XXX)
                </span>
              </button>

              {/* Rápido */}
              <button
                data-testid="ticket-fast-button"
                onClick={() => handleIssueTicket('RAPIDO')}
                className="bg-slate-900 hover:bg-slate-800 border-2 border-slate-800 hover:border-sky-500 rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-3 transition-all transform active:scale-95 shadow-xl group"
              >
                <div className="w-16 h-16 rounded-full bg-sky-500/10 flex items-center justify-center text-sky-400 group-hover:bg-sky-500 group-hover:text-white transition-all">
                  <Clock className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Retirada Rápida & Delivery</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Encomendas prontas, Farmácia Popular e pré-vendas
                  </p>
                </div>
                <span className="text-xs font-mono font-semibold text-sky-400 bg-sky-950/40 px-3 py-1 rounded-full border border-sky-800">
                  Senha Rápida (R-XXX)
                </span>
              </button>

              {/* Consultório */}
              <button
                data-testid="ticket-clinical-button"
                onClick={() => handleIssueTicket('CONSULTORIO')}
                className="bg-slate-900 hover:bg-slate-800 border-2 border-slate-800 hover:border-purple-500 rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-3 transition-all transform active:scale-95 shadow-xl group"
              >
                <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 group-hover:bg-purple-500 group-hover:text-white transition-all">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Consultório Farmacêutico</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Aferições de pressão, glicemia e aplicação de injeções
                  </p>
                </div>
                <span className="text-xs font-mono font-semibold text-purple-400 bg-purple-950/40 px-3 py-1 rounded-full border border-purple-800">
                  Consultório (C-XXX)
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ===================== MODO 3: COMPRAR EXPRESS ===================== */}
        {activeMode === 'SELF_ORDER' && (
          <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Coluna 1 e 2: Catálogo e Busca */}
            <div className="md:col-span-2 space-y-4">
              <h2 className="text-2xl font-bold text-white">Autoatendimento Express</h2>
              <p className="text-xs text-slate-400">
                Adicione produtos sem receita (MIPs, vitaminas e perfumaria) e emita seu ticket de pagamento
              </p>

              <div className="relative">
                <input
                  type="text"
                  data-testid="catalog-search-input"
                  value={catalogSearch}
                  onChange={(e) => handleSearchCatalog(e.target.value)}
                  placeholder="Buscar produto (ex: Dipirona, Vitamina, Shampoo)..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 px-10 text-sm text-white outline-none"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              </div>

              {/* Lista de Produtos do Catálogo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto">
                {catalogItems.length === 0 ? (
                  <div className="col-span-2 p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
                    Digite o nome de um produto acima para adicionar à cesta
                  </div>
                ) : (
                  catalogItems.map((prod) => (
                    <div
                      key={prod.id}
                      className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col justify-between"
                    >
                      <div>
                        <div className="font-semibold text-white text-sm">{prod.name}</div>
                        <div className="text-xs text-slate-400 font-mono mt-0.5">{prod.ean}</div>
                      </div>
                      <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between">
                        <span className="font-bold text-emerald-400 font-mono">
                          R$ {prod.price.toFixed(2)}
                        </span>
                        <button
                          data-testid={`add-to-cart-${prod.id}`}
                          onClick={() => addToCart(prod)}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Adicionar
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Coluna 3: Cesta de Compras e Finalização */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-4 shadow-xl">
              <div>
                <h3 className="font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                  <ShoppingCart className="w-4 h-4 text-emerald-400" />
                  Cesta Express ({cart.length})
                </h3>

                <div className="divide-y divide-slate-800 max-h-60 overflow-y-auto mt-2">
                  {cart.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 text-xs">Cesta vazia</div>
                  ) : (
                    cart.map((item) => (
                      <div key={item.product.id} className="py-2.5 flex justify-between items-center text-xs">
                        <div className="flex-1 mr-2">
                          <div className="font-medium text-white truncate">{item.product.name}</div>
                          <div className="text-slate-400 font-mono">R$ {item.product.price.toFixed(2)}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateQuantity(item.product.id, -1)}
                            className="p-1 rounded bg-slate-800 text-slate-300 hover:text-white"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="font-mono font-bold text-white">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.product.id, 1)}
                            className="p-1 rounded bg-slate-800 text-slate-300 hover:text-white"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => removeFromCart(item.product.id)}
                            className="text-rose-400 hover:text-rose-300 ml-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-slate-800">
                <input
                  type="text"
                  data-testid="order-cpf-input"
                  value={orderCpf}
                  onChange={(e) => setOrderCpf(e.target.value)}
                  placeholder="CPF para 10% de desconto"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none font-mono"
                />

                <div className="flex justify-between items-center text-sm font-bold text-white pt-1">
                  <span>Subtotal:</span>
                  <span className="font-mono text-emerald-400" data-testid="express-subtotal">
                    R$ {cartSubtotal.toFixed(2)}
                  </span>
                </div>

                <button
                  data-testid="checkout-express-button"
                  onClick={handleCreateExpressOrder}
                  disabled={cart.length === 0}
                  className={`w-full py-3 rounded-xl text-sm font-bold shadow-md transition-all ${
                    cart.length > 0
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  Emitir Ticket de Pré-Venda
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===================== MODO 4: PAINEL DE FILA DO BALCÃO ===================== */}
        {activeMode === 'CALL_PANEL' && (
          <div className="w-full max-w-4xl space-y-6">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-2xl font-bold text-white">Painel de Senhas do Balcão</h2>
                <p className="text-xs text-slate-400">Chamada e controle de atendimento em tempo real</p>
              </div>
              <button
                onClick={loadQueue}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-all"
              >
                Atualizar Fila
              </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-800/80 text-slate-400 text-xs border-b border-slate-700">
                    <th className="py-2.5 px-4">Senha</th>
                    <th className="py-2.5 px-4">Tipo</th>
                    <th className="py-2.5 px-4">Cliente</th>
                    <th className="py-2.5 px-4">Hora</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300 text-xs">
                  {queueTickets.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        Nenhuma senha na fila de atendimento.
                      </td>
                    </tr>
                  ) : (
                    queueTickets.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-mono font-bold text-base text-white">{t.ticket_number}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                              t.service_type === 'PREFERENCIAL'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {t.service_type}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-300">{t.customer_name || 'Anônimo'}</td>
                        <td className="py-3 px-4 font-mono text-slate-500">{t.created_at.substring(11, 16)}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                              t.status === 'WAITING'
                                ? 'bg-sky-500/20 text-sky-300'
                                : t.status === 'CALLED'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {t.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-2">
                          {t.status === 'WAITING' && (
                            <button
                              data-testid={`call-ticket-${t.id}`}
                              onClick={() => handleCallTicket(t.id)}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold transition-all"
                            >
                              Chamar
                            </button>
                          )}
                          {t.status === 'CALLED' && (
                            <button
                              onClick={() => handleCompleteTicket(t.id)}
                              className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-xs font-semibold transition-all"
                            >
                              Concluir
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
      </div>

      {/* Modal de Impressão do Bilhete de Senha */}
      {issuedTicketReceipt && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl flex flex-col items-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-400" />
            <h2 className="text-xl font-bold text-white text-center">Senha Emitida com Sucesso!</h2>
            <div
              data-testid="printed-ticket-receipt"
              className="w-full p-4 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-slate-300 whitespace-pre text-center"
            >
              {issuedTicketReceipt}
            </div>
            <button
              onClick={() => setIssuedTicketReceipt(null)}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold transition-all"
            >
              Concluir
            </button>
          </div>
        </div>
      )}

      {/* Modal de Impressão do Bilhete de Pré-Venda Express */}
      {expressReceipt && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl flex flex-col items-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-400" />
            <h2 className="text-xl font-bold text-white text-center">Ticket de Pré-Venda Emitido!</h2>
            <div
              data-testid="printed-express-receipt"
              className="w-full p-4 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-slate-300 whitespace-pre"
            >
              {expressReceipt}
            </div>
            <button
              onClick={() => setExpressReceipt(null)}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold transition-all"
            >
              Concluir
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
