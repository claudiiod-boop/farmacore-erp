import React, { useState, useEffect } from 'react';
import { X, UserPlus, Save, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import type { Customer, CreateCustomerInput, CorporateAgreement } from '../../types';

export interface CustomerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer?: Customer | null;
  agreements: CorporateAgreement[];
  onSaved: (customer: Customer) => void;
}

export default function CustomerFormModal({
  isOpen,
  onClose,
  customer,
  agreements,
  onSaved,
}: CustomerFormModalProps) {
  const [formData, setFormData] = useState<CreateCustomerInput>({
    name: '',
    cpf: '',
    rg: '',
    phone: '',
    email: '',
    street: '',
    number: '',
    neighborhood: '',
    city: '',
    state: 'SP',
    zipCode: '',
    creditLimit: 500,
    agreementId: undefined,
    allowDependents: true,
    notes: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (customer) {
        setFormData({
          name: customer.name || '',
          cpf: customer.cpf || '',
          rg: customer.rg || '',
          phone: customer.phone || '',
          email: customer.email || '',
          street: customer.street || '',
          number: customer.number || '',
          neighborhood: customer.neighborhood || '',
          city: customer.city || '',
          state: customer.state || 'SP',
          zipCode: customer.zipCode || customer.zip_code || '',
          creditLimit: customer.creditLimit ?? customer.credit_limit ?? 500,
          agreementId: customer.agreementId ?? customer.agreement_id ?? undefined,
          allowDependents: Boolean(customer.allowDependents ?? customer.allow_dependents),
          notes: customer.notes || '',
        });
      } else {
        setFormData({
          name: '',
          cpf: '',
          rg: '',
          phone: '',
          email: '',
          street: '',
          number: '',
          neighborhood: '',
          city: '',
          state: 'SP',
          zipCode: '',
          creditLimit: 500,
          agreementId: undefined,
          allowDependents: true,
          notes: '',
        });
      }
      setErrorMessage(null);
    }
  }, [isOpen, customer]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.cpf.trim()) {
      setErrorMessage('Nome e CPF são obrigatórios.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (customer) {
        const updated = await api.credit.updateCustomer(customer.id, {
          ...formData,
          storeId: customer.storeId || customer.store_id || 1,
        });
        onSaved(updated);
      } else {
        const created = await api.credit.createCustomer({
          ...formData,
          storeId: 1,
        });
        onSaved(created);
      }
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao salvar cliente');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="customer-modal-title"
    >
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-xl w-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <UserPlus className="w-5 h-5 text-indigo-400" />
            <h2 id="customer-modal-title" className="text-base font-bold">
              {customer ? `Editar Cliente: ${customer.name}` : 'Novo Cadastro de Cliente Crediário'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg flex items-center space-x-2 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="col-span-2">
              <label htmlFor="customer-name-input" className="font-bold text-slate-700 block mb-1">
                Nome Completo *
              </label>
              <input
                id="customer-name-input"
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500 outline-hidden"
                placeholder="Ex: João da Silva Santos"
              />
            </div>

            <div>
              <label htmlFor="customer-cpf-input" className="font-bold text-slate-700 block mb-1">
                CPF *
              </label>
              <input
                id="customer-cpf-input"
                type="text"
                required
                value={formData.cpf}
                onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500 outline-hidden"
                placeholder="000.000.000-00"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">RG</label>
              <input
                type="text"
                value={formData.rg || ''}
                onChange={(e) => setFormData({ ...formData, rg: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500 outline-hidden"
                placeholder="Ex: 12.345.678-9"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Telefone</label>
              <input
                type="text"
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500 outline-hidden"
                placeholder="(11) 99999-9999"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">E-mail</label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500 outline-hidden"
                placeholder="cliente@email.com"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Limite de Crédito (R$) *</label>
              <input
                type="number"
                min="0"
                step="50"
                required
                value={formData.creditLimit ?? 500}
                onChange={(e) => setFormData({ ...formData, creditLimit: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-emerald-600 focus:ring-1 focus:ring-indigo-500 outline-hidden"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Convênio Associado</label>
              <select
                value={formData.agreementId ?? ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    agreementId: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-1 focus:ring-indigo-500 outline-hidden"
              >
                <option value="">Crediário Próprio (Sem Convênio)</option>
                {agreements.map((ag) => (
                  <option key={ag.id} value={ag.id}>
                    {ag.tradeName || ag.companyName} ({ag.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="font-bold text-slate-700 block mb-1">Endereço (Rua, Número, Bairro)</label>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={formData.street || ''}
                  onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                  placeholder="Logradouro"
                  className="col-span-2 px-3 py-2 border border-slate-300 rounded-lg text-xs outline-hidden"
                />
                <input
                  type="text"
                  value={formData.number || ''}
                  onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                  placeholder="Número"
                  className="px-3 py-2 border border-slate-300 rounded-lg text-xs outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Bairro</label>
              <input
                type="text"
                value={formData.neighborhood || ''}
                onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-hidden"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Cidade / UF</label>
              <div className="flex space-x-1">
                <input
                  type="text"
                  value={formData.city || ''}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Cidade"
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-xs outline-hidden"
                />
                <input
                  type="text"
                  value={formData.state || 'SP'}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  placeholder="UF"
                  maxLength={2}
                  className="w-14 px-2 py-2 border border-slate-300 rounded-lg text-xs uppercase text-center outline-hidden"
                />
              </div>
            </div>

            <div className="col-span-2 flex items-center space-x-2 pt-1">
              <input
                type="checkbox"
                id="allowDependentsCheckbox"
                checked={formData.allowDependents}
                onChange={(e) => setFormData({ ...formData, allowDependents: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
              />
              <label htmlFor="allowDependentsCheckbox" className="text-xs text-slate-700 font-semibold cursor-pointer">
                Permitir compras por dependentes autorizados
              </label>
            </div>
          </div>

          {/* Footer inside form */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center space-x-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Salvar Cliente</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
