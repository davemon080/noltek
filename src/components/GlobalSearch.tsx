import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, Building2, FileText, Search, Settings, ShoppingBag, User, Wallet, X } from 'lucide-react';
import { supabaseService } from '../services/supabaseService';
import { CompanyPartnerRequest, Job, MarketItem, Post, UserProfile } from '../types';

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

type SearchResult = {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ size?: number }>;
  action: () => void;
};

const staticPages: Array<{ id: string; title: string; subtitle: string; path: string; keywords: string[]; icon: SearchResult['icon'] }> = [
  { id: 'page-feed', title: 'Feed', subtitle: 'Home • social updates and active freelancers', path: '/', keywords: ['feed', 'home', 'posts', 'freelancers'], icon: FileText },
  { id: 'page-network', title: 'Network', subtitle: 'Discover users, highlights, and partners', path: '/network', keywords: ['network', 'discover', 'partners', 'connections'], icon: User },
  { id: 'page-jobs', title: 'Jobs', subtitle: 'Browse gigs and client opportunities', path: '/jobs', keywords: ['jobs', 'gigs', 'freelance', 'apply'], icon: Briefcase },
  { id: 'page-market', title: 'Market', subtitle: 'Buy and sell items', path: '/market', keywords: ['market', 'shop', 'sell', 'items'], icon: ShoppingBag },
  { id: 'page-wallets', title: 'Wallets', subtitle: 'Balances, transfers, top-up, withdraw', path: '/wallets', keywords: ['wallet', 'transfer', 'payment', 'pay', 'balance'], icon: Wallet },
  { id: 'page-settings', title: 'Settings', subtitle: 'Account, security, notifications, support', path: '/settings', keywords: ['settings', 'support', 'security', 'notifications', 'market settings'], icon: Settings },
  { id: 'page-support', title: 'Support', subtitle: 'Get help, report an issue, or ask questions', path: '/settings?section=support', keywords: ['support', 'help', 'contact', 'issue', 'report'], icon: Settings },
];

