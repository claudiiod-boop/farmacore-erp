import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  QrCode,
  Search,
  CheckCircle2,
  XCircle,
  FileText,
  User,
  Calendar,
  Pill,
  ArrowRight,
  X,
  Lock
} from 'lucide-react';
import { digitalPrescriptionsApi } from '../../services/api';
import type {
  DigitalPrescription,
  ValidatePrescriptionResult,
} from '../../types';

interface DigitalPrescriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportToPreSale?: (prescription: DigitalPrescription) => void;
}

export const DigitalPrescriptionModal: React.FC<DigitalPrescriptionModalProps> = ({
  isOpen,
  onClose,
  onImportToPreSale,
}) => {
  const [prescriptionCode, setPrescriptionCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isDispensing, setIsDispensing] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidatePrescriptionResult | null>(null);
  const [pharmacistCrf, setPharmacistCrf] = useState('CRF-SP 98765');
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  if (!isOpen) return null;

  const showMsg = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleValidate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prescriptionCode.trim()) {
      showMsg('Informe o código da receita digital ou escaneie o QR Code.', 'error');
      return;
    }

    try {
      setIsValidating(true);
      setValidationResult(null);
      const res = await digitalPrescriptionsApi.validate(prescriptionCode.trim());
      setValidationResult(res);
      if (!res.isValid || !res.canDispense) {
        showMsg(res.message, 'error');
      } else {
        showMsg('Receita digital autêntica ICP-Brasil validada com sucesso!');
      }
    } catch (err: any) {
      showMsg(err.message || 'Erro ao validar receita digital', 'error');
    } finally {
      setIsValidating(false);
    }
  };

  const handleDispenseAndImport = async () => {
    if (!validationResult?.prescription) return;
    if (!pharmacistCrf.trim()) {
      showMsg('CRF do farmacêutico responsável é obrigatório para baixa.', 'error');
      return;
    }

    try {
      setIsDispensing(true);
      const dispensed = await digitalPrescriptionsApi.dispense({
        code: validationResult.prescription.prescription_code,
        storeId: 1,
        pharmacistName: 'Farmacêutico RT',
        pharmacistCrf: pharmacistCrf.trim(),
      });

      showMsg('Receita baixada com carimbo digital e inutilizada contra reuso!');

      if (onImportToPreSale) {
        onImportToPreSale(dispensed);
      }

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      showMsg(err.message || 'Erro ao dispensar receita digital', 'error');
    } finally {
      setIsDispensing(false);
    }
  };

  const prescription = validationResult?.prescription;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Validador de Receitas Digitais ICP-Brasil & CFM/CFF
              </h2>
              <p className="text-xs text-gray-500">
                Conformidade com a Lei 14.063/2020 e Portaria 344/98 com carimbo de inutilização contra reuso
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            data-testid="feedback-alert"
            className={`my-3 p-3 rounded-lg text-xs font-semibold flex items-center justify-between ${
              feedback.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}
          >
            <span>{feedback.message}</span>
            <button onClick={() => setFeedback(null)}>×</button>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {/* Busca por Código ou Leitura de QR Code */}
          <form onSubmit={handleValidate} className="flex gap-2">
            <div className="relative flex-1">
              <QrCode className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                data-testid="input-prescription-code"
                value={prescriptionCode}
                onChange={(e) => setPrescriptionCode(e.target.value)}
                placeholder="Insira o código da receita digital (ex: MEM-2026-ABCD ou link do QR Code)..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-emerald-500 focus:border-emerald-500 font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={isValidating}
              data-testid="btn-validate-prescription"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50 transition-colors"
            >
              <Search className="h-4 w-4" />
              {isValidating ? 'Validando...' : 'Validar ICP'}
            </button>
          </form>

          {/* Resultado da Validação */}
          {validationResult && (
            <div className="space-y-4">
              {/* Status Banner */}
              <div
                data-testid="status-banner"
                className={`p-4 rounded-xl border flex items-start gap-3 ${
                  validationResult.canDispense
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : validationResult.status === 'DISPENSED'
                    ? 'bg-red-50 border-red-200 text-red-800'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}
              >
                {validationResult.canDispense ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : validationResult.status === 'DISPENSED' ? (
                  <Lock className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div className="text-xs">
                  <span className="font-bold block text-sm">
                    {validationResult.canDispense
                      ? 'Assinatura ICP-Brasil Autêntica e Válida'
                      : validationResult.status === 'DISPENSED'
                      ? 'Dispensação Bloqueada: Receita Já Utilizada!'
                      : 'Prescrição Inválida ou Vencida'}
                  </span>
                  <p className="mt-0.5">{validationResult.message}</p>
                </div>
              </div>

              {/* Detalhes da Prescrição */}
              {prescription && (
                <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50 space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-gray-500 font-medium">Médico / Prescritor:</span>
                      <p className="font-bold text-gray-900 text-sm">{prescription.prescriber_name}</p>
                      <p className="text-gray-600">
                        {prescription.prescriber_crm} - {prescription.prescriber_uf}
                      </p>
                    </div>

                    <div>
                      <span className="text-gray-500 font-medium">Paciente:</span>
                      <p className="font-bold text-gray-900 text-sm">{prescription.patient_name}</p>
                      <p className="text-gray-600">CPF: {prescription.patient_cpf || 'Não informado'}</p>
                    </div>

                    <div>
                      <span className="text-gray-500 font-medium">Classificação Sanitária:</span>
                      <span className="inline-block mt-0.5 px-2 py-0.5 bg-purple-100 text-purple-800 font-bold rounded text-[11px]">
                        {prescription.prescription_type === 'ANTIMICROBIAL'
                          ? 'Antimicrobiano (RDC 20/2011)'
                          : prescription.prescription_type === 'CONTROLLED_B1'
                          ? 'Notificação B1 (Portaria 344/98)'
                          : prescription.prescription_type === 'CONTROLLED_C1'
                          ? 'Controle Especial C1 (Portaria 344/98)'
                          : 'Prescrição Simples'}
                      </span>
                    </div>

                    <div>
                      <span className="text-gray-500 font-medium">Emissão / Validade:</span>
                      <p className="text-gray-800 font-medium">
                        Emitido: {prescription.issued_at.slice(0, 10)} | Vence: {prescription.expires_at.slice(0, 10)}
                      </p>
                    </div>
                  </div>

                  {/* Medicamentos Prescritos */}
                  <div className="pt-2 border-t border-gray-200">
                    <span className="text-xs font-bold text-gray-700 uppercase mb-2 block flex items-center gap-1.5">
                      <Pill className="h-4 w-4 text-emerald-600" />
                      Medicamentos Prescritos ({prescription.items?.length || 0})
                    </span>

                    <div className="space-y-2">
                      {prescription.items?.map((item, idx) => (
                        <div
                          key={idx}
                          data-testid={`prescribed-item-${idx}`}
                          className="bg-white p-2.5 rounded-lg border border-gray-200 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-bold text-gray-900">{item.medication_name}</span>
                            {item.dosage && <span className="text-gray-500 ml-1">({item.dosage})</span>}
                            {item.instructions && (
                              <p className="text-gray-400 italic text-[11px] mt-0.5">"{item.instructions}"</p>
                            )}
                          </div>
                          <span className="font-extrabold text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                            Qtd: {item.quantity_prescribed} un
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-gray-100 flex flex-col md:flex-row items-center justify-between gap-3">
          {validationResult?.canDispense && (
            <div className="flex items-center gap-2 text-xs w-full md:w-auto">
              <label className="text-gray-600 font-semibold uppercase">CRF Dispensador:</label>
              <input
                type="text"
                data-testid="input-dispense-crf"
                value={pharmacistCrf}
                onChange={(e) => setPharmacistCrf(e.target.value)}
                className="border border-gray-300 rounded px-2.5 py-1 text-xs font-mono font-bold w-36"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2 w-full md:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Fechar
            </button>

            {validationResult?.canDispense && (
              <button
                type="button"
                onClick={handleDispenseAndImport}
                disabled={isDispensing}
                data-testid="btn-dispense-and-import"
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
              >
                <ArrowRight className="h-4 w-4" />
                {isDispensing ? 'Dispensando...' : 'Baixar Receita & Importar para Balcão'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DigitalPrescriptionModal;
