import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { WalletCurrency } from '../types';

interface CurrencyContextValue {
  currency: WalletCurrency;
  setCurrency: (currency: WalletCurrency) => void;
}

const CurrencyContext = createContext<CurrencyContextValue | undefined>(undefined);
const STORAGE_KEY = 'connect_preferred_currency';

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<WalletCurrency>('USD');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'USD' || saved === 'NGN' || saved === 'EUR') {
      setCurrencyState(saved);
    }
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
