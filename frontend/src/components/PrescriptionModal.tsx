import React, { useState, useEffect } from 'react';
import {
  FileText,
  AlertTriangle,
  X,
  User,
  Calendar,
  Building,
  CheckCircle2,
  Copy,
  Package,
  ShieldAlert,
} from 'lucide-react';
import { PrescriptionDTO } from '../services/api';
import { CartItem } from './CartTable';
import { renderStripeBadge } from './ProductSearch';
import { formatDate } from './BatchSelector';

export interface PrescriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (prescription: PrescriptionDTO) => void;
  controlledItems?: CartItem[];
  initialData?: PrescriptionDTO;
}

export const BRAZILIAN_UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

export const PRESCRIPTION_TYPES = [
  { value: 'B1_AZUL', label: 'Notificação de Receita B - Azul (Psicotrópicos)' },
  { value: 'B2_AZUL', label: 'Notificação de Receita B2 - Azul (Anorexígenos)' },
  { value: 'A1_AMARELA', label: 'Notificação de Receita A - Amarela (Entorpecentes)' },
  { value: 'C1_BRANCA_2VIAS', label: 'Receita de Controle Especial - Branca 2 vias (C1/C2)' },
  { value: 'ANTIMICROBIANO', label: 'Receita de Antimicrobianos em 2 vias (RDC 20/2011)' },
] as const;

