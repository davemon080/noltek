import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ImagePlus, Loader2, X } from 'lucide-react';
import { UserProfile } from '../types';
import { supabaseService } from '../services/supabaseService';
import CachedImage from './CachedImage';
import { useCurrency } from '../context/CurrencyContext';
import { formatAmount } from '../utils/currency';
import { MARKET_CATEGORIES } from '../constants/market';

interface SellItemProps {
  profile: UserProfile;
}

export default function SellItem({ profile }: SellItemProps) {
  const navigate = useNavigate();
  const { currency } = useCurrency();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<(typeof MARKET_CATEGORIES)[number]>(MARKET_CATEGORIES[0]);
  const [price, setPrice] = useState('');
  const [stockQuantity, setStockQuantity] = useState('1');
  const [isNegotiable, setIsNegotiable] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewUrls = files.map((file) => URL.createObjectURL(file));

  React.useEffect(() => {
    let active = true;
    supabaseService.getMarketSettings(profile.uid).then((settings) => {
      if (active && !settings.isRegistered) {
        navigate('/settings?section=market', { replace: true });
      }
    });
    return () => {
      active = false;
    };
  }, [navigate, profile.uid]);

  const handleFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFiles = Array.from(event.target.files || []).slice(0, 4);
    setFiles(nextFiles);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, fileIndex) => fileIndex !== index));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (files.length === 0) {
      setError('Add at least one product image.');
      return;
    }

    const numericPrice = Number(price);
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      setError('Enter a valid price.');
      return;
    }
    const numericStock = Number(stockQuantity);
    if (!Number.isFinite(numericStock) || numericStock < 0) {
      setError('Enter a valid stock quantity.');
      return;
    }

    setSubmitting(true);
    try {
      const uploads = await Promise.all(files.map((file) => supabaseService.uploadFile(file, 'market')));
      await supabaseService.createMarketItem({
        sellerUid: profile.uid,
        title: title.trim(),
        category,
        description: description.trim() || undefined,
        price: Number(numericPrice.toFixed(2)),
        priceCurrency: currency,
        isNegotiable,
        isAnonymous,
        stockQuantity: Math.floor(numericStock),
        imageUrls: uploads.map((upload) => upload.url),
      });
      navigate('/market');
    } catch (submitError: any) {
      setError(submitError?.message || 'Failed to post item.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/market')} className="rounded-full p-2 hover:bg-gray-100">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sell Item</h1>
          <p className="text-sm text-gray-500">Post your product to the market for other users to discover.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-[2rem] border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="space-y-3">
          <label className="text-sm font-bold text-gray-700">Product images</label>
          <label className="flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-[1.5rem] border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center">
            <ImagePlus size={26} className="text-teal-700" />
            <p className="mt-3 text-sm font-bold text-gray-900">Upload up to 4 images</p>
            <p className="mt-1 text-xs text-gray-500">PNG, JPG, or WEBP supported.</p>
            <input type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
          </label>

          {files.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {previewUrls.map((url, index) => (
                <div key={url} className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
                  <CachedImage
                    src={url}
                    alt={`Preview ${index + 1}`}
                    wrapperClassName="aspect-square w-full"
                    imgClassName="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="absolute right-2 top-2 rounded-full bg-black/70 p-1 text-white"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-gray-700">Product name</label>
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="What are you selling?"
            required
            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition-all focus:border-teal-200 focus:bg-white focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-gray-700">Product details</label>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            placeholder="Describe the item, condition, and what buyers should know."
            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition-all focus:border-teal-200 focus:bg-white focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-gray-700">Category</label>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as (typeof MARKET_CATEGORIES)[number])}
            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition-all focus:border-teal-200 focus:bg-white focus:ring-2 focus:ring-teal-500"
          >
            {MARKET_CATEGORIES.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">Price ({currency})</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              placeholder="0.00"
              required
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition-all focus:border-teal-200 focus:bg-white focus:ring-2 focus:ring-teal-500"
            />
            <p className="text-xs text-gray-500">This item will show exactly as {formatAmount(Number(price || 0), currency)}.</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">Stock Quantity</label>
            <input
              type="number"
              min="0"
              step="1"
              value={stockQuantity}
              onChange={(event) => setStockQuantity(event.target.value)}
              required
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition-all focus:border-teal-200 focus:bg-white focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="space-y-3 rounded-[1.5rem] border border-gray-200 bg-gray-50 p-4">
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-gray-700">Negotiable</span>
              <input
                type="checkbox"
                checked={isNegotiable}
                onChange={(event) => setIsNegotiable(event.target.checked)}
                className="h-5 w-5 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-gray-700">Post anonymously</span>
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(event) => setIsAnonymous(event.target.checked)}
                className="h-5 w-5 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
            </label>
            <p className="text-xs text-gray-500">
              Anonymous items hide your name and photo in the market. Buyers only see you after chatting.
            </p>
          </div>
        </div>

        {error && <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-700 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-teal-800 disabled:opacity-70"
        >
          {submitting ? <Loader2 size={18} className="animate-spin" /> : null}
          Post Item
        </button>
      </form>
    </div>
  );
}
