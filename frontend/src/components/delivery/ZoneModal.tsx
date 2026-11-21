import React, { useState, useEffect } from 'react';
import { X, MapPin, Save, AlertCircle, Loader2 } from 'lucide-react';
import { deliveryApi } from '../../services/api';
import type { DeliveryZone, CreateDeliveryZoneInput } from '../../types';

export interface ZoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  zone?: DeliveryZone | null;
  onSaved: (zone: DeliveryZone) => void;
  storeId?: number;
}

export default function ZoneModal({
  isOpen,
  onClose,
  zone,
  onSaved,
  storeId = 1,
}: ZoneModalProps) {
  const [formData, setFormData] = useState<CreateDeliveryZoneInput>({
    storeId,
    name: '',
    neighborhood: '',
    city: 'São Paulo',
    state: 'SP',
    deliveryFee: 10.0,
    estimatedMinutes: 45,
    freeShippingThreshold: 150.0,
    isActive: true,
  });

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (zone) {
      setFormData({
        storeId: zone.storeId ?? storeId,
        name: zone.name || '',
        neighborhood: zone.neighborhood || '',
        city: zone.city || 'São Paulo',
        state: zone.state || 'SP',
        deliveryFee: zone.deliveryFee ?? zone.delivery_fee ?? 10.0,
        estimatedMinutes: zone.estimatedMinutes ?? zone.estimated_minutes ?? 45,
        freeShippingThreshold:
          zone.freeShippingThreshold ?? zone.free_shipping_threshold ?? null,
        isActive: Boolean(zone.isActive ?? zone.is_active),
      });
    } else {
      setFormData({
        storeId,
        name: '',
        neighborhood: '',
        city: 'São Paulo',
        state: 'SP',
        deliveryFee: 10.0,
        estimatedMinutes: 45,
        freeShippingThreshold: 150.0,
        isActive: true,
      });
    }
    setErrorMessage(null);
  }, [isOpen, zone, storeId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setErrorMessage('Nome da zona de entrega é obrigatório.');
      return;
    }
    if (!formData.neighborhood.trim()) {
      setErrorMessage('Bairro atendido é obrigatório.');
      return;
    }
    if (!formData.city.trim()) {
      setErrorMessage('Cidade é obrigatória.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      let saved: DeliveryZone;
      if (zone && zone.id) {
        saved = await deliveryApi.updateZone(zone.id, {
          name: formData.name.trim(),
          neighborhood: formData.neighborhood.trim(),
          city: formData.city.trim(),
          state: formData.state?.trim() || 'SP',
          deliveryFee: Number(formData.deliveryFee) || 0,
          estimatedMinutes: Number(formData.estimatedMinutes) || 30,
          freeShippingThreshold:
            formData.freeShippingThreshold !== undefined &&
            formData.freeShippingThreshold !== null &&
            !isNaN(Number(formData.freeShippingThreshold))
              ? Number(formData.freeShippingThreshold)
              : null,
          isActive: formData.isActive,
        });
      } else {
        saved = await deliveryApi.createZone({
          storeId: formData.storeId ?? storeId,
          name: formData.name.trim(),
          neighborhood: formData.neighborhood.trim(),
          city: formData.city.trim(),
          state: formData.state?.trim() || 'SP',
          deliveryFee: Number(formData.deliveryFee) || 0,
          estimatedMinutes: Number(formData.estimatedMinutes) || 30,
          freeShippingThreshold:
            formData.freeShippingThreshold !== undefined &&
            formData.freeShippingThreshold !== null &&
            !isNaN(Number(formData.freeShippingThreshold))
              ? Number(formData.freeShippingThreshold)
              : null,
          isActive: formData.isActive,
        });
      }
      onSaved(saved);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Falha ao salvar zona de entrega.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      data-testid="zone-modal"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center space-x-2">
            <MapPin className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-white text-base">
              {zone ? 'Editar Zona de Entrega / Bairro' : 'Cadastrar Nova Zona de Entrega'}
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
              <label className="text-xs font-semibold text-slate-300">Identificação da Zona *</label>
              <input
                type="text"
                required
                data-testid="zone-name-input"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Zona Central - Bela Vista"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Bairro Atendido *</label>
              <input
                type="text"
                required
                data-testid="zone-neighborhood-input"
                value={formData.neighborhood}
                onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                placeholder="Ex: Bela Vista"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1">
                <label className="text-xs font-semibold text-slate-300">Cidade *</label>
                <input
                  type="text"
                  required
                  data-testid="zone-city-input"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="São Paulo"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">UF *</label>
                <input
                  type="text"
                  maxLength={2}
                  data-testid="zone-state-input"
                  value={formData.state || 'SP'}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-hidden focus:border-amber-500 text-center font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Taxa de Frete Padrão (R$) *</label>
                <input
                  type="number"
                  step="0.50"
                  min="0"
                  required
                  data-testid="zone-fee-input"
                  value={formData.deliveryFee}
                  onChange={(e) =>
                    setFormData({ ...formData, deliveryFee: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Tempo Estimado (min)</label>
                <input
                  type="number"
                  min="5"
                  step="5"
                  data-testid="zone-estimated-minutes-input"
                  value={formData.estimatedMinutes}
                  onChange={(e) =>
                    setFormData({ ...formData, estimatedMinutes: parseInt(e.target.value) || 30 })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-hidden focus:border-amber-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">
                Valor Mínimo para Frete Grátis (R$) (Opcional)
              </label>
              <input
                type="number"
                step="5.00"
                min="0"
                data-testid="zone-free-threshold-input"
                value={formData.freeShippingThreshold ?? ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    freeShippingThreshold: e.target.value ? parseFloat(e.target.value) : null,
                  })
                }
                placeholder="Ex: 150.00 (deixe em branco se não houver)"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500"
              />
            </div>

            <div className="flex items-center pt-2 space-x-2">
              <input
                type="checkbox"
                id="zoneActive"
                data-testid="zone-active-checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-amber-500 focus:ring-amber-500 cursor-pointer"
              />
              <label htmlFor="zoneActive" className="text-xs font-medium text-slate-300 cursor-pointer">
                Zona de Entrega Ativa para Atendimento
              </label>
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
              data-testid="save-zone-button"
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
                  <span>Salvar Zona</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
