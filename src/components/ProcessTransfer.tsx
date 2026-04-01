import React, { useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { UserProfile, Wallet, WalletCurrency } from '../types';
import { supabaseService } from '../services/supabaseService';
import { useCurrency } from '../context/CurrencyContext';
import { formatAmount } from '../utils/currency';

interface ProcessTransferProps {
  profile: UserProfile;
}

export default function ProcessTransfer({ profile }: ProcessTransferProps) {
  const navigate = useNavigate();
  const { currency, setCurrency } = useCurrency();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [recipientId, setRecipientId] = useState('');
  const [verifyingRecipient, setVerifyingRecipient] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const recipientInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    let active = true;
    supabaseService
      .getOrCreateWallet(profile.uid)
      .then((nextWallet) => {
        if (!active) return;
        setWallet(nextWallet);
      })
      .catch((e: any) => {
        if (!active) return;
        setError(e.message || 'Failed to load wallet balance.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [profile.uid]);

  React.useEffect(() => {
    if (!window.visualViewport) return;
    const vv = window.visualViewport;
    const updateInset = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardInset(inset);
    };
    vv.addEventListener('resize', updateInset);
    vv.addEventListener('scroll', updateInset);
    updateInset();
    return () => {
      vv.removeEventListener('resize', updateInset);
      vv.removeEventListener('scroll', updateInset);
    };
  }, []);

  const availableBalance = useMemo(() => {
    if (!wallet) return 0;
    if (currency === 'USD') return wallet.usdBalance;
    if (currency === 'NGN') return wallet.ngnBalance;
    return wallet.eurBalance;
  }, [wallet, currency]);

  const verifyRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!recipientId.trim()) {
      setError('Recipient ID is required.');
      return;
    }

    setVerifyingRecipient(true);
    try {
      const recipient = await supabaseService.resolveUserByIdentifier(recipientId.trim());
      if (!recipient) {
        setError('Recipient user ID was not found.');
        return;
      }
      if (recipient.uid === profile.uid) {
        setError('You cannot transfer funds to yourself.');
        return;
      }
      setSuccess('Recipient verified. Enter amount to continue.');
      const recipientIdentifier = encodeURIComponent(recipient.publicId || recipient.uid);
      const recipientName = encodeURIComponent(recipient.displayName);
      navigate(`/wallets/transfer/details?recipient=${recipientIdentifier}&name=${recipientName}`);
    } catch (e: any) {
      setError(e.message || 'Failed to verify recipient.');
    } finally {
      setVerifyingRecipient(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div
      className="max-w-3xl mx-auto px-4 py-8 space-y-6 min-h-[100dvh] overflow-y-auto touch-pan-y"
      style={{ paddingBottom: `${keyboardInset + 260}px` }}
    >
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/wallets')} className="p-2 rounded-full hover:bg-gray-100">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Process Transfer</h1>
          <p className="text-sm text-gray-500">Verify recipient, enter amount, then confirm with your 4-digit PIN.</p>
        </div>
      </div>

      <div className="bg-gradient-to-br from-teal-700 to-emerald-700 text-white rounded-3xl p-6 shadow-lg space-y-3">
        <p className="text-xs uppercase tracking-wider opacity-80">Available Balance</p>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-3xl font-black">{formatAmount(availableBalance, currency)}</p>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as WalletCurrency)}
            className="w-36 px-3 py-2.5 rounded-xl bg-white/10 border border-white/30 text-white text-sm"
          >
            <option value="USD" className="text-gray-900">USD</option>
            <option value="NGN" className="text-gray-900">NGN</option>
            <option value="EUR" className="text-gray-900">EUR</option>
          </select>
        </div>
      </div>

      <form onSubmit={verifyRecipient} className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
        <div className="space-y-1">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-500">Recipient ID</label>
          <input
            ref={recipientInputRef}
            type="text"
            value={recipientId}
            onChange={(e) => setRecipientId(e.target.value)}
            onFocus={() => {
              recipientInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
            placeholder="Enter recipient public ID or UID"
            className="w-full px-3 py-2.5 rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-teal-500"
            required
          />
        </div>
        <button
          type="submit"
          disabled={verifyingRecipient}
          className="w-full py-2.5 rounded-xl bg-teal-700 text-white font-bold hover:bg-teal-800 disabled:opacity-70"
        >
          {verifyingRecipient ? 'Verifying...' : 'Verify User ID'}
        </button>
      </form>

      {error && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm font-semibold">{error}</div>}
      {success && <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-semibold">{success}</div>}
    </div>
  );
}
