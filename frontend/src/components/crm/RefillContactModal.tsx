import React, { useState, useEffect } from 'react';
import {
  X,
  PhoneCall,
  Printer,
  Copy,
  Check,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  HeartHandshake,
  Ban,
  User,
  Pill,
} from 'lucide-react';
import { api } from '../../services/api';
import type { UpcomingRefillItem, PatientTreatment } from '../../types/crm';

export interface RefillContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  treatment: UpcomingRefillItem | PatientTreatment | null;
  onSuccess?: () => void;
}

export default function RefillContactModal({
  isOpen,
  onClose,
  treatment,
  onSuccess,
}: RefillContactModalProps) {
  const [activeTab, setActiveTab] = useState<'CONTACT' | 'SLIP' | 'DISCONTINUE'>('CONTACT');
  const [notes, setNotes] = useState('');
  const [discontinueReason, setDiscontinueReason] = useState('');
  const [slipText, setSlipText] = useState<string | null>(null);
  const [isLoadingSlip, setIsLoadingSlip] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedSlip, setCopiedSlip] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const treatmentId = (treatment as any)?.treatmentId || (treatment as any)?.id;

  useEffect(() => {
    if (isOpen && treatmentId) {
      setError(null);
      setSuccessMessage(null);
      setNotes('');
      setDiscontinueReason('');
      setCopiedSlip(false);
      setActiveTab('CONTACT');
      loadSlip(treatmentId);
    }
  }, [isOpen, treatmentId]);

  const loadSlip = async (id: number) => {
    setIsLoadingSlip(true);
    try {
      const res = await api.crm.getTreatmentSlip(id);
      setSlipText(res.textReceipt);
    } catch (err: any) {
      // Slip load error is non-fatal
    } finally {
      setIsLoadingSlip(false);
    }
  };

  const handleRegisterContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!treatmentId) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await api.crm.markTreatmentContacted(treatmentId, notes || 'Contato farmacêutico preventivo');
      setSuccessMessage('Contato farmacêutico registrado com sucesso!');
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || 'Falha ao registrar contato com o paciente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDiscontinue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!treatmentId) return;
    if (!discontinueReason.trim()) {
      setError('Informe a justificativa da descontinuação do tratamento.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await api.crm.discontinueTreatment(treatmentId, discontinueReason.trim());
      setSuccessMessage('Tratamento descontinuado com sucesso.');
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || 'Falha ao descontinuar tratamento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopySlip = () => {
    if (!slipText) return;
    navigator.clipboard.writeText(slipText);
    setCopiedSlip(true);
    setTimeout(() => setCopiedSlip(false), 2000);
  };

  const handlePrintSlip = () => {
    window.print();
  };

  if (!isOpen || !treatment) return null;

  const customerName = (treatment as any).customerName || (treatment as any).customer_name || 'Paciente';
  const customerPhone = (treatment as any).customerPhone || (treatment as any).customer_phone || 'Não informado';
  const productName = (treatment as any).productName || (treatment as any).product_name || 'Medicamento Contínuo';
  const expectedDate = (treatment as any).expectedRefillDate || (treatment as any).expected_refill_date;
  const daysSupply = (treatment as any).totalDaysSupply ?? (treatment as any).total_days_supply ?? 30;
  const daysUntil = (treatment as any).daysUntilRefill ?? 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div
        data-testid="refill-contact-modal"
        className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden text-slate-900 animate-in fade-in duration-150"
      >
        {/* Topbar */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">Atenção Farmacêutica & Adesão</h2>
              <p className="text-xs text-slate-400">
                Acompanhamento de medicamento de uso contínuo e recompra
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition p-1 rounded-md"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Card Resumo do Paciente e Medicamento */}
        <div className="bg-slate-50 border-b border-slate-200 p-4 grid grid-cols-2 gap-3 text-xs">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-indigo-600" />
              <span>Paciente</span>
            </span>
            <span className="font-bold text-slate-900 block text-sm">{customerName}</span>
            <span className="text-slate-600 font-mono">Tel: {customerPhone}</span>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1">
              <Pill className="w-3.5 h-3.5 text-emerald-600" />
              <span>Medicamento / Posologia</span>
            </span>
            <span className="font-bold text-slate-900 block truncate" title={productName}>
              {productName}
            </span>
            <div className="flex items-center space-x-2">
              <span className="text-slate-600">Duração: {daysSupply} dias</span>
              <span
                className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                  daysUntil <= 3
                    ? 'bg-rose-100 text-rose-800'
                    : daysUntil <= 7
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {daysUntil <= 0 ? 'Vencido hoje' : `Faltam ${daysUntil} dias`}
              </span>
            </div>
          </div>
        </div>

        {/* Abas */}
        <div className="flex border-b border-slate-200 bg-white px-6 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('CONTACT')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 cursor-pointer transition ${
              activeTab === 'CONTACT'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Registrar Contato
          </button>
          <button
            type="button"
            data-testid="tab-slip-button"
            onClick={() => setActiveTab('SLIP')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 cursor-pointer transition ${
              activeTab === 'SLIP'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Filipeta Térmica
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('DISCONTINUE')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 cursor-pointer transition ${
              activeTab === 'DISCONTINUE'
                ? 'border-rose-600 text-rose-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Descontinuar
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-rose-800 text-xs flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Atenção:</p>
                <p className="text-rose-700">{error}</p>
              </div>
            </div>
          )}

          {successMessage && (
            <div
              data-testid="contact-success-banner"
              className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-emerald-900 text-xs flex items-start space-x-2"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Sucesso:</p>
                <p className="text-emerald-800">{successMessage}</p>
              </div>
            </div>
          )}

          {/* Aba 1: Registrar Contato */}
          {activeTab === 'CONTACT' && (
            <form onSubmit={handleRegisterContact} className="space-y-4">
              <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-lg text-xs text-emerald-900">
                <p className="font-bold flex items-center gap-1.5">
                  <PhoneCall className="w-4 h-4 text-emerald-600" />
                  <span>Contato Preventivo para Recompra e Adesão Farmacêutica</span>
                </p>
                <p className="mt-1 text-slate-600">
                  Data prevista para término das doses:{' '}
                  <strong className="text-slate-900">{expectedDate?.slice(0, 10)}</strong>. Verifique se o
                  paciente está tomando a medicação corretamente e confirme a reserva/entrega da próxima caixa.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Notas da Interação / Orientações Farmacêuticas
                </label>
                <textarea
                  data-testid="contact-notes-input"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Paciente orientado sobre horários de tomada. Solicitou separar 1 caixa para retirada amanhã..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold transition"
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  data-testid="confirm-contact-btn"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <PhoneCall className="w-4 h-4" />
                  )}
                  <span>Registrar Contato Realizado</span>
                </button>
              </div>
            </form>
          )}

          {/* Aba 2: Filipeta Térmica */}
          {activeTab === 'SLIP' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-semibold">
                  Modelo para impressora não fiscal térmica 48 colunas:
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    data-testid="copy-slip-btn"
                    onClick={handleCopySlip}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-semibold transition"
                  >
                    {copiedSlip ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar Texto</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handlePrintSlip}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold transition"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Imprimir</span>
                  </button>
                </div>
              </div>

              {isLoadingSlip ? (
                <div className="p-8 flex justify-center items-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                </div>
              ) : (
                <pre
                  data-testid="refill-slip-text"
                  className="font-mono text-[11px] leading-relaxed whitespace-pre-wrap max-h-72 overflow-y-auto text-emerald-300 bg-slate-950 p-3 rounded-lg border border-slate-800"
                >
                  {slipText || 'Carregando filipeta térmica...'}
                </pre>
              )}
            </div>
          )}

          {/* Aba 3: Descontinuar Tratamento */}
          {activeTab === 'DISCONTINUE' && (
            <form onSubmit={handleDiscontinue} className="space-y-4">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900">
                <p className="font-bold flex items-center gap-1.5">
                  <Ban className="w-4 h-4 text-rose-600" />
                  <span>Descontinuação de Tratamento Contínuo</span>
                </p>
                <p className="mt-1 text-rose-800">
                  Ao descontinuar, o paciente não receberá mais alertas nem lembretes de recompra deste
                  medicamento.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Motivo da Descontinuação *
                </label>
                <textarea
                  data-testid="discontinue-reason-input"
                  rows={3}
                  value={discontinueReason}
                  onChange={(e) => setDiscontinueReason(e.target.value)}
                  placeholder="Ex: Alta médica concedida, troca de medicação pelo médico, paciente mudou de cidade..."
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-hidden focus:border-rose-500"
                />
              </div>

              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  data-testid="discontinue-treatment-btn"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Ban className="w-4 h-4" />
                  )}
                  <span>Confirmar Descontinuação</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-100 border-t border-slate-200 px-6 py-3 flex justify-between items-center text-xs">
          <span className="text-slate-500">
            Acompanhamento farmacêutico alinhado às diretrizes da RDC 44/2009 e CRF
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded font-bold transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
