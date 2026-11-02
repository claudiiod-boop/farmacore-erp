import { useState, useCallback } from 'react';
import {
  Send,
  RotateCcw,
  X,
  AlertCircle,
  FileText,
} from 'lucide-react';
import ProductSearch from '../components/ProductSearch';
import BatchSelector from '../components/BatchSelector';
import CartTable, { CartItem } from '../components/CartTable';
import PrescriptionModal from '../components/PrescriptionModal';
import PreSaleTicket from '../components/PreSaleTicket';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import {
  getAvailableBatches,
  createPreSale,
  Product,
  Batch,
  CreatePreSaleDTO,
  PrescriptionDTO,
  PreSale,
} from '../services/api';

export default function CounterPage() {
  // Cart state
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  // Customer identification
  const [customerName, setCustomerName] = useState('');
  const [customerCpf, setCustomerCpf] = useState('');

  // Batch selection modal state
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [pendingBatches, setPendingBatches] = useState<Batch[]>([]);
  const [isLoadingBatches, setIsLoadingBatches] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);

  // Prescription modal state
  const [isPrescriptionModalOpen, setIsPrescriptionModalOpen] = useState(false);

  // Pre-sale ticket modal state
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [createdPreSale, setCreatedPreSale] = useState<PreSale | null>(null);
  const [ticketItems, setTicketItems] = useState<CartItem[]>([]);
  const [ticketPrescription, setTicketPrescription] = useState<PrescriptionDTO | null>(null);

  // Status and feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  // Helper to add item to cart
  const addItemToCart = useCallback((product: Product, batch: Batch) => {
    setCartItems((prev) => {
      const existingIdx = prev.findIndex(
        (it) => it.product.id === product.id && it.batch.id === batch.id
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

      const newItem: CartItem = {
        product,
        batch,
        quantity: 1,
        unitPrice: product.price,
        totalPrice: product.price,
      };
      return [...prev, newItem];
    });

    setNoticeMessage(null);
  }, []);

  // When a product is selected in ProductSearch
  const handleSelectProduct = useCallback(
    async (product: Product) => {
      setErrorMessage(null);
      setNoticeMessage(null);
      setIsLoadingBatches(true);
      setBatchError(null);

      try {
        const batches = await getAvailableBatches(product.id);
        const availableBatches = batches.filter((b) => b.availableQuantity > 0);

        if (availableBatches.length === 0) {
          setErrorMessage(
            `Nenhum lote com estoque disponível para ${product.name}.`
          );
          setIsLoadingBatches(false);
          return;
        }

        if (batches.length > 1) {
          // Open modal to choose batch
          setPendingProduct(product);
          setPendingBatches(batches);
          setIsBatchModalOpen(true);
        } else {
          // Exactly 1 batch available: auto-add to cart
          addItemToCart(product, batches[0]);
        }
      } catch (err: any) {
        setErrorMessage(
          err.message || 'Erro ao carregar lotes do medicamento selecionado.'
        );
      } finally {
        setIsLoadingBatches(false);
      }
    },
    [addItemToCart]
  );

  // When batch is confirmed in BatchSelector
  const handleSelectBatch = useCallback(
    (batch: Batch) => {
      if (pendingProduct) {
        addItemToCart(pendingProduct, batch);
      }
      setIsBatchModalOpen(false);
      setPendingProduct(null);
      setPendingBatches([]);
    },
    [pendingProduct, addItemToCart]
  );

  // Cart operations
  const handleUpdateQuantity = useCallback(
    (productId: number, batchId: number, newQty: number) => {
      setCartItems((prev) =>
        prev.map((item) => {
          if (item.product.id === productId && item.batch.id === batchId) {
            const boundedQty = Math.min(
              Math.max(1, newQty),
              item.batch.availableQuantity
            );
            return {
              ...item,
              quantity: boundedQty,
              totalPrice: Number((item.unitPrice * boundedQty).toFixed(2)),
            };
          }
          return item;
        })
      );
    },
    []
  );

  const handleRemoveItem = useCallback((productId: number, batchId: number) => {
    setCartItems((prev) =>
      prev.filter(
        (it) => !(it.product.id === productId && it.batch.id === batchId)
      )
    );
  }, []);

  // Submit pre-sale to API
  const sendPreSaleToApi = useCallback(
    async (prescription?: PrescriptionDTO) => {
      setIsSubmitting(true);
      setErrorMessage(null);
      setNoticeMessage(null);

      const dto: CreatePreSaleDTO = {
        customerName: customerName.trim() || undefined,
        customerCpf: customerCpf.trim() || undefined,
        items: cartItems.map((item) => ({
          productId: item.product.id,
          batchId: item.batch.id,
          quantity: item.quantity,
        })),
        prescription,
      };

      try {
        const result = await createPreSale(dto);

        // Keep items snapshot for ticket display before clearing cart
        setCreatedPreSale(result);
        setTicketItems([...cartItems]);
        setTicketPrescription(prescription || null);

        // Reset cart and customer info
        setCartItems([]);
        setCustomerName('');
        setCustomerCpf('');

        // Open ticket modal
        setIsTicketModalOpen(true);
      } catch (err: any) {
        setErrorMessage(
          err.message || 'Falha ao gerar pré-venda no servidor.'
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [cartItems, customerName, customerCpf]
  );

  // Trigger pre-sale finalization (F4)
  const handleFinalizePreSale = useCallback(() => {
    if (isSubmitting) return;
    setErrorMessage(null);

    if (cartItems.length === 0) {
      setNoticeMessage(
        'Adicione ao menos um medicamento ao carrinho antes de finalizar a pré-venda.'
      );
      return;
    }

    // Check if there are any controlled substances requiring prescription
    const hasControlled = cartItems.some(
      (it) => it.product.controlType !== 'ISENTO'
    );

    if (hasControlled) {
      setIsPrescriptionModalOpen(true);
    } else {
      sendPreSaleToApi(undefined);
    }
  }, [isSubmitting, cartItems, sendPreSaleToApi]);

  // When prescription is confirmed in PrescriptionModal
  const handleConfirmPrescription = useCallback(
    (prescription: PrescriptionDTO) => {
      setIsPrescriptionModalOpen(false);
      sendPreSaleToApi(prescription);
    },
    [sendPreSaleToApi]
  );

  // Reset counter for new customer (F9)
  const handleNewOrder = useCallback(() => {
    setCartItems([]);
    setCustomerName('');
    setCustomerCpf('');
    setPendingProduct(null);
    setPendingBatches([]);
    setIsBatchModalOpen(false);
    setIsPrescriptionModalOpen(false);
    setIsTicketModalOpen(false);
    setErrorMessage(null);
    setNoticeMessage(null);
  }, []);

  const isAnyModalOpen = isTicketModalOpen || isPrescriptionModalOpen || isBatchModalOpen;

  // Global Keyboard Shortcuts
  useKeyboardShortcuts({
    F4: () => {
      if (!isAnyModalOpen && !isSubmitting) {
        handleFinalizePreSale();
      }
    },
    F9: () => {
      handleNewOrder();
    },
    Escape: () => {
      if (isTicketModalOpen) {
        setIsTicketModalOpen(false);
      } else if (isPrescriptionModalOpen) {
        setIsPrescriptionModalOpen(false);
      } else if (isBatchModalOpen) {
        setIsBatchModalOpen(false);
        setPendingProduct(null);
        setPendingBatches([]);
      } else {
        setErrorMessage(null);
        setNoticeMessage(null);
      }
    },
  });

  // Controlled items in cart for the prescription modal
  const controlledItemsInCart = cartItems.filter(
    (it) => it.product.controlType !== 'ISENTO'
  );

  return (
    <div className="flex flex-col h-screen bg-slate-100 font-sans text-slate-800 select-none">
      {/* Header Corporativo FarmaCore & Barra de Atalhos */}
      <header className="bg-emerald-700 text-white px-6 py-3 flex flex-col md:flex-row md:items-center justify-between shadow-md gap-3">
        <div className="flex items-center space-x-3">
          <div className="bg-white text-emerald-700 font-extrabold px-2.5 py-1 rounded text-xl shadow-sm tracking-tight">
            FC
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wide">FarmaCore ERP</h1>
            <p className="text-xs text-emerald-100 font-medium">
              Terminal de Balcão • Atendimento Ágil
            </p>
          </div>
        </div>

        {/* Atalhos Rápidos da Barra de Status */}
        <div className="flex items-center flex-wrap gap-2 text-xs">
          <button
            type="button"
            title="[F2] Buscar Medicamento"
            onClick={() => {
              window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F2' }));
            }}
            className="flex items-center bg-emerald-800/90 hover:bg-emerald-800 px-3 py-1.5 rounded-lg border border-emerald-600/50 shadow-sm transition"
          >
            <kbd className="bg-emerald-950 text-white px-1.5 py-0.5 rounded font-mono font-bold mr-1.5 shadow-inner">
              F2
            </kbd>
            <span className="font-semibold">F2 - Buscar Medicamento</span>
          </button>

          <button
            type="button"
            title="[F4] Finalizar Pré-Venda"
            onClick={handleFinalizePreSale}
            disabled={isSubmitting}
            className="flex items-center bg-emerald-800/90 hover:bg-emerald-800 px-3 py-1.5 rounded-lg border border-emerald-600/50 shadow-sm transition"
          >
            <kbd className="bg-emerald-950 text-white px-1.5 py-0.5 rounded font-mono font-bold mr-1.5 shadow-inner">
              F4
            </kbd>
            <span className="font-semibold">F4 - Gerar Pré-Venda</span>
          </button>

          <button
            type="button"
            title="[F9] Novo Atendimento"
            onClick={handleNewOrder}
            className="flex items-center bg-emerald-800/90 hover:bg-emerald-800 px-3 py-1.5 rounded-lg border border-emerald-600/50 shadow-sm transition"
          >
            <kbd className="bg-emerald-950 text-white px-1.5 py-0.5 rounded font-mono font-bold mr-1.5 shadow-inner">
              F9
            </kbd>
            <span className="font-semibold">F9 - Novo Atendimento</span>
          </button>

          <div
            title="[Esc] Fechar"
            className="flex items-center bg-emerald-800/70 px-2.5 py-1.5 rounded-lg border border-emerald-600/30 text-emerald-100"
          >
            <kbd className="bg-emerald-950/80 text-white px-1.5 py-0.5 rounded font-mono font-bold mr-1.5 shadow-inner">
              Esc
            </kbd>
            <span>Esc - Fechar</span>
          </div>
        </div>
      </header>

      {/* Área Principal de Trabalho do Balcão */}
      <main className="flex-1 p-4 md:p-6 overflow-hidden flex flex-col space-y-4 max-w-7xl w-full mx-auto">
        {/* Alertas de Notificação e Erro */}
        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-300 rounded-lg text-red-800 text-sm flex items-center justify-between shadow-sm animate-fade-in">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <span className="font-medium">{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-red-500 hover:text-red-700 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {noticeMessage && (
          <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 text-sm flex items-center justify-between shadow-sm animate-fade-in">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <span className="font-medium">{noticeMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setNoticeMessage(null)}
              className="text-amber-500 hover:text-amber-700 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Linha Superior: Busca de Medicamento e Identificação do Cliente */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
          {/* Busca de Medicamentos com Foco F2 */}
          <div className="lg:col-span-8">
            <ProductSearch
              onSelectProduct={handleSelectProduct}
              autoFocus={true}
              disabled={isAnyModalOpen}
              placeholder="Buscar medicamento por Nome, EAN ou Princípio Ativo... (F2)"
            />
          </div>

          {/* Identificação Opcional do Cliente */}
          <div className="lg:col-span-4 flex items-center space-x-2 bg-white p-2 rounded-lg border border-slate-300 shadow-2xs">
            <div className="flex-1">
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nome do Cliente (opcional)"
                className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 placeholder-slate-400 font-medium"
              />
            </div>
            <div className="w-36">
              <input
                type="text"
                value={customerCpf}
                onChange={(e) => setCustomerCpf(e.target.value)}
                placeholder="CPF do Cliente (opcional)"
                className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 placeholder-slate-400 font-medium"
              />
            </div>
          </div>
        </div>

        {/* Grade de Itens do Carrinho */}
        <div className="flex-1 overflow-y-auto">
          <CartTable
            items={cartItems}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveItem}
          />
        </div>

        {/* Barra Inferior com Total e Ação Finalizar */}
        {cartItems.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-md flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {controlledItemsInCart.length > 0 && (
                <div className="flex items-center text-xs font-semibold text-amber-800 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                  <FileText className="w-4 h-4 mr-1.5 text-amber-600" />
                  <span>
                    {controlledItemsInCart.length}{' '}
                    {controlledItemsInCart.length === 1
                      ? 'item controlado exige receita'
                      : 'itens controlados exigem receita'}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={handleNewOrder}
                className="px-4 py-2.5 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg text-sm font-semibold transition flex items-center"
              >
                <RotateCcw className="w-4 h-4 mr-1.5 text-slate-500" />
                Limpar (F9)
              </button>

              <button
                type="button"
                onClick={handleFinalizePreSale}
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-sm font-bold shadow-md transition flex items-center space-x-2"
              >
                <Send className="w-4 h-4" />
                <span>
                  {isSubmitting ? 'Gerando Pré-Venda...' : 'Finalizar Pré-Venda (F4)'}
                </span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Modal de Escolha de Lotes (BatchSelector) */}
      {isBatchModalOpen && pendingProduct && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden flex flex-col">
            <div className="px-5 py-3.5 bg-slate-800 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">
                  Selecionar Lote: {pendingProduct.name}
                </h3>
                <p className="text-xs text-slate-300">
                  Princípio Ativo: {pendingProduct.activeIngredient}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsBatchModalOpen(false);
                  setPendingProduct(null);
                  setPendingBatches([]);
                }}
                className="text-slate-400 hover:text-white p-1"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4">
              <BatchSelector
                batches={pendingBatches}
                onSelectBatch={handleSelectBatch}
                isLoading={isLoadingBatches}
                error={batchError}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal Sanitário de Receita (Portaria 344/98 e Antimicrobianos) */}
      <PrescriptionModal
        isOpen={isPrescriptionModalOpen}
        onClose={() => setIsPrescriptionModalOpen(false)}
        onConfirm={handleConfirmPrescription}
        controlledItems={controlledItemsInCart}
      />

      {/* Visualizador Modal do Ticket de Pré-Venda (Bobina 80mm) */}
      {createdPreSale && (
        <PreSaleTicket
          isOpen={isTicketModalOpen}
          onClose={() => setIsTicketModalOpen(false)}
          onNewOrder={handleNewOrder}
          preSale={createdPreSale}
          items={ticketItems}
          prescription={ticketPrescription}
        />
      )}
    </div>
  );
}
