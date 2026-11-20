import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Building2,
  Receipt,
  Search,
  Plus,
  Edit2,
  UserCheck,
  UserX,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { api } from '../services/api';
import { formatBrl } from '../components/ProductSearch';
import CustomerFormModal from '../components/credit/CustomerFormModal';
import DependentsModal from '../components/credit/DependentsModal';
import AgreementFormModal from '../components/credit/AgreementFormModal';
import PayrollInvoiceModal from '../components/credit/PayrollInvoiceModal';
import DebtPaymentModal from '../components/credit/DebtPaymentModal';
import PromissoryNoteModal from '../components/credit/PromissoryNoteModal';
import type {
  Customer,
  CorporateAgreement,
  CustomerReceivable,
} from '../types';

export default function CustomerCreditPage() {
  const [activeTab, setActiveTab] = useState<'CUSTOMERS' | 'AGREEMENTS' | 'DEBT'>('CUSTOMERS');

  // Shared state: Agreements
  const [agreements, setAgreements] = useState<CorporateAgreement[]>([]);
  const [isAgreementsLoading, setIsAgreementsLoading] = useState(false);

  // Tab 1: Clientes & Limites
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedAgreementFilter, setSelectedAgreementFilter] = useState<string>('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('');
  const [isCustomersLoading, setIsCustomersLoading] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customerForDependents, setCustomerForDependents] = useState<Customer | null>(null);
  const [isDependentsModalOpen, setIsDependentsModalOpen] = useState(false);

  // Tab 2: Empresas Conveniadas
  const [agreementToEdit, setAgreementToEdit] = useState<CorporateAgreement | null>(null);
  const [isAgreementModalOpen, setIsAgreementModalOpen] = useState(false);
  const [agreementForInvoices, setAgreementForInvoices] = useState<CorporateAgreement | null>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);

  // Tab 3: Carnê & Quitação Rápida
  const [debtCpfInput, setDebtCpfInput] = useState('');
  const [debtCustomer, setDebtCustomer] = useState<Customer | null>(null);
  const [customerReceivables, setCustomerReceivables] = useState<CustomerReceivable[]>([]);
  const [isDebtLoading, setIsDebtLoading] = useState(false);
  const [debtError, setDebtError] = useState<string | null>(null);
  const [isDebtPaymentModalOpen, setIsDebtPaymentModalOpen] = useState(false);
  const [selectedSaleForPromissory, setSelectedSaleForPromissory] = useState<number | null>(null);
  const [isPromissoryModalOpen, setIsPromissoryModalOpen] = useState(false);

  // Load agreements
  const loadAgreements = useCallback(async () => {
    setIsAgreementsLoading(true);
    try {
      const data = await api.credit.getAgreements();
      setAgreements(data);
    } catch {
      // ignore
    } finally {
      setIsAgreementsLoading(false);
    }
  }, []);

  // Load customers
  const loadCustomers = useCallback(async () => {
    setIsCustomersLoading(true);
    try {
      const data = await api.credit.getCustomers({
        search: customerSearch || undefined,
        agreementId: selectedAgreementFilter ? Number(selectedAgreementFilter) : undefined,
        status: selectedStatusFilter || undefined,
        limit: 100,
      });
      setCustomers(data.customers || []);
    } catch {
      // ignore
    } finally {
      setIsCustomersLoading(false);
    }
  }, [customerSearch, selectedAgreementFilter, selectedStatusFilter]);

  useEffect(() => {
    loadAgreements();
  }, [loadAgreements]);

  useEffect(() => {
    if (activeTab === 'CUSTOMERS') {
      loadCustomers();
    }
  }, [activeTab, loadCustomers]);

  // Handle Debt search by CPF
  const handleSearchDebtCpf = async (cpfToSearch?: string) => {
    const raw = (cpfToSearch || debtCpfInput).replace(/\D/g, '');
    if (!raw) {
      setDebtError('Digite um CPF válido para buscar.');
      return;
    }

    setIsDebtLoading(true);
    setDebtError(null);
    try {
      const customer = await api.credit.getCustomerByCpf(raw);
      setDebtCustomer(customer);

      const receivables = await api.credit.getReceivables({
        customerId: customer.id,
      });
      setCustomerReceivables(receivables);
    } catch (err: any) {
      setDebtCustomer(null);
      setCustomerReceivables([]);
      setDebtError(err.message || 'Cliente não encontrado pelo CPF informado');
    } finally {
      setIsDebtLoading(false);
    }
  };

  const handleSelectCustomerForDebt = (cust: Customer) => {
    setDebtCpfInput(cust.cpf);
    setActiveTab('DEBT');
    handleSearchDebtCpf(cust.cpf);
  };

  const handleSettlementSuccess = async () => {
    if (debtCustomer) {
      // Refresh customer and receivables
      try {
        const updated = await api.credit.getCustomerById(debtCustomer.id);
        setDebtCustomer(updated);
        const recs = await api.credit.getReceivables({ customerId: debtCustomer.id });
        setCustomerReceivables(recs);
      } catch {
        // ignore
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-900 text-slate-100 overflow-hidden">
      {/* Top Header */}
      <div className="bg-slate-950 border-b border-slate-800 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-950 border border-indigo-700 text-indigo-400 rounded-lg">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              Posto de Convênios & Crediário
              <span className="text-[11px] font-mono bg-indigo-900/60 text-indigo-300 border border-indigo-600 px-2 py-0.5 rounded">
                [F9]
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Gestão de Limites, Clientes, Empresas Conveniadas e Quitação Rápida de Carnê
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center space-x-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-bold">
          <button
            type="button"
            data-testid="tab-customers"
            onClick={() => setActiveTab('CUSTOMERS')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'CUSTOMERS'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Clientes & Limites</span>
          </button>

          <button
            type="button"
            data-testid="tab-agreements"
            onClick={() => setActiveTab('AGREEMENTS')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'AGREEMENTS'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Empresas Conveniadas</span>
          </button>

          <button
            type="button"
            data-testid="tab-debt"
            onClick={() => setActiveTab('DEBT')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'DEBT'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Carnê & Quitação Rápida</span>
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* ========================================================= */}
        {/* ABA 1: CLIENTES & LIMITES */}
        {/* ========================================================= */}
        {activeTab === 'CUSTOMERS' && (
          <div className="space-y-4 max-w-7xl mx-auto">
            {/* Action Bar & Filters */}
            <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    data-testid="customer-search-input"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && loadCustomers()}
                    placeholder="Buscar cliente por nome ou CPF..."
                    className="w-full bg-slate-900 border border-slate-800 pl-9 pr-3 py-2 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
                  />
                </div>

                <select
                  value={selectedAgreementFilter}
                  onChange={(e) => setSelectedAgreementFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-800 text-slate-300 px-3 py-2 rounded-lg text-xs outline-hidden"
                >
                  <option value="">Todos os Convênios</option>
                  {agreements.map((ag) => (
                    <option key={ag.id} value={ag.id}>
                      {ag.tradeName || ag.companyName}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-800 text-slate-300 px-3 py-2 rounded-lg text-xs outline-hidden"
                >
                  <option value="">Todos os Status</option>
                  <option value="ACTIVE">Ativo</option>
                  <option value="BLOCKED_OVERDUE">Bloqueado por Inadimplência</option>
                  <option value="INACTIVE">Inativo</option>
                </select>

                <button
                  type="button"
                  onClick={loadCustomers}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold transition cursor-pointer"
                >
                  Filtrar
                </button>
              </div>

              <button
                type="button"
                data-testid="new-customer-btn"
                onClick={() => {
                  setCustomerToEdit(null);
                  setIsCustomerModalOpen(true);
                }}
                className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Novo Cliente</span>
              </button>
            </div>

            {/* Customers Table */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              {isCustomersLoading ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                  <span className="text-xs">Carregando carteira de clientes...</span>
                </div>
              ) : customers.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  Nenhum cliente encontrado com os filtros aplicados.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300 divide-y divide-slate-800">
                    <thead className="bg-slate-900/60 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="px-4 py-3">Cliente / CPF</th>
                        <th className="px-4 py-3">Convênio</th>
                        <th className="px-4 py-3 text-right">Limite</th>
                        <th className="px-4 py-3 text-right">Dívida Atual</th>
                        <th className="px-4 py-3 text-right">Disponível</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {customers.map((c) => {
                        const limit = c.creditLimit ?? c.credit_limit ?? 0;
                        const debt = c.currentDebt ?? c.current_debt ?? 0;
                        const available = Math.max(0, limit - debt);
                        const isBlocked = c.status === 'BLOCKED_OVERDUE';
                        const isActive = c.status === 'ACTIVE';

                        return (
                          <tr key={c.id} className="hover:bg-slate-900/40 transition">
                            <td className="px-4 py-3 font-semibold text-white">
                              <div>{c.name}</div>
                              <div className="text-[11px] font-mono text-slate-400">{c.cpf}</div>
                            </td>
                            <td className="px-4 py-3 text-slate-300">
                              {c.agreement ? (
                                <span className="font-semibold text-indigo-300">
                                  {c.agreement.tradeName || c.agreement.companyName}
                                </span>
                              ) : (
                                <span className="text-slate-500">Crediário Próprio</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-slate-200">
                              {formatBrl(limit)}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-rose-400">
                              {formatBrl(debt)}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-emerald-400">
                              {formatBrl(available)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {isActive ? (
                                <span
                                  data-testid={`badge-status-${c.id}`}
                                  className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-950 text-emerald-400 border border-emerald-700"
                                >
                                  <UserCheck className="w-3 h-3" />
                                  <span>ATIVO</span>
                                </span>
                              ) : isBlocked ? (
                                <span
                                  data-testid={`badge-status-${c.id}`}
                                  className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-950 text-rose-300 border border-rose-700 animate-pulse"
                                >
                                  <UserX className="w-3 h-3" />
                                  <span>BLOQUEADO</span>
                                </span>
                              ) : (
                                <span
                                  data-testid={`badge-status-${c.id}`}
                                  className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700"
                                >
                                  <span>INATIVO</span>
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center space-x-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCustomerToEdit(c);
                                    setIsCustomerModalOpen(true);
                                  }}
                                  title="Editar Cliente"
                                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition cursor-pointer"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCustomerForDependents(c);
                                    setIsDependentsModalOpen(true);
                                  }}
                                  title="Dependentes Autorizados"
                                  className="p-1.5 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/60 rounded transition cursor-pointer"
                                >
                                  <Users className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSelectCustomerForDebt(c)}
                                  title="Abrir Carnê / Quitação"
                                  className="p-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/60 rounded transition cursor-pointer"
                                >
                                  <Receipt className="w-3.5 h-3.5" />
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

        {/* ========================================================= */}
        {/* ABA 2: EMPRESAS CONVENIADAS */}
        {/* ========================================================= */}
        {activeTab === 'AGREEMENTS' && (
          <div className="space-y-4 max-w-7xl mx-auto">
            <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex items-center justify-between text-xs">
              <div>
                <h2 className="font-bold text-white text-sm">Empresas e Convênios Corporativos</h2>
                <p className="text-slate-400">
                  Gerencie limites corporativos, desconto em folha e fechamento de faturas
                </p>
              </div>

              <button
                type="button"
                data-testid="new-agreement-btn"
                onClick={() => {
                  setAgreementToEdit(null);
                  setIsAgreementModalOpen(true);
                }}
                className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Nova Empresa Conveniada</span>
              </button>
            </div>

            {/* Agreements Table */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              {isAgreementsLoading ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                  <span className="text-xs">Carregando convênios...</span>
                </div>
              ) : agreements.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  Nenhum convênio corporativo cadastrado.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300 divide-y divide-slate-800">
                    <thead className="bg-slate-900/60 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="px-4 py-3">Código</th>
                        <th className="px-4 py-3">Empresa / Razão Social</th>
                        <th className="px-4 py-3">CNPJ</th>
                        <th className="px-4 py-3 text-center">Fechamento / Venc.</th>
                        <th className="px-4 py-3 text-right">Limite Global</th>
                        <th className="px-4 py-3 text-center">Desc. Folha</th>
                        <th className="px-4 py-3 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {agreements.map((ag) => (
                        <tr key={ag.id} className="hover:bg-slate-900/40 transition">
                          <td className="px-4 py-3 font-mono font-bold text-indigo-400">
                            {ag.code}
                          </td>
                          <td className="px-4 py-3 font-semibold text-white">
                            <div>{ag.tradeName || ag.trade_name}</div>
                            <div className="text-[11px] text-slate-400">
                              {ag.companyName || ag.company_name}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-400">{ag.cnpj}</td>
                          <td className="px-4 py-3 text-center font-semibold text-slate-300">
                            Dia {ag.closingDay ?? ag.closing_day} / Dia {ag.dueDay ?? ag.due_day}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-400">
                            {formatBrl(ag.creditLimit ?? ag.credit_limit ?? 0)}
                          </td>
                          <td className="px-4 py-3 text-center font-semibold text-amber-300">
                            {ag.discountPercent ?? ag.discount_percent ?? 0}%
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center space-x-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setAgreementToEdit(ag);
                                  setIsAgreementModalOpen(true);
                                }}
                                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-semibold transition cursor-pointer"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                data-testid={`open-invoices-${ag.id}`}
                                onClick={() => {
                                  setAgreementForInvoices(ag);
                                  setIsInvoiceModalOpen(true);
                                }}
                                className="flex items-center space-x-1 px-2.5 py-1 bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-700 rounded text-xs font-bold transition cursor-pointer"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>Faturas / RH</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* ABA 3: CARNÊ & QUITAÇÃO RÁPIDA */}
        {/* ========================================================= */}
        {activeTab === 'DEBT' && (
          <div className="space-y-4 max-w-7xl mx-auto">
            {/* Search by CPF */}
            <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center space-x-2 flex-1 max-w-md">
                <input
                  type="text"
                  data-testid="debt-cpf-input"
                  value={debtCpfInput}
                  onChange={(e) => setDebtCpfInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchDebtCpf()}
                  placeholder="Digite o CPF do cliente para buscar carnê..."
                  className="flex-1 bg-slate-900 border border-slate-800 px-3 py-2 rounded-lg text-xs text-white placeholder-slate-500 font-mono outline-hidden focus:border-indigo-500"
                />
                <button
                  type="button"
                  data-testid="search-cpf-btn"
                  onClick={() => handleSearchDebtCpf()}
                  disabled={isDebtLoading}
                  className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isDebtLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  <span>Buscar Carnê</span>
                </button>
              </div>

              {debtCustomer && (
                <button
                  type="button"
                  data-testid="open-debt-payment-btn"
                  onClick={() => setIsDebtPaymentModalOpen(true)}
                  className="flex items-center space-x-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold transition shadow-xs cursor-pointer"
                >
                  <Receipt className="w-4 h-4" />
                  <span>Quitar Parcelas / Baixar Carnê</span>
                </button>
              )}
            </div>

            {debtError && (
              <div className="bg-rose-950/70 border border-rose-800 text-rose-300 p-4 rounded-xl flex items-center space-x-2.5 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{debtError}</span>
              </div>
            )}

            {/* Customer Details Banner */}
            {debtCustomer && (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                <div className="md:col-span-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Cliente / Titular
                  </span>
                  <span className="text-base font-black text-white block mt-0.5">
                    {debtCustomer.name}
                  </span>
                  <span className="text-slate-400 font-mono block text-[11px]">
                    CPF: {debtCustomer.cpf} • RG: {debtCustomer.rg || 'Não informado'}
                  </span>
                  {debtCustomer.agreement && (
                    <span className="text-indigo-400 font-semibold block text-[11px] mt-0.5">
                      Convênio: {debtCustomer.agreement.tradeName} ({debtCustomer.agreement.code})
                    </span>
                  )}
                </div>

                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Limite & Disponível
                  </span>
                  <div className="mt-1 space-y-0.5">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Limite:</span>
                      <span className="font-bold text-white">
                        {formatBrl(debtCustomer.creditLimit ?? debtCustomer.credit_limit ?? 0)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Disponível:</span>
                      <span className="font-bold text-emerald-400">
                        {formatBrl(
                          Math.max(
                            0,
                            (debtCustomer.creditLimit ?? debtCustomer.credit_limit ?? 0) -
                              (debtCustomer.currentDebt ?? debtCustomer.current_debt ?? 0)
                          )
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/80 flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Dívida Acumulada
                    </span>
                    <span className="text-xl font-black text-rose-400 block mt-0.5">
                      {formatBrl(debtCustomer.currentDebt ?? debtCustomer.current_debt ?? 0)}
                    </span>
                  </div>

                  <div>
                    {debtCustomer.status === 'ACTIVE' ? (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-950 text-emerald-400 border border-emerald-700">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>ATIVO PARA COMPRAS</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-950 text-rose-300 border border-rose-700">
                        <AlertTriangle className="w-3 h-3" />
                        <span>BLOQUEADO POR ATRASO</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Receivables Table */}
            {debtCustomer && (
              <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
                <div className="px-5 py-3.5 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between text-xs">
                  <span className="font-bold text-white uppercase tracking-wider">
                    Carnê de Parcelas do Cliente ({customerReceivables.length})
                  </span>
                </div>

                {customerReceivables.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 text-xs">
                    Nenhuma parcela registrada no carnê deste cliente.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300 divide-y divide-slate-800">
                      <thead className="bg-slate-900/40 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                        <tr>
                          <th className="px-4 py-3">Parcela</th>
                          <th className="px-4 py-3">Venda / Origem</th>
                          <th className="px-4 py-3">Vencimento</th>
                          <th className="px-4 py-3 text-right">Valor Original</th>
                          <th className="px-4 py-3 text-right">Valor Pago</th>
                          <th className="px-4 py-3 text-center">Status</th>
                          <th className="px-4 py-3 text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {customerReceivables.map((r) => {
                          const isOpen = r.status === 'OPEN';
                          const isOverdue = isOpen && new Date(r.dueDate) < new Date();

                          return (
                            <tr key={r.id} className="hover:bg-slate-900/40 transition">
                              <td className="px-4 py-3 font-bold text-white">
                                {r.installmentNumber}/{r.totalInstallments}
                              </td>
                              <td className="px-4 py-3 text-slate-400 font-mono">
                                {r.saleId ? `Venda #${r.saleId}` : 'Lançamento Manual'}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`font-semibold ${
                                    isOverdue ? 'text-rose-400 font-bold' : 'text-slate-300'
                                  }`}
                                >
                                  {new Date(r.dueDate).toLocaleDateString('pt-BR')}
                                  {isOverdue && ' (VENCIDA)'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-slate-200">
                                {formatBrl(r.originalAmount)}
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-emerald-400">
                                {formatBrl(r.paidAmount || 0)}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {isOpen ? (
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      isOverdue
                                        ? 'bg-rose-950 text-rose-300 border border-rose-700'
                                        : 'bg-amber-950 text-amber-300 border border-amber-700'
                                    }`}
                                  >
                                    {isOverdue ? 'EM ATRASO' : 'EM ABERTO'}
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700">
                                    QUITADA
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {r.saleId && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedSaleForPromissory(r.saleId!);
                                      setIsPromissoryModalOpen(true);
                                    }}
                                    title="Visualizar Nota Promissória Térmica"
                                    className="p-1.5 text-indigo-400 hover:text-indigo-300 hover:bg-slate-800 rounded transition cursor-pointer"
                                  >
                                    <FileText className="w-4 h-4" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sub-Modals */}
      <CustomerFormModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        customer={customerToEdit}
        agreements={agreements}
        onSaved={loadCustomers}
      />

      {customerForDependents && (
        <DependentsModal
          isOpen={isDependentsModalOpen}
          onClose={() => setIsDependentsModalOpen(false)}
          customer={customerForDependents}
          onUpdated={loadCustomers}
        />
      )}

      <AgreementFormModal
        isOpen={isAgreementModalOpen}
        onClose={() => setIsAgreementModalOpen(false)}
        agreement={agreementToEdit}
        onSaved={loadAgreements}
      />

      {agreementForInvoices && (
        <PayrollInvoiceModal
          isOpen={isInvoiceModalOpen}
          onClose={() => setIsInvoiceModalOpen(false)}
          agreement={agreementForInvoices}
        />
      )}

      {debtCustomer && (
        <DebtPaymentModal
          isOpen={isDebtPaymentModalOpen}
          onClose={() => setIsDebtPaymentModalOpen(false)}
          customer={debtCustomer}
          receivables={customerReceivables}
          onSettlementSuccess={handleSettlementSuccess}
        />
      )}

      <PromissoryNoteModal
        isOpen={isPromissoryModalOpen}
        onClose={() => setIsPromissoryModalOpen(false)}
        saleId={selectedSaleForPromissory || undefined}
      />
    </div>
  );
}
