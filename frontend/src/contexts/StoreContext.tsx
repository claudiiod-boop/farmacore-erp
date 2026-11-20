import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Store } from '../types';
import { api } from '../services/api';

export const ACTIVE_STORE_STORAGE_KEY = 'farmacore_active_store_id';

export const DEFAULT_HEADQUARTERS_STORE: Store = {
  id: 1,
  code: 'LJ01',
  name: 'FarmaCore Matriz Centro',
  companyName: 'FarmaCore Drogaria e Perfumaria Ltda',
  cnpj: '12.345.678/0001-90',
  ie: '123.456.789.111',
  isHeadquarters: true,
  phone: '(11) 3333-1000',
  email: 'matriz@farmacore.com.br',
  street: 'Avenida Paulista',
  number: '1000',
  neighborhood: 'Bela Vista',
  city: 'São Paulo',
  state: 'SP',
  zipCode: '01310-100',
  ibgeCode: '3550308',
  taxRegime: 'LUCRO_PRESUMIDO',
  isActive: true,
};

export interface StoreContextValue {
  currentStore: Store | null;
  setCurrentStore: (store: Store) => void;
  stores: Store[];
  loading: boolean;
  refreshStores: () => Promise<void>;
}

export const StoreContext = createContext<StoreContextValue | undefined>(undefined);

export function isHeadquartersStore(s: Store): boolean {
  return Boolean(s.isHeadquarters || s.is_headquarters || s.id === 1);
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [stores, setStores] = useState<Store[]>([DEFAULT_HEADQUARTERS_STORE]);
  const [currentStore, setCurrentStoreState] = useState<Store | null>(DEFAULT_HEADQUARTERS_STORE);
  const [loading, setLoading] = useState<boolean>(true);

  const setCurrentStore = useCallback((store: Store) => {
    setCurrentStoreState(store);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(ACTIVE_STORE_STORAGE_KEY, String(store.id));
      }
    } catch {
      // localStorage fallback
    }
  }, []);

  const refreshStores = useCallback(async () => {
    setLoading(true);
    try {
      const fetched = await api.getStores();
      if (fetched && fetched.length > 0) {
        setStores(fetched);

        // Find saved store or headquarters
        let targetStore: Store | undefined;
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            const savedId = window.localStorage.getItem(ACTIVE_STORE_STORAGE_KEY);
            if (savedId) {
              const numId = Number(savedId);
              targetStore = fetched.find((s) => s.id === numId);
            }
          }
        } catch {
          // ignore
        }

        if (!targetStore) {
          targetStore = fetched.find((s) => isHeadquartersStore(s)) || fetched[0];
        }

        if (targetStore) {
          setCurrentStoreState(targetStore);
        }
      }
    } catch {
      // Keep default fallback store on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStores();
  }, [refreshStores]);

  return (
    <StoreContext.Provider
      value={{
        currentStore,
        setCurrentStore,
        stores,
        loading,
        refreshStores,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): StoreContextValue {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
}

export default StoreProvider;
