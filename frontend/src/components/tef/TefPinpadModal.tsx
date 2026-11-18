import { useState, useEffect, useCallback } from 'react';
import {
  CreditCard,
  Lock,
  Wifi,
  CheckCircle2,
  XCircle,
  X,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { api } from '../../services/api';
import { formatBrl } from '../ProductSearch';
import type {
  TefOperationType,
  TefInstallmentType,
  TefMockScenario,
  TefPayParams,
  TefPayResult,
} from '../../types/tef';

export type PinpadState =
  | 'IDLE'
  | 'WAITING_CARD'
  | 'WAITING_PIN'
  | 'PROCESSING'
  | 'APPROVED'
  | 'REJECTED';

export interface TefPinpadModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  onPaymentApproved: (result: TefPayResult) => void;
  initialOperationType?: TefOperationType;
  providerId?: string;
}

export default function TefPinpadModal({
  isOpen,
  onClose,
  amount,
  onPaymentApproved,
  initialOperationType = 'DEBITO',
  providerId = 'MOCK',
}: TefPinpadModalProps) {
  const [pinpadState, setPinpadState] = useState<PinpadState>('IDLE');
  const [operationType, setOperationType] = useState<TefOperationType>(initialOperationType);
  const [installments, setInstallments] = useState<number>(1);
  const [installmentType, setInstallmentType] = useState<TefInstallmentType>('A_VISTA');
  const [mockScenario, setMockScenario] = useState<TefMockScenario>('SUCCESS');
  const [approvedResult, setApprovedResult] = useState<TefPayResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Reset modal state when opened
  useEffect(() => {
    if (isOpen) {
      setPinpadState('IDLE');
      setOperationType(initialOperationType);
      setInstallments(1);
      setInstallmentType('A_VISTA');
      setMockScenario('SUCCESS');
      setApprovedResult(null);
      setErrorMessage(null);
      setIsLoading(false);
    }
  }, [isOpen, initialOperationType]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (pinpadState === 'APPROVED' && approvedResult) {
          onPaymentApproved(approvedResult);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, pinpadState, approvedResult, onClose, onPaymentApproved]);

  const handleStartPayment = useCallback(async () => {
    setErrorMessage(null);
    setIsLoading(true);
    setPinpadState('WAITING_CARD');

    const params: TefPayParams = {
      amount,
      operationType,
      installments: operationType === 'CREDITO' ? installments : 1,
      installmentType: operationType === 'CREDITO' && installments > 1 ? installmentType : 'A_VISTA',
      providerId,
      mockScenario,
    };

    try {
      // Simulate PinPad sequence in UI
      setPinpadState('PROCESSING');
      const result = await api.tef.pay(params);

      if (result && result.success) {
        setApprovedResult({ ...result, operationType: result.operationType || operationType });
        setPinpadState('APPROVED');
      } else {
        setErrorMessage(result?.errorMessage || 'Transação Recusada pela Operadora');
        setPinpadState('REJECTED');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro de comunicação com o PinPad/Adquirente');
      setPinpadState('REJECTED');
    } finally {
      setIsLoading(false);
    }
  }, [amount, operationType, installments, installmentType, providerId, mockScenario]);

  const handleConfirmApproved = () => {
    if (approvedResult) {
      onPaymentApproved(approvedResult);
    }
  };

  const handleRetry = () => {
    setPinpadState('IDLE');
    setErrorMessage(null);
    setApprovedResult(null);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tef-modal-title"
    >
      <div className="bg-slate-900 border border-slate-700 text-white rounded-2xl shadow-2xl max-w-lg w-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-slate-950 px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600/20 text-blue-400 rounded-lg border border-blue-500/30">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 id="tef-modal-title" className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                Pagamento TEF / PinPad
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-900/60 text-blue-300 border border-blue-700">
                  Dedicado
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Interface com terminal POS & autorizadoras (Cielo, Rede, Stone)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="text-slate-400 hover:text-white p-1 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Display do PinPad Virtual */}
        <div className="p-6 space-y-6">
          <div className="bg-slate-950 border-2 border-slate-800 rounded-xl p-5 shadow-inner relative flex flex-col items-center justify-center min-h-[170px] text-center">
            {/* Top PinPad status bar */}
            <div className="w-full flex items-center justify-between text-[11px] font-mono text-slate-400 border-b border-slate-800/80 pb-2 mb-4">
              <div className="flex items-center space-x-1.5 text-emerald-400">
                <Wifi className="w-3.5 h-3.5" />
                <span>ONLINE - {providerId}</span>
              </div>
              <span className="text-slate-400 font-semibold tracking-wider uppercase">
                {pinpadState}
              </span>
            </div>

            {/* PinPad Visual State Display */}
            {pinpadState === 'IDLE' && (
              <div className="space-y-2">
                <div className="text-xs text-slate-400 uppercase tracking-widest font-semibold">
                  Valor a Cobrar no PinPad
                </div>
                <div className="text-3xl font-black font-mono text-emerald-400 tracking-tight">
                  {formatBrl(amount)}
                </div>
                <p className="text-xs text-slate-400">
                  Configure os parâmetros abaixo e acione o terminal
                </p>
              </div>
            )}

            {pinpadState === 'WAITING_CARD' && (
              <div className="space-y-3 animate-pulse">
                <div className="w-12 h-12 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center mx-auto border border-blue-500/30">
                  <CreditCard className="w-6 h-6 animate-bounce" />
                </div>
                <div>
                  <p className="text-base font-bold text-white">Insira ou Aproxime o Cartão</p>
                  <p className="text-xs text-slate-400">Aguardando leitura do chip / NFC no PinPad...</p>
                </div>
              </div>
            )}

            {pinpadState === 'WAITING_PIN' && (
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/30">
                  <Lock className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-base font-bold text-white">Solicitando Senha</p>
                  <p className="text-xs text-slate-400">O cliente está digitando a senha de 4 a 6 dígitos...</p>
                  <div className="mt-2 text-xl font-mono tracking-widest text-amber-400">
                    &bull; &bull; &bull; &bull;
                  </div>
                </div>
              </div>
            )}

            {pinpadState === 'PROCESSING' && (
              <div className="space-y-3">
                <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mx-auto" />
                <div>
                  <p className="text-base font-bold text-white">Processando na Adquirente</p>
                  <p className="text-xs text-slate-400">Contatando rede autorizadora...</p>
                </div>
              </div>
            )}

            {pinpadState === 'APPROVED' && approvedResult && (
              <div className="space-y-2">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <p className="text-lg font-black text-emerald-400 tracking-wide uppercase">
                  Transação Aprovada!
                </p>
                <div className="text-xs font-mono text-slate-300 space-y-0.5">
                  <p>
                    <span className="text-slate-500">NSU:</span>{' '}
                    <strong className="text-white">{approvedResult.nsu}</strong> &bull;{' '}
                    <span className="text-slate-500">AUT:</span>{' '}
                    <strong className="text-white">{approvedResult.authorizationCode}</strong>
                  </p>
                  <p>
                    <span className="text-slate-500">Bandeira:</span>{' '}
                    <strong className="text-white">{approvedResult.brandName}</strong>{' '}
                    ({approvedResult.cardLastFour ? `**** ${approvedResult.cardLastFour}` : 'NFC'})
                  </p>
                  <p>
                    <span className="text-slate-500">Rede:</span>{' '}
                    <strong className="text-white">{approvedResult.acquirerName}</strong> &bull;{' '}
                    <span className="text-slate-500">Valor:</span>{' '}
                    <strong className="text-emerald-400">{formatBrl(approvedResult.amount)}</strong>
                  </p>
                </div>
              </div>
            )}

            {pinpadState === 'REJECTED' && (
              <div className="space-y-2">
                <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/30">
                  <XCircle className="w-7 h-7" />
                </div>
                <p className="text-lg font-black text-rose-400 tracking-wide uppercase">
                  Transação Recusada
                </p>
                <p className="text-xs text-rose-300 font-medium max-w-sm mx-auto">
                  {errorMessage || 'Operação negada pela adquirente ou cancelada pelo usuário.'}
                </p>
              </div>
            )}
          </div>

          {/* Opções de Configuração no estado IDLE */}
          {pinpadState === 'IDLE' && (
            <div className="space-y-4">
              {/* Seleção do Tipo de Operação */}
              <div>
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
                  Tipo de Operação
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setOperationType('DEBITO')}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                      operationType === 'DEBITO'
                        ? 'bg-blue-600 border-blue-500 text-white shadow-md'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <span>Débito</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOperationType('CREDITO')}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                      operationType === 'CREDITO'
                        ? 'bg-blue-600 border-blue-500 text-white shadow-md'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <span>Crédito</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOperationType('VOUCHER')}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                      operationType === 'VOUCHER'
                        ? 'bg-blue-600 border-blue-500 text-white shadow-md'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <span>Voucher</span>
                  </button>
                </div>
              </div>

              {/* Parcelamento se Crédito */}
              {operationType === 'CREDITO' && (
                <div className="grid grid-cols-2 gap-3 bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                  <div>
                    <label
                      htmlFor="tef-installments-select"
                      className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1"
                    >
                      Parcelas
                    </label>
                    <select
                      id="tef-installments-select"
                      data-testid="tef-installments-select"
                      value={installments}
                      onChange={(e) => setInstallments(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-md py-1.5 px-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="1">1x À Vista ({formatBrl(amount)})</option>
                      {Array.from({ length: 11 }, (_, i) => i + 2).map((num) => (
                        <option key={num} value={num}>
                          {num}x de {formatBrl(amount / num)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="tef-installment-type-select"
                      className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1"
                    >
                      Tipo Parcelamento
                    </label>
                    <select
                      id="tef-installment-type-select"
                      value={installmentType}
                      disabled={installments <= 1}
                      onChange={(e) => setInstallmentType(e.target.value as TefInstallmentType)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-md py-1.5 px-2 text-xs text-white disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="A_VISTA">À Vista</option>
                      <option value="PARCELADO_LOJA">Parcelado Loja (Sem Juros)</option>
                      <option value="PARCELADO_ADM">Parcelado Adm (Com Juros)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Cenário Simulado para Testes e Homologação */}
              <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800 flex items-center justify-between text-xs">
                <label
                  htmlFor="mock-scenario-select"
                  className="font-semibold text-slate-400 flex items-center space-x-1.5"
                >
                  <ShieldCheck className="w-4 h-4 text-blue-400" />
                  <span>Cenário PinPad:</span>
                </label>
                <select
                  id="mock-scenario-select"
                  data-testid="mock-scenario-select"
                  value={mockScenario}
                  onChange={(e) => setMockScenario(e.target.value as TefMockScenario)}
                  className="bg-slate-900 border border-slate-700 rounded py-1 px-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="SUCCESS">Aprovação Normal (Sucesso)</option>
                  <option value="WRONG_PIN">Senha Incorreta</option>
                  <option value="INSUFFICIENT_FUNDS">Saldo Insuficiente</option>
                  <option value="TIMEOUT">Timeout / Sem Resposta</option>
                  <option value="USER_CANCELLED">Cancelado pelo Cliente</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Footer / Ações */}
        <div className="bg-slate-950 px-6 py-4 flex items-center justify-between border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-lg transition"
          >
            Cancelar (Esc)
          </button>

          {pinpadState === 'IDLE' && (
            <button
              type="button"
              data-testid="start-tef-button"
              onClick={handleStartPayment}
              disabled={isLoading}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg transition flex items-center space-x-1.5 shadow-md shadow-blue-600/30"
            >
              <span>Iniciar no PinPad</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          {pinpadState === 'APPROVED' && (
            <button
              type="button"
              data-testid="confirm-approved-button"
              onClick={handleConfirmApproved}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition flex items-center space-x-1.5 shadow-md shadow-emerald-600/30"
            >
              <Check className="w-4 h-4" />
              <span>Confirmar Pagamento TEF</span>
            </button>
          )}

          {pinpadState === 'REJECTED' && (
            <button
              type="button"
              data-testid="retry-tef-button"
              onClick={handleRetry}
              className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs rounded-lg transition flex items-center space-x-1.5 shadow-md"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Tentar Novamente</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
