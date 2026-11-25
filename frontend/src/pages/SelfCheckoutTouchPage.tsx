import React, { useState, useEffect, useRef } from 'react';
import {
  MonitorSmartphone,
  ScanBarcode,
  Trash2,
  AlertTriangle,
  QrCode,
  CreditCard,
  CheckCircle2,
  Receipt,
  RotateCcw,
  Plus,
  Minus,
  Sparkles,
  ShoppingBag,
  ExternalLink,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { selfCheckoutApi } from '../services/api';
import {
  SelfCheckoutSession,
  SelfCheckoutScanResult,
  SelfCheckoutPaymentResult,
  SelfCheckoutFinalizeResult,
  SelfCheckoutKpis
} from '../types/self-checkout';

export const SelfCheckoutTouchPage: React.FC = () => {
  const [session, setSession] = useState<SelfCheckoutSession | null>(null);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [scanWarning, setScanWarning] = useState<SelfCheckoutScanResult | null>(null);

  // Modal / Pagamento
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<'PIX' | 'CARTAO_DEBITO' | 'CARTAO_CREDITO'>('PIX');
  const [paymentData, setPaymentData] = useState<SelfCheckoutPaymentResult | null>(null);
  const [finalizeData, setFinalizeData] = useState<SelfCheckoutFinalizeResult | null>(null);
  const [kpis, setKpis] = useState<SelfCheckoutKpis | null>(null);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Inicializa sessão
  const startNewSession = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      setScanWarning(null);
      setIsPaymentModalOpen(false);
      setPaymentData(null);
      setFinalizeData(null);

      const res = await selfCheckoutApi.startSession('TOTEM-TOUCH-01');
      if (res.success && res.data) {
        setSession(res.data);
      } else {
        setErrorMsg('Erro ao iniciar sessão do totem');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Falha na conexão com o totem');
    } finally {
      setLoading(false);
      setTimeout(() => barcodeInputRef.current?.focus(), 150);
    }
  };

  const loadKpis = async () => {
    try {
      const res = await selfCheckoutApi.getKpis();
      if (res.success && res.data) {
        setKpis(res.data);
      }
    } catch {
      // silencioso
    }
  };

  useEffect(() => {
    startNewSession();
    loadKpis();
  }, []);

  // Foco constante no input de scanner
  useEffect(() => {
    if (!isPaymentModalOpen && !finalizeData) {
      barcodeInputRef.current?.focus();
    }
  }, [isPaymentModalOpen, finalizeData, session]);

  // Bipar produto
  const handleScanBarcode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim() || !session) return;

    try {
      setLoading(true);
      setErrorMsg(null);
      setScanWarning(null);

      const res = await selfCheckoutApi.scanItem(session.id, barcodeInput.trim(), 1);
      if (res.success && res.data) {
        const scanRes = res.data;
        if (scanRes.status === 'BLOCKED_REQUIRES_PHARMACIST') {
          // Bloqueio sanitário regulatório
          setScanWarning(scanRes);
        } else if (scanRes.session) {
          setSession(scanRes.session);
        }
      } else {
        setErrorMsg(res.error || 'Código de barras não identificado');
      }
      setBarcodeInput('');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao processar leitura do item');
    } finally {
      setLoading(false);
      setTimeout(() => barcodeInputRef.current?.focus(), 100);
    }
  };

  // Remover item
  const handleRemoveItem = async (itemId: string) => {
    if (!session) return;
    try {
      setLoading(true);
      const res = await selfCheckoutApi.removeItem(session.id, itemId);
      if (res.success && res.data) {
        setSession(res.data);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao remover item do carrinho');
    } finally {
      setLoading(false);
    }
  };

  // Iniciar Pagamento
  const handleStartPayment = async (method: 'PIX' | 'CARTAO_DEBITO' | 'CARTAO_CREDITO') => {
    if (!session || session.items.length === 0) return;
    try {
      setLoading(true);
      setSelectedMethod(method);
      const res = await selfCheckoutApi.initiatePayment(session.id, method);
      if (res.success && res.data) {
        setPaymentData(res.data);
        setIsPaymentModalOpen(true);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Falha ao processar pagamento');
    } finally {
      setLoading(false);
    }
  };

  // Finalizar Venda e emitir NFC-e
  const handleFinalizeSale = async () => {
    if (!session) return;
    try {
      setLoading(true);
      const res = await selfCheckoutApi.finalizeSale(session.id);
      if (res.success && res.data) {
        setFinalizeData(res.data);
        setIsPaymentModalOpen(false);
        loadKpis();
      } else {
        setErrorMsg(res.error || 'Falha ao emitir NFC-e');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao comunicar com a SEFAZ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col p-4 md:p-6 select-none font-sans">
      {/* Topo do Totem */}
      <header className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-purple-600/20 border border-purple-500/30 rounded-2xl text-purple-400">
            <MonitorSmartphone className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Totem Farmacêutico Touch
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Autoatendimento Seguro
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Terminal Autônomo ID: {session?.terminal_id || 'TOTEM-01'} • Conforme RDC 44/2009 ANVISA
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {kpis && (
            <div className="hidden lg:flex items-center space-x-4 bg-slate-900/80 px-4 py-2 rounded-xl border border-slate-800 text-xs">
              <div>
                <span className="text-slate-400">Vendas Totem:</span>{' '}
                <span className="font-bold text-emerald-400">{kpis.completed_sessions}</span>
              </div>
              <div className="border-l border-slate-700 pl-4">
                <span className="text-slate-400">Faturamento:</span>{' '}
                <span className="font-bold text-white">
                  R$ {kpis.total_amount_completed.toFixed(2).replace('.', ',')}
                </span>
              </div>
              <div className="border-l border-slate-700 pl-4">
                <span className="text-slate-400">Redirecionados Balcão:</span>{' '}
                <span className="font-bold text-amber-400">{kpis.blocked_sessions}</span>
              </div>
            </div>
          )}
          <button
            onClick={startNewSession}
            data-testid="btn-reset-session"
            className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 px-4 py-2.5 rounded-xl border border-slate-700 transition"
          >
            <RotateCcw className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-semibold">Nova Venda</span>
          </button>
        </div>
      </header>

      {/* Conteúdo Principal Touch */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Painel Esquerdo: Scanner e Carrinho */}
        <section className="lg:col-span-8 flex flex-col space-y-4">
          {/* Scanner Input Touch Bar */}
          <form
            onSubmit={handleScanBarcode}
            className="bg-slate-900 border-2 border-purple-500/40 rounded-2xl p-4 flex items-center space-x-3 shadow-lg shadow-purple-950/20"
          >
            <ScanBarcode className="w-8 h-8 text-purple-400 animate-pulse" />
            <input
              ref={barcodeInputRef}
              data-testid="scanner-barcode-input"
              type="text"
              placeholder="Aproxime o código de barras do leitor ou digite aqui..."
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              className="flex-1 bg-transparent text-xl font-mono text-white placeholder-slate-500 outline-none"
              autoFocus
            />
            <button
              type="submit"
              data-testid="btn-scan-submit"
              disabled={loading || !barcodeInput.trim()}
              className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl transition shadow text-base cursor-pointer"
            >
              Bipar
            </button>
          </form>

          {/* Banner de Erro */}
          {errorMsg && (
            <div
              data-testid="alert-error-message"
              className="bg-rose-950/60 border border-rose-500/40 text-rose-300 p-4 rounded-xl flex items-center space-x-3"
            >
              <AlertTriangle className="w-6 h-6 text-rose-400 flex-shrink-0" />
              <span className="text-sm font-medium">{errorMsg}</span>
            </div>
          )}

          {/* Alerta Regulatório de Bloqueio Sanitário */}
          {scanWarning && (
            <div
              data-testid="alert-regulatory-block"
              className="bg-amber-950/70 border-2 border-amber-500 rounded-2xl p-6 flex flex-col space-y-3 animate-in fade-in"
            >
              <div className="flex items-start space-x-4">
                <div className="p-3 bg-amber-500/20 rounded-xl text-amber-400 border border-amber-500/30">
                  <UserCheck className="w-8 h-8" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-amber-300">
                    Atenção: Medicamento sob Retenção de Receita
                  </h3>
                  <p className="text-sm text-slate-300 mt-1">{scanWarning.message}</p>
                  <p className="text-xs text-amber-400/80 mt-1">
                    Conforme a RDC 44/2009 e Portaria 344/98, este produto exige dispensação privativa por
                    farmacêutico habilitado.
                  </p>
                </div>
              </div>

              {scanWarning.queueTicketNumber && (
                <div className="bg-slate-900 border border-amber-500/50 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                      Sua Senha Prioritária no Balcão:
                    </span>
                    <div
                      data-testid="queue-ticket-display"
                      className="text-3xl font-extrabold text-amber-400 tracking-widest font-mono"
                    >
                      {scanWarning.queueTicketNumber}
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-400">
                    Dirija-se ao guichê de farmacêuticos.<br />Seu atendimento já foi priorizado.
                  </div>
                </div>
              )}

              <button
                type="button"
                data-testid="btn-dismiss-warning"
                onClick={() => setScanWarning(null)}
                className="self-end bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold px-5 py-2 rounded-xl text-sm transition"
              >
                Compreendido / Continuar
              </button>
            </div>
          )}

          {/* Lista de Itens do Carrinho Touch */}
          <div className="flex-1 bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center justify-between">
              <span>Itens no Carrinho ({session?.items?.length || 0})</span>
              <span className="text-xs text-purple-400 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> Bipagem Instantânea
              </span>
            </h2>

            {session?.items && session.items.length > 0 ? (
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {session.items.map((item) => (
                  <div
                    key={item.id}
                    data-testid={`cart-item-${item.id}`}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between hover:border-slate-700 transition"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-3 bg-purple-950/40 text-purple-400 rounded-xl">
                        <ShoppingBag className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-white text-base">{item.product_name}</h4>
                        <div className="text-xs text-slate-400 font-mono mt-0.5">
                          EAN: {item.barcode} • Lote: {item.lot_number || 'S/L'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-6">
                      <div className="text-right">
                        <div className="text-xs text-slate-400">
                          {item.quantity} un × R$ {item.unit_price.toFixed(2).replace('.', ',')}
                        </div>
                        <div className="text-lg font-bold text-emerald-400">
                          R$ {item.total_price.toFixed(2).replace('.', ',')}
                        </div>
                      </div>

                      <button
                        type="button"
                        data-testid={`btn-remove-item-${item.id}`}
                        onClick={() => handleRemoveItem(item.id)}
                        className="p-2.5 text-rose-400 hover:bg-rose-950/50 rounded-xl border border-rose-900/40 transition"
                        title="Remover item"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-12">
                <ScanBarcode className="w-16 h-16 stroke-1 text-slate-600 mb-2" />
                <p className="text-base font-medium">Carrinho vazio no momento</p>
                <p className="text-xs text-slate-600">Aproxime os produtos com código de barras do leitor</p>
              </div>
            )}
          </div>
        </section>

        {/* Painel Direito: Resumo Financeiro & Pagamento Autônomo */}
        <section className="lg:col-span-4 flex flex-col space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between shadow-xl">
            <div>
              <h3 className="text-base font-bold text-white mb-4">Resumo da Compra</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal</span>
                  <span className="font-mono text-white">
                    R$ {(session?.subtotal_amount || 0).toFixed(2).replace('.', ',')}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Descontos de Farmácia</span>
                  <span className="font-mono text-emerald-400">
                    - R$ {(session?.discount_amount || 0).toFixed(2).replace('.', ',')}
                  </span>
                </div>
                <div className="border-t border-slate-800 pt-3 flex justify-between items-baseline">
                  <span className="text-base font-bold text-white">Total a Pagar</span>
                  <span
                    data-testid="session-total-amount"
                    className="text-3xl font-extrabold text-emerald-400 font-mono"
                  >
                    R$ {(session?.total_amount || 0).toFixed(2).replace('.', ',')}
                  </span>
                </div>
              </div>
            </div>

            {/* Ações de Pagamento Touchscreen com Botões Grandes */}
            <div className="mt-8 space-y-3">
              <button
                type="button"
                data-testid="btn-pay-pix"
                disabled={!session || session.items.length === 0 || loading}
                onClick={() => handleStartPayment('PIX')}
                className="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-98 disabled:opacity-40 text-white font-bold py-4 px-4 rounded-2xl flex items-center justify-center space-x-3 text-lg transition shadow-lg shadow-emerald-950/40 cursor-pointer"
              >
                <QrCode className="w-6 h-6" />
                <span>Pagar com PIX Dinâmico</span>
              </button>

              <button
                type="button"
                data-testid="btn-pay-card-debito"
                disabled={!session || session.items.length === 0 || loading}
                onClick={() => handleStartPayment('CARTAO_DEBITO')}
                className="w-full bg-blue-600 hover:bg-blue-500 active:scale-98 disabled:opacity-40 text-white font-bold py-4 px-4 rounded-2xl flex items-center justify-center space-x-3 text-lg transition shadow-lg shadow-blue-950/40 cursor-pointer"
              >
                <CreditCard className="w-6 h-6" />
                <span>Cartão de Débito (PinPad)</span>
              </button>

              <button
                type="button"
                data-testid="btn-pay-card-credito"
                disabled={!session || session.items.length === 0 || loading}
                onClick={() => handleStartPayment('CARTAO_CREDITO')}
                className="w-full bg-indigo-600 hover:bg-indigo-500 active:scale-98 disabled:opacity-40 text-white font-bold py-4 px-4 rounded-2xl flex items-center justify-center space-x-3 text-lg transition shadow-lg shadow-indigo-950/40 cursor-pointer"
              >
                <CreditCard className="w-6 h-6" />
                <span>Cartão de Crédito</span>
              </button>
            </div>
          </div>

          {/* Dica de Segurança */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 flex items-center space-x-3 text-slate-400 text-xs">
            <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <span>
              Pagamento 100% autônomo com emissão fiscal automática de NFC-e e baixa atômica FEFO.
            </span>
          </div>
        </section>
      </main>

      {/* Modal Touch de Pagamento (PIX / TEF PinPad) */}
      {isPaymentModalOpen && paymentData && (
        <div
          data-testid="modal-payment"
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 md:p-8 max-w-lg w-full flex flex-col items-center text-center shadow-2xl">
            {selectedMethod === 'PIX' ? (
              <>
                <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl mb-4">
                  <QrCode className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-bold text-white">Escaneie o QR Code PIX</h3>
                <p className="text-sm text-slate-400 mt-1">
                  Abra o aplicativo do seu banco e aponte a câmera para pagar
                </p>

                <div className="my-6 p-4 bg-white rounded-2xl shadow-inner">
                  {/* QR Code Simulado Touch */}
                  <img
                    data-testid="pix-qrcode-image"
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                      paymentData.pixQrCode || ''
                    )}`}
                    alt="QR Code PIX"
                    className="w-48 h-48 mx-auto"
                  />
                </div>

                <div className="w-full bg-slate-950 p-3 rounded-xl border border-slate-800 mb-6 text-left">
                  <span className="text-[10px] text-slate-500 uppercase font-mono font-bold">
                    Copia e Cola:
                  </span>
                  <p
                    data-testid="pix-copy-paste"
                    className="text-xs text-slate-300 font-mono break-all line-clamp-2"
                  >
                    {paymentData.pixCopyPaste}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="p-3 bg-blue-500/20 text-blue-400 rounded-2xl mb-4">
                  <CreditCard className="w-10 h-10 animate-pulse" />
                </div>
                <h3 className="text-2xl font-bold text-white">Insira ou Aproxime o Cartão</h3>
                <p className="text-sm text-slate-400 mt-1">
                  Siga as instruções na tela do PinPad TEF ao lado do totem
                </p>

                <div className="my-8 p-6 bg-slate-950 rounded-2xl border border-blue-500/30 text-center w-full">
                  <div className="text-xs uppercase text-slate-500 font-bold mb-1">
                    Valor a ser debitado
                  </div>
                  <div className="text-3xl font-mono font-bold text-emerald-400">
                    R$ {(session?.total_amount || 0).toFixed(2).replace('.', ',')}
                  </div>
                  <div className="text-xs text-blue-400 mt-2">Aguardando autorização da adquirente...</div>
                </div>
              </>
            )}

            <div className="flex w-full space-x-3">
              <button
                type="button"
                data-testid="btn-cancel-payment"
                onClick={() => setIsPaymentModalOpen(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-3 rounded-xl transition"
              >
                Voltar
              </button>
              <button
                type="button"
                data-testid="btn-confirm-payment-success"
                onClick={handleFinalizeSale}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-emerald-950/40"
              >
                Confirmar Pagamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tela de Venda Finalizada com Sucesso e NFC-e */}
      {finalizeData && (
        <div
          data-testid="screen-sale-success"
          className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-lg w-full flex flex-col items-center text-center shadow-2xl">
            <div className="p-4 bg-emerald-500/20 text-emerald-400 rounded-full mb-4">
              <CheckCircle2 className="w-16 h-16" />
            </div>

            <h2 className="text-3xl font-extrabold text-white">Venda Concluída!</h2>
            <p className="text-slate-400 text-sm mt-1">Obrigado por comprar conosco no autoatendimento.</p>

            <div className="my-6 bg-slate-950 border border-slate-800 rounded-2xl p-4 w-full text-left font-mono text-xs space-y-2">
              <div className="flex justify-between text-slate-400">
                <span>NFC-e Emitida:</span>
                <span className="text-white font-bold">Nº {finalizeData.saleId.slice(0, 8)}</span>
              </div>
              <div className="text-slate-400">
                <span>Chave de Acesso SEFAZ (44 dígitos):</span>
                <div
                  data-testid="nfce-access-key-display"
                  className="text-[11px] text-emerald-400 break-all bg-slate-900 p-2 rounded mt-1 select-all"
                >
                  {finalizeData.nfceKey}
                </div>
              </div>
            </div>

            <button
              type="button"
              data-testid="btn-finish-and-restart"
              onClick={startNewSession}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 rounded-2xl text-lg transition shadow-lg shadow-purple-950/40 cursor-pointer"
            >
              Finalizar e Liberar Totem
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SelfCheckoutTouchPage;
