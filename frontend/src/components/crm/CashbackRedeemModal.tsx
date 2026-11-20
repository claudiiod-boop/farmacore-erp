import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  Sparkles,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Receipt,
  Printer,
  Copy,
  Check,
} from 'lucide-react';
import { api } from '../../services/api';
import { formatBrl } from '../ProductSearch';
import type { Customer } from '../../types/credit';
import type { LoyaltyWallet, LoyaltyTransaction } from '../../types/crm';

export interface CashbackRedeemModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCustomerId?: number;
  initialSaleAmount?: number;
  onRedeemSuccess?: (transaction: LoyaltyTransaction) => void;
}

export default function CashbackRedeemModal({
  isOpen,
  onClose,
  initialCustomerId,
  initialSaleAmount = 0,
  onRedeemSuccess,
}: CashbackRedeemModalProps) {
  const [cpf, setCpf] = useState('');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [wallet, setWallet] = useState<LoyaltyWallet | null>(null);
  const [isLoadingCustomer, setIsLoadingCustomer] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form values
  const [saleAmount, setSaleAmount] = useState<string>('');
  const [requestedRedeem, setRequestedRedeem] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [lastTransaction, setLastTransaction] = useState<LoyaltyTransaction | null>(null);

  // Thermal statement
  const [statementText, setStatementText] = useState<string | null>(null);
  const [copiedReceipt, setCopiedReceipt] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setLastTransaction(null);
      setStatementText(null);
      setCopiedReceipt(false);
      setNotes('');
      setRequestedRedeem('');
      setSaleAmount(initialSaleAmount > 0 ? initialSaleAmount.toFixed(2) : '');

      if (initialCustomerId) {
        loadCustomerById(initialCustomerId);
      } else {
        setCustomer(null);
        setWallet(null);
        setCpf('');
      }
    }
  }, [isOpen, initialCustomerId, initialSaleAmount]);

  const loadCustomerById = async (id: number) => {
    setIsLoadingCustomer(true);
    setError(null);
    try {
      const customersRes = await api.credit.getCustomers({ search: String(id) });
      const found = customersRes.customers.find((c) => c.id === id);
      if (found) {
        setCustomer(found);
        setCpf(found.cpf);
        const w = await api.crm.getWallet(found.id);
        setWallet(w);
      } else {
        setError(`Cliente #${id} não localizado.`);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados do cliente.');
    } finally {
      setIsLoadingCustomer(false);
    }
  };

  const handleSearchCustomer = async () => {
    const cleanCpf = cpf.replace(/\D/g, '');
    if (!cleanCpf) {
      setError('Informe um CPF válido para consulta.');
      return;
    }
    setIsLoadingCustomer(true);
    setError(null);
    setLastTransaction(null);
    try {
      const cust = await api.credit.getCustomerByCpf(cleanCpf);
      setCustomer(cust);
      const w = await api.crm.getWallet(cust.id);
      setWallet(w);
    } catch (err: any) {
      setCustomer(null);
      setWallet(null);
      setError(err.message || 'Cliente não encontrado com o CPF informado.');
    } finally {
      setIsLoadingCustomer(false);
    }
  };

  const handleQuickAmount = (amount: number) => {
    const available = wallet?.currentBalance ?? wallet?.current_balance ?? 0;
    const finalVal = Math.min(amount, available);
    setRequestedRedeem(finalVal.toFixed(2));
  };

  const handleMaxAmount = () => {
    const available = wallet?.currentBalance ?? wallet?.current_balance ?? 0;
    const parsedSale = parseFloat(saleAmount) || 0;
    const limit = parsedSale > 0 ? Math.min(available, parsedSale) : available;
    setRequestedRedeem(limit.toFixed(2));
  };

  const handleExecuteRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) {
      setError('Selecione um cliente para resgatar o cashback.');
      return;
    }
    const parsedRedeem = parseFloat(requestedRedeem);
    if (isNaN(parsedRedeem) || parsedRedeem <= 0) {
      setError('Informe um valor de resgate válido maior que zero.');
      return;
    }
    const available = wallet?.currentBalance ?? wallet?.current_balance ?? 0;
    if (parsedRedeem > available) {
      setError(`Valor solicitado (${formatBrl(parsedRedeem)}) excede o saldo disponível (${formatBrl(available)}).`);
      return;
    }
    const parsedSale = parseFloat(saleAmount) || parsedRedeem;

    setIsSubmitting(true);
    setError(null);
    try {
      const tx = await api.crm.redeemCashback({
        customerId: customer.id,
        saleAmount: parsedSale,
        requestedRedeem: parsedRedeem,
        notes: notes || 'Resgate avulso balcão CRM',
      });
      setLastTransaction(tx);
      // Reload wallet
      const updatedWallet = await api.crm.getWallet(customer.id);
      setWallet(updatedWallet);
      if (onRedeemSuccess) {
        onRedeemSuccess(tx);
      }
    } catch (err: any) {
      setError(err.message || 'Falha ao executar resgate de cashback.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLoadStatement = async () => {
    if (!customer) return;
    try {
      const stmt = await api.crm.getWalletStatement(customer.id);
      setStatementText(stmt.textReceipt);
    } catch (err: any) {
      setError(err.message || 'Falha ao carregar extrato térmico.');
    }
  };

  const handleCopyReceipt = () => {
    if (!statementText) return;
    navigator.clipboard.writeText(statementText);
    setCopiedReceipt(true);
    setTimeout(() => setCopiedReceipt(false), 2000);
  };

  if (!isOpen) return null;

  const currentBal = wallet?.currentBalance ?? wallet?.current_balance ?? 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden text-slate-900 animate-in fade-in duration-150">
        {/* Topbar */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">Resgate de Cashback — Clube Fidelidade</h2>
              <p className="text-xs text-slate-400">Consulta de saldo por CPF e autorização de resgate</p>
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

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div
              data-testid="crm-error-banner"
              className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-rose-800 text-xs flex items-start space-x-2"
            >
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Atenção:</p>
                <p className="text-rose-700">{error}</p>
              </div>
            </div>
          )}

          {/* Busca por CPF */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Buscar Cliente pelo CPF
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                data-testid="crm-cpf-input"
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSearchCustomer();
                  }
                }}
                placeholder="Ex: 123.456.789-00 ou números..."
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono outline-hidden focus:border-emerald-500"
              />
              <button
                type="button"
                data-testid="crm-search-cpf-btn"
                onClick={handleSearchCustomer}
                disabled={isLoadingCustomer}
                className="flex items-center space-x-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition disabled:opacity-50 cursor-pointer"
              >
                {isLoadingCustomer ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Search className="w-3.5 h-3.5" />
                )}
                <span>Consultar</span>
              </button>
            </div>
          </div>

          {/* Informações da Carteira */}
          {customer && wallet && (
            <div
              data-testid="crm-wallet-card"
              className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{customer.name}</h3>
                  <p className="text-xs text-slate-500 font-mono">CPF: {customer.cpf}</p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-500 block uppercase font-semibold">Saldo Atual</span>
                  <span
                    data-testid="crm-wallet-balance"
                    className="text-xl font-black text-emerald-700 font-mono"
                  >
                    {formatBrl(currentBal)}
                  </span>
                </div>
              </div>

              {/* Grid de Totais */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-emerald-200/70 text-center text-xs">
                <div className="bg-white p-2 rounded-lg border border-emerald-100">
                  <span className="text-slate-500 text-[10px] block font-semibold uppercase">Acumulado</span>
                  <span className="font-bold text-slate-800 font-mono">
                    {formatBrl(wallet.totalEarned ?? wallet.total_earned ?? 0)}
                  </span>
                </div>
                <div className="bg-white p-2 rounded-lg border border-emerald-100">
                  <span className="text-slate-500 text-[10px] block font-semibold uppercase">Resgatado</span>
                  <span className="font-bold text-slate-800 font-mono">
                    {formatBrl(wallet.totalRedeemed ?? wallet.total_redeemed ?? 0)}
                  </span>
                </div>
                <div className="bg-white p-2 rounded-lg border border-emerald-100">
                  <span className="text-slate-500 text-[10px] block font-semibold uppercase">Expirado</span>
                  <span className="font-bold text-slate-500 font-mono">
                    {formatBrl(wallet.totalExpired ?? wallet.total_expired ?? 0)}
                  </span>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  data-testid="view-statement-btn"
                  onClick={handleLoadStatement}
                  className="text-xs text-emerald-800 hover:text-emerald-950 font-bold flex items-center space-x-1 underline cursor-pointer"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Ver Extrato Térmico Completo</span>
                </button>
              </div>
            </div>
          )}

          {/* Sucesso do Resgate */}
          {lastTransaction && (
            <div
              data-testid="redeem-success-banner"
              className="p-4 bg-emerald-100 border border-emerald-300 rounded-xl text-emerald-950 text-xs flex items-start space-x-3"
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold text-sm">Resgate de Cashback Concluído com Sucesso!</p>
                <p className="mt-1">
                  Valor resgatado: <strong className="font-mono">{formatBrl(lastTransaction.amount)}</strong> |
                  Saldo restante: <strong className="font-mono">{formatBrl(lastTransaction.balanceAfter ?? lastTransaction.balance_after ?? 0)}</strong>
                </p>
                <p className="text-[11px] text-emerald-800 mt-0.5 font-mono">Transação #{lastTransaction.id}</p>
              </div>
            </div>
          )}

          {/* Formulário de Resgate */}
          {customer && wallet && currentBal > 0 && !lastTransaction && (
            <form onSubmit={handleExecuteRedeem} className="space-y-4 pt-2 border-t border-slate-200">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Valor da Compra (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    data-testid="redeem-sale-amount-input"
                    value={saleAmount}
                    onChange={(e) => setSaleAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono outline-hidden focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Valor a Resgatar (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={currentBal}
                    data-testid="redeem-requested-input"
                    value={requestedRedeem}
                    onChange={(e) => setRequestedRedeem(e.target.value)}
                    placeholder="0.00"
                    required
                    className="w-full px-3 py-2 border border-emerald-400 bg-emerald-50/30 rounded-lg text-xs font-mono font-bold text-emerald-900 outline-hidden focus:border-emerald-600"
                  />
                </div>
              </div>

              {/* Atalhos Rápidos */}
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Atalhos de Valor
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleMaxAmount}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold transition"
                  >
                    Saldo Máximo
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAmount(5)}
                    className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-xs font-semibold transition"
                  >
                    R$ 5,00
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAmount(10)}
                    className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-xs font-semibold transition"
                  >
                    R$ 10,00
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAmount(20)}
                    className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-xs font-semibold transition"
                  >
                    R$ 20,00
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAmount(50)}
                    className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-xs font-semibold transition"
                  >
                    R$ 50,00
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Observações / Justificativa
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Resgate de fidelidade na compra do balcão..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  data-testid="confirm-redeem-btn"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>Autorizar Resgate</span>
                </button>
              </div>
            </form>
          )}

          {customer && wallet && currentBal <= 0 && !lastTransaction && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-center text-xs text-slate-500">
              Este cliente não possui saldo disponível de cashback para resgate no momento.
            </div>
          )}

          {/* Extrato Térmico View */}
          {statementText && (
            <div className="mt-4 border border-slate-300 rounded-lg bg-slate-900 text-slate-100 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
                <span className="font-bold flex items-center gap-1.5 text-emerald-400">
                  <Printer className="w-4 h-4" />
                  <span>Filipeta Térmica de Extrato (ESC/POS 48 Colunas)</span>
                </span>
                <button
                  type="button"
                  onClick={handleCopyReceipt}
                  className="flex items-center space-x-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded text-[11px] font-semibold text-white transition"
                >
                  {copiedReceipt ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar Extrato</span>
                    </>
                  )}
                </button>
              </div>
              <pre
                data-testid="crm-statement-text"
                className="font-mono text-[11px] leading-relaxed whitespace-pre-wrap max-h-56 overflow-y-auto text-emerald-300 bg-slate-950 p-2.5 rounded"
              >
                {statementText}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-100 border-t border-slate-200 px-6 py-3 flex justify-between items-center text-xs">
          <span className="text-slate-500">
            Regra padrão: Validade de 90 dias com resgate máximo de 50% da compra
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded font-bold transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
