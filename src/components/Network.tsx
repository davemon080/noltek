import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, FriendRequest, Connection, Post, CompanyPartnerRequest } from '../types';
import { supabaseService } from '../services/supabaseService';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Star, MessageSquare, UserPlus, Users, Check, Sparkles, TrendingUp, Building2 } from 'lucide-react';
import { motion } from 'motion/react';
import CachedImage from './CachedImage';

interface NetworkProps {
  profile: UserProfile;
}

const PAGE_SIZE = 20;

export default function Network({ profile }: NetworkProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [highlights, setHighlights] = useState<Post[]>([]);
  const [partners, setPartners] = useState<CompanyPartnerRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'suggested' | 'discover'>('suggested');
  const [profileByUid, setProfileByUid] = useState<Record<string, UserProfile>>({});
  const [offset, setOffset] = useState(0);
  const [hasMoreUsers, setHasMoreUsers] = useState(true);
  const [loadingMoreUsers, setLoadingMoreUsers] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  const loadMoreUsers = async (reset = false) => {
    if (loadingMoreUsers) return;
    if (!reset && !hasMoreUsers) return;

    setLoadingMoreUsers(true);
    try {
      const pageOffset = reset ? 0 : offset;
      const rows = await supabaseService.listUsersPaginated(PAGE_SIZE + 1, pageOffset, profile.uid);
      const hasNextPage = rows.length > PAGE_SIZE;
      const nextPage = hasNextPage ? rows.slice(0, PAGE_SIZE) : rows;

      setUsers((prev) => {
        if (reset) return nextPage;
        const map = new Map(prev.map((item) => [item.uid, item]));
        nextPage.forEach((item) => map.set(item.uid, item));
        return Array.from(map.values());
      });
      setOffset(pageOffset + nextPage.length);
      setHasMoreUsers(hasNextPage);
    } catch (error) {
      console.error('Error loading network users:', error);
    } finally {
      setLoadingMoreUsers(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        await loadMoreUsers(true);
        const posts = await supabaseService.getHighlights(10);
        const approvedPartners = await supabaseService.listApprovedCompanyPartnerRequests(15);
        setHighlights(posts);
        setPartners(approvedPartners);
      } catch (error) {
        console.error('Error fetching network data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    const unsubscribeRequests = supabaseService.subscribeToIncomingFriendRequests(
      profile.uid,
      (requests) => setFriendRequests(requests.filter((r) => r.status === 'pending'))
    );

    const unsubscribeOutgoing = supabaseService.subscribeToOutgoingFriendRequests(
      profile.uid,
      (requests) => setOutgoingRequests(requests)
    );

    const unsubscribeConnections = supabaseService.subscribeToConnections(
      profile.uid,
      (items) => setConnections(items)
    );

    return () => {
      unsubscribeRequests();
      unsubscribeOutgoing();
      unsubscribeConnections();
    };
  }, [profile.uid]);

  useEffect(() => {
    const uids = Array.from(new Set(highlights.map((post) => post.authorUid).filter(Boolean)));
    if (uids.length === 0) return;
    let active = true;
    supabaseService
      .getUsersByUids(uids)
      .then((profiles) => {
        if (!active) return;
        setProfileByUid((prev) => {
          const next = { ...prev };
          profiles.forEach((item) => {
            next[item.uid] = item;
          });
          return next;
        });
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [highlights]);

  useEffect(() => {
    if (activeTab !== 'suggested') return;
    if (!loadMoreRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        loadMoreUsers(false);
      },
      { rootMargin: '140px' }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [activeTab, hasMoreUsers, loadingMoreUsers, offset]);

  const sendFriendRequest = async (targetUser: UserProfile) => {
    try {
      const alreadyConnected = connections.some((c) => c.uids.includes(targetUser.uid));
      if (alreadyConnected) return;

      const alreadyOutgoing = outgoingRequests.some(
        (r) => r.toUid === targetUser.uid && r.status === 'pending'
      );
      const alreadyIncoming = friendRequests.some(
        (r) => r.fromUid === targetUser.uid && r.status === 'pending'
      );
      if (alreadyOutgoing || alreadyIncoming) return;

      await supabaseService.sendFriendRequest(targetUser, profile);
      navigate('/requests');
    } catch (error) {
      console.error('Error sending friend request:', error);
    }
  };

  const suggestedUsers = users
    .filter((u) => !connections.some((c) => c.uids.includes(u.uid)))
    .map((u) => {
      let score = 0;
      const commonSkills = u.skills?.filter((s) => profile.skills?.includes(s)) || [];
      score += commonSkills.length * 15;
      if (u.role !== profile.role) score += 25;
      if (u.education?.university && u.education?.university === profile.education?.university) {
        score += 30;
      }
      if (u.location && u.location === profile.location) score += 10;
      return { ...u, score };
    })
    .sort((a, b) => b.score - a.score);

  const filteredUsers = suggestedUsers.filter(
    (u) =>
      u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.skills?.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-full -mr-16 -mt-16 blur-3xl" />
        <div className="flex items-center gap-4 relative z-10">
          <div className="p-3 bg-teal-600 rounded-2xl shadow-lg shadow-teal-100">
            <Users className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Network Hub</h1>
            <p className="text-gray-500 text-xs font-medium">Expand your professional circle</p>
          </div>
        </div>

        <div className="flex items-center gap-3 relative z-10">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search by name or skills..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border-transparent focus:bg-white focus:ring-2 focus:ring-teal-500 rounded-xl text-sm transition-all border border-gray-100"
            />
          </div>
          <Link
            to="/requests"
            className="relative p-2.5 rounded-xl transition-all border bg-white border-gray-100 hover:border-teal-200 text-gray-600 hover:text-teal-600"
            title="Friend Requests"
          >
            <UserPlus size={20} />
            {friendRequests.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white">
                {friendRequests.length}
              </span>
            )}
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-6 border-b border-gray-100 pb-1">
        <button
          onClick={() => setActiveTab('suggested')}
          className={`pb-4 text-sm font-bold transition-all relative ${activeTab === 'suggested' ? 'text-teal-600' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <div className="flex items-center gap-2">
            <Sparkles size={16} />
            Suggested for You
          </div>
          {activeTab === 'suggested' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-1 bg-teal-600 rounded-full" />}
        </button>
        <button
          onClick={() => setActiveTab('discover')}
          className={`pb-4 text-sm font-bold transition-all relative ${activeTab === 'discover' ? 'text-teal-600' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <div className="flex items-center gap-2">
            <TrendingUp size={16} />
            Discover Highlights
          </div>
          {activeTab === 'discover' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-1 bg-teal-600 rounded-full" />}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div></div>
      ) : activeTab === 'suggested' ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredUsers.map((user) => (
              <motion.div
                key={user.uid}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-gray-100 p-4 hover:border-teal-200 hover:shadow-xl hover:shadow-teal-900/5 transition-all group relative"
              >
                <div className="flex items-start gap-4">
                  <Link to={`/profile/${user.uid}`} className="relative shrink-0">
                    <CachedImage
                      src={user.photoURL}
                      alt={user.displayName}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      wrapperClassName="w-16 h-16 rounded-2xl shadow-sm"
                      imgClassName="w-full h-full rounded-2xl object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {user.score > 30 && (
                      <div className="absolute -top-1 -right-1 p-1 bg-amber-400 text-white rounded-lg shadow-sm">
                        <Star size={10} fill="currentColor" />
                      </div>
                    )}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link to={`/profile/${user.uid}`} className="block font-bold text-gray-900 hover:text-teal-600 transition-colors truncate text-sm">
                      {user.displayName}
                    </Link>
                    <p className="text-[11px] font-medium text-teal-600 uppercase tracking-wider mb-1">{user.role}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {user.skills?.slice(0, 2).map((skill) => (
                        <span key={skill} className="px-1.5 py-0.5 bg-gray-50 text-gray-500 text-[9px] font-bold rounded-md border border-gray-100">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4">
                  <button
                    onClick={() => sendFriendRequest(user)}
                    disabled={outgoingRequests.some((r) => r.toUid === user.uid && r.status === 'pending') || connections.some((c) => c.uids.includes(user.uid))}
                    className={`py-2 px-3 font-bold text-[11px] rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                      outgoingRequests.some((r) => r.toUid === user.uid && r.status === 'pending')
                        ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                        : connections.some((c) => c.uids.includes(user.uid))
                        ? 'bg-teal-50 text-teal-600 cursor-default'
                        : 'bg-teal-600 hover:bg-teal-700 text-white shadow-md shadow-teal-100'
                    }`}
                  >
                    {connections.some((c) => c.uids.includes(user.uid)) ? (
                      <>
                        <Check size={12} />
                        Connected
                      </>
                    ) : outgoingRequests.some((r) => r.toUid === user.uid && r.status === 'pending') ? (
                      'Pending'
                    ) : (
                      <>
                        <UserPlus size={12} />
                        Connect
                      </>
                    )}
                  </button>
                  <Link
                    to={`/messages?uid=${user.uid}`}
                    className="py-2 px-3 bg-gray-50 hover:bg-teal-50 text-gray-600 hover:text-teal-600 font-bold text-[11px] rounded-xl transition-all flex items-center justify-center gap-1.5 border border-transparent hover:border-teal-100"
                  >
                    <MessageSquare size={12} />
                    Message
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
          <div ref={loadMoreRef} className="h-10 flex items-center justify-center text-xs text-gray-400">
            {loadingMoreUsers ? 'Loading more users...' : hasMoreUsers ? 'Scroll to load more users' : 'No more users'}
          </div>
        </>
      ) : (
        <div className="space-y-8">
          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-xs sm:text-sm font-bold text-gray-900 tracking-wide">
                Our partners
              </h3>
              <span className="text-[10px] sm:text-xs font-semibold text-teal-700">
                Approved companies on Connect
              </span>
            </div>
            <div className="flex items-start gap-5 sm:gap-6 overflow-x-auto px-1 pb-2">
              {partners.length > 0 ? (
                partners.map((partner) => (
                  <Link
                    key={partner.id}
                    to={`/profile/${partner.userUid}`}
                    className="shrink-0 flex flex-col items-center gap-2 min-w-[92px] sm:min-w-[110px]"
                  >
                    <div className="relative">
                      <CachedImage
                        src={partner.companyLogoUrl}
                        alt={partner.companyName}
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        wrapperClassName="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 border-teal-100"
                        imgClassName="w-full h-full rounded-full object-cover"
                      />
                      <span className="absolute bottom-1 right-1 inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-white shadow-sm">
                        <Building2 size={12} className="text-teal-700" />
                      </span>
                    </div>
                    <span className="text-[10px] sm:text-xs font-semibold text-gray-700 text-center truncate w-20 sm:w-24">
                      {partner.companyName}
                    </span>
                    <span className="text-[9px] sm:text-[10px] text-teal-600 font-medium text-center truncate w-20 sm:w-24">
                      {partner.location}
                    </span>
                  </Link>
                ))
              ) : (
                <p className="text-xs text-gray-400 italic">No approved partners yet.</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {highlights.map((post) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-all"
              >
                <div className="p-4 flex items-center gap-3 border-b border-gray-50">
                  <CachedImage
                    src={profileByUid[post.authorUid]?.photoURL || post.authorPhoto}
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    wrapperClassName="w-10 h-10 rounded-xl"
                    imgClassName="w-full h-full rounded-xl object-cover"
                    alt=""
                  />
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{post.authorName}</p>
                    <p className="text-[10px] text-teal-600 font-semibold">
                      {profileByUid[post.authorUid]?.skills?.[0] || profileByUid[post.authorUid]?.role || 'Freelancer'}
                    </p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Recent Highlight</p>
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-gray-600 text-sm line-clamp-3 mb-4">{post.content}</p>
                  {post.imageUrl && (
                    <CachedImage
                      src={post.imageUrl}
                      loading="lazy"
                      decoding="async"
                      wrapperClassName="w-full h-48 rounded-2xl mb-4"
                      imgClassName="w-full h-full rounded-2xl object-cover"
                      alt=""
                    />
                  )}
                  <Link to={`/profile/${post.authorUid}`} className="inline-flex items-center gap-2 text-teal-600 font-bold text-xs hover:gap-3 transition-all">
                    View Portfolio
                    <TrendingUp size={14} />
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
