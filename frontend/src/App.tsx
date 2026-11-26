import { useState, useEffect } from 'react';
import CounterPage from './pages/CounterPage';
import PosPage from './pages/PosPage';
import PurchasesPage from './pages/PurchasesPage';
import SngpcPage from './pages/SngpcPage';
import FinancialDashboardPage from './pages/FinancialDashboardPage';
import MultiStorePage from './pages/MultiStorePage';
import InventoryPage from './pages/InventoryPage';
import CustomerCreditPage from './pages/CustomerCreditPage';
import CrmPage from './pages/CrmPage';
import DeliveryPage from './pages/DeliveryPage';
import { SanitaryPage } from './pages/SanitaryPage';
import CardReconciliationPage from './pages/CardReconciliationPage';
import BankReconciliationPage from './pages/BankReconciliationPage';
import SpedFiscalPage from './pages/SpedFiscalPage';
import ClinicalConsultingPage from './pages/ClinicalConsultingPage';
import B2bQuotationsPage from './pages/B2bQuotationsPage';
import CmedPricingPage from './pages/CmedPricingPage';
import { OmnichannelPickPackPage } from './pages/OmnichannelPickPackPage';
import { CompoundingPage } from './pages/CompoundingPage';
import { SubscriptionsPage } from './pages/SubscriptionsPage';
import { FractionationPage } from './pages/FractionationPage';
import { CommissionsPage } from './pages/CommissionsPage';
import { DreAnalyticsPage } from './pages/DreAnalyticsPage';
import { PgrssDisposalPage } from './pages/PgrssDisposalPage';
import { KioskPage } from './pages/KioskPage';
import { BmpoRegulatoryPage } from './pages/BmpoRegulatoryPage';
import { SncmTraceabilityPage } from './pages/SncmTraceabilityPage';
import { SmartReplenishmentPage } from './pages/SmartReplenishmentPage';
import { CustomerReturnsPage } from './pages/CustomerReturnsPage';
import { QuarantineRegulatoryPage } from './pages/QuarantineRegulatoryPage';
import { TemperatureMonitoringPage } from './pages/TemperatureMonitoringPage';
import { SanitizationCompliancePage } from './pages/SanitizationCompliancePage';
import { InjectablesVaccinationPage } from './pages/InjectablesVaccinationPage';
import { PharmacovigilancePage } from './pages/PharmacovigilancePage';
import { MarketplaceHubPage } from './pages/MarketplaceHubPage';
import { BackupDisasterRecoveryPage } from './pages/BackupDisasterRecoveryPage';
import { SelfCheckoutTouchPage } from './pages/SelfCheckoutTouchPage';
import { DdaReconciliationPage } from './pages/DdaReconciliationPage';
import { SanitaryAuditDossierPage } from './pages/SanitaryAuditDossierPage';
import { CorporateAgreementsBillingPage } from './pages/CorporateAgreementsBillingPage';
import { BlindInventoryPage } from './pages/BlindInventoryPage';
import { SatFiscalPage } from './pages/SatFiscalPage';
import { PrecisionScalePage } from './pages/PrecisionScalePage';
import { FarmaciaPopularAuditPage } from './pages/FarmaciaPopularAuditPage';
import { MdfePage } from './pages/MdfePage';
import { PharmaceuticalAssistancePage } from './pages/PharmaceuticalAssistancePage';
import PbmModal from './components/pbm/PbmModal';
import StoreSelector from './components/StoreSelector';
import StoreProvider from './contexts/StoreContext';
import { useStationMode } from './hooks/useStationMode';
import {
  ArrowLeftRight,
  Monitor,
  Store,
  Package,
  ShieldAlert,
  ShieldCheck,
  DollarSign,
  Building2,
  ClipboardList,
  Users,
  Sparkles,
  Bike,
  CreditCard,
  FileCode,
  Stethoscope,
  Truck,
  Scale,
  MessageSquare,
  FlaskConical,
  Repeat,
  Scissors,
  Award,
  PieChart,
  Trash2,
  MonitorSmartphone,
  FileSpreadsheet,
  QrCode,
  Landmark,
  TrendingUp,
  RotateCcw,
  Thermometer,
} from 'lucide-react';

