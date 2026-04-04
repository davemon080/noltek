import React, { useEffect, useState } from 'react';
import { UserProfile, WalletTransaction } from '../types';
import { supabaseService } from '../services/supabaseService';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Download,
  RefreshCw,
  SendHorizontal,
  Share2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { formatAmount } from '../utils/currency';
import { downloadReceiptImage, getWalletTransactionMeta, shareReceiptImage } from '../utils/walletReceipt';

interface WalletHistoryProps {
  profile: UserProfile;
}

export default function WalletHistory({ profile }: WalletHistoryProps) {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTransactions = async () => {
    setLoading(true);
    setError(null);
    try {
      const tx = await supabaseService.listWalletTransactions(profile.uid);
      setTransactions(tx);
    } catch (e: any) {
      setError(e.message || 'Failed to load wallet transactions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribeTransactions = supabaseService.subscribeToWalletTransactions(
      profile.uid,
      (tx) => {
        setTransactions(tx);
        setLoading(false);
      },
      (nextError) => {
        setError(nextError?.message || 'Failed to load wallet transactions.');
        setLoading(false);
      }
    );

    return () => {
      unsubscribeTransactions();
    };
  }, [profile.uid]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/wallets')} className="rounded-full p-2 hover:bg-gray-100">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transaction History</h1>
          <p className="text-sm text-gray-500">Review every wallet movement and manage receipt downloads.</p>
        </div>
        <button
          onClick={loadTransactions}
          className="ml-auto flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-gray-50"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-teal-600" />
      ) : error ? (
        <div className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div>
      ) : transactions.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
          No transactions yet.
        </div>
      ) : (
        <div className="space-y-3 rounded-3xl border border-gray-200 bg-white p-5">
          {transactions.map((tx) => {
            const isCredit = tx.type === 'topup';
            const isTransferOut = tx.reference?.startsWith('transfer_out:');
            const isTransferIn = tx.reference?.startsWith('transfer_in:');
            const meta = getWalletTransactionMeta(tx);

            return (
              <div key={tx.id} className="rounded-2xl border border-gray-100 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                        isCredit ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                      }`}
                    >
                      {isTransferIn ? <SendHorizontal size={17} className="rotate-180" /> : isTransferOut ? <SendHorizontal size={17} /> : isCredit ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900">{meta.title}</p>
                      <p className="truncate text-xs text-gray-500">
                        {meta.counterparty ? `User ID: ${meta.counterparty} · ` : ''}
                        {format(new Date(tx.createdAt), 'MMM d, yyyy, h:mm a')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">{formatAmount(tx.amount, tx.currency)}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{tx.status}</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => downloadReceiptImage(profile, tx)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200"
                  >
                    <Download size={14} />
                    Download Receipt
                  </button>
                  <button
                    type="button"
                    onClick={() => void shareReceiptImage(profile, tx)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-700 hover:bg-teal-100"
                  >
                    <Share2 size={14} />
                    Share Receipt
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
