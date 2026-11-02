import { useState, useCallback } from 'react';

export type StationMode = 'COUNTER' | 'POS';

export const STATION_MODE_STORAGE_KEY = 'farmacore_station_mode';

function getStoredMode(initialDefault: StationMode): StationMode {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(STATION_MODE_STORAGE_KEY);
      if (stored === 'COUNTER' || stored === 'POS') {
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
  };
}

export default useStationMode;
