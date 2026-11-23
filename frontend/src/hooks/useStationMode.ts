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
        stored === 'CLINICAL_CONSULTING'
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
  };
}

export default useStationMode;
