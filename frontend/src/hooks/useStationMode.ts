import { useState, useCallback } from 'react';
import type { StationMode } from '../types';

export type { StationMode };

export const STATION_MODE_STORAGE_KEY = 'farmacore_station_mode';

function getStoredMode(initialDefault: StationMode): StationMode {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(STATION_MODE_STORAGE_KEY);
      if (
        stored === 'COUNTER' ||
        stored === 'POS' ||
        stored === 'PURCHASES' ||
        stored === 'SNGPC' ||
        stored === 'FINANCIAL' ||
        stored === 'STORES' ||
        stored === 'INVENTORY' ||
        stored === 'CREDIT' ||
        stored === 'CRM' ||
        stored === 'DELIVERY' ||
        stored === 'SANITARY' ||
        stored === 'CARD_RECONCILIATION' ||
        stored === 'BANK_RECONCILIATION' ||
        stored === 'SPED_FISCAL' ||
        stored === 'CLINICAL_CONSULTING' ||
        stored === 'B2B_QUOTATIONS' ||
        stored === 'CMED_PRICING' ||
        stored === 'OMNICHANNEL_PICK_PACK' ||
        stored === 'COMPOUNDING_MAGISTRAL' ||
        stored === 'SUBSCRIPTION_CLUB' ||
        stored === 'FRACTIONATION_RDC80' ||
        stored === 'SALES_COMMISSIONS' ||
        stored === 'FINANCIAL_DRE' ||
        stored === 'PGRSS_DISPOSAL' ||
        stored === 'KIOSK_TERMINAL' ||
        stored === 'BMPO_REGULATORY' ||
        stored === 'SNCM_TRACEABILITY' ||
        stored === 'SMART_REPLENISHMENT' ||
        stored === 'CUSTOMER_RETURNS' ||
        stored === 'QUARANTINE_REGULATORY' ||
        stored === 'TEMPERATURE_MONITORING' ||
        stored === 'SANITIZATION_COMPLIANCE' ||
        stored === 'INJECTABLES_VACCINATION' ||
        stored === 'PHARMACOVIGILANCE_NOTIVISA' ||
        stored === 'CORPORATE_AGREEMENTS_BILLING' ||
        stored === 'BLIND_INVENTORY_AUDIT' ||
        stored === 'SAT_FISCAL_MODULE' ||
        stored === 'PRECISION_SCALE_MODULE' ||
        stored === 'FARMACIA_POPULAR_AUDIT' ||
        stored === 'MDFE_FISCAL_MODULE' ||
        stored === 'PHARMACEUTICAL_ASSISTANCE' ||
        stored === 'MAGNOS_FARMA_ANALYTICS'
      ) {
        return stored;
      }
    }
  } catch {
    // fallback
  }
  return initialDefault;
}

export function useStationMode(initialDefault: StationMode = 'COUNTER') {
  const [mode, setModeState] = useState<StationMode>(() => getStoredMode(initialDefault));

  const setMode = useCallback((newMode: StationMode) => {
    setModeState(newMode);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STATION_MODE_STORAGE_KEY, newMode);
      }
    } catch {
      // fallback
    }
  }, []);

  return {
    mode,
    setMode,
    isCounter: mode === 'COUNTER',
    isPos: mode === 'POS',
    isPurchases: mode === 'PURCHASES',
    isSngpc: mode === 'SNGPC',
    isFinancial: mode === 'FINANCIAL',
    isStores: mode === 'STORES',
    isInventory: mode === 'INVENTORY',
    isCredit: mode === 'CREDIT',
    isCrm: mode === 'CRM',
    isDelivery: mode === 'DELIVERY',
    isSanitary: mode === 'SANITARY',
    isCardReconciliation: mode === 'CARD_RECONCILIATION',
    isBankReconciliation: mode === 'BANK_RECONCILIATION',
    isSpedFiscal: mode === 'SPED_FISCAL',
    isClinicalConsulting: mode === 'CLINICAL_CONSULTING',
    isB2bQuotations: mode === 'B2B_QUOTATIONS',
    isCmedPricing: mode === 'CMED_PRICING',
    isOmnichannelPickPack: mode === 'OMNICHANNEL_PICK_PACK',
    isCompounding: mode === 'COMPOUNDING_MAGISTRAL',
    isSubscriptionClub: mode === 'SUBSCRIPTION_CLUB',
    isFractionation: mode === 'FRACTIONATION_RDC80',
    isCommissions: mode === 'SALES_COMMISSIONS',
    isDre: mode === 'FINANCIAL_DRE',
    isPgrss: mode === 'PGRSS_DISPOSAL',
    isKiosk: mode === 'KIOSK_TERMINAL',
    isBmpo: mode === 'BMPO_REGULATORY',
    isSncm: mode === 'SNCM_TRACEABILITY',
    isReplenishment: mode === 'SMART_REPLENISHMENT',
    isCustomerReturns: mode === 'CUSTOMER_RETURNS',
    isQuarantine: mode === 'QUARANTINE_REGULATORY',
    isTemperatureMonitoring: mode === 'TEMPERATURE_MONITORING',
    isSanitizationCompliance: mode === 'SANITIZATION_COMPLIANCE',
    isInjectablesVaccination: mode === 'INJECTABLES_VACCINATION',
    isPharmacovigilance: mode === 'PHARMACOVIGILANCE_NOTIVISA',
    isMarketplaceHub: mode === 'MARKETPLACE_HUB',
    isBackupDisasterRecovery: mode === 'BACKUP_DISASTER_RECOVERY',
    isSelfCheckoutTouch: mode === 'SELF_CHECKOUT_TOUCH',
    isDdaReconciliation: mode === 'DDA_RECONCILIATION',
    isSanitaryAuditDossier: mode === 'SANITARY_AUDIT_DOSSIER',
    isCorporateAgreementsBilling: mode === 'CORPORATE_AGREEMENTS_BILLING',
    isBlindInventoryAudit: mode === 'BLIND_INVENTORY_AUDIT',
    isSatFiscalModule: mode === 'SAT_FISCAL_MODULE',
    isPrecisionScaleModule: mode === 'PRECISION_SCALE_MODULE',
    isFarmaciaPopularAudit: mode === 'FARMACIA_POPULAR_AUDIT',
    isMdfeFiscalModule: mode === 'MDFE_FISCAL_MODULE',
    isPharmaceuticalAssistance: mode === 'PHARMACEUTICAL_ASSISTANCE',
    isMagnosFarmaAnalytics: mode === 'MAGNOS_FARMA_ANALYTICS',
  };
}

export default useStationMode;
