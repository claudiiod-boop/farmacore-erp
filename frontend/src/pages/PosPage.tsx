import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Lock,
  Unlock,
  Ticket,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  X,
  User,
  Wallet,
  RotateCcw,
} from 'lucide-react';
import PreSaleLookupModal from '../components/pos/PreSaleLookupModal';
import DirectItemInput from '../components/pos/DirectItemInput';
import PosItemGrid, { PosGridItem } from '../components/pos/PosItemGrid';
import PaymentModal from '../components/pos/PaymentModal';
import SaleReceiptModal from '../components/pos/SaleReceiptModal';
import CashSessionModal from '../components/pos/CashSessionModal';
import CashMovementModal from '../components/pos/CashMovementModal';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { formatBrl } from '../components/ProductSearch';
import {
  api,
  CashSession,
  CashSessionSummary,
  PreSaleDetails,
  PreSale,
  Product,
  Batch,
  PaymentItem,
  Sale,
  CashMovementType,
  CheckoutDTO,
  Stripe,
  NfceInvoiceDetails,
} from '../services/api';

export default function PosPage() {
  // Cash Session State
  const [currentSession, setCurrentSession] = useState<CashSession | null>(null);
  const [sessionSummary, setSessionSummary] = useState<CashSessionSummary | null>(null);
  const [isCashSessionModalOpen, setIsCashSessionModalOpen] = useState(false);
  const [sessionModalMode, setSessionModalMode] = useState<'OPEN' | 'CLOSE'>('OPEN');
  const [isSubmittingSession, setIsSubmittingSession] = useState(false);

  // Cart / Items State
  const [items, setItems] = useState<PosGridItem[]>([]);
  const [selectedItemIndex, setSelectedItemIndex] = useState<number>(0);
  const [loadedPreSale, setLoadedPreSale] = useState<PreSale | null>(null);

  // Modals State
  const [isPreSaleModalOpen, setIsPreSaleModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);

  // Completed Sale & Receipt State
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [currentNfce, setCurrentNfce] = useState<NfceInvoiceDetails | null>(null);
  const [receiptText, setReceiptText] = useState<string>('');

  // Status & Feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingMovement, setIsSubmittingMovement] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  const isSessionOpen = currentSession?.status === 'OPEN';

  // Calculations
  const totalCartAmount = useMemo(() => {
    return Number(items.reduce((acc, it) => acc + it.totalPrice, 0).toFixed(2));
  }, [items]);

  const totalItemsCount = useMemo(() => {
    return items.reduce((acc, it) => acc + it.quantity, 0);
  }, [items]);

  // Load current session on mount
  useEffect(() => {
    let isMounted = true;
    api.getCurrentSession()
      .then((session) => {
        if (isMounted) {
          setCurrentSession(session);
        }
      })
      .catch(() => {
        // Fallback: session remains null
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Open Session Handler
  const handleConfirmOpenSession = useCallback(async (operatorName: string, initialCash: number) => {
    setIsSubmittingSession(true);
    setErrorMessage(null);
    try {
      const session = await api.openCashSession(operatorName, initialCash);
      setCurrentSession(session);
      setIsCashSessionModalOpen(false);
      setNoticeMessage(`Caixa #${session.id} aberto com sucesso.`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao abrir sessão de caixa.');
    } finally {
      setIsSubmittingSession(false);
    }
  }, []);

  // Close Session Action Trigger (F12)
  const handleTriggerCloseSession = useCallback(async () => {
    if (!isSessionOpen || !currentSession) {
      setErrorMessage('Caixa já se encontra fechado.');
      return;
    }
    if (items.length > 0) {
      setErrorMessage('Não é possível fechar o caixa com itens no carrinho. Finalize ou limpe a venda atual.');
      return;
    }

    setIsSubmittingSession(true);
    try {
      const summary = await api.getSessionSummary(currentSession.id);
      setSessionSummary(summary);
      setSessionModalMode('CLOSE');
      setIsCashSessionModalOpen(true);
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao buscar resumo do caixa.');
    } finally {
      setIsSubmittingSession(false);
    }
  }, [isSessionOpen, currentSession, items.length]);

  // Close Session Confirmation
  const handleConfirmCloseSession = useCallback(async () => {
    if (!currentSession) return;
    setIsSubmittingSession(true);
    setErrorMessage(null);
    try {
      await api.closeCashSession(currentSession.id);
      setCurrentSession((prev) =>
        prev
          ? {
              ...prev,
              status: 'CLOSED',
              closedAt: new Date().toISOString(),
            }
          : null
      );
      setIsCashSessionModalOpen(false);
      setNoticeMessage(`Caixa #${currentSession.id} fechado com sucesso.`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao fechar sessão de caixa.');
    } finally {
      setIsSubmittingSession(false);
    }
  }, [currentSession]);

  // Movement Action Trigger (F10)
  const handleTriggerMovement = useCallback(() => {
    if (!isSessionOpen) {
      setSessionModalMode('OPEN');
      setIsCashSessionModalOpen(true);
    } else {
      setIsMovementModalOpen(true);
    }
  }, [isSessionOpen]);

  // Confirm Cash Movement
  const handleConfirmMovement = useCallback(
    async (type: CashMovementType, amount: number, reason: string) => {
      if (!currentSession || isSubmittingMovement) return;
      setIsSubmittingMovement(true);
      setErrorMessage(null);
      try {
        await api.registerCashMovement(currentSession.id, {
          type,
          amount,
          reason,
          operatorName: currentSession.operatorName,
        });

        const delta = type === 'SANGRIA' ? -amount : amount;
        setCurrentSession((prev) =>
          prev ? { ...prev, currentCash: +(prev.currentCash + delta).toFixed(2) } : null
        );

        setIsMovementModalOpen(false);
        setNoticeMessage(
          `${type === 'SANGRIA' ? 'Sangria' : 'Suprimento'} de ${formatBrl(amount)} realizada com sucesso.`
        );
      } catch (err: any) {
        setErrorMessage(err.message || 'Falha ao registrar movimentação.');
      } finally {
        setIsSubmittingMovement(false);
      }
    },
    [currentSession, isSubmittingMovement]
  );

  // Load Pre-Sale
  const handleLoadPreSale = useCallback((details: PreSaleDetails) => {
    setLoadedPreSale(details.preSale);
    const hasPrescription = Boolean(details.prescription);
    const pType = details.prescription?.prescriptionType || 'ISENTO';
    const isPreta = pType.startsWith('A') || pType.startsWith('B');
    const defaultStripe: Stripe = hasPrescription
      ? isPreta
        ? 'PRETA'
        : 'VERMELHA'
      : 'SEM_TARJA';

    const newItems: PosGridItem[] = details.items.map((it) => ({
      id: `pre-sale-${it.id}`,
      source: 'PRE_SALE',
      productId: it.productId,
      productName: it.productName,
      stripe: defaultStripe,
      controlType: hasPrescription ? pType : 'ISENTO',
      batchId: it.batchId,
      batchNumber: it.batchNumber,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      totalPrice: it.totalPrice,
    }));

    setItems((prev) => {
      const directItems = prev.filter((it) => it.source === 'DIRECT');
      return [...newItems, ...directItems];
    });

    setNoticeMessage(`Pré-venda #${details.preSale.code} carregada.`);
    setErrorMessage(null);
  }, []);

  // Add Direct Item
  const handleAddDirectItem = useCallback((product: Product, batch: Batch) => {
    setItems((prev) => {
      const existingIdx = prev.findIndex(
        (it) => it.source === 'DIRECT' && it.productId === product.id && it.batchId === batch.id
      );

      if (existingIdx >= 0) {
        const item = prev[existingIdx];
        const newQty = Math.min(item.quantity + 1, batch.availableQuantity);
        const updated = [...prev];
        updated[existingIdx] = {
          ...item,
          quantity: newQty,
          totalPrice: Number((item.unitPrice * newQty).toFixed(2)),
        };
        return updated;
      }

      const newItem: PosGridItem = {
        id: `direct-${product.id}-${batch.id}-${Date.now()}`,
        source: 'DIRECT',
        productId: product.id,
        productName: product.name,
        stripe: product.stripe,
        controlType: product.controlType,
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        expirationDate: batch.expirationDate,
        quantity: 1,
        unitPrice: product.price,
        totalPrice: product.price,
      };
      return [...prev, newItem];
    });
    setErrorMessage(null);
  }, []);

  // Remove Direct Item
  const handleRemoveDirectItem = useCallback((itemToRemove: PosGridItem) => {
    if (itemToRemove.source !== 'DIRECT') return;
    setItems((prev) => prev.filter((it) => it.id !== itemToRemove.id));
    setNoticeMessage(`Item "${itemToRemove.productName}" removido.`);
  }, []);

  // Trigger Payment Modal (F8)
  const handleTriggerPayment = useCallback(() => {
    if (!isSessionOpen) {
      setErrorMessage('Caixa fechado. Abra uma sessão de caixa antes de realizar vendas.');
      return;
    }
    if (items.length === 0) {
      setErrorMessage('O carrinho está vazio. Adicione itens ou resgate uma pré-venda para prosseguir.');
      return;
    }
    setErrorMessage(null);
    setIsPaymentModalOpen(true);
  }, [isSessionOpen, items.length]);

  // Checkout Submission
  const handleConfirmPayments = useCallback(
    async (payments: PaymentItem[], options?: { emitNfce?: boolean }) => {
      if (isSubmitting || !currentSession) return;
      setIsSubmitting(true);
      setErrorMessage(null);

      try {
        const additionalItems = items
          .filter((it) => it.source === 'DIRECT')
          .map((it) => ({
            productId: it.productId,
            batchId: it.batchId,
            quantity: it.quantity,
          }));

        const dto: CheckoutDTO = {
          cashSessionId: currentSession.id,
          preSaleCode: loadedPreSale?.code,
          additionalItems: additionalItems.length > 0 ? additionalItems : undefined,
          payments,
        };

        const res = await api.checkoutSale(dto);

        // Update local session drawer cash
        const cashPaid = payments
          .filter((p) => p.method === 'DINHEIRO')
          .reduce((sum, p) => sum + p.amount, 0);
        const change = res.sale.changeAmount || 0;
        const netCash = cashPaid - change;

        setCurrentSession((prev) =>
          prev ? { ...prev, currentCash: +(prev.currentCash + netCash).toFixed(2) } : null
        );

        setCompletedSale(res.sale);
        setReceiptText(res.receiptText);

        // Issue NFC-e if enabled (default true)
        if (options?.emitNfce !== false) {
          try {
            const nfceDetails = await api.issueNfce(res.sale.id);
            setCurrentNfce(nfceDetails);
            if (nfceDetails.danfeText) {
              setReceiptText(nfceDetails.danfeText);
            }
          } catch (fiscalErr: any) {
            // Attempt offline contingency if regular issuance fails
            try {
              const contingencyDetails = await api.issueNfce(res.sale.id, {
                offlineContingency: true,
              });
              setCurrentNfce(contingencyDetails);
              if (contingencyDetails.danfeText) {
                setReceiptText(contingencyDetails.danfeText);
              }
              setNoticeMessage('NFC-e emitida em contingência offline (pendente de transmissão).');
            } catch {
              setErrorMessage(
                `Venda finalizada, mas falha na emissão da NFC-e: ${fiscalErr.message || 'Erro fiscal'}`
              );
            }
          }
        } else {
          setCurrentNfce(null);
        }

        setIsPaymentModalOpen(false);
        setIsReceiptModalOpen(true);
      } catch (err: any) {
        setErrorMessage(err.message || 'Falha ao concluir a venda no caixa.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [isSubmitting, currentSession, items, loadedPreSale]
  );

  // New Sale / Reset State
  const handleNewSale = useCallback(() => {
    setIsReceiptModalOpen(false);
    setCompletedSale(null);
    setCurrentNfce(null);
    setReceiptText('');
    setItems([]);
    setLoadedPreSale(null);
    setErrorMessage(null);
    setNoticeMessage(null);
  }, []);

  // Cancel / Clear Cart (Esc)
  const handleCancelOrClear = useCallback(() => {
    if (isReceiptModalOpen) {
      handleNewSale();
    } else if (isPaymentModalOpen) {
      setIsPaymentModalOpen(false);
    } else if (isPreSaleModalOpen) {
      setIsPreSaleModalOpen(false);
    } else if (isMovementModalOpen) {
      setIsMovementModalOpen(false);
    } else if (isCashSessionModalOpen) {
      setIsCashSessionModalOpen(false);
    } else if (items.length > 0 || loadedPreSale) {
      setItems([]);
      setLoadedPreSale(null);
      setNoticeMessage('Venda cancelada / carrinho limpo.');
    } else {
      setErrorMessage(null);
      setNoticeMessage(null);
    }
  }, [
    isReceiptModalOpen,
    isPaymentModalOpen,
    isPreSaleModalOpen,
    isMovementModalOpen,
    isCashSessionModalOpen,
    items.length,
    loadedPreSale,
    handleNewSale,
  ]);

  // Global Keyboard Shortcuts
  useKeyboardShortcuts({
    F5: () => {
      if (
        isPreSaleModalOpen ||
        isPaymentModalOpen ||
        isReceiptModalOpen ||
        isCashSessionModalOpen ||
        isMovementModalOpen
      ) {
        return;
      }
      if (!isSessionOpen) {
        setErrorMessage('Caixa fechado. Abra uma sessão de caixa antes de resgatar pré-venda.');
        return;
      }
      setIsPreSaleModalOpen(true);
    },
    F8: () => {
      if (
        isPreSaleModalOpen ||
        isPaymentModalOpen ||
        isReceiptModalOpen ||
        isCashSessionModalOpen ||
        isMovementModalOpen
      ) {
        return;
      }
      handleTriggerPayment();
    },
    F10: () => {
      if (
        isPreSaleModalOpen ||
        isPaymentModalOpen ||
        isReceiptModalOpen ||
        isCashSessionModalOpen ||
        isMovementModalOpen
      ) {
        return;
      }
      handleTriggerMovement();
    },
    F12: () => {
      if (
        isPreSaleModalOpen ||
        isPaymentModalOpen ||
        isReceiptModalOpen ||
        isCashSessionModalOpen ||
        isMovementModalOpen
      ) {
        return;
      }
      handleTriggerCloseSession();
    },
    Escape: () => {
      handleCancelOrClear();
    },
  });

  return (
    <div className="flex flex-col h-screen bg-slate-100 font-sans text-slate-800 select-none overflow-hidden">
      {/* Header Corporativo FarmaCore & Barra de Status do PDV */}
      <header className="bg-slate-900 text-white px-6 py-3 flex flex-col md:flex-row md:items-center justify-between shadow-md gap-3 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="bg-emerald-600 text-white font-extrabold px-2.5 py-1 rounded text-xl shadow-sm tracking-tight">
            FC
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wide">FarmaCore ERP</h1>
            <p className="text-xs text-slate-400 font-medium">
              Frente de Caixa (PDV) &bull; Terminal de Atendimento
            </p>
          </div>
        </div>

        {/* Informações da Sessão de Caixa */}
        <div className="flex items-center space-x-4 text-xs">
          {isSessionOpen && currentSession ? (
            <>
              <div className="flex items-center space-x-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="font-bold text-emerald-300">CAIXA ABERTO</span>
                <span className="text-slate-400">|</span>
                <span className="font-semibold text-slate-200">Caixa #{currentSession.id}</span>
              </div>

              <div className="flex items-center space-x-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-300 font-medium">{currentSession.operatorName}</span>
              </div>

              <div className="flex items-center space-x-2 bg-emerald-950/60 px-3 py-1.5 rounded-lg border border-emerald-800/60 text-emerald-300">
                <Wallet className="w-3.5 h-3.5" />
                <span className="font-mono font-bold">
                  Saldo Gaveta: {formatBrl(currentSession.currentCash)}
                </span>
              </div>
            </>
          ) : (
            <div className="flex items-center space-x-2 bg-red-950/80 px-3 py-1.5 rounded-lg border border-red-800/60 text-red-300">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
              <span className="font-bold uppercase tracking-wider">CAIXA FECHADO</span>
            </div>
          )}
        </div>

        {/* Atalhos Rápidos no Cabeçalho */}
        <div className="flex items-center flex-wrap gap-2 text-xs">
          <button
            type="button"
            title="[F5] Resgatar Pré-Venda"
            disabled={!isSessionOpen}
            onClick={() => setIsPreSaleModalOpen(true)}
            className="flex items-center bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700 shadow-xs transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <kbd className="bg-slate-950 text-white px-1.5 py-0.5 rounded font-mono font-bold mr-1.5 shadow-inner">
              F5
            </kbd>
            <span className="font-semibold">Resgatar Pré-Venda</span>
          </button>

          <button
            type="button"
            title={isSessionOpen ? '[F10] Sangria / Suprimento' : '[F10] Abrir Caixa'}
            onClick={handleTriggerMovement}
            className="flex items-center bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700 shadow-xs transition"
          >
            <kbd className="bg-slate-950 text-white px-1.5 py-0.5 rounded font-mono font-bold mr-1.5 shadow-inner">
              F10
            </kbd>
            <span className="font-semibold">
              {isSessionOpen ? 'Sangria / Suprimento' : 'Abrir Caixa'}
            </span>
          </button>

          {isSessionOpen && (
            <button
              type="button"
              title="[F12] Fechar Caixa"
              onClick={handleTriggerCloseSession}
              className="flex items-center bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700 shadow-xs transition"
            >
              <kbd className="bg-slate-950 text-white px-1.5 py-0.5 rounded font-mono font-bold mr-1.5 shadow-inner">
                F12
              </kbd>
              <span className="font-semibold">Fechar Caixa</span>
            </button>
          )}
        </div>
      </header>

      {/* Alertas e Mensagens de Feedback */}
      {errorMessage && (
        <div className="mx-6 mt-4 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between text-red-800 text-sm shadow-xs animate-shake">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <span className="font-medium">{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-red-500 hover:text-red-700 p-1 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {noticeMessage && (
        <div className="mx-6 mt-4 p-3.5 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-blue-800 text-sm shadow-xs">
          <div className="flex items-center space-x-3">
            <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <span className="font-medium">{noticeMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setNoticeMessage(null)}
            className="text-blue-500 hover:text-blue-700 p-1 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Conteúdo Principal do Terminal */}
      <main className="flex-1 p-6 flex flex-col gap-4 overflow-hidden">
        {!isSessionOpen ? (
          /* Estado de Caixa Fechado */
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white border border-slate-200 rounded-2xl shadow-sm text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mb-4">
              <Lock className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Caixa Fechado</h2>
            <p className="text-sm text-slate-500 max-w-md mb-6">
              Para iniciar o registro de vendas, resgate de pré-vendas e atendimento no PDV, abra
              uma nova sessão de caixa informando o operador e o fundo de troco inicial.
            </p>
            <button
              type="button"
              onClick={() => {
                setSessionModalMode('OPEN');
                setIsCashSessionModalOpen(true);
              }}
              className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition flex items-center space-x-2"
            >
              <Unlock className="w-4 h-4" />
              <span>Abrir Caixa [F10]</span>
            </button>
          </div>
        ) : (
          /* Estado Operacional do Caixa */
          <div className="flex-1 flex flex-col gap-4 overflow-hidden">
            {/* Linha Superior: Scanner de Conveniência & Informações da Pré-Venda */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <DirectItemInput
                  onAddDirectItem={handleAddDirectItem}
                  disabled={!isSessionOpen}
                />
              </div>

              {/* Informações da Pré-Venda Carregada */}
              <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl shadow-xs">
                {loadedPreSale ? (
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center space-x-2.5 truncate">
                      <div className="p-2 bg-blue-50 text-blue-700 rounded-lg">
                        <Ticket className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-slate-800">
                            #{loadedPreSale.code}
                          </span>
                          <span className="text-[11px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-semibold">
                            Pré-Venda
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">
                          {loadedPreSale.customerName || 'Cliente Balcão'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      title="Remover pré-venda do caixa"
                      onClick={() => {
                        setItems((prev) => prev.filter((it) => it.source !== 'PRE_SALE'));
                        setLoadedPreSale(null);
                        setNoticeMessage('Pré-venda removida da tela de caixa.');
                      }}
                      className="text-slate-400 hover:text-red-600 p-1.5 rounded transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between w-full text-slate-400 text-xs">
                    <div className="flex items-center space-x-2">
                      <Ticket className="w-4 h-4" />
                      <span>Nenhuma pré-venda vinculada</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsPreSaleModalOpen(true)}
                      className="text-emerald-700 hover:text-emerald-800 font-bold hover:underline"
                    >
                      [F5] Resgatar
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Grade de Itens no Caixa */}
            <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
              <PosItemGrid
                items={items}
                selectedItemIndex={selectedItemIndex}
                onSelectItemIndex={setSelectedItemIndex}
                onRemoveDirectItem={handleRemoveDirectItem}
                className="flex-1"
              />
            </div>

            {/* Barra Inferior: Totalizadores e Finalização da Venda */}
            <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-lg border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center space-x-6">
                <div>
                  <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                    Quantidade de Itens
                  </span>
                  <p className="text-xl font-bold font-mono text-slate-200">
                    {totalItemsCount} {totalItemsCount === 1 ? 'item' : 'itens'}
                  </p>
                </div>
                <div className="h-8 w-px bg-slate-700 hidden sm:block"></div>
                <div>
                  <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                    Total a Pagar
                  </span>
                  <p className="text-3xl font-black font-mono text-emerald-400">
                    {formatBrl(totalCartAmount)}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3 w-full sm:w-auto">
                <button
                  type="button"
                  title="[Esc] Cancelar Venda Atual"
                  onClick={handleCancelOrClear}
                  disabled={items.length === 0 && !loadedPreSale}
                  className="px-4 py-3 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span className="flex items-center space-x-1.5">
                    <RotateCcw className="w-4 h-4" />
                    <span>[Esc] Cancelar Venda</span>
                  </span>
                </button>

                <button
                  type="button"
                  title="[F8] Pagamento / Finalizar Venda"
                  onClick={handleTriggerPayment}
                  disabled={items.length === 0}
                  className="flex-1 sm:flex-none px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-slate-950 font-black text-sm shadow-md transition flex items-center justify-center space-x-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <DollarSign className="w-5 h-5" />
                  <span>[F8] Pagamento</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modais Integrados */}
      <PreSaleLookupModal
        isOpen={isPreSaleModalOpen}
        onClose={() => setIsPreSaleModalOpen(false)}
        onLoadPreSale={handleLoadPreSale}
      />

      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        totalAmount={totalCartAmount}
        onConfirmPayments={handleConfirmPayments}
        isLoading={isSubmitting}
      />

      {completedSale && (
        <SaleReceiptModal
          isOpen={isReceiptModalOpen}
          onClose={handleNewSale}
          onNewSale={handleNewSale}
          sale={completedSale}
          receiptText={receiptText}
          nfceInvoice={currentNfce}
        />
      )}

      <CashSessionModal
        isOpen={isCashSessionModalOpen}
        onClose={() => setIsCashSessionModalOpen(false)}
        mode={sessionModalMode}
        currentSession={currentSession}
        sessionSummary={sessionSummary}
        onConfirmOpen={handleConfirmOpenSession}
        onConfirmClose={handleConfirmCloseSession}
        isLoading={isSubmittingSession}
      />

      <CashMovementModal
        isOpen={isMovementModalOpen}
        onClose={() => setIsMovementModalOpen(false)}
        currentCash={currentSession?.currentCash ?? 0}
        operatorName={currentSession?.operatorName ?? ''}
        onConfirmMovement={handleConfirmMovement}
        isLoading={isSubmittingMovement}
      />
    </div>
  );
}
