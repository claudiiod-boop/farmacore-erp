import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  X,
  ShieldCheck,
  Search,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  User,
  FileText,
  BadgePercent,
  Check,
  Building2,
} from 'lucide-react';
import { api, Product, searchProducts } from '../../services/api';
import { formatBrl } from '../ProductSearch';
import type {
  PbmConfig,
  PbmAuthorizeParams,
  PbmAuthorizationResult,
  PbmItemRequest,
} from '../../types';

export interface PbmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthorized?: (result: PbmAuthorizationResult) => void;
  initialCpf?: string;
  initialPatientName?: string;
  initialItems?: Array<{
    product: Product;
    quantity: number;
    dailyDose?: number;
    batchId?: number;
  }>;
}

const BRAZILIAN_UFS = [
  'SP', 'RJ', 'MG', 'RS', 'PR', 'SC', 'BA', 'PE', 'CE', 'GO',
  'ES', 'DF', 'MT', 'MS', 'MA', 'PA', 'PB', 'RN', 'AL', 'SE',
  'PI', 'TO', 'RO', 'AC', 'AP', 'AM', 'RR'
];

export function formatCpf(val: string): string {
  const digits = val.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export default function PbmModal({
  isOpen,
  onClose,
  onAuthorized,
  initialCpf = '',
  initialPatientName = '',
  initialItems = [],
}: PbmModalProps) {
  // Providers list
  const [providers, setProviders] = useState<PbmConfig[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('FARMACIA_POPULAR');

  // Beneficiary form
  const [patientCpf, setPatientCpf] = useState(initialCpf);
  const [patientName, setPatientName] = useState(initialPatientName);
  const [patientBirthDate, setPatientBirthDate] = useState('');
  const [isBolsaFamilia, setIsBolsaFamilia] = useState(false);

  // Prescriber form
  const [doctorName, setDoctorName] = useState('');
  const [doctorCrm, setDoctorCrm] = useState('');
  const [doctorUf, setDoctorUf] = useState('SP');
  const [prescriptionDate, setPrescriptionDate] = useState(() => {
    return new Date().toISOString().slice(0, 10);
  });

  // Proxy form (optional)
  const [proxyName, setProxyName] = useState('');
  const [proxyCpf, setProxyCpf] = useState('');

  // CID / Laudo (optional)
  const [cidLaudo, setCidLaudo] = useState('');

  // Items list
  const [items, setItems] = useState<PbmItemRequest[]>([]);

  // Item Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [itemDailyDose, setItemDailyDose] = useState<number>(1);
  const [itemQuantity, setItemQuantity] = useState<number>(1);

  // Authorization state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authResult, setAuthResult] = useState<PbmAuthorizationResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cpfInputRef = useRef<HTMLInputElement>(null);
  const prevIsOpenRef = useRef(false);

  // Initialize or reset when modal opens
  useEffect(() => {
    if (!isOpen) {
      prevIsOpenRef.current = false;
      return;
    }

    if (!prevIsOpenRef.current) {
      prevIsOpenRef.current = true;
      setPatientCpf(initialCpf ? formatCpf(initialCpf) : '');
      setPatientName(initialPatientName || '');
      setPatientBirthDate('');
      setIsBolsaFamilia(false);
      setDoctorName('');
      setDoctorCrm('');
      setDoctorUf('SP');
      setPrescriptionDate(new Date().toISOString().slice(0, 10));
      setProxyName('');
      setProxyCpf('');
      setCidLaudo('');
      setAuthResult(null);
      setErrorMessage(null);
      setSearchQuery('');
      setSearchResults([]);
      setItemDailyDose(1);
      setItemQuantity(1);

      if (initialItems && initialItems.length > 0) {
        setItems(
          initialItems.map((it) => ({
            productId: it.product.id,
            ean: it.product.ean,
            msRegistration: it.product.msRegistration || '1000000000000',
            productName: it.product.name,
            quantity: it.quantity,
            unitPrice: it.product.price,
            dailyDose: it.dailyDose || 1,
            batchId: it.batchId,
          }))
        );
      } else {
        setItems([]);
      }

      // Load active PBM providers
      api.pbm
        .getProviders(true)
        .then((data) => {
          if (data && data.length > 0) {
            setProviders(data);
            const hasFp = data.find((p) => p.providerId === 'FARMACIA_POPULAR');
            if (hasFp) setSelectedProvider('FARMACIA_POPULAR');
            else setSelectedProvider(data[0].providerId);
          }
        })
        .catch(() => {
          // Fallback default
          setProviders([
            {
              id: 1,
              providerId: 'FARMACIA_POPULAR',
              providerName: 'Aqui Tem Farmácia Popular (Datasus/MS)',
              environment: 'MOCK',
              isActive: 1,
              createdAt: '',
              updatedAt: '',
            },
          ]);
          setSelectedProvider('FARMACIA_POPULAR');
        });

      setTimeout(() => cpfInputRef.current?.focus(), 80);
    }
  }, [isOpen, initialCpf, initialPatientName, initialItems]);

  // Product search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchProducts(searchQuery.trim());
        setSearchResults(results.slice(0, 8));
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleAddItem = (prod: Product) => {
    const qty = Math.max(1, itemQuantity);
    const dose = Math.max(1, itemDailyDose);

    setItems((prev) => {
      const idx = prev.findIndex((it) => it.productId === prod.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          quantity: updated[idx].quantity + qty,
          dailyDose: dose,
        };
        return updated;
      }
      return [
        ...prev,
        {
          productId: prod.id,
          ean: prod.ean,
          msRegistration: prod.msRegistration || '1000000000000',
          productName: prod.name,
          quantity: qty,
          unitPrice: prod.price,
          dailyDose: dose,
        },
      ];
    });

    setSearchQuery('');
    setSearchResults([]);
    setItemQuantity(1);
    setItemDailyDose(1);
    setAuthResult(null); // Reset authorization if items change
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
    setAuthResult(null);
  };

  // Preliminary live calculations
  const totalGross = useMemo(() => {
    return Number(items.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0).toFixed(2));
  }, [items]);

  const estimatedSubsidy = useMemo(() => {
    if (authResult?.success) return authResult.subsidyAmount;
    if (isBolsaFamilia) return totalGross;
    // Estimate 90% subsidy for preview if Farmácia Popular
    if (selectedProvider === 'FARMACIA_POPULAR') {
      return Number((totalGross * 0.9).toFixed(2));
    }
    return 0;
  }, [authResult, isBolsaFamilia, selectedProvider, totalGross]);

  const estimatedCopay = useMemo(() => {
    if (authResult?.success) return authResult.patientCopayAmount;
    return Math.max(0, Number((totalGross - estimatedSubsidy).toFixed(2)));
  }, [authResult, totalGross, estimatedSubsidy]);

  // Authorization Submission
  const handleAuthorize = useCallback(async () => {
    setErrorMessage(null);

    const cleanCpf = patientCpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      setErrorMessage('Informe um CPF válido do beneficiário com 11 dígitos.');
      return;
    }

    if (!patientName.trim()) {
      setErrorMessage('Informe o nome do beneficiário.');
      return;
    }

    if (!doctorCrm.trim()) {
      setErrorMessage('Informe o CRM do médico prescritor.');
      return;
    }

    if (!prescriptionDate) {
      setErrorMessage('Informe a data da receita médica.');
      return;
    }

    if (items.length === 0) {
      setErrorMessage('Adicione ao menos um medicamento para autorização.');
      return;
    }

    const params: PbmAuthorizeParams = {
      providerId: selectedProvider,
      patientCpf: cleanCpf,
      patientName: patientName.trim(),
      patientBirthDate: patientBirthDate || undefined,
      doctorCrm: doctorCrm.trim(),
      doctorUf: doctorUf.trim().toUpperCase(),
      doctorName: doctorName.trim() || undefined,
      prescriptionDate,
      proxyName: proxyName.trim() || undefined,
      proxyCpf: proxyCpf.replace(/\D/g, '') || undefined,
      isBolsaFamilia,
      cidLaudo: cidLaudo.trim() || undefined,
      items: items.map((it) => ({
        productId: it.productId,
        ean: it.ean,
        msRegistration: it.msRegistration,
        productName: it.productName,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        dailyDose: it.dailyDose || 1,
      })),
    };

    setIsSubmitting(true);
    try {
      const res = await api.pbm.authorize(params);
      if (!res.success) {
        setErrorMessage(res.errorMessage || 'Autorização PBM rejeitada.');
        setAuthResult(res);
      } else {
        setAuthResult(res);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro de comunicação ao autorizar convênio.');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    patientCpf,
    patientName,
    patientBirthDate,
    doctorCrm,
    doctorUf,
    doctorName,
    prescriptionDate,
    proxyName,
    proxyCpf,
    isBolsaFamilia,
    cidLaudo,
    items,
    selectedProvider,
  ]);

  const handleApplyToSale = () => {
    if (authResult?.success && onAuthorized) {
      onAuthorized(authResult);
    }
    onClose();
  };

  // Keyboard Shortcuts (F10 to Authorize, ESC to Close)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F10') {
        e.preventDefault();
        if (!isSubmitting) {
          if (authResult?.success) {
            handleApplyToSale();
          } else {
            handleAuthorize();
          }
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, authResult, handleAuthorize, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pbm-modal-title"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-4xl w-full shadow-2xl flex flex-col max-h-[94vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 id="pbm-modal-title" className="text-base font-bold text-white flex items-center gap-2">
                Autorização de Convênio Farmacêutico & Farmácia Popular
                <span className="text-xs font-mono font-semibold text-emerald-400 bg-emerald-950/70 px-2 py-0.5 rounded border border-emerald-800">
                  [F6]
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Portaria MS nº 184/2011 — Conexão oficial Datasus / PBM com cálculo em tempo real
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            title="Fechar (ESC)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 p-6 overflow-y-auto space-y-5 bg-slate-900 text-slate-200">
          {/* Error / Alert banner */}
          {errorMessage && (
            <div
              data-testid="pbm-error-banner"
              className="bg-red-950/70 border border-red-800 rounded-lg p-3 text-red-200 text-xs flex items-start space-x-3 animate-in fade-in"
            >
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold">Atenção na Autorização:</span> {errorMessage}
              </div>
            </div>
          )}

          {/* Success banner if authorized */}
          {authResult?.success && (
            <div
              data-testid="pbm-success-banner"
              className="bg-emerald-950/80 border border-emerald-700 rounded-lg p-4 text-emerald-200 text-xs flex items-center justify-between shadow-lg animate-in fade-in"
            >
              <div className="flex items-center space-x-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                <div>
                  <div className="text-sm font-bold text-white flex items-center gap-2">
                    Autorização Aprovada com Sucesso!
                    <span className="font-mono bg-emerald-900 px-2 py-0.5 rounded border border-emerald-600 text-white">
                      Prot: {authResult.authorizationProtocol}
                    </span>
                  </div>
                  <div className="text-emerald-300 mt-1">
                    Cota Subsidiada: <strong className="text-white">{formatBrl(authResult.subsidyAmount)}</strong> | Co-pagamento Paciente: <strong className="text-white">{formatBrl(authResult.patientCopayAmount)}</strong>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleApplyToSale}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs shadow-md transition cursor-pointer flex items-center space-x-1"
              >
                <Check className="w-4 h-4" />
                <span>Aplicar ao Pedido</span>
              </button>
            </div>
          )}

          {/* Section 1: Provider Selection & Bolsa Família */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-950/60 p-4 rounded-lg border border-slate-800">
            <div className="md:col-span-2">
              <label htmlFor="pbm-provider" className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                Provedor de Convênio / PBM
              </label>
              <select
                id="pbm-provider"
                value={selectedProvider}
                onChange={(e) => {
                  setSelectedProvider(e.target.value);
                  setAuthResult(null);
                }}
                disabled={authResult?.success}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-emerald-500"
              >
                {providers.map((p) => (
                  <option key={p.providerId} value={p.providerId}>
                    {p.providerName} ({p.environment})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col justify-end">
              <label className="flex items-center space-x-2 text-xs text-slate-200 cursor-pointer p-2 rounded hover:bg-slate-900 border border-slate-800">
                <input
                  type="checkbox"
                  data-testid="bolsa-familia-checkbox"
                  checked={isBolsaFamilia}
                  onChange={(e) => {
                    setIsBolsaFamilia(e.target.checked);
                    setAuthResult(null);
                  }}
                  disabled={authResult?.success}
                  className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 bg-slate-800 border-slate-600"
                />
                <span className="font-semibold text-emerald-400">Beneficiário Bolsa Família</span>
              </label>
              <span className="text-[10px] text-slate-500 px-1 mt-0.5">100% gratuito conforme Portaria MS</span>
            </div>
          </div>

          {/* Section 2: Beneficiary & Prescriber Data */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Beneficiary */}
            <div className="bg-slate-950/40 p-4 rounded-lg border border-slate-800 space-y-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-1.5">
                <User className="w-3.5 h-3.5 text-emerald-400" />
                1. Identificação do Beneficiário
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="pbm-patient-cpf" className="block text-[11px] font-semibold text-slate-400 mb-1">
                    CPF do Paciente *
                  </label>
                  <input
                    id="pbm-patient-cpf"
                    ref={cpfInputRef}
                    data-testid="patient-cpf-input"
                    type="text"
                    value={patientCpf}
                    onChange={(e) => {
                      setPatientCpf(formatCpf(e.target.value));
                      setAuthResult(null);
                    }}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    disabled={authResult?.success}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-hidden focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label htmlFor="pbm-patient-birthdate" className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Data de Nascimento
                  </label>
                  <input
                    id="pbm-patient-birthdate"
                    data-testid="patient-birthdate-input"
                    type="date"
                    value={patientBirthDate}
                    onChange={(e) => {
                      setPatientBirthDate(e.target.value);
                      setAuthResult(null);
                    }}
                    disabled={authResult?.success}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="pbm-patient-name" className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Nome Completo do Paciente *
                </label>
                <input
                  id="pbm-patient-name"
                  data-testid="patient-name-input"
                  type="text"
                  value={patientName}
                  onChange={(e) => {
                    setPatientName(e.target.value);
                    setAuthResult(null);
                  }}
                  placeholder="Nome do titular do CPF"
                  disabled={authResult?.success}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              {/* Legal Proxy (Optional) */}
              <div className="pt-2 border-t border-slate-800/80">
                <span className="text-[10px] text-slate-400 font-semibold block mb-1">
                  Retirada por Procurador Legal (Opcional):
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={proxyName}
                    onChange={(e) => setProxyName(e.target.value)}
                    placeholder="Nome do Procurador"
                    disabled={authResult?.success}
                    className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-white focus:outline-hidden focus:border-emerald-500"
                  />
                  <input
                    type="text"
                    value={proxyCpf}
                    onChange={(e) => setProxyCpf(formatCpf(e.target.value))}
                    placeholder="CPF Procurador"
                    maxLength={14}
                    disabled={authResult?.success}
                    className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-white font-mono focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Prescriber */}
            <div className="bg-slate-950/40 p-4 rounded-lg border border-slate-800 space-y-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-1.5">
                <FileText className="w-3.5 h-3.5 text-emerald-400" />
                2. Prescritor & Receita Médica
              </h3>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label htmlFor="pbm-doctor-crm" className="block text-[11px] font-semibold text-slate-400 mb-1">
                    CRM do Médico *
                  </label>
                  <input
                    id="pbm-doctor-crm"
                    data-testid="doctor-crm-input"
                    type="text"
                    value={doctorCrm}
                    onChange={(e) => {
                      setDoctorCrm(e.target.value);
                      setAuthResult(null);
                    }}
                    placeholder="Ex: 123456"
                    disabled={authResult?.success}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label htmlFor="pbm-doctor-uf" className="block text-[11px] font-semibold text-slate-400 mb-1">
                    UF *
                  </label>
                  <select
                    id="pbm-doctor-uf"
                    value={doctorUf}
                    onChange={(e) => {
                      setDoctorUf(e.target.value);
                      setAuthResult(null);
                    }}
                    disabled={authResult?.success}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-hidden focus:border-emerald-500"
                  >
                    {BRAZILIAN_UFS.map((uf) => (
                      <option key={uf} value={uf}>
                        {uf}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="pbm-doctor-name" className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Nome do Médico Prescritor
                </label>
                <input
                  id="pbm-doctor-name"
                  data-testid="doctor-name-input"
                  type="text"
                  value={doctorName}
                  onChange={(e) => {
                    setDoctorName(e.target.value);
                    setAuthResult(null);
                  }}
                  placeholder="Dr(a). Nome Completo"
                  disabled={authResult?.success}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="pbm-prescription-date" className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Data da Receita *
                  </label>
                  <input
                    id="pbm-prescription-date"
                    data-testid="prescription-date-input"
                    type="date"
                    value={prescriptionDate}
                    onChange={(e) => {
                      setPrescriptionDate(e.target.value);
                      setAuthResult(null);
                    }}
                    disabled={authResult?.success}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label htmlFor="pbm-cid-laudo" className="block text-[11px] font-semibold text-slate-400 mb-1">
                    CID / Laudo (Opt)
                  </label>
                  <input
                    id="pbm-cid-laudo"
                    type="text"
                    value={cidLaudo}
                    onChange={(e) => setCidLaudo(e.target.value)}
                    placeholder="Ex: I10"
                    disabled={authResult?.success}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Items Selection */}
          <div className="bg-slate-950/40 p-4 rounded-lg border border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between border-b border-slate-800 pb-1.5">
              <span className="flex items-center gap-1.5">
                <BadgePercent className="w-3.5 h-3.5 text-emerald-400" />
                3. Medicamentos Solicitados ({items.length})
              </span>
              <span className="text-[11px] text-slate-500 font-normal">
                Busque pelo nome ou EAN
              </span>
            </h3>

            {/* Product Search & Quick Add */}
            {!authResult?.success && (
              <div className="relative">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      data-testid="pbm-item-search"
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Pesquisar medicamento por nome ou código de barras (EAN)..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-hidden focus:border-emerald-500"
                    />
                    {isSearching && (
                      <Loader2 className="w-4 h-4 text-emerald-400 absolute right-3 top-2.5 animate-spin" />
                    )}
                  </div>
                  <div className="w-24">
                    <input
                      type="number"
                      min={1}
                      value={itemDailyDose}
                      onChange={(e) => setItemDailyDose(Number(e.target.value))}
                      placeholder="Dose/Dia"
                      title="Posologia: doses/dia"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-xs text-white text-center"
                    />
                  </div>
                  <div className="w-20">
                    <input
                      type="number"
                      min={1}
                      value={itemQuantity}
                      onChange={(e) => setItemQuantity(Number(e.target.value))}
                      placeholder="Qtd"
                      title="Quantidade solicitada"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-xs text-white text-center"
                    />
                  </div>
                </div>

                {/* Search dropdown results */}
                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-slate-950 border border-slate-700 rounded-lg shadow-xl overflow-hidden max-h-56 overflow-y-auto">
                    {searchResults.map((prod) => (
                      <button
                        key={prod.id}
                        type="button"
                        onClick={() => handleAddItem(prod)}
                        className="w-full text-left px-3 py-2 hover:bg-slate-800 border-b border-slate-850 flex items-center justify-between text-xs transition"
                      >
                        <div>
                          <div className="font-semibold text-white">{prod.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            EAN: {prod.ean} | MS: {prod.msRegistration || 'N/D'}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-emerald-400">{formatBrl(prod.price)}</span>
                          <span className="block text-[10px] text-slate-500">Adicionar</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Items Table */}
            <div className="border border-slate-800 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-3 py-2 font-medium">Medicamento</th>
                    <th className="px-3 py-2 font-medium font-mono text-center">EAN</th>
                    <th className="px-3 py-2 font-medium text-center">Dose Diária</th>
                    <th className="px-3 py-2 font-medium text-center">Qtd</th>
                    <th className="px-3 py-2 font-medium text-right">Unitário</th>
                    <th className="px-3 py-2 font-medium text-right">Total</th>
                    {!authResult?.success && <th className="px-2 py-2 text-center w-10"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/50">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                        Nenhum medicamento adicionado ainda. Busque e adicione acima.
                      </td>
                    </tr>
                  ) : (
                    items.map((item, idx) => {
                      const itemResult = authResult?.items?.find((r) => r.productId === item.productId);
                      return (
                        <tr key={`${item.productId}-${idx}`} className="hover:bg-slate-800/40">
                          <td className="px-3 py-2">
                            <div className="font-medium text-white">{item.productName}</div>
                            {itemResult?.rejectReason && (
                              <div className="text-[10px] text-red-400 font-semibold mt-0.5">
                                Motivo: {itemResult.rejectReason}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 font-mono text-slate-400 text-center">
                            {item.ean}
                          </td>
                          <td className="px-3 py-2 text-center text-slate-300">
                            {item.dailyDose || 1}x ao dia
                          </td>
                          <td className="px-3 py-2 text-center font-bold text-white">
                            {item.quantity}
                          </td>
                          <td className="px-3 py-2 text-right text-slate-300 font-mono">
                            {formatBrl(item.unitPrice)}
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-white font-mono">
                            {formatBrl(item.unitPrice * item.quantity)}
                          </td>
                          {!authResult?.success && (
                            <td className="px-2 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="text-slate-500 hover:text-red-400 p-1 rounded transition cursor-pointer"
                                title="Remover item"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 4: Live Subsidies Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Total Gross */}
            <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 flex flex-col justify-between">
              <span className="text-[11px] text-slate-400 font-semibold uppercase">Total Bruto dos Medicamentos</span>
              <div className="text-xl font-bold font-mono text-white mt-1">
                {formatBrl(totalGross)}
              </div>
              <span className="text-[10px] text-slate-500 mt-1">Preço balcão farmácia</span>
            </div>

            {/* Subsidy Amount (Governo / PBM) */}
            <div className="bg-emerald-950/40 p-3.5 rounded-lg border border-emerald-800/80 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-emerald-400 font-semibold uppercase">
                  Subsidiado pelo Governo
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-300 font-bold">
                  {authResult?.success ? 'CONFIRMADO' : 'ESTIMADO'}
                </span>
              </div>
              <div
                data-testid="subsidy-amount-display"
                className="text-xl font-bold font-mono text-emerald-300 mt-1"
              >
                {formatBrl(estimatedSubsidy)}
              </div>
              <span className="text-[10px] text-emerald-400/80 mt-1">
                {isBolsaFamilia ? '100% Gratuito (Bolsa Família)' : 'Pago pelo Ministério da Saúde'}
              </span>
            </div>

            {/* Patient Copay Amount (A Pagar) */}
            <div className="bg-blue-950/40 p-3.5 rounded-lg border border-blue-800/80 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-blue-400 font-semibold uppercase">
                  A Pagar pelo Beneficiário
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-950 border border-blue-700 text-blue-300 font-bold">
                  CO-PAGAMENTO
                </span>
              </div>
              <div
                data-testid="copay-amount-display"
                className="text-xl font-bold font-mono text-blue-300 mt-1"
              >
                {formatBrl(estimatedCopay)}
              </div>
              <span className="text-[10px] text-blue-400/80 mt-1">
                Cobrado no caixa do PDV
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-950 px-6 py-4 border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span>Atalhos:</span>
            <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-mono font-bold">F10</kbd>
            <span>{authResult?.success ? 'Concluir' : 'Autorizar'}</span> |
            <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-mono font-bold">ESC</kbd>
            <span>Fechar</span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg text-xs transition cursor-pointer"
            >
              Cancelar (ESC)
            </button>

            {authResult?.success ? (
              <button
                type="button"
                data-testid="pbm-apply-button"
                onClick={handleApplyToSale}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs flex items-center space-x-2 transition shadow-lg cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>[F10] Concluir & Vincular à Venda</span>
              </button>
            ) : (
              <button
                type="button"
                data-testid="pbm-authorize-button"
                onClick={handleAuthorize}
                disabled={isSubmitting || items.length === 0}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs flex items-center space-x-2 transition shadow-lg cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Comunicando com Datasus...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>[F10] Autorizar Convênio</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
