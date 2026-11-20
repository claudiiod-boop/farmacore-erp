import React, { useState, useEffect } from 'react';
import {
  X,
  Tag,
  Layers,
  Plus,
  Trash2,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../../services/api';
import { formatBrl } from '../ProductSearch';
import type {
  PromotionType,
  PromotionAppliesTo,
  PromotionWithProducts,
  CreatePromotionInput,
  CreatePromotionProductInput,
} from '../../types/crm';
import type { Product } from '../../types';

export interface PromotionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  promotionToEdit?: PromotionWithProducts | null;
  onSaveSuccess: (saved: PromotionWithProducts) => void;
}

const PROMOTION_TYPES: { id: PromotionType; label: string; description: string }[] = [
  {
    id: 'TAKE_MORE_PAY_LESS',
    label: 'Leve Mais Pague Menos',
    description: 'Compre uma quantidade maior e pague menos unidades (Ex: Leve 3 Pague 2).',
  },
  {
    id: 'PROGRESSIVE_DISCOUNT',
    label: 'Desconto Progressivo',
    description: 'Desconto percentual crescente conforme a quantidade adicionada (Ex: 2 un: 10%, 3 un: 15%).',
  },
  {
    id: 'COMBO_CROSS_SELL',
    label: 'Combo / Venda Casada',
    description: 'Comprando o produto A (gatilho), o produto B (recompensa) recebe desconto.',
  },
  {
    id: 'CLUB_SPECIAL_PRICE',
    label: 'Preço Clube Fidelidade',
    description: 'Preço fixo diferenciado exclusivo para clientes identificados no Clube FarmaCore.',
  },
  {
    id: 'BIRTHDAY_DISCOUNT',
    label: 'Desconto Aniversariante',
    description: 'Desconto especial concedido para aniversariantes do mês.',
  },
];

