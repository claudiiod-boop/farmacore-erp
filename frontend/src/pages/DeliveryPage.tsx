import { useState, useEffect, useCallback } from 'react';
import {
  Bike,
  Package,
  Truck,
  Ban,
  Plus,
  RefreshCw,
  Search,
  Receipt,
  FileText,
  MapPin,
  ChevronRight,
  Printer,
  Edit2,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { deliveryApi } from '../services/api';
import { useStore } from '../contexts/StoreContext';
import type {
  DeliveryOrder,
  Courier,
  DeliveryZone,
  DeliveryDispatch,
  DeliveryDispatchWithOrders,
  DeliveryOrderStatus,
  CourierStatus,
} from '../types';

import NewDeliveryOrderModal from '../components/delivery/NewDeliveryOrderModal';
import DispatchModal from '../components/delivery/DispatchModal';
import SettlementModal from '../components/delivery/SettlementModal';
import CourierModal from '../components/delivery/CourierModal';
import ZoneModal from '../components/delivery/ZoneModal';
import OrderSlipModal from '../components/delivery/OrderSlipModal';

type DeliveryTab = 'kanban' | 'routing' | 'settlement' | 'couriers-zones';

function useSafeStore() {
  try {
    return useStore();
  } catch {
    return { currentStore: { id: 1, name: 'DROGARIA FARMACORE MATRIZ' } } as any;
  }
}

export default function DeliveryPage() {
  const { currentStore } = useSafeStore();
  const storeId = currentStore?.id ?? 1;

  // Active Tab
  const [activeTab, setActiveTab] = useState<DeliveryTab>('kanban');

  // Core Data
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [dispatches, setDispatches] = useState<DeliveryDispatch[]>([]);

  // Loading & Error States
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modals state
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [selectedOrdersForDispatch, setSelectedOrdersForDispatch] = useState<DeliveryOrder[]>([]);

  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false);
  const [activeDispatchForSettlement, setActiveDispatchForSettlement] =
    useState<DeliveryDispatchWithOrders | null>(null);

  const [isCourierModalOpen, setIsCourierModalOpen] = useState(false);
  const [selectedCourier, setSelectedCourier] = useState<Courier | null>(null);

  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false);
  const [selectedZone, setSelectedZone] = useState<DeliveryZone | null>(null);

  const [isSlipModalOpen, setIsSlipModalOpen] = useState(false);
  const [selectedOrderForSlip, setSelectedOrderForSlip] = useState<DeliveryOrder | null>(null);

  // Dispatch slip preview modal state
  const [viewingDispatchSlip, setViewingDispatchSlip] = useState<string | null>(null);

  // Cancel order prompt
  const [cancelOrderId, setCancelOrderId] = useState<number | null>(null);
  const [cancellationReason, setCancellationReason] = useState('Cancelado a pedido do cliente');

  // Load all module data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersRes, couriersRes, zonesRes, dispatchesRes] = await Promise.all([
        deliveryApi.getOrders({ storeId }).catch(() => []),
        deliveryApi.getCouriers({ storeId }).catch(() => []),
        deliveryApi.getZones(storeId).catch(() => []),
        deliveryApi.getDispatches({ storeId }).catch(() => []),
      ]);
      setOrders(ordersRes);
      setCouriers(couriersRes);
      setZones(zonesRes);
      setDispatches(dispatchesRes);
    } catch {
      // Graceful error handling
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Advance Order Status handler
  const handleAdvanceStatus = async (order: DeliveryOrder) => {
    const currentStatus = order.status;
    let nextStatus: DeliveryOrderStatus | null = null;

    if (currentStatus === 'RECEIVED') nextStatus = 'PREPARING';
    else if (currentStatus === 'PREPARING') nextStatus = 'READY_FOR_PICKUP';
    else if (currentStatus === 'DISPATCHED') nextStatus = 'DELIVERED';

    if (!nextStatus) return;

    try {
      const updated = await deliveryApi.updateOrderStatus(order.id, {
        status: nextStatus,
      });
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    } catch (err: any) {
      alert(err?.message || 'Erro ao avançar status do pedido.');
    }
  };

  // Open Dispatch Modal with specific or all ready orders
  const handleOpenDispatch = (specificOrder?: DeliveryOrder) => {
    const ready = orders.filter((o) => o.status === 'READY_FOR_PICKUP');
    if (specificOrder) {
      setSelectedOrdersForDispatch([specificOrder]);
    } else {
      setSelectedOrdersForDispatch(ready);
    }
    setIsDispatchModalOpen(true);
  };

  // Cancel Order handler
  const handleConfirmCancel = async () => {
    if (!cancelOrderId) return;
    try {
      const cancelled = await deliveryApi.cancelOrder(cancelOrderId, cancellationReason);
      setOrders((prev) => prev.map((o) => (o.id === cancelled.id ? cancelled : o)));
      setCancelOrderId(null);
    } catch (err: any) {
      alert(err?.message || 'Erro ao cancelar pedido.');
    }
  };

  // Settle Dispatch handler (opens modal with complete dispatch)
  const handleOpenSettlement = async (dispatchId: number) => {
    try {
      const fullDispatch = await deliveryApi.getDispatchById(dispatchId);
      setActiveDispatchForSettlement(fullDispatch);
      setIsSettlementModalOpen(true);
    } catch (err: any) {
      alert(err?.message || 'Erro ao carregar detalhes do romaneio para acerto.');
    }
  };

  // Re-print dispatch slip
  const handleViewDispatchSlip = async (dispatchId: number) => {
    try {
      const res = await deliveryApi.getDispatchSlip(dispatchId);
      setViewingDispatchSlip(res.textReceipt);
    } catch (err: any) {
      alert(err?.message || 'Erro ao carregar romaneio térmico.');
    }
  };

  // Toggle courier status
  const handleToggleCourierStatus = async (courier: Courier) => {
    const nextStatus: CourierStatus =
      courier.status === 'AVAILABLE'
        ? 'INACTIVE'
        : courier.status === 'INACTIVE'
        ? 'AVAILABLE'
        : 'AVAILABLE';

    try {
      const updated = await deliveryApi.updateCourierStatus(courier.id, nextStatus);
      setCouriers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } catch (err: any) {
      alert(err?.message || 'Erro ao atualizar status do entregador.');
    }
  };

  // Delete zone
  const handleDeleteZone = async (zoneId: number) => {
    if (!window.confirm('Deseja realmente remover esta zona de entrega?')) return;
    try {
      await deliveryApi.deleteZone(zoneId);
      setZones((prev) => prev.filter((z) => z.id !== zoneId));
    } catch (err: any) {
      alert(err?.message || 'Erro ao remover zona.');
    }
  };

  // Filtered orders for search
  const filteredOrders = orders.filter((o) => {
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchName = (o.customerName ?? o.customer_name ?? '').toLowerCase().includes(term);
      const matchPhone = (o.customerPhone ?? o.customer_phone ?? '').includes(term);
      const matchNumber = (o.orderNumber ?? o.order_number ?? '').toLowerCase().includes(term);
      const matchNeighborhood = (o.neighborhood ?? '').toLowerCase().includes(term);
      if (!matchName && !matchPhone && !matchNumber && !matchNeighborhood) return false;
    }
    if (statusFilter !== 'ALL' && o.status !== statusFilter) return false;
    return true;
  });

  // Kanban Columns
  const receivedOrders = filteredOrders.filter((o) => o.status === 'RECEIVED');
  const preparingOrders = filteredOrders.filter((o) => o.status === 'PREPARING');
  const readyOrders = filteredOrders.filter((o) => o.status === 'READY_FOR_PICKUP');
  const dispatchedOrders = filteredOrders.filter((o) => o.status === 'DISPATCHED');
  const finishedOrders = filteredOrders.filter(
    (o) => o.status === 'DELIVERED' || o.status === 'RETURNED' || o.status === 'CANCELLED'
  );

  return (
    <div
      className="flex-1 flex flex-col bg-slate-900 text-slate-100 min-h-0 overflow-hidden"
      data-testid="delivery-page"
    >
      {/* Top Header / Bar */}
      <div className="bg-slate-950 border-b border-slate-800 px-5 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
            <Bike className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-black text-white tracking-wide">
                [F11] Central de Delivery & Tele-Entrega Farmacêutica
              </h1>
              <span className="bg-amber-950 text-amber-400 border border-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                Posto F11
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Kanban de pedidos, despacho de motoboys, zonas de frete e acerto de caixa
            </p>
          </div>
        </div>

        {/* Global Action: Novo Pedido & Refresh */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            data-testid="refresh-delivery-button"
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition cursor-pointer"
            title="Atualizar dados (F5)"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setIsNewOrderModalOpen(true)}
            data-testid="new-delivery-order-button"
            className="flex items-center space-x-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg shadow-md transition text-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Pedido [F11]</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="bg-slate-950/80 border-b border-slate-800 px-5 flex items-center justify-between gap-4">
        <div className="flex space-x-1">
          <button
            type="button"
            onClick={() => setActiveTab('kanban')}
            data-testid="tab-kanban"
            className={`flex items-center space-x-2 px-4 py-3 text-xs font-bold border-b-2 transition cursor-pointer ${
              activeTab === 'kanban'
                ? 'border-amber-500 text-amber-400 bg-amber-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>1. Central de Pedidos (Kanban)</span>
            <span className="bg-slate-800 px-1.5 py-0.5 rounded-full text-[10px] text-slate-300">
              {orders.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('routing')}
            data-testid="tab-routing"
            className={`flex items-center space-x-2 px-4 py-3 text-xs font-bold border-b-2 transition cursor-pointer ${
              activeTab === 'routing'
                ? 'border-amber-500 text-amber-400 bg-amber-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>2. Roteirização & Despacho</span>
            {readyOrders.length > 0 && (
              <span className="bg-amber-600 text-white px-1.5 py-0.5 rounded-full text-[10px] font-bold animate-pulse">
                {readyOrders.length} prontos
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settlement')}
            data-testid="tab-settlement"
            className={`flex items-center space-x-2 px-4 py-3 text-xs font-bold border-b-2 transition cursor-pointer ${
              activeTab === 'settlement'
                ? 'border-amber-500 text-amber-400 bg-amber-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>3. Acerto de Contas no Caixa</span>
            <span className="bg-slate-800 px-1.5 py-0.5 rounded-full text-[10px] text-slate-300">
              {dispatches.filter((d) => d.status === 'OPEN').length} abertos
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('couriers-zones')}
            data-testid="tab-couriers-zones"
            className={`flex items-center space-x-2 px-4 py-3 text-xs font-bold border-b-2 transition cursor-pointer ${
              activeTab === 'couriers-zones'
                ? 'border-amber-500 text-amber-400 bg-amber-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>4. Entregadores & Zonas</span>
          </button>
        </div>

        {/* Search bar inside header when in kanban tab */}
        {activeTab === 'kanban' && (
          <div className="flex items-center space-x-2 py-1.5">
            <select
              data-testid="kanban-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-hidden focus:border-amber-500 cursor-pointer"
            >
              <option value="ALL">Todos os Status</option>
              <option value="RECEIVED">Recebidos</option>
              <option value="PREPARING">Em Separação</option>
              <option value="READY_FOR_PICKUP">Prontos</option>
              <option value="DISPATCHED">Em Rota</option>
              <option value="DELIVERED">Entregues</option>
            </select>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                data-testid="kanban-search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar cliente, telefone, pedido..."
                className="bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500 w-56"
              />
            </div>
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-hidden p-4">
        {/* TAB 1: KANBAN DE ENTREGAS */}
        {activeTab === 'kanban' && (
          <div className="h-full flex gap-3 overflow-x-auto pb-2 select-none" data-testid="kanban-board">
            {/* Column 1: Recebidos */}
            <KanbanColumn
              title="Recebidos"
              color="border-blue-500"
              count={receivedOrders.length}
              orders={receivedOrders}
              onAdvance={handleAdvanceStatus}
              advanceLabel="Iniciar Separação"
              onSlip={(ord) => {
                setSelectedOrderForSlip(ord);
                setIsSlipModalOpen(true);
              }}
              onCancel={(ord) => setCancelOrderId(ord.id)}
            />

            {/* Column 2: Em Separação */}
            <KanbanColumn
              title="Em Separação"
              color="border-purple-500"
              count={preparingOrders.length}
              orders={preparingOrders}
              onAdvance={handleAdvanceStatus}
              advanceLabel="Pronto p/ Despacho"
              onSlip={(ord) => {
                setSelectedOrderForSlip(ord);
                setIsSlipModalOpen(true);
              }}
              onCancel={(ord) => setCancelOrderId(ord.id)}
            />

            {/* Column 3: Pronto p/ Despacho */}
            <KanbanColumn
              title="Pronto p/ Despacho"
              color="border-amber-500"
              count={readyOrders.length}
              orders={readyOrders}
              onAdvance={handleOpenDispatch}
              advanceLabel="Despachar no Romaneio"
              onSlip={(ord) => {
                setSelectedOrderForSlip(ord);
                setIsSlipModalOpen(true);
              }}
              onCancel={(ord) => setCancelOrderId(ord.id)}
            />

            {/* Column 4: Em Rota */}
            <KanbanColumn
              title="Em Rota (Motoboy)"
              color="border-indigo-500"
              count={dispatchedOrders.length}
              orders={dispatchedOrders}
              onAdvance={handleAdvanceStatus}
              advanceLabel="Confirmar Entrega"
              onSlip={(ord) => {
                setSelectedOrderForSlip(ord);
                setIsSlipModalOpen(true);
              }}
              onCancel={(ord) => setCancelOrderId(ord.id)}
            />

            {/* Column 5: Concluídos */}
            <KanbanColumn
              title="Concluídos / Histórico"
              color="border-emerald-500"
              count={finishedOrders.length}
              orders={finishedOrders}
              onSlip={(ord) => {
                setSelectedOrderForSlip(ord);
                setIsSlipModalOpen(true);
              }}
            />
          </div>
        )}

        {/* TAB 2: ROTEIRIZAÇÃO & DESPACHO */}
        {activeTab === 'routing' && (
          <div className="h-full flex flex-col space-y-4 overflow-y-auto" data-testid="routing-view">
            {/* Action Banner */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center space-x-2">
                  <Truck className="w-4 h-4 text-amber-400" />
                  <span>Roteirização de Pedidos Prontos para Saída</span>
                </h2>
                <p className="text-xs text-slate-400">
                  {readyOrders.length} pedidos aguardando agrupamento em romaneio térmico.
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleOpenDispatch()}
                disabled={readyOrders.length === 0}
                data-testid="create-dispatch-button"
                className="flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition shadow-sm cursor-pointer disabled:opacity-50"
              >
                <Truck className="w-4 h-4" />
                <span>Gerar Romaneio de Despacho ({readyOrders.length})</span>
              </button>
            </div>

            {/* Table of Dispatches */}
            <div className="bg-slate-950 rounded-xl border border-slate-800 flex-1 flex flex-col overflow-hidden">
              <div className="p-3 border-b border-slate-800 font-bold text-xs text-slate-300">
                Romaneios de Despacho Gerados
              </div>
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-left text-xs" data-testid="dispatches-table">
                  <thead className="bg-slate-900 text-slate-400 sticky top-0">
                    <tr>
                      <th className="py-2.5 px-4">Romaneio #</th>
                      <th className="py-2.5 px-3">Entregador</th>
                      <th className="py-2.5 px-3 text-center">Pedidos</th>
                      <th className="py-2.5 px-3 text-right">Total a Cobrar</th>
                      <th className="py-2.5 px-3 text-right">Troco Fornecido</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3">Saída</th>
                      <th className="py-2.5 px-4 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {dispatches.map((disp) => {
                      const courier = couriers.find((c) => c.id === disp.courierId);
                      return (
                        <tr key={disp.id} className="hover:bg-slate-900/60">
                          <td className="py-2.5 px-4 font-mono font-bold text-white">
                            {disp.dispatchNumber ?? disp.dispatch_number}
                          </td>
                          <td className="py-2.5 px-3 text-slate-200">
                            {courier?.name || `ID #${disp.courierId}`}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-white">
                            {disp.totalOrders ?? disp.total_orders ?? 0}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-amber-400">
                            R$ {(disp.totalAmount ?? disp.total_amount ?? 0).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-emerald-400">
                            R$ {(disp.totalChangeProvided ?? disp.total_change_provided ?? 0).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                disp.status === 'OPEN'
                                  ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                  : disp.status === 'SETTLED'
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                  : 'bg-red-950 text-red-300 border border-red-800'
                              }`}
                            >
                              {disp.status === 'OPEN'
                                ? 'Em Rota'
                                : disp.status === 'SETTLED'
                                ? 'Liquidado'
                                : 'Cancelado'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                            {new Date(disp.dispatchedAt ?? disp.dispatched_at ?? '').toLocaleTimeString()}
                          </td>
                          <td className="py-2.5 px-4 text-center space-x-2">
                            <button
                              type="button"
                              onClick={() => handleViewDispatchSlip(disp.id)}
                              className="text-amber-400 hover:text-amber-300 p-1 rounded hover:bg-slate-800 cursor-pointer inline-flex items-center space-x-1"
                              title="Visualizar / Reimprimir Romaneio"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span className="text-[11px]">Romaneio</span>
                            </button>
                            {disp.status === 'OPEN' && (
                              <button
                                type="button"
                                onClick={() => handleOpenSettlement(disp.id)}
                                className="text-emerald-400 hover:text-emerald-300 p-1 rounded hover:bg-slate-800 cursor-pointer inline-flex items-center space-x-1"
                                title="Liquidar no Caixa"
                              >
                                <Receipt className="w-3.5 h-3.5" />
                                <span className="text-[11px]">Acerto</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {dispatches.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-500">
                          Nenhum romaneio gerado nesta loja.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: ACERTO DE CONTAS NO CAIXA */}
        {activeTab === 'settlement' && (
          <div className="h-full flex flex-col space-y-4 overflow-y-auto" data-testid="settlement-view">
            {/* Open Dispatches Section */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center space-x-2">
                    <Receipt className="w-4 h-4 text-amber-400" />
                    <span>Romaneios em Aberto Aguardando Acerto no Caixa</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Conferência de recebimentos em espécie, cartão e pix no fechamento de rota
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {dispatches
                  .filter((d) => d.status === 'OPEN')
                  .map((disp) => {
                    const courier = couriers.find((c) => c.id === disp.courierId);
                    return (
                      <div
                        key={disp.id}
                        className="bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-xl p-4 flex flex-col justify-between space-y-3"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-mono font-bold text-amber-400 text-sm">
                              #{disp.dispatchNumber ?? disp.dispatch_number}
                            </span>
                            <h4 className="text-xs font-bold text-white mt-1">
                              {courier?.name || `Motoboy #${disp.courierId}`}
                            </h4>
                          </div>
                          <span className="bg-amber-950 text-amber-300 border border-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            Em Aberto
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                          <div>
                            <span className="text-slate-400 block">Total a Cobrar:</span>
                            <span className="font-bold text-white">
                              R$ {(disp.totalAmount ?? disp.total_amount ?? 0).toFixed(2)}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Qtd Pedidos:</span>
                            <span className="font-bold text-white">
                              {disp.totalOrders ?? disp.total_orders ?? 0} pedidos
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleOpenSettlement(disp.id)}
                          data-testid={`settle-dispatch-btn-${disp.id}`}
                          className="w-full flex items-center justify-center space-x-1.5 py-2 px-3 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition shadow-sm cursor-pointer"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          <span>Realizar Acerto no Caixa</span>
                        </button>
                      </div>
                    );
                  })}
                {dispatches.filter((d) => d.status === 'OPEN').length === 0 && (
                  <div className="col-span-full py-8 text-center text-slate-500 text-xs">
                    Nenhum romaneio em aberto pendente de acerto no caixa.
                  </div>
                )}
              </div>
            </div>

            {/* Settled History */}
            <div className="bg-slate-950 rounded-xl border border-slate-800 flex-1 flex flex-col overflow-hidden">
              <div className="p-3 border-b border-slate-800 font-bold text-xs text-slate-300">
                Histórico de Romaneios Liquidados
              </div>
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-400 sticky top-0">
                    <tr>
                      <th className="py-2.5 px-4">Romaneio #</th>
                      <th className="py-2.5 px-3">Entregador</th>
                      <th className="py-2.5 px-3 text-right">Dinheiro</th>
                      <th className="py-2.5 px-3 text-right">Cartão</th>
                      <th className="py-2.5 px-3 text-right">PIX</th>
                      <th className="py-2.5 px-3 text-right">Comissão Paga</th>
                      <th className="py-2.5 px-3">Liquidado Em</th>
                      <th className="py-2.5 px-4 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {dispatches
                      .filter((d) => d.status === 'SETTLED')
                      .map((disp) => {
                        const courier = couriers.find((c) => c.id === disp.courierId);
                        return (
                          <tr key={disp.id} className="hover:bg-slate-900/60">
                            <td className="py-2.5 px-4 font-mono font-bold text-white">
                              {disp.dispatchNumber ?? disp.dispatch_number}
                            </td>
                            <td className="py-2.5 px-3 text-slate-200">
                              {courier?.name || `ID #${disp.courierId}`}
                            </td>
                            <td className="py-2.5 px-3 text-right text-emerald-400">
                              R$ {(disp.collectedCash ?? disp.collected_cash ?? 0).toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-right text-blue-400">
                              R$ {(disp.collectedCard ?? disp.collected_card ?? 0).toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-right text-purple-400">
                              R$ {(disp.collectedPix ?? disp.collected_pix ?? 0).toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-amber-400">
                              R$ {(disp.totalCommission ?? disp.total_commission ?? 0).toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                              {disp.settledAt ?? disp.settled_at
                                ? new Date(disp.settledAt ?? disp.settled_at!).toLocaleString()
                                : '-'}
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => handleViewDispatchSlip(disp.id)}
                                className="text-amber-400 hover:text-amber-300 p-1 rounded hover:bg-slate-800 cursor-pointer inline-flex items-center space-x-1"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>Ver Recibo</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    {dispatches.filter((d) => d.status === 'SETTLED').length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-500">
                          Nenhum romaneio liquidado no histórico.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: ENTREGADORES & ZONAS */}
        {activeTab === 'couriers-zones' && (
          <div
            className="h-full grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-y-auto"
            data-testid="couriers-zones-view"
          >
            {/* Couriers Panel */}
            <div className="bg-slate-950 rounded-xl border border-slate-800 flex flex-col overflow-hidden">
              <div className="p-3 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Bike className="w-4 h-4 text-amber-400" />
                  <span className="font-bold text-xs text-white">
                    Entregadores e Motoboys ({couriers.length})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCourier(null);
                    setIsCourierModalOpen(true);
                  }}
                  data-testid="add-courier-button"
                  className="flex items-center space-x-1 px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Novo Entregador</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-left text-xs" data-testid="couriers-table">
                  <thead className="bg-slate-900 text-slate-400 sticky top-0">
                    <tr>
                      <th className="py-2 px-3">Nome</th>
                      <th className="py-2 px-2">Veículo</th>
                      <th className="py-2 px-2 text-right">Comissão</th>
                      <th className="py-2 px-2 text-center">Status</th>
                      <th className="py-2 px-3 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {couriers.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-900/60">
                        <td className="py-2 px-3">
                          <div className="font-bold text-white">{c.name}</div>
                          <div className="text-[10px] text-slate-400">{c.phone}</div>
                        </td>
                        <td className="py-2 px-2 text-slate-300">
                          {c.vehicleType || 'MOTO'}{' '}
                          {c.vehiclePlate ? `(${c.vehiclePlate})` : ''}
                        </td>
                        <td className="py-2 px-2 text-right text-amber-400 font-bold">
                          R$ {(c.commissionPerDelivery ?? 5).toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleCourierStatus(c)}
                            title="Alternar disponibilidade"
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer ${
                              c.status === 'AVAILABLE'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : c.status === 'ON_DELIVERY'
                                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            {c.status === 'AVAILABLE'
                              ? 'Disponível'
                              : c.status === 'ON_DELIVERY'
                              ? 'Em Rota'
                              : 'Inativo'}
                          </button>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCourier(c);
                              setIsCourierModalOpen(true);
                            }}
                            className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 cursor-pointer"
                            title="Editar"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {couriers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-500">
                          Nenhum entregador cadastrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Zones Panel */}
            <div className="bg-slate-950 rounded-xl border border-slate-800 flex flex-col overflow-hidden">
              <div className="p-3 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <MapPin className="w-4 h-4 text-amber-400" />
                  <span className="font-bold text-xs text-white">
                    Zonas & Bairros de Entrega ({zones.length})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedZone(null);
                    setIsZoneModalOpen(true);
                  }}
                  data-testid="add-zone-button"
                  className="flex items-center space-x-1 px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nova Zona</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-left text-xs" data-testid="zones-table">
                  <thead className="bg-slate-900 text-slate-400 sticky top-0">
                    <tr>
                      <th className="py-2 px-3">Bairro / Zona</th>
                      <th className="py-2 px-2 text-right">Taxa Frete</th>
                      <th className="py-2 px-2 text-center">Tempo Est.</th>
                      <th className="py-2 px-2 text-right">Frete Grátis</th>
                      <th className="py-2 px-3 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {zones.map((z) => (
                      <tr key={z.id} className="hover:bg-slate-900/60">
                        <td className="py-2 px-3">
                          <div className="font-bold text-white">{z.neighborhood}</div>
                          <div className="text-[10px] text-slate-400">
                            {z.name} - {z.city}/{z.state}
                          </div>
                        </td>
                        <td className="py-2 px-2 text-right text-amber-400 font-bold">
                          R$ {(z.deliveryFee ?? z.delivery_fee ?? 0).toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-center text-slate-300">
                          {z.estimatedMinutes ?? z.estimated_minutes ?? 30} min
                        </td>
                        <td className="py-2 px-2 text-right text-emerald-400">
                          {z.freeShippingThreshold ?? z.free_shipping_threshold
                            ? `≥ R$ ${(z.freeShippingThreshold ?? z.free_shipping_threshold)!.toFixed(2)}`
                            : '-'}
                        </td>
                        <td className="py-2 px-3 text-center space-x-1">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedZone(z);
                              setIsZoneModalOpen(true);
                            }}
                            className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 cursor-pointer"
                            title="Editar"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteZone(z.id)}
                            className="text-red-400 hover:text-red-300 p-1 rounded hover:bg-slate-800 cursor-pointer"
                            title="Remover"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {zones.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-500">
                          Nenhuma zona de entrega cadastrada.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODALS */}

      {/* 1. New Delivery Order Modal */}
      <NewDeliveryOrderModal
        isOpen={isNewOrderModalOpen}
        onClose={() => setIsNewOrderModalOpen(false)}
        storeId={storeId}
        onOrderCreated={(newOrd) => {
          setOrders((prev) => [newOrd, ...prev]);
        }}
      />

      {/* 2. Dispatch Modal */}
      <DispatchModal
        isOpen={isDispatchModalOpen}
        onClose={() => setIsDispatchModalOpen(false)}
        readyOrders={selectedOrdersForDispatch}
        couriers={couriers}
        storeId={storeId}
        onDispatched={() => {
          loadData();
        }}
      />

      {/* 3. Settlement Modal */}
      <SettlementModal
        isOpen={isSettlementModalOpen}
        onClose={() => setIsSettlementModalOpen(false)}
        dispatch={activeDispatchForSettlement}
        onSettled={() => {
          loadData();
        }}
      />

      {/* 4. Courier Modal */}
      <CourierModal
        isOpen={isCourierModalOpen}
        onClose={() => setIsCourierModalOpen(false)}
        courier={selectedCourier}
        storeId={storeId}
        onSaved={() => {
          loadData();
        }}
      />

      {/* 5. Zone Modal */}
      <ZoneModal
        isOpen={isZoneModalOpen}
        onClose={() => setIsZoneModalOpen(false)}
        zone={selectedZone}
        storeId={storeId}
        onSaved={() => {
          loadData();
        }}
      />

      {/* 6. Order Slip Modal (48-column thermal label) */}
      <OrderSlipModal
        isOpen={isSlipModalOpen}
        onClose={() => {
          setIsSlipModalOpen(false);
          setSelectedOrderForSlip(null);
        }}
        order={selectedOrderForSlip}
      />

      {/* 7. Dispatch Slip Preview Modal */}
      {viewingDispatchSlip && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden text-slate-100">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950">
              <h3 className="font-bold text-white text-base">Romaneio Térmico ESC/POS</h3>
              <button
                type="button"
                onClick={() => setViewingDispatchSlip(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              <pre className="bg-slate-950 p-4 rounded-lg font-mono text-xs text-emerald-400 border border-slate-800 overflow-x-auto whitespace-pre leading-relaxed select-all">
                {viewingDispatchSlip}
              </pre>
            </div>
            <div className="px-5 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center space-x-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir</span>
              </button>
              <button
                type="button"
                onClick={() => setViewingDispatchSlip(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Cancel Order Modal */}
      {cancelOrderId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          data-testid="cancel-order-modal"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md p-5 space-y-4 text-slate-100">
            <div className="flex items-center space-x-2 text-red-400">
              <Ban className="w-5 h-5" />
              <h3 className="font-bold text-white text-base">Cancelar Pedido de Entrega</h3>
            </div>
            <p className="text-xs text-slate-300">
              Deseja realmente cancelar o pedido #{cancelOrderId}? Informe o motivo:
            </p>
            <input
              type="text"
              data-testid="cancel-reason-input"
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-red-500"
            />
            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setCancelOrderId(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white"
              >
                Voltar
              </button>
              <button
                type="button"
                data-testid="confirm-cancel-order-button"
                onClick={handleConfirmCancel}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-500 text-white"
              >
                Confirmar Cancelamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Kanban Column Subcomponent
interface KanbanColumnProps {
  title: string;
  color: string;
  count: number;
  orders: DeliveryOrder[];
  onAdvance?: (order: DeliveryOrder) => void;
  advanceLabel?: string;
  onSlip: (order: DeliveryOrder) => void;
  onCancel?: (order: DeliveryOrder) => void;
}

function KanbanColumn({
  title,
  color,
  count,
  orders,
  onAdvance,
  advanceLabel,
  onSlip,
  onCancel,
}: KanbanColumnProps) {
  return (
    <div
      className={`w-72 shrink-0 bg-slate-950/80 rounded-xl border border-slate-800 flex flex-col max-h-full overflow-hidden`}
      data-testid={`kanban-column-${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
    >
      {/* Column Header */}
      <div className={`p-3 border-t-4 ${color} border-b border-slate-800 flex items-center justify-between bg-slate-950`}>
        <span className="font-bold text-xs text-white">{title}</span>
        <span className="bg-slate-800 text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
          {count}
        </span>
      </div>

      {/* Column Cards */}
      <div className="p-2 space-y-2.5 overflow-y-auto flex-1">
        {orders.map((ord) => {
          const total = ord.totalAmount ?? ord.total_amount ?? 0;
          const isCash = (ord.paymentMethod ?? ord.payment_method) === 'DINHEIRO';
          const change =
            isCash &&
            (ord.changeFor ?? ord.change_for) &&
            (ord.changeFor ?? ord.change_for)! > total
              ? (ord.changeFor ?? ord.change_for)! - total
              : 0;

          return (
            <div
              key={ord.id}
              data-testid={`kanban-order-card-${ord.id}`}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg p-3 space-y-2 text-xs shadow-xs"
            >
              {/* Card Header */}
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-amber-400">
                  #{ord.orderNumber ?? ord.order_number}
                </span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    ord.status === 'DELIVERED'
                      ? 'bg-emerald-950 text-emerald-300'
                      : ord.status === 'CANCELLED'
                      ? 'bg-red-950 text-red-300'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {ord.status}
                </span>
              </div>

              {/* Customer & Address */}
              <div>
                <div className="font-bold text-white truncate">
                  {ord.customerName ?? ord.customer_name}
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {ord.customerPhone ?? ord.customer_phone}
                </div>
                <div className="text-[11px] text-slate-300 flex items-center space-x-1 mt-1">
                  <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
                  <span className="truncate">
                    {ord.neighborhood} - {ord.street}, {ord.number}
                  </span>
                </div>
              </div>

              {/* Payment Info */}
              <div className="pt-1 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                <div>
                  <span className="text-slate-400 block text-[10px]">
                    {ord.paymentMethod ?? ord.payment_method}
                  </span>
                  {change > 0 && (
                    <span className="text-emerald-400 text-[10px]">
                      Troco: R$ {change.toFixed(2)}
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <span className="font-black text-amber-400 text-sm">
                    R$ {total.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-1">
                <button
                  type="button"
                  onClick={() => onSlip(ord)}
                  data-testid={`order-slip-btn-${ord.id}`}
                  className="flex items-center space-x-1 text-[10px] text-slate-300 hover:text-white px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 cursor-pointer"
                  title="Etiqueta Térmica de Pacote"
                >
                  <FileText className="w-3 h-3 text-amber-400" />
                  <span>Etiqueta</span>
                </button>

                <div className="flex items-center space-x-1">
                  {onCancel && ord.status !== 'CANCELLED' && ord.status !== 'DELIVERED' && (
                    <button
                      type="button"
                      onClick={() => onCancel(ord)}
                      data-testid={`order-cancel-btn-${ord.id}`}
                      className="p-1 text-red-400 hover:text-red-300 rounded hover:bg-red-950/40 cursor-pointer"
                      title="Cancelar Pedido"
                    >
                      <Ban className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {onAdvance && advanceLabel && (
                    <button
                      type="button"
                      onClick={() => onAdvance(ord)}
                      data-testid={`order-advance-btn-${ord.id}`}
                      className="flex items-center space-x-1 text-[10px] font-bold text-white px-2 py-1 rounded bg-amber-600 hover:bg-amber-500 cursor-pointer shadow-xs"
                    >
                      <span>{advanceLabel}</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {orders.length === 0 && (
          <div className="py-8 text-center text-slate-600 text-xs">
            Nenhum pedido nesta etapa.
          </div>
        )}
      </div>
    </div>
  );
}
