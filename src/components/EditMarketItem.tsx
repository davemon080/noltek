import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ImagePlus, Loader2, X } from 'lucide-react';
import { UserProfile } from '../types';
import { supabaseService } from '../services/supabaseService';
import CachedImage from './CachedImage';
import { useCurrency } from '../context/CurrencyContext';
import { convertAmount, formatAmount } from '../utils/currency';
import { MARKET_CATEGORIES } from '../constants/market';

interface EditMarketItemProps {
  profile: UserProfile;
}

export default function EditMarketItem({ profile }: EditMarketItemProps) {
  const { itemId } = useParams();
  const navigate = useNavigate();
  const { currency } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<(typeof MARKET_CATEGORIES)[number]>(MARKET_CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stockQuantity, setStockQuantity] = useState('1');
  const [isNegotiable, setIsNegotiable] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);

  useEffect(() => {
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

  useEffect(() => {
    let active = true;
    if (!itemId) return;
    supabaseService.getMarketItemById(itemId).then((item) => {
      if (!active) return;
      if (!item || item.sellerUid !== profile.uid) {
        navigate('/market');
        return;
      }
      setTitle(item.title);
      setCategory((item.category as (typeof MARKET_CATEGORIES)[number]) || MARKET_CATEGORIES[0]);
      setDescription(item.description || '');
      setPrice(convertAmount(item.price, item.priceCurrency, currency).toFixed(2));
      setStockQuantity(String(item.stockQuantity));
      setIsNegotiable(item.isNegotiable);
      setIsAnonymous(item.isAnonymous);
      setExistingImages(item.imageUrls);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [currency, itemId, navigate, profile.uid]);

  const previewUrls = useMemo(() => newFiles.map((file) => URL.createObjectURL(file)), [newFiles]);
  const totalImages = existingImages.length + newFiles.length;

  const handleFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []);
    const availableSlots = Math.max(0, 4 - existingImages.length);
    setNewFiles(selected.slice(0, availableSlots));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!itemId) return;
    setError(null);
    if (totalImages === 0) {
      setError('Keep at least one image.');
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
      const uploads = await Promise.all(newFiles.map((file) => supabaseService.uploadFile(file, 'market')));
      await supabaseService.updateMarketItem(itemId, {
        title: title.trim(),
        category,
        description: description.trim() || undefined,
        price: Number(numericPrice.toFixed(2)),
        priceCurrency: currency,
        isNegotiable,
        isAnonymous,
        stockQuantity: Math.floor(numericStock),
        imageUrls: [...existingImages, ...uploads.map((upload) => upload.url)].slice(0, 4),
      });
      navigate(`/market/${itemId}`);
    } catch (submitError: any) {
      setError(submitError?.message || 'Failed to update item.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-gray-500">Loading item...</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="rounded-full p-2 hover:bg-gray-100">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit Item</h1>
          <p className="text-sm text-gray-500">Update your listing details and save changes.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-[2rem] border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="space-y-3">
          <label className="text-sm font-bold text-gray-700">Product images</label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {existingImages.map((url, index) => (
              <div key={url} className="relative overflow-hidden rounded-2xl border border-gray-200">
                <CachedImage src={url} alt={`Existing ${index + 1}`} wrapperClassName="aspect-square w-full" imgClassName="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setExistingImages((prev) => prev.filter((imageUrl) => imageUrl !== url))}
                  className="absolute right-2 top-2 rounded-full bg-black/70 p-1 text-white"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            {previewUrls.map((url, index) => (
              <div key={url} className="relative overflow-hidden rounded-2xl border border-gray-200">
                <CachedImage src={url} alt={`New ${index + 1}`} wrapperClassName="aspect-square w-full" imgClassName="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setNewFiles((prev) => prev.filter((_, fileIndex) => fileIndex !== index))}
                  className="absolute right-2 top-2 rounded-full bg-black/70 p-1 text-white"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            {totalImages < 4 && (
              <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 text-center">
                <ImagePlus size={20} className="text-teal-700" />
                <p className="mt-2 text-xs font-bold text-gray-700">Add image</p>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
              </label>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-gray-700">Product name</label>
          <input value={title} onChange={(event) => setTitle(event.target.value)} required className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-teal-500" />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-gray-700">Product details</label>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-teal-500" />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-gray-700">Category</label>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as (typeof MARKET_CATEGORIES)[number])}
            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-teal-500"
          >
            {MARKET_CATEGORIES.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">Price ({currency})</label>
            <input type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} required className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-teal-500" />
            <p className="text-xs text-gray-500">This item will display as {formatAmount(Number(price || 0), currency)}.</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">Stock Quantity</label>
            <input type="number" min="0" step="1" value={stockQuantity} onChange={(event) => setStockQuantity(event.target.value)} required className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-teal-500" />
          </div>

          <div className="space-y-3 rounded-[1.5rem] border border-gray-200 bg-gray-50 p-4">
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-gray-700">Negotiable</span>
              <input type="checkbox" checked={isNegotiable} onChange={(event) => setIsNegotiable(event.target.checked)} className="h-5 w-5 rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-gray-700">Post anonymously</span>
              <input type="checkbox" checked={isAnonymous} onChange={(event) => setIsAnonymous(event.target.checked)} className="h-5 w-5 rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
            </label>
          </div>
        </div>

        {error && <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}

        <button type="submit" disabled={submitting} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-700 px-4 py-3 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-70">
          {submitting ? <Loader2 size={18} className="animate-spin" /> : null}
          Save Changes
        </button>
      </form>
    </div>
  );
}
