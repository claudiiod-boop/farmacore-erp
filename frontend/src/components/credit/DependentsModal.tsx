import React, { useState, useEffect } from 'react';
import { X, Users, Plus, Trash2, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import type { Customer, CustomerDependent, DependentRelationship } from '../../types';

export interface DependentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
  onUpdated?: () => void;
}

const RELATIONSHIPS: DependentRelationship[] = ['CONJUGE', 'FILHO(A)', 'PAI/MAE', 'OUTRO'];

export default function DependentsModal({
  isOpen,
  onClose,
  customer,
  onUpdated,
}: DependentsModalProps) {
  const [dependents, setDependents] = useState<CustomerDependent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [relationship, setRelationship] = useState<DependentRelationship>('CONJUGE');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadCustomerDetails = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.credit.getCustomerById(customer.id);
      setDependents(res.dependents || []);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao carregar dependentes');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setName('');
      setCpf('');
      setRelationship('CONJUGE');
      loadCustomerDetails();
    }
  }, [isOpen, customer.id]);

  if (!isOpen) return null;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !cpf.trim()) {
      setErrorMessage('Nome e CPF do dependente são obrigatórios.');
      return;
    }

    setIsAdding(true);
    setErrorMessage(null);
    try {
      await api.credit.addDependent(customer.id, {
        name,
        cpf,
        relationship,
        isActive: true,
      });
      setName('');
      setCpf('');
      await loadCustomerDetails();
      if (onUpdated) onUpdated();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao adicionar dependente');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemove = async (depId: number) => {
    setErrorMessage(null);
    try {
      await api.credit.removeDependent(depId);
      await loadCustomerDetails();
      if (onUpdated) onUpdated();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao remover dependente');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dependents-modal-title"
    >
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <Users className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 id="dependents-modal-title" className="text-base font-bold">
                Dependentes Autorizados
              </h2>
              <p className="text-xs text-slate-400">Titular: {customer.name} (CPF: {customer.cpf})</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg flex items-center space-x-2 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form to add */}
          <form onSubmit={handleAdd} className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-3">
            <span className="text-xs font-bold text-slate-700 block uppercase tracking-wider">
              Adicionar Novo Dependente
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <input
                type="text"
                placeholder="Nome do dependente"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="col-span-2 px-3 py-1.5 border border-slate-300 rounded-md outline-hidden bg-white"
                required
              />
              <input
                type="text"
                placeholder="CPF"
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-md outline-hidden bg-white"
                required
              />
              <select
                value={relationship}
                onChange={(e) => setRelationship(e.target.value as DependentRelationship)}
                className="px-3 py-1.5 border border-slate-300 rounded-md outline-hidden bg-white font-semibold"
              >
                {RELATIONSHIPS.map((rel) => (
                  <option key={rel} value={rel}>
                    {rel}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isAdding}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-bold transition cursor-pointer disabled:opacity-50"
              >
                {isAdding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>Adicionar</span>
              </button>
            </div>
          </form>

          {/* List of dependents */}
          <div>
            <span className="text-xs font-bold text-slate-700 block uppercase tracking-wider mb-2">
              Dependentes Cadastrados ({dependents.length})
            </span>
            {isLoading ? (
              <div className="py-6 text-center text-xs text-slate-500">Carregando dependentes...</div>
            ) : dependents.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500 bg-slate-50 rounded-lg border border-slate-200">
                Nenhum dependente cadastrado para este cliente.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                {dependents.map((dep) => (
                  <div key={dep.id} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50">
                    <div>
                      <span className="font-bold text-slate-900 block">{dep.name}</span>
                      <span className="text-slate-500 text-[11px]">
                        CPF: {dep.cpf} • Grau: <strong>{dep.relationship}</strong>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemove(dep.id)}
                      title="Remover Dependente"
                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
