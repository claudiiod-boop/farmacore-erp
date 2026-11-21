import React, { useState, useEffect } from 'react';
import { X, Bike, Save, AlertCircle, Loader2 } from 'lucide-react';
import { deliveryApi } from '../../services/api';
import type { Courier, CourierStatus, CourierVehicleType, CreateCourierInput } from '../../types';

export interface CourierModalProps {
  isOpen: boolean;
  onClose: () => void;
  courier?: Courier | null;
  onSaved: (courier: Courier) => void;
  storeId?: number;
}

export default function CourierModal({
  isOpen,
  onClose,
  courier,
  onSaved,
  storeId = 1,
}: CourierModalProps) {
  const [formData, setFormData] = useState<CreateCourierInput>({
    storeId,
    name: '',
    cpf: '',
    phone: '',
    vehicleType: 'MOTO',
    vehiclePlate: '',
    cnh: '',
    commissionPerDelivery: 5.0,
    dailyAllowance: 30.0,
    status: 'AVAILABLE',
    isActive: true,
  });

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (courier) {
      setFormData({
        storeId: courier.storeId ?? storeId,
        name: courier.name || '',
        cpf: courier.cpf || '',
        phone: courier.phone || '',
        vehicleType: courier.vehicleType || 'MOTO',
        vehiclePlate: courier.vehiclePlate || '',
        cnh: courier.cnh || '',
        commissionPerDelivery: courier.commissionPerDelivery ?? 5.0,
        dailyAllowance: courier.dailyAllowance ?? 30.0,
        status: courier.status || 'AVAILABLE',
        isActive: Boolean(courier.isActive ?? courier.is_active),
      });
    } else {
      setFormData({
        storeId,
        name: '',
        cpf: '',
        phone: '',
        vehicleType: 'MOTO',
        vehiclePlate: '',
        cnh: '',
        commissionPerDelivery: 5.0,
        dailyAllowance: 30.0,
        status: 'AVAILABLE',
        isActive: true,
      });
    }
    setErrorMessage(null);
  }, [isOpen, courier, storeId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setErrorMessage('Nome do entregador é obrigatório.');
      return;
    }
    if (!formData.cpf.trim()) {
      setErrorMessage('CPF do entregador é obrigatório.');
      return;
    }
    if (!formData.phone.trim()) {
      setErrorMessage('Telefone de contato é obrigatório.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      let saved: Courier;
      if (courier && courier.id) {
        saved = await deliveryApi.updateCourier(courier.id, {
          storeId: formData.storeId,
          name: formData.name.trim(),
          cpf: formData.cpf.trim(),
          phone: formData.phone.trim(),
          vehicleType: formData.vehicleType,
          vehiclePlate: formData.vehiclePlate?.trim() || null,
          cnh: formData.cnh?.trim() || null,
          commissionPerDelivery: Number(formData.commissionPerDelivery) || 0,
          dailyAllowance: Number(formData.dailyAllowance) || 0,
          status: formData.status,
          isActive: formData.isActive,
        });
      } else {
        saved = await deliveryApi.createCourier({
          storeId: formData.storeId ?? storeId,
          name: formData.name.trim(),
          cpf: formData.cpf.trim(),
          phone: formData.phone.trim(),
          vehicleType: formData.vehicleType,
          vehiclePlate: formData.vehiclePlate?.trim() || null,
          cnh: formData.cnh?.trim() || null,
          commissionPerDelivery: Number(formData.commissionPerDelivery) || 0,
          dailyAllowance: Number(formData.dailyAllowance) || 0,
          status: formData.status,
          isActive: formData.isActive,
        });
      }
      onSaved(saved);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Falha ao salvar entregador.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      data-testid="courier-modal"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center space-x-2">
            <Bike className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-white text-base">
              {courier ? 'Editar Entregador / Motoboy' : 'Cadastrar Novo Entregador'}
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-y-auto">
          <div className="p-5 space-y-4">
            {errorMessage && (
              <div className="p-3 bg-red-950/60 border border-red-700/60 rounded-lg text-red-200 flex items-center space-x-2 text-xs">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Nome Completo *</label>
              <input
                type="text"
                required
                data-testid="courier-name-input"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Carlos Henrique Santos"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">CPF *</label>
                <input
                  type="text"
                  required
                  data-testid="courier-cpf-input"
                  value={formData.cpf}
                  onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                  placeholder="000.000.000-00"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Telefone / WhatsApp *</label>
                <input
                  type="text"
                  required
                  data-testid="courier-phone-input"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(11) 98888-7777"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Tipo de Veículo</label>
                <select
                  data-testid="courier-vehicle-type-select"
                  value={formData.vehicleType}
                  onChange={(e) =>
                    setFormData({ ...formData, vehicleType: e.target.value as CourierVehicleType })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-hidden focus:border-amber-500 cursor-pointer"
                >
                  <option value="MOTO">Moto</option>
                  <option value="BIKE">Bicicleta</option>
                  <option value="CAR">Carro / Utilitário</option>
                  <option value="WALK">A Pé / Próximo</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Placa do Veículo</label>
                <input
                  type="text"
                  data-testid="courier-plate-input"
                  value={formData.vehiclePlate || ''}
                  onChange={(e) => setFormData({ ...formData, vehiclePlate: e.target.value })}
                  placeholder="ABC-1234"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">CNH</label>
                <input
                  type="text"
                  data-testid="courier-cnh-input"
                  value={formData.cnh || ''}
                  onChange={(e) => setFormData({ ...formData, cnh: e.target.value })}
                  placeholder="Nº CNH"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Comissão por Entrega (R$)</label>
                <input
                  type="number"
                  step="0.50"
                  min="0"
                  data-testid="courier-commission-input"
                  value={formData.commissionPerDelivery}
                  onChange={(e) =>
                    setFormData({ ...formData, commissionPerDelivery: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Diária Fixa (R$)</label>
                <input
                  type="number"
                  step="1.00"
                  min="0"
                  data-testid="courier-allowance-input"
                  value={formData.dailyAllowance}
                  onChange={(e) =>
                    setFormData({ ...formData, dailyAllowance: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-hidden focus:border-amber-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Status Operacional</label>
                <select
                  data-testid="courier-status-select"
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value as CourierStatus })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-hidden focus:border-amber-500 cursor-pointer"
                >
                  <option value="AVAILABLE">Disponível</option>
                  <option value="ON_DELIVERY">Em Rota / Entrega</option>
                  <option value="INACTIVE">Inativo / Folga</option>
                </select>
              </div>

              <div className="flex items-center pt-6 space-x-2">
                <input
                  type="checkbox"
                  id="courierActive"
                  data-testid="courier-active-checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-amber-500 focus:ring-amber-500 cursor-pointer"
                />
                <label htmlFor="courierActive" className="text-xs font-medium text-slate-300 cursor-pointer">
                  Entregador Ativo no Cadastro
                </label>
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
              data-testid="save-courier-button"
              className="flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Salvar Entregador</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
