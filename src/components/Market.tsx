import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, SlidersHorizontal, Tag, Plus, Star } from 'lucide-react';
import { UserProfile, MarketItem, MarketSellerRating } from '../types';
import { supabaseService } from '../services/supabaseService';
import CachedImage, { preloadCachedImage } from './CachedImage';
import { convertAmount, formatAmountInCurrency } from '../utils/currency';
import { formatDistanceToNow } from 'date-fns';
import { MARKET_CATEGORIES } from '../constants/market';
import { useCurrency } from '../context/CurrencyContext';

interface MarketProps {
  profile: UserProfile;
}

export default function Market({ profile }: MarketProps) {
  const navigate = useNavigate();
  const { currency } = useCurrency();
  const [items, setItems] = useState<MarketItem[]>([]);
  const [ratings, setRatings] = useState<MarketSellerRating[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [negotiableOnly, setNegotiableOnly] = useState(false);
  const [category, setCategory] = useState('All');
  const [sortBy, setSortBy] = useState<'newest' | 'price-low' | 'price-high'>('newest');
  const [accessReady, setAccessReady] = useState(false);

  useEffect(() => {
    let active = true;
    supabaseService.getMarketSettings(profile.uid).then((settings) => {
      if (!active) return;
      if (!settings.isRegistered) {
        navigate('/settings?section=market', { replace: true });
        return;
      }
      setAccessReady(true);
    });
    return () => {
      active = false;
    };
  }, [navigate, profile.uid]);

  useEffect(() => {
    if (!accessReady) return;
    const unsubscribe = supabaseService.subscribeToMarketItems(setItems);
    return () => unsubscribe();
  }, [accessReady]);

  useEffect(() => {
    if (!accessReady) return;
    const unsubscribe = supabaseService.subscribeToMarketSellerRatings(setRatings);
    return () => unsubscribe();
  }, [accessReady]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    let nextItems = items.filter((item) => {
      if (negotiableOnly && !item.isNegotiable) return false;
      if (category !== 'All' && item.category !== category) return false;
      if (!normalizedQuery) return true;
      return [
        item.title,
        item.description || '',
        item.seller?.displayName || '',
        item.category,
        `${item.stockQuantity}`,
        formatAmountInCurrency(item.price, item.priceCurrency, currency),
      ].some((value) => value.toLowerCase().includes(normalizedQuery));
    });

    nextItems = [...nextItems].sort((a, b) => {
      if (sortBy === 'price-low') {
        return convertAmount(a.price, a.priceCurrency, currency) - convertAmount(b.price, b.priceCurrency, currency);
      }
      if (sortBy === 'price-high') {
        return convertAmount(b.price, b.priceCurrency, currency) - convertAmount(a.price, a.priceCurrency, currency);
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return nextItems;
  }, [category, currency, items, negotiableOnly, searchQuery, sortBy]);

  const categoryCounts = useMemo(() => {
    return items.reduce<Record<string, number>>((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1;
      return acc;
    }, {});
  }, [items]);

  const sellerRatingMeta = useMemo(() => {
    return ratings.reduce<Record<string, { avg: number; count: number }>>((acc, rating) => {
      const current = acc[rating.sellerUid] || { avg: 0, count: 0 };
      const total = current.avg * current.count + rating.rating;
      const count = current.count + 1;
      acc[rating.sellerUid] = { avg: total / count, count };
      return acc;
    }, {});
  }, [ratings]);

  const suggestions = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) return [];
    return items
      .filter((item) =>
        [item.title, item.description || '', item.category, item.seller?.displayName || '']
          .some((value) => value.toLowerCase().includes(normalized))
      )
      .slice(0, 6);
  }, [items, searchQuery]);

  useEffect(() => {
    filteredItems.slice(0, 8).forEach((item) => {
      preloadCachedImage(item.imageUrls[0]);
    });
  }, [filteredItems]);

  if (!accessReady) {
    return <div className="rounded-[2rem] border border-gray-200 bg-white p-8 text-sm text-gray-500 shadow-sm">Checking marketplace access...</div>;
  }

  return (
    <div className="relative space-y-5 pb-24">
      <div className="rounded-[2rem] border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search items for sale..."
              className="w-full rounded-2xl border border-gray-100 bg-gray-50 py-3 pl-11 pr-4 text-sm outline-none transition-all focus:border-teal-200 focus:bg-white focus:ring-2 focus:ring-teal-500"
            />
            {suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
                {suggestions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(`/market/${item.id}`)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
                  >
                    <CachedImage src={item.imageUrls[0]} alt={item.title} wrapperClassName="h-10 w-10 rounded-xl" imgClassName="h-full w-full rounded-xl object-cover" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-gray-900">{item.title}</p>
                      <p className="truncate text-xs text-gray-500">{item.category} · {formatAmountInCurrency(item.price, item.priceCurrency, currency)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-2xl border border-gray-100 bg-gray-50 px-3 py-2">
              <SlidersHorizontal size={16} className="text-gray-400" />
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as 'newest' | 'price-low' | 'price-high')}
                className="bg-transparent text-sm font-semibold text-gray-700 outline-none"
              >
                <option value="newest">Newest</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
              </select>
            </div>

            <label className="inline-flex items-center gap-2 rounded-2xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700">
              <input
                type="checkbox"
                checked={negotiableOnly}
                onChange={(event) => setNegotiableOnly(event.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              Negotiable only
            </label>

            <div className="inline-flex items-center gap-2 rounded-2xl border border-gray-100 bg-gray-50 px-3 py-2">
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="bg-transparent text-sm font-semibold text-gray-700 outline-none"
              >
                <option value="All">All categories</option>
                {MARKET_CATEGORIES.map((item) => (
                  <option key={item} value={item}>{item} ({categoryCounts[item] || 0})</option>
                ))}
              </select>
            </div>

            <div className="ml-auto text-xs font-bold uppercase tracking-wider text-gray-400">
              {filteredItems.length} item{filteredItems.length === 1 ? '' : 's'}
            </div>
          </div>
        </div>
      </div>

      {filteredItems.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredItems.map((item, index) => (
            <Link
              key={item.id}
              to={`/market/${item.id}`}
              className="overflow-hidden rounded-[2rem] border border-gray-200 bg-white shadow-sm transition-all hover:-translate-y-1 hover:border-teal-200 hover:shadow-lg"
            >
              <div className="aspect-[4/3] bg-gray-100">
                <CachedImage
                  src={item.imageUrls[0]}
                  alt={item.title}
                  loading={index < 4 ? 'eager' : 'lazy'}
                  decoding="async"
                  fetchPriority={index < 4 ? 'high' : 'auto'}
                  referrerPolicy="no-referrer"
                  wrapperClassName="h-full w-full"
                  imgClassName="h-full w-full object-cover"
                />
              </div>

              <div className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">{item.category}</p>
                    <h2 className="line-clamp-2 text-base font-bold text-gray-900">{item.title}</h2>
                  </div>
                  {item.isNegotiable && (
                    <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                      Negotiable
                    </span>
                  )}
                </div>

                <p className="text-xl font-black text-teal-700">{formatAmountInCurrency(item.price, item.priceCurrency, currency)}</p>

                <div className="flex items-center justify-between gap-3 text-xs text-gray-500">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-700">
                      {item.isAnonymous ? 'Anonymous Seller' : item.seller?.displayName || 'Seller'}
                    </p>
                    <div className="flex items-center gap-2">
                      <p>{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</p>
                      <span className="inline-flex items-center gap-1 text-amber-600">
                        <Star size={12} className="fill-current" />
                        {(sellerRatingMeta[item.sellerUid]?.avg || 0).toFixed(1)}
                      </span>
                      <span className="text-[10px] font-semibold text-gray-400">
                        {sellerRatingMeta[item.sellerUid]?.count || 0} rating{(sellerRatingMeta[item.sellerUid]?.count || 0) === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 font-semibold text-gray-600">
                    <Tag size={12} />
                    {item.stockQuantity} in stock
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-[2rem] border border-dashed border-gray-300 bg-white px-6 py-16 text-center shadow-sm">
          <p className="text-lg font-bold text-gray-900">No items found</p>
          <p className="mt-2 text-sm text-gray-500">
            Try another search, or be the first to post something for sale.
          </p>
        </div>
      )}

      <Link
        to="/market/sell"
        className="fixed bottom-24 right-4 z-30 inline-flex items-center gap-2 rounded-full bg-teal-700 px-5 py-4 text-sm font-bold text-white shadow-xl transition-all hover:bg-teal-800 md:bottom-8 md:right-8"
      >
        <Plus size={18} />
        Sell Item
      </Link>
    </div>
  );
}
