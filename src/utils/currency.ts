import { WalletCurrency } from '../types';

const USD_BASE_RATES: Record<WalletCurrency, number> = {
  USD: 1,
  NGN: 1500,
  EUR: 0.92,
};

const CURRENCY_SYMBOL: Record<WalletCurrency, string> = {
  USD: '$',
  NGN: 'N',
  EUR: 'EUR ',
};

export function convertFromUSD(usdAmount: number, currency: WalletCurrency): number {
  return usdAmount * USD_BASE_RATES[currency];
}

export function convertToUSD(amount: number, currency: WalletCurrency): number {
  return amount / USD_BASE_RATES[currency];
}

export function convertAmount(amount: number, fromCurrency: WalletCurrency, toCurrency: WalletCurrency): number {
  if (fromCurrency === toCurrency) return amount;
  const usdAmount = fromCurrency === 'USD' ? amount : convertToUSD(amount, fromCurrency);
  return toCurrency === 'USD' ? usdAmount : convertFromUSD(usdAmount, toCurrency);
}

export function formatMoneyFromUSD(usdAmount: number, currency: WalletCurrency): string {
  const converted = convertFromUSD(usdAmount, currency);
  const symbol = CURRENCY_SYMBOL[currency];
  return `${symbol}${converted.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
}

export function formatAmount(amount: number, currency: WalletCurrency): string {
  const symbol = CURRENCY_SYMBOL[currency];
  return `${symbol}${amount.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
}

export function formatAmountInCurrency(amount: number, fromCurrency: WalletCurrency, toCurrency: WalletCurrency): string {
  return formatAmount(convertAmount(amount, fromCurrency, toCurrency), toCurrency);
}
