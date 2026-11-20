import React, { useState, useEffect } from 'react';
import { X, Building2, Save, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import type { CorporateAgreement, CreateAgreementInput } from '../../types';

export interface AgreementFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  agreement?: CorporateAgreement | null;
  onSaved: (agreement: CorporateAgreement) => void;
}

export default function AgreementFormModal({
  isOpen,
  onClose,
  agreement,
  onSaved,
}: AgreementFormModalProps) {
  const [formData, setFormData] = useState<CreateAgreementInput>({
    code: '',
    companyName: '',
    tradeName: '',
    cnpj: '',
    street: '',
    number: '',
    neighborhood: '',
    city: '',
    state: 'SP',
    zipCode: '',
    closingDay: 25,
    dueDay: 5,
    creditLimit: 10000,
    discountPercent: 10,
    isActive: true,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (agreement) {
        setFormData({
          code: agreement.code || '',
          companyName: agreement.companyName || agreement.company_name || '',
          tradeName: agreement.tradeName || agreement.trade_name || '',
          cnpj: agreement.cnpj || '',
          street: agreement.street || '',
          number: agreement.number || '',
          neighborhood: agreement.neighborhood || '',
          city: agreement.city || '',
          state: agreement.state || 'SP',
          zipCode: agreement.zipCode || agreement.zip_code || '',
          closingDay: agreement.closingDay ?? agreement.closing_day ?? 25,
          dueDay: agreement.dueDay ?? agreement.due_day ?? 5,
          creditLimit: agreement.creditLimit ?? agreement.credit_limit ?? 10000,
          discountPercent: agreement.discountPercent ?? agreement.discount_percent ?? 10,
          isActive: Boolean(agreement.isActive ?? agreement.is_active),
        });
      } else {
        setFormData({
          code: '',
          companyName: '',
          tradeName: '',
          cnpj: '',
          street: 'Av. Principal',
          number: '100',
          neighborhood: 'Centro',
          city: 'São Paulo',
          state: 'SP',
          zipCode: '01001-000',
          closingDay: 25,
          dueDay: 5,
          creditLimit: 10000,
          discountPercent: 10,
          isActive: true,
        });
      }
      setErrorMessage(null);
    }
  }, [isOpen, agreement]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code.trim() || !formData.cnpj.trim() || !formData.tradeName.trim()) {
      setErrorMessage('Código, Nome Fantasia e CNPJ são obrigatórios.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (agreement) {
        const updated = await api.credit.updateAgreement(agreement.id, formData);
        onSaved(updated);
      } else {
        const created = await api.credit.createAgreement(formData);
        onSaved(created);
      }
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao salvar convênio');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="agreement-modal-title"
    >
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-xl w-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <Building2 className="w-5 h-5 text-indigo-400" />
            <h2 id="agreement-modal-title" className="text-base font-bold">
              {agreement ? `Editar Empresa: ${agreement.tradeName}` : 'Nova Empresa Conveniada'}
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

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg flex items-center space-x-2 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Código do Convênio *</label>
              <input
                type="text"
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="Ex: EMP-001"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold uppercase outline-hidden"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">CNPJ *</label>
              <input
                type="text"
                required
                value={formData.cnpj}
                onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                placeholder="00.000.000/0001-00"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-hidden"
              />
            </div>

            <div className="col-span-2">
              <label className="font-bold text-slate-700 block mb-1">Razão Social *</label>
              <input
                type="text"
                required
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                placeholder="Ex: Indústria e Comércio Silva Ltda"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-hidden"
              />
            </div>

            <div className="col-span-2">
              <label className="font-bold text-slate-700 block mb-1">Nome Fantasia *</label>
              <input
                type="text"
                required
                value={formData.tradeName}
                onChange={(e) => setFormData({ ...formData, tradeName: e.target.value })}
                placeholder="Ex: Grupo Silva"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-hidden"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Dia do Fechamento (1-31) *</label>
              <input
                type="number"
                min="1"
                max="31"
                required
                value={formData.closingDay ?? 25}
                onChange={(e) => setFormData({ ...formData, closingDay: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold outline-hidden"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Dia do Vencimento (1-31) *</label>
              <input
                type="number"
                min="1"
                max="31"
                required
                value={formData.dueDay ?? 5}
                onChange={(e) => setFormData({ ...formData, dueDay: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold outline-hidden"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Limite Global de Crédito (R$) *</label>
              <input
                type="number"
                min="0"
                step="500"
                required
                value={formData.creditLimit ?? 10000}
                onChange={(e) => setFormData({ ...formData, creditLimit: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-emerald-600 outline-hidden"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Desconto em Folha (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={formData.discountPercent ?? 10}
                onChange={(e) => setFormData({ ...formData, discountPercent: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold outline-hidden"
              />
            </div>
          </div>

          {/* Footer */}
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
                  <span>Salvar Convênio</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