export default function GlobalSearch({ isOpen, onClose }: GlobalSearchProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [marketItems, setMarketItems] = useState<MarketItem[]>([]);
  const [partners, setPartners] = useState<CompanyPartnerRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);

  useEffect(() => {
    if (!isOpen || loadedOnce) return;
    setLoading(true);

    const unsubscribeUsers = supabaseService.subscribeToAllUsers((allUsers) => {
      setUsers(allUsers);
      setLoadedOnce(true);
      setLoading(false);
    });
    const unsubscribeJobs = supabaseService.subscribeToJobs(setJobs);
    const unsubscribePosts = supabaseService.subscribeToPosts((allPosts) => setPosts(allPosts.slice(0, 50)));
    const unsubscribeMarket = supabaseService.subscribeToMarketItems(setMarketItems);
    const unsubscribePartners = supabaseService.subscribeToApprovedCompanyPartnerRequests(25, setPartners);

    return () => {
      unsubscribeUsers();
      unsubscribeJobs();
      unsubscribePosts();
      unsubscribeMarket();
      unsubscribePartners();
    };
  }, [isOpen, loadedOnce]);

  const normalizedQuery = query.trim().toLowerCase();

  const results = useMemo<SearchResult[]>(() => {
    if (!normalizedQuery) return [];

    const userResults = users
      .filter(
        (u) =>
          u.displayName.toLowerCase().includes(normalizedQuery) ||
          u.email.toLowerCase().includes(normalizedQuery) ||
          (u.publicId || '').toLowerCase().includes(normalizedQuery) ||
          u.skills?.some((skill) => skill.toLowerCase().includes(normalizedQuery))
      )
      .slice(0, 6)
      .map((u) => ({
        id: `user-${u.uid}`,
        title: u.displayName,
        subtitle: `Profile • ${u.role}`,
        icon: User,
        action: () => navigate(`/profile/${u.uid}`),
      }));

    const partnerResults = partners
      .filter(
        (partner) =>
          partner.companyName.toLowerCase().includes(normalizedQuery) ||
          partner.location.toLowerCase().includes(normalizedQuery) ||
          partner.about.toLowerCase().includes(normalizedQuery)
      )
      .slice(0, 5)
      .map((partner) => ({
        id: `partner-${partner.id}`,
        title: partner.companyName,
        subtitle: `Company • ${partner.location}`,
        icon: Building2,
        action: () => navigate(`/profile/${partner.userUid}`),
      }));

    const jobResults = jobs
      .filter(
        (j) =>
          j.title.toLowerCase().includes(normalizedQuery) ||
          j.description.toLowerCase().includes(normalizedQuery) ||
          j.category.toLowerCase().includes(normalizedQuery)
      )
      .slice(0, 6)
      .map((j) => ({
        id: `job-${j.id}`,
        title: j.title,
        subtitle: `Gig • ${j.category}`,
        icon: Briefcase,
        action: () => navigate(`/jobs/${j.id}`),
      }));

    const marketResults = marketItems
      .filter(
        (item) =>
          item.title.toLowerCase().includes(normalizedQuery) ||
          item.category.toLowerCase().includes(normalizedQuery) ||
          (item.description || '').toLowerCase().includes(normalizedQuery)
      )
      .slice(0, 6)
      .map((item) => ({
        id: `market-${item.id}`,
        title: item.title,
        subtitle: `Market • ${item.category}`,
        icon: ShoppingBag,
        action: () => navigate(`/market/${item.id}`),
      }));

    const postResults = posts
      .filter(
        (p) =>
          p.content.toLowerCase().includes(normalizedQuery) ||
          p.authorName.toLowerCase().includes(normalizedQuery)
      )
      .slice(0, 5)
      .map((p) => ({
        id: `post-${p.id}`,
        title: p.authorName,
        subtitle: `Post • ${p.content.slice(0, 72)}${p.content.length > 72 ? '...' : ''}`,
        icon: FileText,
        action: () => navigate(`/profile/${p.authorUid}`),
      }));

    const pageResults = staticPages
      .filter((page) =>
        [page.title, page.subtitle, ...page.keywords].some((value) => value.toLowerCase().includes(normalizedQuery))
      )
      .slice(0, 6)
      .map((page) => ({
        id: page.id,
        title: page.title,
        subtitle: page.subtitle,
        icon: page.icon,
        action: () => navigate(page.path),
      }));

    return [...pageResults, ...partnerResults, ...userResults, ...jobResults, ...marketResults, ...postResults];
  }, [jobs, marketItems, navigate, normalizedQuery, partners, posts, users]);

  const handleResultClick = (action: () => void) => {
    action();
    onClose();
    setQuery('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/45 backdrop-blur-sm flex items-start justify-center p-4 md:p-8">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center gap-3">
          <Search size={18} className="text-gray-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search market, gigs, partners, settings, and more..."
            className="flex-1 text-sm md:text-base outline-none"
          />
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto">
          {loading && <p className="p-6 text-sm text-gray-500">Loading searchable content...</p>}
          {!loading && !normalizedQuery && (
            <p className="p-6 text-sm text-gray-500">Type to search across profiles, companies, gigs, market items, posts, and app pages.</p>
          )}
          {!loading && normalizedQuery && results.length === 0 && (
            <p className="p-6 text-sm text-gray-500">No results found.</p>
          )}
          {!loading &&
            results.map((result) => (
              <button
                key={result.id}
                onClick={() => handleResultClick(result.action)}
                className="w-full flex items-start gap-3 p-4 text-left hover:bg-gray-50 border-b border-gray-50"
              >
                <div className="p-2 rounded-xl bg-gray-100 text-gray-700">
                  <result.icon size={16} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{result.title}</p>
                  <p className="text-xs text-gray-500">{result.subtitle}</p>
                </div>
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