function AppContent() {
  const { mode, setMode, isCounter, isPos, isPurchases, isSngpc, isFinancial, isStores, isInventory, isCredit, isCrm, isDelivery, isSanitary, isCardReconciliation, isBankReconciliation, isSpedFiscal, isClinicalConsulting, isB2bQuotations, isCmedPricing, isOmnichannelPickPack, isCompounding, isSubscriptionClub, isFractionation, isCommissions, isDre, isPgrss, isKiosk, isBmpo, isSncm, isReplenishment, isCustomerReturns, isQuarantine, isTemperatureMonitoring, isSanitizationCompliance, isInjectablesVaccination, isPharmacovigilance, isMarketplaceHub, isBackupDisasterRecovery, isSelfCheckoutTouch, isDdaReconciliation, isSanitaryAuditDossier, isCorporateAgreementsBilling, isBlindInventoryAudit, isSatFiscalModule, isPrecisionScaleModule, isFarmaciaPopularAudit, isMdfeFiscalModule, isPharmaceuticalAssistance } = useStationMode();
  const [isPbmModalOpen, setIsPbmModalOpen] = useState(false);

  // Listen to keyboard shortcuts (F1-F7, and Ctrl+Shift+S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Station hotkeys F1-F5, F7
      if (e.key === 'F1') {
        e.preventDefault();
        setMode('COUNTER');
        return;
      }
      if (e.key === 'F2') {
        e.preventDefault();
        setMode('POS');
        return;
      }
      if (e.key === 'F3') {
        e.preventDefault();
        setMode('PURCHASES');
        return;
      }
      if (e.key === 'F4') {
        e.preventDefault();
        setMode('SNGPC');
        return;
      }
      if (e.key === 'F5') {
        e.preventDefault();
        setMode('FINANCIAL');
        return;
      }

      // PBM / Farmácia Popular shortcut F6
      if (e.key === 'F6') {
        e.preventDefault();
        setIsPbmModalOpen((prev) => !prev);
        return;
      }

      // Rede & Filiais shortcut F7
      if (e.key === 'F7') {
        e.preventDefault();
        setMode('STORES');
        return;
      }

      // Inventário / Balanço shortcut F8
      if (e.key === 'F8') {
        e.preventDefault();
        setMode('INVENTORY');
        return;
      }

      // Convênios & Crediário shortcut F9
      if (e.key === 'F9') {
        e.preventDefault();
        setMode('CREDIT');
        return;
      }

      // CRM & Fidelidade shortcut F10
      if (e.key === 'F10') {
        e.preventDefault();
        setMode('CRM');
        return;
      }

      // Delivery & Tele-Entrega shortcut F11
      if (e.key === 'F11') {
        e.preventDefault();
        setMode('DELIVERY');
        return;
      }

      // Validades & Vigilância Sanitária shortcut F12
      if (e.key === 'F12') {
        e.preventDefault();
        setMode('SANITARY');
        return;
      }

      // Legacy toggle shortcut Ctrl+Shift+S
      if (
        (e.key === 's' || e.key === 'S') &&
        e.ctrlKey &&
        e.shiftKey
      ) {
        e.preventDefault();
        setMode(mode === 'COUNTER' ? 'POS' : 'COUNTER');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mode, setMode]);

  const toggleStationMode = () => {
    setMode(mode === 'COUNTER' ? 'POS' : 'COUNTER');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-900 text-slate-100">
      {/* Station Mode Switcher Topbar */}
      <div className="bg-slate-950 border-b border-slate-800 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs select-none">
        <div className="flex items-center space-x-4">
          {/* Quick toggle pill for backwards compatibility & current mode badge */}
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-400">Posto de Trabalho:</span>
            <button
              type="button"
              onClick={toggleStationMode}
              title="Alternar posto fixo de trabalho (Ctrl+Shift+S)"
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full font-bold transition shadow-xs border bg-slate-800 hover:bg-slate-700 text-white border-slate-700 cursor-pointer"
            >
              {isCounter ? (
                <>
                  <Store className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Posto: Balcão</span>
                </>
              ) : isPos ? (
                <>
                  <Monitor className="w-3.5 h-3.5 text-blue-400" />
                  <span>Posto: Caixa PDV</span>
                </>
              ) : isPurchases ? (
                <>
                  <Package className="w-3.5 h-3.5 text-amber-400" />
                  <span>Posto: Compras</span>
                </>
              ) : isSngpc ? (
                <>
                  <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
                  <span>Posto: SNGPC</span>
                </>
              ) : isFinancial ? (
                <>
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Posto: Financeiro</span>
                </>
              ) : isStores ? (
                <>
                  <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Posto: Rede & Filiais</span>
                </>
              ) : isInventory ? (
                <>
                  <ClipboardList className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Posto: Inventário</span>
                </>
              ) : isCredit ? (
                <>
                  <Users className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Posto: Convênios</span>
                </>
              ) : isCrm ? (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Posto: CRM</span>
                </>
              ) : (
                <>
                  <Bike className="w-3.5 h-3.5 text-amber-400" />
                  <span>Posto: Delivery</span>
                </>
              )}
              <ArrowLeftRight className="w-3 h-3 ml-1 text-slate-400" />
            </button>
          </div>

          {/* Navigation Station Selector Buttons [F1]..[F5], [F7] */}
          <nav className="flex items-center space-x-1.5 flex-wrap gap-y-1" aria-label="Estações de Trabalho">
            <button
              type="button"
              onClick={() => setMode('COUNTER')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition border text-xs cursor-pointer ${
                isCounter
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-600 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
              }`}
            >
              <Store className="w-3.5 h-3.5 text-emerald-400" />
              <span>[F1] Balcão</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('POS')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition border text-xs cursor-pointer ${
                isPos
                  ? 'bg-blue-950 text-blue-300 border-blue-600 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
              }`}
            >
              <Monitor className="w-3.5 h-3.5 text-blue-400" />
              <span>[F2] Caixa</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('PURCHASES')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition border text-xs cursor-pointer ${
                isPurchases
                  ? 'bg-amber-950 text-amber-300 border-amber-600 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
              }`}
            >
              <Package className="w-3.5 h-3.5 text-amber-400" />
              <span>[F3] Compras</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('SNGPC')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition border text-xs cursor-pointer ${
                isSngpc
                  ? 'bg-purple-950 text-purple-300 border-purple-600 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
              <span>[F4] SNGPC</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('FINANCIAL')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition border text-xs cursor-pointer ${
                isFinancial
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-600 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              <span>[F5] Financeiro</span>
            </button>

            <button
              type="button"
              data-testid="topbar-stores-button"
              onClick={() => setMode('STORES')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition border text-xs cursor-pointer ${
                isStores
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-600 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>[F7] Filiais / Rede</span>
            </button>

            <button
              type="button"
              data-testid="topbar-inventory-button"
              onClick={() => setMode('INVENTORY')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition border text-xs cursor-pointer ${
                isInventory
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-600 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5 text-emerald-400" />
              <span>[F8] Inventário</span>
            </button>

            <button
              type="button"
              data-testid="topbar-credit-button"
              onClick={() => setMode('CREDIT')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition border text-xs cursor-pointer ${
                isCredit
                  ? 'bg-indigo-950 text-indigo-300 border-indigo-600 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-indigo-400" />
              <span>[F9] Convênios & Crediário</span>
            </button>

            <button
              type="button"
              data-testid="topbar-crm-button"
              onClick={() => setMode('CRM')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition border text-xs cursor-pointer ${
                isCrm
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-600 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>[F10] CRM & Fidelidade</span>
            </button>

            <button
              type="button"
              data-testid="topbar-delivery-button"
              onClick={() => setMode('DELIVERY')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition border text-xs cursor-pointer ${
                isDelivery
                  ? 'bg-amber-950 text-amber-300 border-amber-600 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
              }`}
            >
              <Bike className="w-3.5 h-3.5 text-amber-400" />
              <span>[F11] Delivery / Tele-Entrega</span>
            </button>

            <button
              type="button"
              data-testid="topbar-sanitary-button"
              onClick={() => setMode('SANITARY')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition border text-xs cursor-pointer ${
                isSanitary
                  ? 'bg-rose-950 text-rose-300 border-rose-600 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              <span>[F12] Validades & VISA</span>
            </button>

            <button
              type="button"
              data-testid="topbar-card-reconciliation-button"
              onClick={() => setMode('CARD_RECONCILIATION')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition border text-xs cursor-pointer ${
                isCardReconciliation
                  ? 'bg-indigo-950 text-indigo-300 border-indigo-600 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5 text-indigo-400" />
              <span>Conciliação Cartões / MDR</span>
            </button>

            <button
              type="button"
              data-testid="topbar-bank-reconciliation-button"
              onClick={() => setMode('BANK_RECONCILIATION')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition border text-xs cursor-pointer ${
                isBankReconciliation
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-600 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Conciliação OFX & Caixa</span>
            </button>

            <button
              type="button"
              data-testid="topbar-sped-fiscal-button"
              onClick={() => setMode('SPED_FISCAL')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition border text-xs cursor-pointer ${
                isSpedFiscal
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-600 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
              }`}
            >
              <FileCode className="w-3.5 h-3.5 text-emerald-400" />
              <span>SPED / Sintegra</span>
            </button>

            <button
              type="button"
              data-testid="topbar-clinical-consulting-button"
              onClick={() => setMode('CLINICAL_CONSULTING')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition border text-xs cursor-pointer ${
                isClinicalConsulting
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-600 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
              }`}
            >
              <Stethoscope className="w-3.5 h-3.5 text-emerald-400" />
              <span>Consultório / DSF</span>
            </button>

            <button
              type="button"
              data-testid="topbar-b2b-quotations-button"
              onClick={() => setMode('B2B_QUOTATIONS')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition border text-xs cursor-pointer ${
                isB2bQuotations
                  ? 'bg-blue-950 text-blue-300 border-blue-600 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
              }`}
            >
              <Truck className="w-3.5 h-3.5 text-blue-400" />
              <span>Cotação B2B / EDI</span>
            </button>

            <button
              type="button"
              data-testid="topbar-cmed-pricing-button"
              onClick={() => setMode('CMED_PRICING')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition border text-xs cursor-pointer ${
                isCmedPricing
                  ? 'bg-red-950 text-red-300 border-red-600 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
              }`}
            >
              <Scale className="w-3.5 h-3.5 text-red-400" />
              <span>CMED / Precificação</span>
            </button>

            <button
              type="button"
              data-testid="topbar-omnichannel-button"
              onClick={() => setMode('OMNICHANNEL_PICK_PACK')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition border text-xs cursor-pointer ${
                isOmnichannelPickPack
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-600 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
              <span>Omnichannel / WhatsApp</span>
            </button>

            <button
              type="button"
              data-testid="topbar-compounding-button"
              onClick={() => setMode('COMPOUNDING_MAGISTRAL')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition border text-xs cursor-pointer ${
                isCompounding
                  ? 'bg-purple-950 text-purple-300 border-purple-600 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
              }`}
            >
              <FlaskConical className="w-3.5 h-3.5 text-purple-400" />
              <span>Magistral / Manipulação</span>
            </button>

            <button
              type="button"
              data-testid="topbar-subscriptions-button"
              onClick={() => setMode('SUBSCRIPTION_CLUB')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition border text-xs cursor-pointer ${
                isSubscriptionClub
                  ? 'bg-indigo-950 text-indigo-300 border-indigo-600 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
              }`}
            >
              <Repeat className="w-3.5 h-3.5 text-indigo-400" />
              <span>Clube Assinaturas</span>
            </button>

            <button
              type="button"
              data-testid="topbar-fractionation-button"
              onClick={() => setMode('FRACTIONATION_RDC80')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition border text-xs cursor-pointer ${
                isFractionation
                  ? 'bg-sky-950 text-sky-300 border-sky-600 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
              }`}
            >
              <Scissors className="w-3.5 h-3.5 text-sky-400" />
              <span>Fracionamento</span>
            </button>

            <button
              type="button"
              data-testid="topbar-commissions-button"
              onClick={() => setMode('SALES_COMMISSIONS')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition border text-xs cursor-pointer ${
                isCommissions
                  ? 'bg-amber-950 text-amber-300 border-amber-600 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
              }`}
            >
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>Comissões</span>
            </button>

            <button
              type="button"
              data-testid="topbar-dre-button"
              onClick={() => setMode('FINANCIAL_DRE')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition border text-xs cursor-pointer ${
                isDre
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-600 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
              }`}
            >
              <PieChart className="w-3.5 h-3.5 text-emerald-400" />
              <span>DRE Gerencial</span>
            </button>

            <button
              type="button"
              data-testid="topbar-pgrss-button"
              onClick={() => setMode('PGRSS_DISPOSAL')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition border text-xs cursor-pointer ${
                isPgrss
                  ? 'bg-rose-950 text-rose-300 border-rose-600 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>PGRSS & Descarte</span>
            </button>

            <button
              type="button"
              data-testid="topbar-kiosk-button"
              onClick={() => setMode('KIOSK_TERMINAL')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition border text-xs cursor-pointer ${
                isKiosk
                  ? 'bg-cyan-950 text-cyan-300 border-cyan-600 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
              }`}
            >
              <MonitorSmartphone className="w-3.5 h-3.5 text-cyan-400" />
              <span>Totem Autoatendimento</span>
            </button>

            <button
              type="button"
              data-testid="topbar-bmpo-button"
              onClick={() => setMode('BMPO_REGULATORY')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition border text-xs cursor-pointer ${
                isBmpo
                  ? 'bg-amber-950 text-amber-300 border-amber-600 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" />
              <span>BMPO / Mapas VISA</span>
            </button>

            <button
              type="button"
              data-testid="topbar-sncm-button"
              onClick={() => setMode('SNCM_TRACEABILITY')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition border text-xs cursor-pointer ${
                isSncm
                  ? 'bg-cyan-950 text-cyan-300 border-cyan-600 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
              }`}
            >
              <QrCode className="w-3.5 h-3.5 text-cyan-400" />
              <span>SNCM Rastreabilidade</span>
            </button>

            <button
              type="button"
              data-testid="topbar-replenishment-button"
              onClick={() => setMode('SMART_REPLENISHMENT')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition border text-xs cursor-pointer ${
                isReplenishment
                  ? 'bg-amber-950 text-amber-300 border-amber-600 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
              <span>Reposição Inteligente</span>
            </button>

            <button
              type="button"
              data-testid="topbar-returns-button"
              onClick={() => setMode('CUSTOMER_RETURNS')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition border text-xs cursor-pointer ${
                isCustomerReturns
                  ? 'bg-rose-950 text-rose-300 border-rose-600 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
              <span>Devoluções & Trocas</span>
            </button>

            <button
              type="button"
              data-testid="topbar-quarantine-button"
              onClick={() => setMode('QUARANTINE_REGULATORY')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition border text-xs cursor-pointer ${
                isQuarantine
                  ? 'bg-purple-950 text-purple-300 border-purple-600 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
              <span>Quarentena & Notivisa</span>
            </button>

            <button
              type="button"
              data-testid="topbar-temperature-button"
              onClick={() => setMode('TEMPERATURE_MONITORING')}
              title="Termômetro & Higrômetro Digital (RDC 44/2009 & RDC 430/2020 ANVISA)"
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition border text-xs cursor-pointer ${
                isTemperatureMonitoring
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-600 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
              }`}
            >
              <Thermometer className="w-3.5 h-3.5 text-emerald-400" />
              <span>Termo-Higrômetro</span>
            </button>

            <button
              type="button"
              data-testid="topbar-sanitization-button"
              onClick={() => setMode('SANITIZATION_COMPLIANCE')}
              title="Sanitização, Dedetização & POPs (RDC 44/2009 ANVISA)"
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition border text-xs cursor-pointer ${
                isSanitizationCompliance
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-600 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Sanitização & POPs</span>
            </button>

            <button
              type="button"
              data-testid="topbar-injectables-button"
              onClick={() => setMode('INJECTABLES_VACCINATION')}
              title="Livro de Injetáveis & Sala de Vacinas (RDC 197/2017 & RDC 44/2009 ANVISA)"
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition border text-xs cursor-pointer ${
                isInjectablesVaccination
                  ? 'bg-indigo-950 text-indigo-300 border-indigo-600 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
              }`}
            >
              <Stethoscope className="w-3.5 h-3.5 text-indigo-400" />
              <span>Injetáveis & Vacinas</span>
            </button>

            <button
              type="button"
              data-testid="topbar-pharmacovigilance-button"
              onClick={() => setMode('PHARMACOVIGILANCE_NOTIVISA')}
              title="Farmacovigilância, RAM & NOTIVISA (RDC 406/2020 ANVISA)"
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition border text-xs cursor-pointer ${
                isPharmacovigilance
                  ? 'bg-rose-950 text-rose-300 border-rose-600 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              <span>Farmacovigilância & NOTIVISA</span>
            </button>

            <button
              type="button"
              data-testid="topbar-marketplace-button"
              onClick={() => setMode('MARKETPLACE_HUB')}
              title="Hub de Marketplaces & Delivery Externo (iFood, Rappi, Consulta Remédios)"
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition border text-xs cursor-pointer ${
                isMarketplaceHub
                  ? 'bg-amber-950 text-amber-300 border-amber-600 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
              }`}
            >
              <Store className="w-3.5 h-3.5 text-amber-400" />
              <span>Marketplaces Hub</span>
            </button>

            <button
              type="button"
              data-testid="topbar-backup-button"
              onClick={() => setMode('BACKUP_DISASTER_RECOVERY')}
              title="Backup em Nuvem, Criptografia LGPD & Disaster Recovery"
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition border text-xs cursor-pointer ${
                isBackupDisasterRecovery
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-600 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Backup & LGPD</span>
            </button>

            <button
              type="button"
              data-testid="topbar-selfcheckout-button"
              onClick={() => setMode('SELF_CHECKOUT_TOUCH')}
              title="Totem de Autoatendimento Touch & Self-Checkout Autônomo"
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition border text-xs cursor-pointer ${
                isSelfCheckoutTouch
                  ? 'bg-purple-950 text-purple-300 border-purple-600 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
              }`}
            >
              <MonitorSmartphone className="w-3.5 h-3.5 text-purple-400" />
              <span>Self-Checkout Touch</span>
            </button>

            <button
              type="button"
              data-testid="topbar-dda-button"
              onClick={() => setMode('DDA_RECONCILIATION')}
              title="Conciliação Eletrônica DDA & Boletos de Fornecedores"
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition border text-xs cursor-pointer ${
                isDdaReconciliation
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-600 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>DDA Boletos</span>
            </button>

            <button
              type="button"
              data-testid="topbar-sanitary-audit-button"
              onClick={() => setMode('SANITARY_AUDIT_DOSSIER')}
              title="Dossiê de Autoinspeção Sanitária & Auditoria ANVISA/VISA"
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition border text-xs cursor-pointer ${
                isSanitaryAuditDossier
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-600 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Dossiê ANVISA</span>
            </button>

            <button
              type="button"
              data-testid="topbar-agreements-billing-button"
              onClick={() => setMode('CORPORATE_AGREEMENTS_BILLING')}
              title="Faturamento de Convênios Empresariais & Desconto em Folha (RH)"
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition border text-xs cursor-pointer ${
                isCorporateAgreementsBilling
                  ? 'bg-indigo-950 text-indigo-300 border-indigo-600 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>Faturamento RH</span>
            </button>

            <button
              type="button"
              data-testid="topbar-blind-inventory-button"
              onClick={() => setMode('BLIND_INVENTORY_AUDIT')}
              title="Balanço Patrimonial & Inventário Rotativo Cego (RDC 44/2009 e Portaria 344/98)"
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition border text-xs cursor-pointer ${
                isBlindInventoryAudit
                  ? 'bg-amber-950 text-amber-300 border-amber-600 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5 text-amber-400" />
              <span>Inventário Cego</span>
            </button>

            <button
              type="button"
              data-testid="topbar-sat-fiscal-button"
              onClick={() => setMode('SAT_FISCAL_MODULE')}
              title="Módulo Fiscal SAT (CF-e-SAT SP / MF-e CE) & Contingência Off-line"
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition border text-xs cursor-pointer ${
                isSatFiscalModule
                  ? 'bg-red-950 text-red-300 border-red-600 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
              }`}
            >
              <QrCode className="w-3.5 h-3.5 text-red-400" />
              <span>SAT Fiscal</span>
            </button>

            <button
              type="button"
              data-testid="topbar-precision-scale-button"
              onClick={() => setMode('PRECISION_SCALE_MODULE')}
              title="Balança de Precisão & Checkout Pesável (INMETRO 236/94 & RDC 67/07)"
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition border text-xs cursor-pointer ${
                isPrecisionScaleModule
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-600 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
              }`}
            >
              <Scale className="w-3.5 h-3.5 text-emerald-400" />
              <span>Balança & Pesáveis</span>
            </button>

            <button
              type="button"
              data-testid="topbar-fp-audit-button"
              onClick={() => setMode('FARMACIA_POPULAR_AUDIT')}
              title="Auditoria Farmácia Popular, Glosas FNS & Dossiê 5 Anos (DENASUS)"
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition border text-xs cursor-pointer ${
                isFarmaciaPopularAudit
                  ? 'bg-indigo-950 text-indigo-300 border-indigo-600 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
              }`}
            >
              <Landmark className="w-3.5 h-3.5 text-indigo-400" />
              <span>Auditoria F. Popular</span>
            </button>

            <button
              type="button"
              data-testid="topbar-mdfe-button"
              onClick={() => setMode('MDFE_FISCAL_MODULE')}
              title="MDF-e Transporte & Manifesto Fiscal (Modelo 58 / Ajuste SINIEF 21/2010)"
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition border text-xs cursor-pointer ${
                isMdfeFiscalModule
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-600 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
              }`}
            >
              <Truck className="w-3.5 h-3.5 text-emerald-400" />
              <span>MDF-e Cargas</span>
            </button>

            <button
              type="button"
              data-testid="topbar-assistance-button"
              onClick={() => setMode('PHARMACEUTICAL_ASSISTANCE')}
              title="Assistência Farmacêutica Integral & Livro RT (Lei 13.021/14 e CRF/CFF)"
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition border text-xs cursor-pointer ${
                isPharmaceuticalAssistance
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-600 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Assistência & RT</span>
            </button>
          </nav>
        </div>

        {/* Global Action [F6] Convênio, StoreSelector & Shortcuts Hint */}
        <div className="flex items-center space-x-3 text-xs">
          {/* Topbar Store Selector Dropdown */}
          <StoreSelector />

          <button
            type="button"
            data-testid="topbar-pbm-button"
            onClick={() => setIsPbmModalOpen(true)}
            title="Gateway de Convênios Farmacêuticos & Farmácia Popular (F6)"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-bold transition border text-xs cursor-pointer bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border-emerald-600 shadow-sm"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>[F6] Convênio</span>
          </button>

          <div className="hidden xl:flex items-center space-x-3 text-slate-400 text-[11px]">
            <span>
              Atalhos:{' '}
              <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-mono font-bold">F1</kbd>{' '}
              Balcão |{' '}
              <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-mono font-bold">F2</kbd>{' '}
              Caixa |{' '}
              <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-mono font-bold">F3</kbd>{' '}
              Compras |{' '}
              <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-mono font-bold">F4</kbd>{' '}
              SNGPC |{' '}
              <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-mono font-bold">F5</kbd>{' '}
              Financeiro |{' '}
              <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-mono font-bold">F6</kbd>{' '}
              Convênio |{' '}
              <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-mono font-bold">F7</kbd>{' '}
              Filiais |{' '}
              <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-mono font-bold">F8</kbd>{' '}
              Inventário |{' '}
              <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-mono font-bold">F9</kbd>{' '}
              Crediário |{' '}
              <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-mono font-bold">F10</kbd>{' '}
              CRM |{' '}
              <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-mono font-bold">F11</kbd>{' '}
              Delivery |{' '}
              <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-mono font-bold">F12</kbd>{' '}
              VISA
            </span>
          </div>
        </div>
      </div>

      {/* Main Page Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {isCounter && <CounterPage />}
        {isPos && <PosPage />}
        {isPurchases && <PurchasesPage />}
        {isSngpc && <SngpcPage />}
        {isFinancial && <FinancialDashboardPage />}
        {isStores && <MultiStorePage />}
        {isInventory && <InventoryPage />}
        {isCredit && <CustomerCreditPage />}
        {isCrm && <CrmPage />}
        {isDelivery && <DeliveryPage />}
        {isSanitary && <SanitaryPage />}
        {isCardReconciliation && <CardReconciliationPage />}
        {isBankReconciliation && <BankReconciliationPage />}
        {isSpedFiscal && <SpedFiscalPage />}
        {isClinicalConsulting && <ClinicalConsultingPage />}
        {isB2bQuotations && <B2bQuotationsPage />}
        {isCmedPricing && <CmedPricingPage />}
        {isOmnichannelPickPack && <OmnichannelPickPackPage />}
        {isCompounding && <CompoundingPage />}
        {isSubscriptionClub && <SubscriptionsPage />}
        {isFractionation && <FractionationPage />}
        {isCommissions && <CommissionsPage />}
        {isDre && <DreAnalyticsPage />}
        {isPgrss && <PgrssDisposalPage />}
        {isKiosk && <KioskPage />}
        {isBmpo && <BmpoRegulatoryPage />}
        {isSncm && <SncmTraceabilityPage />}
        {isReplenishment && <SmartReplenishmentPage />}
        {isCustomerReturns && <CustomerReturnsPage />}
        {isQuarantine && <QuarantineRegulatoryPage />}
        {isTemperatureMonitoring && <TemperatureMonitoringPage />}
        {isSanitizationCompliance && <SanitizationCompliancePage />}
        {isInjectablesVaccination && <InjectablesVaccinationPage />}
        {isPharmacovigilance && <PharmacovigilancePage />}
        {isMarketplaceHub && <MarketplaceHubPage />}
        {isBackupDisasterRecovery && <BackupDisasterRecoveryPage />}
        {isSelfCheckoutTouch && <SelfCheckoutTouchPage />}
        {isDdaReconciliation && <DdaReconciliationPage />}
        {isSanitaryAuditDossier && <SanitaryAuditDossierPage />}
        {isCorporateAgreementsBilling && <CorporateAgreementsBillingPage />}
        {isBlindInventoryAudit && <BlindInventoryPage />}
        {isSatFiscalModule && <SatFiscalPage />}
        {isPrecisionScaleModule && <PrecisionScalePage />}
        {isFarmaciaPopularAudit && <FarmaciaPopularAuditPage />}
        {isMdfeFiscalModule && <MdfePage />}
        {isPharmaceuticalAssistance && <PharmaceuticalAssistancePage />}
      </div>

      {/* Global PBM Modal */}
      <PbmModal
        isOpen={isPbmModalOpen}
        onClose={() => setIsPbmModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <AppContent />
    </StoreProvider>
  );
}