export default function PromotionFormModal({
  isOpen,
  onClose,
  promotionToEdit,
  onSaveSuccess,
}: PromotionFormModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<PromotionType>('TAKE_MORE_PAY_LESS');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [priority, setPriority] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [appliesTo, setAppliesTo] = useState<PromotionAppliesTo>('SPECIFIC_PRODUCTS');
  const [targetCategory, setTargetCategory] = useState('');

  // Type specific condition states
  // TAKE_MORE_PAY_LESS
  const [takeQty, setTakeQty] = useState(3);
  const [payQty, setPayQty] = useState(2);

  // PROGRESSIVE_DISCOUNT
  const [tiers, setTiers] = useState<Array<{ minQuantity: number; discountPercent: number }>>([
    { minQuantity: 2, discountPercent: 10 },
    { minQuantity: 3, discountPercent: 15 },
  ]);

  // COMBO_CROSS_SELL
  const [comboTriggerId, setComboTriggerId] = useState<number | ''>('');
  const [comboRewardId, setComboRewardId] = useState<number | ''>('');
  const [comboDiscount, setComboDiscount] = useState(20);

  // CLUB_SPECIAL_PRICE
  const [specialPrice, setSpecialPrice] = useState<number | ''>('');

  // BIRTHDAY_DISCOUNT
  const [birthdayDiscount, setBirthdayDiscount] = useState(15);

  // Products
  const [products, setProducts] = useState<CreatePromotionProductInput[]>([]);
  const [searchProductQuery, setSearchProductQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearchingProduct, setIsSearchingProduct] = useState(false);

  // Feedback states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSearchResults([]);
      setSearchProductQuery('');

      if (promotionToEdit) {
        setName(promotionToEdit.name);
        setDescription(promotionToEdit.description || '');
        setType(promotionToEdit.type);
        setStartDate(
          promotionToEdit.startDate?.slice(0, 10) ||
            (promotionToEdit as any).start_date?.slice(0, 10) ||
            ''
        );
        setEndDate(
          promotionToEdit.endDate?.slice(0, 10) ||
            (promotionToEdit as any).end_date?.slice(0, 10) ||
            ''
        );
        setPriority(promotionToEdit.priority ?? 0);
        setIsActive(
          promotionToEdit.isActive !== undefined
            ? promotionToEdit.isActive
            : Boolean((promotionToEdit as any).is_active)
        );
        setAppliesTo(
          promotionToEdit.appliesTo ||
            (promotionToEdit as any).applies_to ||
            'SPECIFIC_PRODUCTS'
        );
        setTargetCategory(
          promotionToEdit.targetCategory || (promotionToEdit as any).target_category || ''
        );

        // Parse conditions
        try {
          const raw =
            typeof promotionToEdit.conditionsJson === 'string'
              ? JSON.parse(promotionToEdit.conditionsJson)
              : (promotionToEdit as any).conditions_json
                ? typeof (promotionToEdit as any).conditions_json === 'string'
                  ? JSON.parse((promotionToEdit as any).conditions_json)
                  : (promotionToEdit as any).conditions_json
                : {};

          if (promotionToEdit.type === 'TAKE_MORE_PAY_LESS') {
            setTakeQty(raw.takeQuantity || 3);
            setPayQty(raw.payQuantity || 2);
          } else if (promotionToEdit.type === 'PROGRESSIVE_DISCOUNT') {
            setTiers(raw.tiers || [{ minQuantity: 2, discountPercent: 10 }]);
          } else if (promotionToEdit.type === 'COMBO_CROSS_SELL') {
            setComboTriggerId(raw.triggerProductId || '');
            setComboRewardId(raw.rewardProductId || '');
            setComboDiscount(raw.discountPercent || 20);
          } else if (promotionToEdit.type === 'CLUB_SPECIAL_PRICE') {
            setSpecialPrice(raw.specialPrice || '');
          } else if (promotionToEdit.type === 'BIRTHDAY_DISCOUNT') {
            setBirthdayDiscount(raw.discountPercent || 15);
          }
        } catch {
          // fallback
        }

        // Products
        if (promotionToEdit.products && promotionToEdit.products.length > 0) {
          setProducts(
            promotionToEdit.products.map((p) => ({
              productId: p.productId ?? (p as any).product_id,
              role: p.role,
              specialPrice: p.specialPrice ?? (p as any).special_price,
              discountPercent: p.discountPercent ?? (p as any).discount_percent,
            }))
          );
        } else {
          setProducts([]);
        }
      } else {
        // Defaults for new promotion
        const today = new Date().toISOString().slice(0, 10);
        const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
        setName('');
        setDescription('');
        setType('TAKE_MORE_PAY_LESS');
        setStartDate(today);
        setEndDate(nextMonth);
        setPriority(0);
        setIsActive(true);
        setAppliesTo('SPECIFIC_PRODUCTS');
        setTargetCategory('');
        setTakeQty(3);
        setPayQty(2);
        setTiers([
          { minQuantity: 2, discountPercent: 10 },
          { minQuantity: 3, discountPercent: 15 },
        ]);
        setComboTriggerId('');
        setComboRewardId('');
        setComboDiscount(20);
        setSpecialPrice('');
        setBirthdayDiscount(15);
        setProducts([]);
      }
    }
  }, [isOpen, promotionToEdit]);

  const handleSearchProducts = async () => {
    if (!searchProductQuery.trim()) return;
    setIsSearchingProduct(true);
    try {
      const res = await api.searchProducts(searchProductQuery.trim());
      setSearchResults(res);
    } catch (err: any) {
      setError(err.message || 'Falha ao buscar produtos');
    } finally {
      setIsSearchingProduct(false);
    }
  };

  const handleAddProduct = (p: Product) => {
    if (products.some((it) => it.productId === p.id)) return;
    setProducts((prev) => [
      ...prev,
      {
        productId: p.id,
        role: type === 'COMBO_CROSS_SELL' ? 'TRIGGER' : 'BOTH',
      },
    ]);
  };

  const handleRemoveProduct = (productId: number) => {
    setProducts((prev) => prev.filter((p) => p.productId !== productId));
  };

  const handleAddTier = () => {
    const lastMin = tiers.length > 0 ? tiers[tiers.length - 1].minQuantity : 1;
    const lastDisc = tiers.length > 0 ? tiers[tiers.length - 1].discountPercent : 5;
    setTiers([...tiers, { minQuantity: lastMin + 1, discountPercent: lastDisc + 5 }]);
  };

  const handleRemoveTier = (index: number) => {
    setTiers(tiers.filter((_, i) => i !== index));
  };

  const buildConditionsJson = () => {
    switch (type) {
      case 'TAKE_MORE_PAY_LESS':
        return { takeQuantity: Number(takeQty), payQuantity: Number(payQty) };
      case 'PROGRESSIVE_DISCOUNT':
        return { tiers: tiers.map((t) => ({ minQuantity: Number(t.minQuantity), discountPercent: Number(t.discountPercent) })) };
      case 'COMBO_CROSS_SELL':
        return {
          triggerProductId: Number(comboTriggerId),
          rewardProductId: Number(comboRewardId),
          discountPercent: Number(comboDiscount),
        };
      case 'CLUB_SPECIAL_PRICE':
        return { specialPrice: Number(specialPrice) };
      case 'BIRTHDAY_DISCOUNT':
        return { discountPercent: Number(birthdayDiscount) };
      default:
        return {};
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('O nome da promoção é obrigatório.');
      return;
    }
    if (!startDate || !endDate) {
      setError('Período de vigência completo é obrigatório.');
      return;
    }

    const conditionsJson = buildConditionsJson();

    if (type === 'COMBO_CROSS_SELL') {
      if (!comboTriggerId || !comboRewardId) {
        setError('Para combo, informe o ID do produto gatilho e do produto recompensa.');
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload: CreatePromotionInput = {
        name: name.trim(),
        description: description.trim() || undefined,
        type,
        startDate,
        endDate,
        priority: Number(priority),
        isActive,
        appliesTo,
        targetCategory: targetCategory.trim() || undefined,
        conditionsJson,
        products: appliesTo === 'SPECIFIC_PRODUCTS' ? products : undefined,
      };

      let result: PromotionWithProducts;
      if (promotionToEdit?.id) {
        result = await api.crm.updatePromotion(promotionToEdit.id, payload);
      } else {
        result = await api.crm.createPromotion(payload);
      }
      onSaveSuccess(result);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Falha ao salvar campanha promocional.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden text-slate-900 animate-in fade-in duration-150">
        {/* Topbar */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">
                {promotionToEdit ? 'Editar Campanha Promocional' : 'Nova Campanha Promocional'}
              </h2>
              <p className="text-xs text-slate-400">
                Regras de desconto, precificação dinâmica e clube de fidelidade
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition p-1 rounded-md"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="p-6 overflow-y-auto space-y-5 flex-1">
            {error && (
              <div
                data-testid="promotion-error-banner"
                className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-rose-800 text-xs flex items-start space-x-2"
              >
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Atenção:</p>
                  <p className="text-rose-700">{error}</p>
                </div>
              </div>
            )}

            {/* Dados Principais */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nome da Campanha *
                </label>
                <input
                  type="text"
                  data-testid="promotion-name-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Leve 3 Pague 2 Fraldas Pampers..."
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-hidden focus:border-indigo-500 font-semibold"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Descrição Comercial (Opcional)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Oferta válida para o departamento infantil até durar o estoque..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Mecânica Promocional *
                </label>
                <select
                  data-testid="promotion-type-select"
                  value={type}
                  onChange={(e) => setType(e.target.value as PromotionType)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-hidden focus:border-indigo-500 bg-white"
                >
                  {PROMOTION_TYPES.map((pt) => (
                    <option key={pt.id} value={pt.id}>
                      {pt.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  {PROMOTION_TYPES.find((pt) => pt.id === type)?.description}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Prioridade de Aplicação
                </label>
                <input
                  type="number"
                  min="0"
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-hidden focus:border-indigo-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Quanto maior a prioridade, antes a promoção é calculada no carrinho.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Início da Vigência *
                </label>
                <input
                  type="date"
                  data-testid="promotion-start-date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Fim da Vigência *
                </label>
                <input
                  type="date"
                  data-testid="promotion-end-date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-hidden focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Condições Específicas pelo Tipo */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-indigo-600" />
                <span>Parâmetros da Regra: {PROMOTION_TYPES.find((pt) => pt.id === type)?.label}</span>
              </h4>

              {type === 'TAKE_MORE_PAY_LESS' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Quantidade a Levar (Ex: 3)
                    </label>
                    <input
                      type="number"
                      min="2"
                      data-testid="take-quantity-input"
                      value={takeQty}
                      onChange={(e) => setTakeQty(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-hidden focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Quantidade a Pagar (Ex: 2)
                    </label>
                    <input
                      type="number"
                      min="1"
                      data-testid="pay-quantity-input"
                      value={payQty}
                      onChange={(e) => setPayQty(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-hidden focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}

              {type === 'PROGRESSIVE_DISCOUNT' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-600">Faixas progressivas de quantidade e desconto:</span>
                    <button
                      type="button"
                      onClick={handleAddTier}
                      className="flex items-center space-x-1 px-2.5 py-1 bg-indigo-600 text-white rounded text-xs font-bold hover:bg-indigo-700"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Nova Faixa</span>
                    </button>
                  </div>
                  {tiers.map((t, idx) => (
                    <div key={idx} className="flex items-center space-x-3 bg-white p-2 rounded-lg border border-slate-200">
                      <span className="text-xs font-bold text-slate-500 w-16">Nível {idx + 1}:</span>
                      <div className="flex-1 flex items-center space-x-2">
                        <span className="text-xs text-slate-600">A partir de</span>
                        <input
                          type="number"
                          min="1"
                          value={t.minQuantity}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setTiers(tiers.map((item, i) => (i === idx ? { ...item, minQuantity: val } : item)));
                          }}
                          className="w-16 px-2 py-1 border border-slate-300 rounded text-xs font-bold text-center"
                        />
                        <span className="text-xs text-slate-600">un:</span>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={t.discountPercent}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setTiers(tiers.map((item, i) => (i === idx ? { ...item, discountPercent: val } : item)));
                          }}
                          className="w-16 px-2 py-1 border border-slate-300 rounded text-xs font-bold text-center"
                        />
                        <span className="text-xs text-slate-600">% de desconto</span>
                      </div>
                      {tiers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveTier(idx)}
                          className="text-rose-500 hover:text-rose-700 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {type === 'COMBO_CROSS_SELL' && (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      ID Produto Gatilho
                    </label>
                    <input
                      type="number"
                      value={comboTriggerId}
                      onChange={(e) => setComboTriggerId(e.target.value ? Number(e.target.value) : '')}
                      placeholder="Ex: 101"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      ID Produto Recompensa
                    </label>
                    <input
                      type="number"
                      value={comboRewardId}
                      onChange={(e) => setComboRewardId(e.target.value ? Number(e.target.value) : '')}
                      placeholder="Ex: 202"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Desconto no Recompensa (%)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={comboDiscount}
                      onChange={(e) => setComboDiscount(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-indigo-700"
                    />
                  </div>
                </div>
              )}

              {type === 'CLUB_SPECIAL_PRICE' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Preço Especial para Membros do Clube (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={specialPrice}
                    onChange={(e) => setSpecialPrice(e.target.value ? Number(e.target.value) : '')}
                    placeholder="0.00"
                    className="w-48 px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold font-mono text-emerald-700"
                  />
                </div>
              )}

              {type === 'BIRTHDAY_DISCOUNT' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Percentual de Desconto de Aniversário (%)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={birthdayDiscount}
                    onChange={(e) => setBirthdayDiscount(Number(e.target.value))}
                    className="w-48 px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-indigo-700"
                  />
                </div>
              )}
            </div>

            {/* Escopo de Aplicação */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Escopo de Produtos Afetados
              </label>
              <div className="flex items-center space-x-4 text-xs">
                <label className="flex items-center space-x-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="appliesTo"
                    value="SPECIFIC_PRODUCTS"
                    checked={appliesTo === 'SPECIFIC_PRODUCTS'}
                    onChange={() => setAppliesTo('SPECIFIC_PRODUCTS')}
                  />
                  <span>Produtos Específicos</span>
                </label>
                <label className="flex items-center space-x-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="appliesTo"
                    value="CATEGORY"
                    checked={appliesTo === 'CATEGORY'}
                    onChange={() => setAppliesTo('CATEGORY')}
                  />
                  <span>Categoria / Departamento</span>
                </label>
                <label className="flex items-center space-x-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="appliesTo"
                    value="ALL_PRODUCTS"
                    checked={appliesTo === 'ALL_PRODUCTS'}
                    onChange={() => setAppliesTo('ALL_PRODUCTS')}
                  />
                  <span>Todos os Produtos da Loja</span>
                </label>
              </div>

              {appliesTo === 'CATEGORY' && (
                <div className="mt-2">
                  <input
                    type="text"
                    value={targetCategory}
                    onChange={(e) => setTargetCategory(e.target.value)}
                    placeholder="Nome da categoria (Ex: Dermocosméticos, Fraldas, Vitaminas)..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              )}

              {appliesTo === 'SPECIFIC_PRODUCTS' && (
                <div className="mt-3 space-y-3">
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={searchProductQuery}
                      onChange={(e) => setSearchProductQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSearchProducts();
                        }
                      }}
                      placeholder="Pesquisar produto por nome, EAN ou princípio ativo..."
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleSearchProducts}
                      disabled={isSearchingProduct}
                      className="px-3.5 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-900"
                    >
                      {isSearchingProduct ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Buscar'}
                    </button>
                  </div>

                  {/* Resultados da busca */}
                  {searchResults.length > 0 && (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 max-h-36 overflow-y-auto space-y-1">
                      {searchResults.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between p-2 bg-white rounded border border-slate-200 text-xs hover:border-indigo-400"
                        >
                          <div>
                            <span className="font-bold text-slate-800 block">{p.name}</span>
                            <span className="text-[11px] text-slate-500 font-mono">
                              EAN: {p.ean} | Preço: {formatBrl(p.price)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddProduct(p)}
                            disabled={products.some((it) => it.productId === p.id)}
                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded font-bold transition disabled:opacity-40"
                          >
                            {products.some((it) => it.productId === p.id) ? 'Adicionado' : 'Adicionar'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Lista de Produtos Vinculados */}
                  <div>
                    <span className="text-[11px] font-bold text-slate-600 block mb-1">
                      Produtos Vinculados ({products.length}):
                    </span>
                    {products.length === 0 ? (
                      <div className="p-3 bg-slate-50 border border-dashed border-slate-300 rounded-lg text-center text-xs text-slate-400">
                        Nenhum produto vinculado ainda. Busque e adicione produtos acima.
                      </div>
                    ) : (
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {products.map((prod) => (
                          <div
                            key={prod.productId}
                            className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded text-xs"
                          >
                            <span className="font-mono text-slate-700">Produto ID #{prod.productId}</span>
                            <div className="flex items-center space-x-2">
                              {type === 'COMBO_CROSS_SELL' && (
                                <select
                                  value={prod.role || 'TRIGGER'}
                                  onChange={(e) => {
                                    const val = e.target.value as any;
                                    setProducts(
                                      products.map((p) =>
                                        p.productId === prod.productId ? { ...p, role: val } : p
                                      )
                                    );
                                  }}
                                  className="px-2 py-0.5 border border-slate-300 rounded text-[11px]"
                                >
                                  <option value="TRIGGER">Gatilho</option>
                                  <option value="REWARD">Recompensa</option>
                                  <option value="BOTH">Ambos</option>
                                </select>
                              )}
                              <button
                                type="button"
                                onClick={() => handleRemoveProduct(prod.productId)}
                                className="text-rose-600 hover:text-rose-800 p-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Status Ativo */}
            <div className="flex items-center space-x-2 pt-2 border-t border-slate-200">
              <input
                type="checkbox"
                id="promo-is-active"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="promo-is-active" className="text-xs font-bold text-slate-800 cursor-pointer">
                Campanha ativa e disponível no motor de promoções do caixa/balcão
              </label>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex justify-end space-x-3 text-xs">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg font-bold transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              data-testid="save-promotion-btn"
              disabled={isSubmitting}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition shadow-sm cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Tag className="w-4 h-4" />}
              <span>{promotionToEdit ? 'Salvar Alterações' : 'Criar Campanha'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
