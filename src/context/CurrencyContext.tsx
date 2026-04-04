import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { WalletCurrency } from '../types';

interface CurrencyContextValue {
  currency: WalletCurrency;
  setCurrency: (currency: WalletCurrency) => void;
}

const CurrencyContext = createContext<CurrencyContextValue | undefined>(undefined);
const STORAGE_KEY = 'connect_preferred_currency';

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<WalletCurrency>(() => {
    if (typeof window === 'undefined') return 'USD';
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'USD' || saved === 'NGN' || saved === 'EUR' ? saved : 'USD';
  });

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      const nextCurrency = event.newValue;
      if (nextCurrency === 'USD' || nextCurrency === 'NGN' || nextCurrency === 'EUR') {
        setCurrencyState(nextCurrency);
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const setCurrency = (nextCurrency: WalletCurrency) => {
    setCurrencyState(nextCurrency);
    localStorage.setItem(STORAGE_KEY, nextCurrency);
  };

  const value = useMemo(() => ({ currency, setCurrency }), [currency]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within CurrencyProvider');
  }
  return context;
}
