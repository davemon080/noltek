import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, MessageCircle, Pencil, Star, Trash2 } from 'lucide-react';
import { UserProfile, MarketItem, MarketSellerRating, MarketSettings } from '../types';
import { supabaseService } from '../services/supabaseService';
import CachedImage from './CachedImage';
import { formatAmountInCurrency } from '../utils/currency';
import { formatDistanceToNow } from 'date-fns';
import { useConfirmDialog } from './ConfirmDialog';
import { useCurrency } from '../context/CurrencyContext';

interface MarketItemDetailsProps {
  profile: UserProfile;
}

export default function MarketItemDetails({ profile }: MarketItemDetailsProps) {
  const { itemId } = useParams();
  const navigate = useNavigate();
  const { currency } = useCurrency();
  const [item, setItem] = useState<MarketItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [ratings, setRatings] = useState<MarketSellerRating[]>([]);
  const [sellerSettings, setSellerSettings] = useState<MarketSettings | null>(null);
  const isOwnItem = item?.sellerUid === profile.uid;
  const { confirm, confirmDialog } = useConfirmDialog();

  useEffect(() => {
    let active = true;
    if (!itemId) return;

    supabaseService.getMarketItemById(itemId).then((nextItem) => {
      if (!active) return;
      setItem(nextItem);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [itemId]);

  useEffect(() => {
    const unsubscribe = supabaseService.subscribeToMarketSellerRatings(setRatings);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!item?.sellerUid) return;
    let active = true;
    supabaseService.getMarketSettings(item.sellerUid).then((settings) => {
      if (active) setSellerSettings(settings);
    });
    return () => {
      active = false;
    };
  }, [item?.sellerUid]);

  const activeImage = useMemo(() => item?.imageUrls[activeImageIndex] || item?.imageUrls[0], [activeImageIndex, item]);
  const sellerRatings = useMemo(() => ratings.filter((rating) => rating.sellerUid === item?.sellerUid), [item?.sellerUid, ratings]);
  const sellerAverageRating = useMemo(() => {
    if (sellerRatings.length === 0) return 0;
    return sellerRatings.reduce((sum, rating) => sum + rating.rating, 0) / sellerRatings.length;
  }, [sellerRatings]);
  const myRating = useMemo(() => sellerRatings.find((rating) => rating.userUid === profile.uid)?.rating || 0, [profile.uid, sellerRatings]);

  if (loading) {
    return <div className="h-40 animate-pulse rounded-[2rem] bg-gray-100" />;
  }

  if (!item) {
    return (
      <div className="rounded-[2rem] border border-gray-200 bg-white p-10 text-center shadow-sm">
        <p className="text-lg font-bold text-gray-900">Item not found</p>
        <button onClick={() => navigate('/market')} className="mt-4 rounded-2xl bg-teal-700 px-4 py-3 text-sm font-bold text-white">
          Back to Market
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/market')} className="rounded-full p-2 hover:bg-gray-100">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Item Details</h1>
          <p className="text-sm text-gray-500">View item details and message the seller if interested.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-[2rem] border border-gray-200 bg-white shadow-sm">
            {activeImage ? (
              <CachedImage
                src={activeImage}
                alt={item.title}
                wrapperClassName="aspect-[4/3] w-full"
                imgClassName="h-full w-full object-cover"
              />
            ) : (
              <div className="aspect-[4/3] w-full bg-gray-100" />
            )}

            {item.imageUrls.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveImageIndex((prev) => (prev - 1 + item.imageUrls.length) % item.imageUrls.length)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveImageIndex((prev) => (prev + 1) % item.imageUrls.length)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white"
                >
                  <ChevronRight size={18} />
                </button>
              </>
            )}
          </div>

          {item.imageUrls.length > 1 && (
            <div className="grid grid-cols-4 gap-3">
              {item.imageUrls.map((imageUrl, index) => (
                <button
                  key={imageUrl}
                  type="button"
                  onClick={() => setActiveImageIndex(index)}
                  className={`overflow-hidden rounded-2xl border ${index === activeImageIndex ? 'border-teal-500' : 'border-gray-200'}`}
                >
                  <CachedImage
                    src={imageUrl}
                    alt={`${item.title} ${index + 1}`}
                    wrapperClassName="aspect-square w-full"
                    imgClassName="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-[2rem] border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-bold uppercase tracking-wider text-gray-400">For Sale</p>
              <h2 className="text-3xl font-black text-gray-900">{item.title}</h2>
              <p className="text-3xl font-black text-teal-700">{formatAmountInCurrency(item.price, item.priceCurrency, currency)}</p>
            </div>

            <div className="flex flex-wrap gap-2 text-xs font-bold uppercase tracking-wider">
              <span className="rounded-full bg-gray-100 px-3 py-1.5 text-gray-600">{item.category}</span>
              {item.isNegotiable && <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-700">Negotiable</span>}
              <span className="rounded-full bg-teal-50 px-3 py-1.5 text-teal-700">{item.stockQuantity} in stock</span>
              <span className="rounded-full bg-gray-100 px-3 py-1.5 text-gray-600">
                {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
              </span>
              {item.isAnonymous && <span className="rounded-full bg-gray-900 px-3 py-1.5 text-white">Anonymous Seller</span>}
            </div>

            <div className="rounded-[1.5rem] bg-gray-50 p-4">
              <p className="text-sm font-bold text-gray-900">
                {item.isAnonymous ? 'Anonymous Seller' : item.seller?.displayName || 'Seller'}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                {item.isAnonymous
                  ? 'The seller chose to hide their profile on the market listing. You will see them in chat after you message them.'
                  : item.seller?.role || 'Marketplace seller'}
              </p>
              {!item.isAnonymous && (
                <div className="mt-3 space-y-2 text-sm text-gray-600">
                  {sellerSettings?.showBrandName && sellerSettings.brandName && <p><span className="font-semibold text-gray-900">Brand:</span> {sellerSettings.brandName}</p>}
                  {sellerSettings?.showPhoneNumber && sellerSettings.phoneNumber && <p><span className="font-semibold text-gray-900">Phone:</span> {sellerSettings.phoneNumber}</p>}
                  {sellerSettings?.showLocation && sellerSettings.location && <p><span className="font-semibold text-gray-900">Location:</span> {sellerSettings.location}</p>}
                </div>
              )}
            </div>

            <div className="rounded-[1.5rem] border border-gray-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-gray-900">Seller Rating</p>
                  <p className="text-xs text-gray-500">
                    Trust level {sellerAverageRating >= 4.5 ? 'Excellent' : sellerAverageRating >= 4 ? 'High' : sellerAverageRating >= 3 ? 'Growing' : 'New'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-amber-600">{sellerAverageRating.toFixed(1)}</p>
                  <p className="text-[11px] text-gray-400">{sellerRatings.length} rating{sellerRatings.length === 1 ? '' : 's'}</p>
                </div>
              </div>
              {!isOwnItem && (
                <div className="mt-3 flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => supabaseService.upsertMarketSellerRating(item.sellerUid, profile.uid, star)}
                      className={`rounded-full p-1 ${star <= myRating ? 'text-amber-500' : 'text-gray-300'}`}
                    >
                      <Star size={18} className={star <= myRating ? 'fill-current' : ''} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {item.description && (
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">Details</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-600">{item.description}</p>
              </div>
            )}

            {isOwnItem ? (
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => navigate(`/market/${item.id}/edit`)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50"
                >
                  <Pencil size={16} />
                  Edit Item
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const confirmed = await confirm({
                      title: 'Delete this item?',
                      description: 'This will permanently remove the market listing from the database.',
                      confirmLabel: 'Delete',
                      tone: 'danger',
                    });
                    if (!confirmed) return;
                    await supabaseService.deleteMarketItem(item.id);
                    navigate('/market');
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-red-700"
                >
                  <Trash2 size={16} />
                  Delete Item
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => navigate(`/messages?uid=${item.sellerUid}`)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-700 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-teal-800"
              >
                <MessageCircle size={18} />
                Message Seller
              </button>
            )}
          </div>
        </div>
      </div>
      {confirmDialog}
    </div>
  );
}