export default function PrescriptionModal({
  isOpen,
  onClose,
  onConfirm,
  controlledItems = [],
  initialData,
}: PrescriptionModalProps) {
  const [doctorName, setDoctorName] = useState('');
  const [doctorCrm, setDoctorCrm] = useState('');
  const [doctorUf, setDoctorUf] = useState('');
  const [prescriptionType, setPrescriptionType] = useState('');
  const [prescriptionDate, setPrescriptionDate] = useState('');
  const [patientName, setPatientName] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [buyerCpf, setBuyerCpf] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setDoctorName(initialData.doctorName || '');
        setDoctorCrm(initialData.doctorCrm || '');
        setDoctorUf(initialData.doctorUf || '');
        setPrescriptionType(initialData.prescriptionType || '');
        setPrescriptionDate(initialData.prescriptionDate || '');
        setPatientName(initialData.patientName || '');
        setBuyerName(initialData.buyerName || '');
        setBuyerCpf(initialData.buyerCpf || '');
      } else {
        setDoctorName('');
        setDoctorCrm('');
        setDoctorUf('');
        setPrescriptionType('');
        setPrescriptionDate('');
        setPatientName('');
        setBuyerName('');
        setBuyerCpf('');
      }
      setErrors({});
    }
  }, [isOpen, initialData]);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopyPatientToBuyer = () => {
    setBuyerName(patientName);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};

    if (!doctorName.trim()) {
      newErrors.doctorName = 'Nome do prescritor é obrigatório';
    }
    if (!doctorCrm.trim()) {
      newErrors.doctorCrm = 'CRM/Registro é obrigatório';
    }
    if (!doctorUf.trim()) {
      newErrors.doctorUf = 'UF é obrigatória';
    }
    if (!prescriptionType.trim()) {
      newErrors.prescriptionType = 'Tipo de receituário é obrigatório';
    }
    if (!prescriptionDate.trim()) {
      newErrors.prescriptionDate = 'Data da receita é obrigatória';
    } else {
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      if (prescriptionDate > todayStr) {
        newErrors.prescriptionDate = 'A data da receita não pode ser futura';
      }
    }
    if (!patientName.trim()) {
      newErrors.patientName = 'Nome do paciente é obrigatório';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const prescriptionData: PrescriptionDTO = {
      doctorName: doctorName.trim(),
      doctorCrm: doctorCrm.trim(),
      doctorUf: doctorUf.trim(),
      prescriptionType: prescriptionType.trim(),
      prescriptionDate: prescriptionDate.trim(),
      patientName: patientName.trim(),
      ...(buyerName.trim() ? { buyerName: buyerName.trim() } : {}),
      ...(buyerCpf.trim() ? { buyerCpf: buyerCpf.trim() } : {}),
    };

    onConfirm(prescriptionData);
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="prescription-modal-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Sanitário */}
        <div className="px-6 py-4 bg-gradient-to-r from-amber-600 to-amber-700 text-white flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-amber-500/30 rounded-lg">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 id="prescription-modal-title" className="text-lg font-bold">
                Retenção de Receituário Sanitário
              </h2>
              <p className="text-xs text-amber-100">
                Portaria Anvisa 344/98 e RDC 20/2011 (Antimicrobianos)
              </p>
            </div>
          </div>
          <button
            type="button"
            data-testid="close-prescription-modal"
            aria-label="Fechar"
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/10 rounded-lg p-1.5 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário com Scroll Interno */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Lista de Medicamentos Controlados no Carrinho */}
          {controlledItems && controlledItems.length > 0 && (
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-4">
              <div className="flex items-center space-x-2 text-amber-900 font-semibold text-xs uppercase tracking-wider mb-2.5">
                <FileText className="w-4 h-4 text-amber-700" />
                <span>Medicamentos Controlados nesta Pré-Venda:</span>
              </div>
              <div className="space-y-2">
                {controlledItems.map((item) => (
                  <div
                    key={`${item.product.id}-${item.batch.id}`}
                    className="flex flex-col sm:flex-row sm:items-center justify-between text-xs bg-white/90 p-2.5 rounded-lg border border-amber-100 shadow-2xs gap-2"
                  >
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-800">{item.product.name}</span>
                      {renderStripeBadge(item.product.stripe, item.product.controlType)}
                    </div>
                    <div className="flex items-center space-x-3 text-slate-600 font-mono">
                      <span className="flex items-center">
                        <Package className="w-3.5 h-3.5 mr-1 text-slate-400" />
                        Lote: {item.batch.batchNumber}
                      </span>
                      <span>Val: {formatDate(item.batch.expirationDate)}</span>
                      <span className="font-semibold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">
                        {item.quantity} un.
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dados do Prescritor */}
          <div>
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center">
              <User className="w-4 h-4 mr-1.5 text-slate-500" />
              Dados do Prescritor (Médico / Odontólogo / Veterinário)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-6">
                <label
                  htmlFor="doctorName"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Nome do Médico / Prescritor *
                </label>
                <input
                  id="doctorName"
                  type="text"
                  value={doctorName}
                  onChange={(e) => {
                    setDoctorName(e.target.value);
                    if (errors.doctorName) setErrors((prev) => ({ ...prev, doctorName: '' }));
                  }}
                  placeholder="Ex: Dra. Juliana Santos"
                  className={`w-full px-3 py-2 text-sm rounded-lg border ${
                    errors.doctorName
                      ? 'border-red-400 bg-red-50/50 text-red-900 focus:ring-red-500'
                      : 'border-slate-300 focus:ring-amber-500'
                  } focus:outline-none focus:ring-2`}
                />
                {errors.doctorName && (
                  <p className="text-xs text-red-600 mt-1 font-medium">{errors.doctorName}</p>
                )}
              </div>

              <div className="sm:col-span-3">
                <label
                  htmlFor="doctorCrm"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  CRM / Registro Profissional *
                </label>
                <input
                  id="doctorCrm"
                  type="text"
                  value={doctorCrm}
                  onChange={(e) => {
                    setDoctorCrm(e.target.value);
                    if (errors.doctorCrm) setErrors((prev) => ({ ...prev, doctorCrm: '' }));
                  }}
                  placeholder="Ex: 123456"
                  className={`w-full px-3 py-2 text-sm rounded-lg border ${
                    errors.doctorCrm
                      ? 'border-red-400 bg-red-50/50 text-red-900 focus:ring-red-500'
                      : 'border-slate-300 focus:ring-amber-500'
                  } focus:outline-none focus:ring-2`}
                />
                {errors.doctorCrm && (
                  <p className="text-xs text-red-600 mt-1 font-medium">{errors.doctorCrm}</p>
                )}
              </div>

              <div className="sm:col-span-3">
                <label
                  htmlFor="doctorUf"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  UF do Conselho *
                </label>
                <select
                  id="doctorUf"
                  value={doctorUf}
                  onChange={(e) => {
                    setDoctorUf(e.target.value);
                    if (errors.doctorUf) setErrors((prev) => ({ ...prev, doctorUf: '' }));
                  }}
                  className={`w-full px-3 py-2 text-sm rounded-lg border bg-white ${
                    errors.doctorUf
                      ? 'border-red-400 bg-red-50/50 text-red-900 focus:ring-red-500'
                      : 'border-slate-300 focus:ring-amber-500'
                  } focus:outline-none focus:ring-2`}
                >
                  <option value="">Selecione...</option>
                  {BRAZILIAN_UFS.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </select>
                {errors.doctorUf && (
                  <p className="text-xs text-red-600 mt-1 font-medium">{errors.doctorUf}</p>
                )}
              </div>
            </div>
          </div>

          {/* Dados do Receituário */}
          <div>
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center">
              <FileText className="w-4 h-4 mr-1.5 text-slate-500" />
              Classificação Sanitária do Receituário
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-7">
                <label
                  htmlFor="prescriptionType"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Tipo de Receituário *
                </label>
                <select
                  id="prescriptionType"
                  value={prescriptionType}
                  onChange={(e) => {
                    setPrescriptionType(e.target.value);
                    if (errors.prescriptionType)
                      setErrors((prev) => ({ ...prev, prescriptionType: '' }));
                  }}
                  className={`w-full px-3 py-2 text-sm rounded-lg border bg-white ${
                    errors.prescriptionType
                      ? 'border-red-400 bg-red-50/50 text-red-900 focus:ring-red-500'
                      : 'border-slate-300 focus:ring-amber-500'
                  } focus:outline-none focus:ring-2`}
                >
                  <option value="">Selecione o tipo regulatório...</option>
                  {PRESCRIPTION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                {errors.prescriptionType && (
                  <p className="text-xs text-red-600 mt-1 font-medium">{errors.prescriptionType}</p>
                )}
              </div>

              <div className="sm:col-span-5">
                <label
                  htmlFor="prescriptionDate"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Data da Receita *
                </label>
                <input
                  id="prescriptionDate"
                  type="date"
                  value={prescriptionDate}
                  onChange={(e) => {
                    setPrescriptionDate(e.target.value);
                    if (errors.prescriptionDate)
                      setErrors((prev) => ({ ...prev, prescriptionDate: '' }));
                  }}
                  className={`w-full px-3 py-2 text-sm rounded-lg border ${
                    errors.prescriptionDate
                      ? 'border-red-400 bg-red-50/50 text-red-900 focus:ring-red-500'
                      : 'border-slate-300 focus:ring-amber-500'
                  } focus:outline-none focus:ring-2`}
                />
                {errors.prescriptionDate && (
                  <p className="text-xs text-red-600 mt-1 font-medium">
                    {errors.prescriptionDate}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Dados do Paciente e Comprador */}
          <div>
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center">
              <Building className="w-4 h-4 mr-1.5 text-slate-500" />
              Identificação do Paciente e Comprador
            </h3>
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="patientName"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Nome do Paciente *
                </label>
                <input
                  id="patientName"
                  type="text"
                  value={patientName}
                  onChange={(e) => {
                    setPatientName(e.target.value);
                    if (errors.patientName) setErrors((prev) => ({ ...prev, patientName: '' }));
                  }}
                  placeholder="Nome completo conforme consta na receita"
                  className={`w-full px-3 py-2 text-sm rounded-lg border ${
                    errors.patientName
                      ? 'border-red-400 bg-red-50/50 text-red-900 focus:ring-red-500'
                      : 'border-slate-300 focus:ring-amber-500'
                  } focus:outline-none focus:ring-2`}
                />
                {errors.patientName && (
                  <p className="text-xs text-red-600 mt-1 font-medium">{errors.patientName}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-7">
                  <div className="flex items-center justify-between mb-1">
                    <label
                      htmlFor="buyerName"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Nome do Comprador (opcional)
                    </label>
                    <button
                      type="button"
                      onClick={handleCopyPatientToBuyer}
                      className="inline-flex items-center text-[11px] font-medium text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-200 transition"
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Mesmo do Paciente
                    </button>
                  </div>
                  <input
                    id="buyerName"
                    type="text"
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    placeholder="Nome de quem está retirando na farmácia"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="sm:col-span-5">
                  <label
                    htmlFor="buyerCpf"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    CPF do Comprador (opcional)
                  </label>
                  <input
                    id="buyerCpf"
                    type="text"
                    value={buyerCpf}
                    onChange={(e) => setBuyerCpf(e.target.value)}
                    placeholder="000.000.000-00"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer com botões de ação */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium text-sm transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex items-center px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm shadow-sm transition"
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              Confirmar Receita
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
