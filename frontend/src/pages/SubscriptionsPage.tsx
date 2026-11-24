import React, { useState, useEffect, useCallback } from 'react';
import {
  Repeat,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Plus,
  RefreshCw,
  Search,
  Truck,
  Store,
  CreditCard,
  FileText,
  Clock,
  User,
  ShieldAlert,
  ChevronRight,
  Pause,
  Play,
  XCircle,
} from 'lucide-react';
import { subscriptionApi } from '../services/api';
import {
  SubscriptionListItem,
  SubscriptionDetail,
  SubscriptionKpis,
  ExpiringPrescriptionItem,
  ProcessRefillsResult,
  SubscriptionInterval,
  SubscriptionDeliveryMode,
  SubscriptionPaymentMethod,
} from '../types/subscription';

export const SubscriptionsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'cycles' | 'prescriptions'>('subscriptions');
  const [kpis, setKpis] = useState<SubscriptionKpis | null>(null);
  const [subscriptions, setSubscriptions] = useState<SubscriptionListItem[]>([]);
  const [expiringPrescriptions, setExpiringPrescriptions] = useState<ExpiringPrescriptionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  // Modais
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedSubDetail, setSelectedSubDetail] = useState<SubscriptionDetail | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [renewTargetItem, setRenewTargetItem] = useState<ExpiringPrescriptionItem | null>(null);
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);

  // Form Nova Assinatura
  const [formCustomerId, setFormCustomerId] = useState<number>(1);
  const [formStoreId, setFormStoreId] = useState<number>(1);
  const [formPlanName, setFormPlanName] = useState('Clube Hipertensão & Diabetes');
  const [formInterval, setFormInterval] = useState<SubscriptionInterval>(30);
  const [formPreferredDay, setFormPreferredDay] = useState<number>(5);
  const [formDeliveryMode, setFormDeliveryMode] = useState<SubscriptionDeliveryMode>('DELIVERY');
  const [formDeliveryAddress, setFormDeliveryAddress] = useState('Av. Brasil, 1500');
  const [formNeighborhood, setFormNeighborhood] = useState('Centro');
  const [formCity, setFormCity] = useState('São Paulo');
  const [formPaymentMethod, setFormPaymentMethod] = useState<SubscriptionPaymentMethod>('PIX_RECURRING');
  const [formDiscount, setFormDiscount] = useState<number>(10.0);
  const [formItems, setFormItems] = useState<
    Array<{
      product_id: number;
      product_name: string;
      quantity: number;
      unit_price: number;
      requires_prescription: boolean;
      prescription_doctor_crm?: string;
      prescription_doctor_uf?: string;
      prescription_expiry_date?: string;
    }>
  >([
    {
      product_id: 1,
      product_name: 'Losartana Potássica 50mg',
      quantity: 2,
      unit_price: 15.0,
      requires_prescription: false,
    },
  ]);

  // Form Renovar Receita
  const [renewCrm, setRenewCrm] = useState('123456');
  const [renewUf, setRenewUf] = useState('SP');
  const [renewExpiryDate, setRenewExpiryDate] = useState('2027-12-31');

  // Processador de Ciclos
  const [processDate, setProcessDate] = useState(new Date().toISOString().split('T')[0]);
  const [processResult, setProcessResult] = useState<ProcessRefillsResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Carregar dados
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [kpiRes, subList, expList] = await Promise.all([
        subscriptionApi.getSubscriptionKpis(),
        subscriptionApi.listSubscriptions({ status: statusFilter || undefined }),
        subscriptionApi.getExpiringPrescriptions(30),
      ]);
      setKpis(kpiRes);
      setSubscriptions(subList);
      setExpiringPrescriptions(expList);
    } catch (err) {
      console.error('Erro ao carregar dados do clube de assinaturas:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Ações de Assinatura
  const handleToggleStatus = async (sub: SubscriptionListItem) => {
    try {
      const nextStatus = sub.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
      await subscriptionApi.updateSubscriptionStatus(sub.id, nextStatus);
      loadData();
    } catch (err: any) {
      alert(`Erro ao alterar status: ${err.message}`);
    }
  };

  const handleOpenDetail = async (id: number) => {
    try {
      const detail = await subscriptionApi.getSubscription(id);
      setSelectedSubDetail(detail);
      setIsDetailModalOpen(true);
    } catch (err: any) {
      alert(`Erro ao buscar detalhes: ${err.message}`);
    }
  };

  // Submit Nova Assinatura
  const handleCreateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await subscriptionApi.createSubscription({
        customer_id: Number(formCustomerId),
        store_id: Number(formStoreId),
        plan_name: formPlanName,
        interval_days: formInterval,
        preferred_delivery_day: Number(formPreferredDay),
        delivery_mode: formDeliveryMode,
        delivery_address: formDeliveryAddress,
        delivery_neighborhood: formNeighborhood,
        delivery_city: formCity,
        payment_method: formPaymentMethod,
        discount_percentage: Number(formDiscount),
        items: formItems.map((it) => ({
          product_id: it.product_id,
          quantity: it.quantity,
          unit_price: it.unit_price,
          requires_prescription: it.requires_prescription,
          prescription_doctor_crm: it.prescription_doctor_crm,
          prescription_doctor_uf: it.prescription_doctor_uf,
          prescription_expiry_date: it.prescription_expiry_date,
        })),
      });

      setIsNewModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(`Erro ao cadastrar assinatura: ${err.message}`);
    }
  };

  // Submit Renovação de Receita
  const handleRenewPrescription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewTargetItem) return;
    try {
      await subscriptionApi.renewPrescription(renewTargetItem.item_id, {
        prescription_doctor_crm: renewCrm,
        prescription_doctor_uf: renewUf,
        prescription_expiry_date: renewExpiryDate,
      });
      setIsRenewModalOpen(false);
      setRenewTargetItem(null);
      loadData();
    } catch (err: any) {
      alert(`Erro ao renovar receita: ${err.message}`);
    }
  };

  // Disparo do Motor Diário de Reposições
  const handleProcessRefills = async () => {
    try {
      setIsProcessing(true);
      const res = await subscriptionApi.processScheduledRefills(processDate);
      setProcessResult(res);
      loadData();
    } catch (err: any) {
      alert(`Erro ao processar reposições: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredSubs = subscriptions.filter(
    (s) =>
      s.plan_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.customer_cpf.includes(searchTerm)
  );

  return (
    <div className="flex-1 bg-slate-50 min-h-screen p-6 text-slate-800">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-md">
              <Repeat className="w-6 h-6 animate-spin-slow" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Clube de Assinaturas & Reposição Recorrente
              </h1>
              <p className="text-sm text-slate-500">
                Automação de Tratamentos Crônicos, Entregas Agendadas & Compliance RDC 44/2009
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setActiveTab('cycles');
              handleProcessRefills();
            }}
            disabled={isProcessing}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg shadow-sm transition"
          >
            <RefreshCw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
            <span>Processar Reposições do Dia</span>
          </button>
          <button
            onClick={() => setIsNewModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Assinatura</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-sm font-medium">Assinaturas Ativas</span>
            <Repeat className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {kpis?.activeSubscriptions ?? 0}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {kpis?.pausedSubscriptions ?? 0} em pausa temporária
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-sm font-medium">MRR Recorrente Previsto</span>
            <CreditCard className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            R$ {kpis?.totalMonthlyRecurringRevenue.toFixed(2) ?? '0.00'}
          </div>
          <div className="text-xs text-emerald-600 mt-1">
            Receita previsível mensal
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-sm font-medium">Reposições no Mês</span>
            <CheckCircle className="w-5 h-5 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {kpis?.refillsProcessedThisMonth ?? 0}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Pré-vendas e pedidos faturados
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-sm font-medium">Receitas a Vencer (15d)</span>
            <AlertTriangle className={`w-5 h-5 ${(kpis?.expiringPrescriptionsNext15Days ?? 0) > 0 ? 'text-amber-500' : 'text-slate-400'}`} />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {kpis?.expiringPrescriptionsNext15Days ?? 0}
          </div>
          <div className="text-xs text-amber-600 mt-1">
            Exige renovação médica
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 mb-6">
        <button
          onClick={() => setActiveTab('subscriptions')}
          className={`flex items-center gap-2 px-4 py-3 font-semibold text-sm border-b-2 transition ${
            activeTab === 'subscriptions'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Repeat className="w-4 h-4" />
          <span>Contratos & Pacientes</span>
        </button>

        <button
          onClick={() => setActiveTab('cycles')}
          className={`flex items-center gap-2 px-4 py-3 font-semibold text-sm border-b-2 transition ${
            activeTab === 'cycles'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Esteira de Reposições & Motor Autoship</span>
        </button>

        <button
          onClick={() => setActiveTab('prescriptions')}
          className={`flex items-center gap-2 px-4 py-3 font-semibold text-sm border-b-2 transition ${
            activeTab === 'prescriptions'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Controle de Receitas de Uso Contínuo</span>
          {expiringPrescriptions.length > 0 && (
            <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-800 rounded-full font-bold">
              {expiringPrescriptions.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: ASSINATURAS */}
      {activeTab === 'subscriptions' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Buscar plano, paciente ou CPF..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Todos os Status</option>
                <option value="ACTIVE">Ativas</option>
                <option value="PAUSED">Pausadas</option>
                <option value="CANCELLED">Canceladas</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Plano / Contrato</th>
                  <th className="py-3 px-4">Paciente</th>
                  <th className="py-3 px-4">Ciclo</th>
                  <th className="py-3 px-4">Entrega / Canal</th>
                  <th className="py-3 px-4">Próxima Cobrança</th>
                  <th className="py-3 px-4">Valor Estimado</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSubs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-slate-400">
                      Nenhuma assinatura encontrada.
                    </td>
                  </tr>
                ) : (
                  filteredSubs.map((sub) => (
                    <tr key={sub.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-medium text-slate-900">
                        <div>{sub.plan_name}</div>
                        <div className="text-xs text-slate-400 font-normal">
                          {sub.item_count} medicamento(s) cadastrado(s)
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-900 font-medium">{sub.customer_name}</div>
                        <div className="text-xs text-slate-500">{sub.customer_cpf}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-semibold">
                          A cada {sub.interval_days} dias (Dia {sub.preferred_delivery_day})
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          {sub.delivery_mode === 'DELIVERY' ? (
                            <Truck className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Store className="w-4 h-4 text-blue-600" />
                          )}
                          <span className="text-xs font-medium">
                            {sub.delivery_mode === 'DELIVERY' ? 'Tele-Entrega' : 'Retirada em Loja'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400">
                          {sub.payment_method === 'PIX_RECURRING'
                            ? 'PIX Recorrente'
                            : sub.payment_method === 'CREDIT_CARD_TOKEN'
                            ? 'Cartão Crédito'
                            : 'Conveniado'}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{sub.next_billing_date}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        R$ {sub.total_recurring_amount.toFixed(2)}
                        {sub.discount_percentage > 0 && (
                          <span className="text-xs font-normal text-emerald-600 ml-1">
                            (-{sub.discount_percentage}%)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            sub.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : sub.status === 'PAUSED'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {sub.status === 'ACTIVE' ? 'Ativo' : sub.status === 'PAUSED' ? 'Pausado' : 'Cancelado'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleToggleStatus(sub)}
                            title={sub.status === 'ACTIVE' ? 'Pausar Assinatura' : 'Reativar Assinatura'}
                            className="p-1.5 hover:bg-slate-200 text-slate-600 rounded"
                          >
                            {sub.status === 'ACTIVE' ? <Pause className="w-4 h-4 text-amber-600" /> : <Play className="w-4 h-4 text-emerald-600" />}
                          </button>
                          <button
                            onClick={() => handleOpenDetail(sub.id)}
                            className="p-1.5 hover:bg-slate-200 text-indigo-600 rounded flex items-center gap-1 text-xs font-semibold"
                          >
                            <span>Detalhes</span>
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: ESTEIRA DE REPOSIÇÕES & MOTOR AUTOSHIP */}
      {activeTab === 'cycles' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-2">
              Processador Preditivo de Reposições Farmacêuticas
            </h2>
            <p className="text-sm text-slate-500 mb-6">
              Executa a varredura das assinaturas ativas com faturamento agendado até a data selecionada.
              Gera atômica a Pré-Venda no PDV, o Pedido de Tele-Entrega e valida a prescrição médica para itens de controle especial.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-slate-700">Data de Corte:</label>
                <input
                  type="date"
                  value={processDate}
                  onChange={(e) => setProcessDate(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <button
                onClick={handleProcessRefills}
                disabled={isProcessing}
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-sm transition"
              >
                <RefreshCw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
                <span>{isProcessing ? 'Processando...' : 'Executar Varredura Agora'}</span>
              </button>
            </div>
          </div>

          {processResult && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-md font-bold text-slate-900 mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <span>Resultado do Processamento ({processResult.currentDate})</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-xs text-slate-500">Varredura Total</div>
                  <div className="text-xl font-bold text-slate-900">{processResult.totalProcessed}</div>
                </div>
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                  <div className="text-xs text-emerald-700">Pré-Vendas Geradas</div>
                  <div className="text-xl font-bold text-emerald-800">{processResult.successCount}</div>
                </div>
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="text-xs text-amber-700">Pendência de Receita (RDC 44)</div>
                  <div className="text-xl font-bold text-amber-800">{processResult.prescriptionPendingCount}</div>
                </div>
                <div className="p-3 bg-rose-50 rounded-lg border border-rose-200">
                  <div className="text-xs text-rose-700">Falhas / Erros</div>
                  <div className="text-xl font-bold text-rose-800">{processResult.failedCount}</div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Assinatura / Paciente</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Pré-Venda</th>
                      <th className="py-2.5 px-3">Valor</th>
                      <th className="py-2.5 px-3">Observação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {processResult.details.map((d, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-medium text-slate-900">
                          {d.customerName} (ID #{d.subscriptionId})
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-bold ${
                              d.status === 'PROCESSED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : d.status === 'PRESCRIPTION_PENDING'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {d.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-xs text-indigo-600 font-bold">
                          {d.preSaleCode || '—'}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          R$ {d.totalAmount.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-xs text-slate-500">
                          {d.message || (d.deliveryOrderId ? 'Ordem de Entrega Gerada com Sucesso' : 'Retirada em Loja')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CONTROLE DE RECEITAS MÉDICAS */}
      {activeTab === 'prescriptions' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden p-6">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-900">
              Prescrições de Medicamentos de Uso Contínuo (RDC 44/2009 & Portaria 344/98)
            </h2>
            <p className="text-sm text-slate-500">
              Medicamentos sob controle especial só podem ser liberados na esteira recorrente com receita médica válida dentro do prazo legal.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Paciente</th>
                  <th className="py-3 px-4">Medicamento Controlado</th>
                  <th className="py-3 px-4">Médico / CRM</th>
                  <th className="py-3 px-4">Validade da Receita</th>
                  <th className="py-3 px-4">Situação Sanitária</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expiringPrescriptions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-400">
                      Nenhuma prescrição com vencimento nos próximos 30 dias.
                    </td>
                  </tr>
                ) : (
                  expiringPrescriptions.map((item) => (
                    <tr key={item.item_id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{item.customer_name}</div>
                        <div className="text-xs text-slate-500">{item.customer_phone}</div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {item.product_name}
                      </td>
                      <td className="py-3 px-4">
                        CRM {item.prescription_doctor_crm || '—'} / {item.prescription_doctor_uf || '—'}
                      </td>
                      <td className="py-3 px-4 font-mono font-medium">
                        {item.prescription_expiry_date}
                      </td>
                      <td className="py-3 px-4">
                        {item.is_expired ? (
                          <span className="px-2.5 py-1 bg-rose-100 text-rose-800 rounded-full text-xs font-bold flex items-center gap-1 w-max">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Vencida há {Math.abs(item.days_until_expiry)} dias</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold flex items-center gap-1 w-max">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Vence em {item.days_until_expiry} dias</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            setRenewTargetItem(item);
                            setRenewCrm(item.prescription_doctor_crm || '123456');
                            setRenewUf(item.prescription_doctor_uf || 'SP');
                            setIsRenewModalOpen(true);
                          }}
                          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold transition"
                        >
                          Renovar Receita
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL DETALHES DA ASSINATURA */}
      {isDetailModalOpen && selectedSubDetail && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xl font-bold text-slate-900">{selectedSubDetail.plan_name}</h3>
                <p className="text-sm text-slate-500">
                  {selectedSubDetail.customer_name} ({selectedSubDetail.customer_cpf})
                </p>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <div className="mb-6">
              <h4 className="text-sm font-bold text-slate-800 mb-2">Medicamentos na Cesta Recorrente</h4>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 font-semibold text-slate-600">
                    <tr>
                      <th className="py-2 px-3">Medicamento</th>
                      <th className="py-2 px-3">Qtd</th>
                      <th className="py-2 px-3">Preço Unit.</th>
                      <th className="py-2 px-3">Controle / Receita</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedSubDetail.items.map((it) => (
                      <tr key={it.id}>
                        <td className="py-2 px-3 font-medium text-slate-900">{it.product_name}</td>
                        <td className="py-2 px-3">{it.quantity}</td>
                        <td className="py-2 px-3">R$ {it.unit_price.toFixed(2)}</td>
                        <td className="py-2 px-3 text-xs">
                          {it.requires_prescription === 1 ? (
                            <span className="text-amber-700 font-semibold">
                              Exige Receita (CRM: {it.prescription_doctor_crm || '—'} / Val: {it.prescription_expiry_date || '—'})
                            </span>
                          ) : (
                            <span className="text-slate-400">Uso Livre / Isento</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-slate-800 mb-2">Histórico de Ciclos e Faturamento</h4>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 font-semibold text-slate-600">
                    <tr>
                      <th className="py-2 px-3">Ciclo</th>
                      <th className="py-2 px-3">Data Agendada</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Pré-Venda</th>
                      <th className="py-2 px-3">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedSubDetail.cycles.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-slate-400">
                          Nenhum ciclo executado ainda.
                        </td>
                      </tr>
                    ) : (
                      selectedSubDetail.cycles.map((c) => (
                        <tr key={c.id}>
                          <td className="py-2 px-3 font-medium">#{c.cycle_number}</td>
                          <td className="py-2 px-3">{c.scheduled_date}</td>
                          <td className="py-2 px-3">
                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-100">
                              {c.status}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono text-xs">{c.pre_sale_code || '—'}</td>
                          <td className="py-2 px-3 font-bold">R$ {c.total_amount.toFixed(2)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOVA ASSINATURA */}
      {isNewModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
              <h3 className="text-xl font-bold text-slate-900">Nova Assinatura de Paciente</h3>
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubscription} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nome do Plano</label>
                  <input
                    type="text"
                    required
                    value={formPlanName}
                    onChange={(e) => setFormPlanName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ID do Paciente / Cliente</label>
                  <input
                    type="number"
                    required
                    value={formCustomerId}
                    onChange={(e) => setFormCustomerId(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Ciclo de Reposição</label>
                  <select
                    value={formInterval}
                    onChange={(e) => setFormInterval(Number(e.target.value) as SubscriptionInterval)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value={15}>A cada 15 dias</option>
                    <option value={30}>A cada 30 dias (Mensal)</option>
                    <option value={60}>A cada 60 dias (Bimestral)</option>
                    <option value={90}>A cada 90 dias (Trimestral)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Dia Preferido de Entrega</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={formPreferredDay}
                    onChange={(e) => setFormPreferredDay(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Desconto de Assinante (%)</label>
                  <input
                    type="number"
                    step="0.5"
                    min={0}
                    max={50}
                    value={formDiscount}
                    onChange={(e) => setFormDiscount(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Canal de Atendimento</label>
                  <select
                    value={formDeliveryMode}
                    onChange={(e) => setFormDeliveryMode(e.target.value as SubscriptionDeliveryMode)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="DELIVERY">Tele-Entrega Farmacêutica</option>
                    <option value="STORE_PICKUP">Retirada no Balcão</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Forma de Pagamento</label>
                  <select
                    value={formPaymentMethod}
                    onChange={(e) => setFormPaymentMethod(e.target.value as SubscriptionPaymentMethod)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="PIX_RECURRING">PIX Recorrente</option>
                    <option value="CREDIT_CARD_TOKEN">Cartão de Crédito</option>
                    <option value="CONVENIO_CREDIARIO">Convênio / Carnê Crediário</option>
                    <option value="CASH_ON_DELIVERY">Dinheiro na Entrega</option>
                  </select>
                </div>
              </div>

              {formDeliveryMode === 'DELIVERY' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Endereço de Entrega</label>
                  <input
                    type="text"
                    value={formDeliveryAddress}
                    onChange={(e) => setFormDeliveryAddress(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

              <div className="border-t border-slate-100 pt-4">
                <h4 className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">
                  Medicamentos Programados ({formItems.length})
                </h4>
                {formItems.map((it, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2">
                    <div className="flex justify-between font-bold">
                      <span>{it.product_name}</span>
                      <span>Qtd: {it.quantity} x R$ {it.unit_price.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-sm shadow-sm"
                >
                  Confirmar Assinatura
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL RENOVAÇÃO DE RECEITA */}
      {isRenewModalOpen && renewTargetItem && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">Renovar Prescrição Médica</h3>
              <button
                onClick={() => setIsRenewModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRenewPrescription} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500">Paciente</label>
                <div className="text-sm font-bold text-slate-800">{renewTargetItem.customer_name}</div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500">Medicamento</label>
                <div className="text-sm font-semibold text-slate-800">{renewTargetItem.product_name}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">CRM do Médico</label>
                  <input
                    type="text"
                    required
                    value={renewCrm}
                    onChange={(e) => setRenewCrm(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">UF do CRM</label>
                  <input
                    type="text"
                    maxLength={2}
                    required
                    value={renewUf}
                    onChange={(e) => setRenewUf(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nova Validade da Receita</label>
                <input
                  type="date"
                  required
                  value={renewExpiryDate}
                  onChange={(e) => setRenewExpiryDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRenewModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-sm shadow-sm"
                >
                  Salvar Renovação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionsPage;
