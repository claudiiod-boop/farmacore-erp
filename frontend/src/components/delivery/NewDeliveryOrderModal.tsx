import React, { useState, useEffect } from 'react';
import {
  X,
  PackagePlus,
  Plus,
  Trash2,
  DollarSign,
  MapPin,
  User,
  AlertCircle,
  Loader2,
  Clock,
} from 'lucide-react';
import { deliveryApi } from '../../services/api';
import type {
  DeliveryOrder,
  CreateDeliveryOrderItemInput,
  DeliveryPaymentMethod,
} from '../../types';

export interface NewDeliveryOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderCreated: (order: DeliveryOrder) => void;
  storeId?: number;
}

interface NewOrderItem {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export default function NewDeliveryOrderModal({
  isOpen,
  onClose,
  onOrderCreated,
  storeId = 1,
}: NewDeliveryOrderModalProps) {
  // Customer info
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerCpf, setCustomerCpf] = useState('');

  // Address
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('São Paulo');
  const [state, setState] = useState('SP');
  const [zipCode, setZipCode] = useState('');
  const [referencePoint, setReferencePoint] = useState('');

  // Items
  const [items, setItems] = useState<NewOrderItem[]>([
    {
      productId: 1,
      productName: 'Dipirona Monoidratada 500mg 10 comprimidos',
      quantity: 1,
      unitPrice: 8.5,
      totalPrice: 8.5,
    },
  ]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState(1);
  const [newItemPrice, setNewItemPrice] = useState(15.0);

  // Financial & Fee
  const [deliveryFee, setDeliveryFee] = useState(10.0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<DeliveryPaymentMethod>('DINHEIRO');
  const [changeFor, setChangeFor] = useState<string>('');
  const [notes, setNotes] = useState('');

  // Fee calculation feedback
  const [calculatingFee, setCalculatingFee] = useState(false);
  const [feeStatusText, setFeeStatusText] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Calculate items subtotal
  const subtotal = items.reduce((acc, it) => acc + it.totalPrice, 0);
  const totalAmount = Math.max(0, subtotal + deliveryFee - discountAmount);

  // Reset form on open
  useEffect(() => {
    if (isOpen) {
      setCustomerName('');
      setCustomerPhone('');
      setCustomerCpf('');
      setStreet('');
      setNumber('');
      setComplement('');
      setNeighborhood('');
      setCity('São Paulo');
      setState('SP');
      setZipCode('');
      setReferencePoint('');
      setItems([
        {
          productId: 1,
          productName: 'Dipirona Monoidratada 500mg c/ 10 comprimidos',
          quantity: 1,
          unitPrice: 8.5,
          totalPrice: 8.5,
        },
      ]);
      setDeliveryFee(10.0);
      setDiscountAmount(0);
      setPaymentMethod('DINHEIRO');
      setChangeFor('');
      setNotes('');
      setFeeStatusText(null);
      setErrorMessage(null);
    }
  }, [isOpen]);

  // Real-time delivery fee calculation by neighborhood
  useEffect(() => {
    if (!neighborhood.trim()) {
      setFeeStatusText(null);
      return;
    }

    const timer = setTimeout(() => {
      setCalculatingFee(true);
      deliveryApi
        .calculateDeliveryFee({
          neighborhood: neighborhood.trim(),
          subtotalAmount: subtotal,
          storeId,
        })
        .then((res) => {
          setDeliveryFee(res.deliveryFee);
          if (res.zone) {
            setFeeStatusText(
              res.freeShipping
                ? `Frete Grátis aplicado (Zona: ${res.zone.name}, ~${res.estimatedMinutes} min)`
                : `Taxa calculada: R$ ${res.deliveryFee.toFixed(2)} (Zona: ${res.zone.name}, ~${res.estimatedMinutes} min)`
            );
          } else {
            setFeeStatusText(`Bairro sem zona cadastrada. Taxa padrão: R$ ${res.deliveryFee.toFixed(2)}`);
          }
        })
        .catch(() => {
          // Fallback
        })
        .finally(() => {
          setCalculatingFee(false);
        });
    }, 400);

    return () => clearTimeout(timer);
  }, [neighborhood, subtotal, storeId]);

  if (!isOpen) return null;

  const handleAddItem = () => {
    if (!newItemName.trim()) return;
    const qty = Math.max(1, Number(newItemQty) || 1);
    const price = Math.max(0, Number(newItemPrice) || 0);
    const newItem: NewOrderItem = {
      productId: Date.now(),
      productName: newItemName.trim(),
      quantity: qty,
      unitPrice: price,
      totalPrice: qty * price,
    };
    setItems([...items, newItem]);
    setNewItemName('');
    setNewItemQty(1);
    setNewItemPrice(15.0);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      setErrorMessage('Nome do cliente é obrigatório.');
      return;
    }
    if (!customerPhone.trim()) {
      setErrorMessage('Telefone do cliente é obrigatório.');
      return;
    }
    if (!street.trim() || !number.trim() || !neighborhood.trim()) {
      setErrorMessage('Endereço completo (Rua, Número e Bairro) é obrigatório.');
      return;
    }
    if (items.length === 0) {
      setErrorMessage('Adicione ao menos um produto no pedido.');
      return;
    }

    const parsedChangeFor =
      paymentMethod === 'DINHEIRO' && changeFor ? parseFloat(changeFor) : null;

    if (parsedChangeFor !== null && parsedChangeFor < totalAmount) {
      setErrorMessage(
        `O valor do troco (R$ ${parsedChangeFor.toFixed(2)}) não pode ser menor que o total do pedido (R$ ${totalAmount.toFixed(2)}).`
      );
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const orderItems: CreateDeliveryOrderItemInput[] = items.map((it) => ({
        productId: it.productId,
        productName: it.productName,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        totalPrice: it.totalPrice,
      }));

      const created = await deliveryApi.createOrder({
        storeId,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerCpf: customerCpf.trim() || null,
        street: street.trim(),
        number: number.trim(),
        complement: complement.trim() || null,
        neighborhood: neighborhood.trim(),
        city: city.trim() || 'São Paulo',
        state: state.trim() || 'SP',
        zipCode: zipCode.trim() || null,
        referencePoint: referencePoint.trim() || null,
        subtotalAmount: subtotal,
        deliveryFee,
        discountAmount,
        totalAmount,
        paymentMethod,
        changeFor: parsedChangeFor,
        notes: notes.trim() || null,
        items: orderItems,
      });

      onOrderCreated(created);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Falha ao criar pedido de tele-entrega.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      data-testid="new-delivery-order-modal"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[92vh] overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center space-x-2">
            <PackagePlus className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-white text-base">
              Novo Pedido de Tele-Entrega Farmacêutica
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-y-auto">
          <div className="p-5 space-y-5">
            {errorMessage && (
              <div className="p-3 bg-red-950/60 border border-red-700/60 rounded-lg text-red-200 flex items-center space-x-2 text-xs">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* 1. Customer Section */}
            <div className="space-y-3 bg-slate-950/50 p-4 rounded-lg border border-slate-800">
              <div className="flex items-center space-x-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
                <User className="w-4 h-4" />
                <span>1. Dados do Cliente</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Nome do Cliente *</label>
                  <input
                    type="text"
                    required
                    data-testid="delivery-customer-name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Ex: Maria Aparecida"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Telefone / WhatsApp *</label>
                  <input
                    type="text"
                    required
                    data-testid="delivery-customer-phone"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="(11) 99999-8888"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">CPF (Opcional)</label>
                  <input
                    type="text"
                    data-testid="delivery-customer-cpf"
                    value={customerCpf}
                    onChange={(e) => setCustomerCpf(e.target.value)}
                    placeholder="000.000.000-00"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* 2. Address & Delivery Zone */}
            <div className="space-y-3 bg-slate-950/50 p-4 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
                  <MapPin className="w-4 h-4" />
                  <span>2. Endereço de Entrega & Bairro</span>
                </div>
                {calculatingFee && (
                  <span className="text-[11px] text-amber-300 flex items-center space-x-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Calculando taxa por bairro...</span>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="md:col-span-3 space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Logradouro / Rua *</label>
                  <input
                    type="text"
                    required
                    data-testid="delivery-street"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    placeholder="Rua das Flores"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Número *</label>
                  <input
                    type="text"
                    required
                    data-testid="delivery-number"
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    placeholder="123"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Complemento / Apto</label>
                  <input
                    type="text"
                    data-testid="delivery-complement"
                    value={complement}
                    onChange={(e) => setComplement(e.target.value)}
                    placeholder="Apto 42 Bloco B"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Bairro * (Cálculo Frete)</label>
                  <input
                    type="text"
                    required
                    data-testid="delivery-neighborhood"
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    placeholder="Ex: Bela Vista"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Ponto de Referência</label>
                  <input
                    type="text"
                    data-testid="delivery-reference"
                    value={referencePoint}
                    onChange={(e) => setReferencePoint(e.target.value)}
                    placeholder="Próximo ao mercado"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500"
                  />
                </div>
              </div>

              {feeStatusText && (
                <div className="p-2 bg-amber-950/40 border border-amber-800/40 rounded text-amber-300 text-xs flex items-center space-x-2">
                  <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>{feeStatusText}</span>
                </div>
              )}
            </div>

            {/* 3. Items Selection */}
            <div className="space-y-3 bg-slate-950/50 p-4 rounded-lg border border-slate-800">
              <div className="flex items-center space-x-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
                <PackagePlus className="w-4 h-4" />
                <span>3. Itens do Pedido ({items.length})</span>
              </div>

              {/* Add item inline bar */}
              <div className="flex flex-wrap gap-2 items-end bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                <div className="flex-1 min-w-[200px] space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400">Produto</label>
                  <input
                    type="text"
                    data-testid="add-item-name"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="Nome do medicamento ou item..."
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500"
                  />
                </div>
                <div className="w-20 space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400">Qtd</label>
                  <input
                    type="number"
                    min="1"
                    data-testid="add-item-qty"
                    value={newItemQty}
                    onChange={(e) => setNewItemQty(parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-hidden focus:border-amber-500"
                  />
                </div>
                <div className="w-28 space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400">Preço Un (R$)</label>
                  <input
                    type="number"
                    step="0.50"
                    min="0"
                    data-testid="add-item-price"
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-hidden focus:border-amber-500"
                  />
                </div>
                <button
                  type="button"
                  data-testid="add-item-button"
                  onClick={handleAddItem}
                  className="flex items-center space-x-1 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-white transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-400" />
                  <span>Adicionar</span>
                </button>
              </div>

              {/* Items Table */}
              <div className="max-h-40 overflow-y-auto border border-slate-800 rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 sticky top-0">
                    <tr>
                      <th className="py-2 px-3">Item / Produto</th>
                      <th className="py-2 px-2 text-center">Qtd</th>
                      <th className="py-2 px-2 text-right">Unitário</th>
                      <th className="py-2 px-2 text-right">Total</th>
                      <th className="py-2 px-2 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {items.map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/50">
                        <td className="py-2 px-3 text-white font-medium">{it.productName}</td>
                        <td className="py-2 px-2 text-center text-slate-300">{it.quantity}</td>
                        <td className="py-2 px-2 text-right text-slate-300">
                          R$ {it.unitPrice.toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-right font-bold text-amber-400">
                          R$ {it.totalPrice.toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="text-red-400 hover:text-red-300 p-1 rounded hover:bg-red-950/40 cursor-pointer"
                            title="Remover Item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {items.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-slate-500">
                          Nenhum produto adicionado. Adicione acima.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 4. Payment & Totals */}
            <div className="space-y-3 bg-slate-950/50 p-4 rounded-lg border border-slate-800">
              <div className="flex items-center space-x-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
                <DollarSign className="w-4 h-4" />
                <span>4. Pagamento e Fechamento</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Forma de Pagamento *</label>
                  <select
                    data-testid="delivery-payment-method"
                    value={paymentMethod}
                    onChange={(e) =>
                      setPaymentMethod(e.target.value as DeliveryPaymentMethod)
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-hidden focus:border-amber-500 cursor-pointer"
                  >
                    <option value="DINHEIRO">Dinheiro (Espécie)</option>
                    <option value="CARTAO_CREDITO">Cartão de Crédito (Maquininha)</option>
                    <option value="CARTAO_DEBITO">Cartão de Débito (Maquininha)</option>
                    <option value="PIX">PIX (Chave / QR Code)</option>
                    <option value="CONVENIO">Convênio Farmacêutico</option>
                    <option value="CREDIARIO">Crediário / Conta da Casa</option>
                  </select>
                </div>

                {paymentMethod === 'DINHEIRO' && (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-amber-300">
                      Troco Para Quanto? (R$)
                    </label>
                    <input
                      type="number"
                      step="5.00"
                      min={totalAmount}
                      data-testid="delivery-change-for"
                      value={changeFor}
                      onChange={(e) => setChangeFor(e.target.value)}
                      placeholder="Ex: 50.00 ou 100.00"
                      className="w-full bg-slate-800 border border-amber-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-400"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Taxa de Frete (R$)</label>
                  <input
                    type="number"
                    step="0.50"
                    min="0"
                    data-testid="delivery-fee-input"
                    value={deliveryFee}
                    onChange={(e) => setDeliveryFee(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-hidden focus:border-amber-500"
                  />
                </div>
              </div>

              {paymentMethod === 'DINHEIRO' && changeFor && parseFloat(changeFor) >= totalAmount && (
                <div className="text-xs text-emerald-400 font-semibold bg-emerald-950/40 border border-emerald-800/40 p-2 rounded">
                  Troco a devolver ao cliente: R${' '}
                  {(parseFloat(changeFor) - totalAmount).toFixed(2)}
                </div>
              )}

              {/* Total Summary Row */}
              <div className="flex flex-wrap items-center justify-between pt-3 border-t border-slate-800 text-sm">
                <div className="flex items-center space-x-4 text-xs text-slate-400">
                  <span>
                    Subtotal: <strong className="text-white">R$ {subtotal.toFixed(2)}</strong>
                  </span>
                  <span>
                    Frete: <strong className="text-white">R$ {deliveryFee.toFixed(2)}</strong>
                  </span>
                  {discountAmount > 0 && (
                    <span>
                      Desconto: <strong className="text-emerald-400">-R$ {discountAmount.toFixed(2)}</strong>
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 mr-2">Total a Cobrar:</span>
                  <span
                    data-testid="delivery-order-total"
                    className="text-lg font-black text-amber-400"
                  >
                    R$ {totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              data-testid="create-order-button"
              className="flex items-center space-x-1.5 px-5 py-2.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Gerando Pedido...</span>
                </>
              ) : (
                <>
                  <PackagePlus className="w-4 h-4" />
                  <span>Confirmar Pedido de Entrega</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
