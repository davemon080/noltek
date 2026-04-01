import React, { useEffect, useMemo, useState } from 'react';
import { supabaseService } from '../services/supabaseService';
import { UserProfile, FriendRequest } from '../types';
import { resolveAvatar } from '../utils/avatar';
import { Check, X, Clock, UserPlus, ArrowLeft, UserCheck, UserX, Send, Copy, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import CachedImage from './CachedImage';

interface FriendRequestsProps {
  profile: UserProfile;
}

type RequestTab = 'incoming' | 'outgoing';

export default function FriendRequests({ profile }: FriendRequestsProps) {
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [profileByUid, setProfileByUid] = useState<Record<string, UserProfile>>({});
  const [activeTab, setActiveTab] = useState<RequestTab>('incoming');
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubIncoming = supabaseService.subscribeToIncomingFriendRequests(profile.uid, (requests) => {
      setIncomingRequests(requests);
      setLoading(false);
    });

    const unsubOutgoing = supabaseService.subscribeToOutgoingFriendRequests(profile.uid, (requests) => {
      setOutgoingRequests(requests);
    });

    return () => {
      unsubIncoming();
      unsubOutgoing();
    };
  }, [profile.uid]);

  useEffect(() => {
    const uids = Array.from(
      new Set([
        ...incomingRequests.map((item) => item.fromUid),
        ...outgoingRequests.map((item) => item.toUid),
      ])
    );
    if (uids.length === 0) return;

    let active = true;
    supabaseService
      .getUsersByUids(uids)
      .then((users) => {
        if (!active) return;
        setProfileByUid((prev) => {
          const next = { ...prev };
          users.forEach((user) => {
            next[user.uid] = user;
          });
          return next;
        });
      })
      .catch(() => {
        // Keep existing resolved profile cards if fetch fails.
      });

    return () => {
      active = false;
    };
  }, [incomingRequests, outgoingRequests]);

  const pendingIncomingCount = useMemo(
    () => incomingRequests.filter((item) => item.status === 'pending').length,
    [incomingRequests]
  );
  const pendingOutgoingCount = useMemo(
    () => outgoingRequests.filter((item) => item.status === 'pending').length,
    [outgoingRequests]
  );

  const handleAccept = async (request: FriendRequest) => {
    try {
      await supabaseService.acceptFriendRequest(request, profile);
    } catch (error) {
      console.error('Error accepting request:', error);
    }
  };

  const handleReject = async (request: FriendRequest) => {
    try {
      await supabaseService.rejectFriendRequest(request.id);
    } catch (error) {
      console.error('Error rejecting request:', error);
    }
  };

  const handleCancel = async (requestId: string) => {
    try {
      await supabaseService.deleteFriendRequest(requestId);
    } catch (error) {
      console.error('Error canceling request:', error);
    }
  };

  const handleCopyId = async (user: UserProfile | undefined) => {
    if (!user) return;
    const value = user.publicId || user.uid;
    await navigator.clipboard.writeText(value);
    setCopiedId(value);
    setTimeout(() => setCopiedId(null), 1200);
  };

  const renderStatus = (status: FriendRequest['status']) => {
    const classes =
      status === 'accepted'
        ? 'bg-teal-100 text-teal-700'
        : status === 'pending'
        ? 'bg-amber-100 text-amber-700'
        : 'bg-red-100 text-red-700';
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${classes}`}>
        {status === 'accepted' ? <UserCheck size={14} /> : status === 'pending' ? <Clock size={14} /> : <UserX size={14} />}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const RequestCard = ({ request, direction }: { request: FriendRequest; direction: RequestTab }) => {
    const user = direction === 'incoming' ? profileByUid[request.fromUid] : profileByUid[request.toUid];
    const name = direction === 'incoming' ? request.fromName : user?.displayName || 'User';
    const publicUserId = user?.publicId || user?.uid;
    const targetUid = direction === 'incoming' ? request.fromUid : request.toUid;
    const avatar = resolveAvatar(
      user?.photoURL || (direction === 'incoming' ? request.fromPhoto : undefined),
      name || targetUid
    );

    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm">
        <div className="flex items-start gap-3 sm:gap-4">
          <Link to={`/profile/${targetUid}`} className="shrink-0">
            <CachedImage
              src={avatar}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              wrapperClassName="w-12 h-12 sm:w-14 sm:h-14 rounded-xl border border-gray-100"
              imgClassName="w-full h-full rounded-xl object-cover"
              alt={name}
            />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link to={`/profile/${targetUid}`} className="font-bold text-gray-900 hover:text-teal-600 truncate">
                {name}
              </Link>
              {renderStatus(request.status)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {new Date(request.createdAt).toLocaleString()}
            </p>

            {user && (
              <div className="mt-2 space-y-1">
                <p className="text-[11px] uppercase tracking-wider font-bold text-teal-600">{user.role}</p>
                {user.bio && <p className="text-sm text-gray-600 line-clamp-2">{user.bio}</p>}
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  {user.location && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={12} />
                      {user.location}
                    </span>
                  )}
                  {publicUserId && (
                    <button
                      onClick={() => handleCopyId(user)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold"
                      type="button"
                    >
                      <Copy size={12} />
                      {copiedId === publicUserId ? 'Copied' : `ID: ${publicUserId}`}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 justify-end">
          {direction === 'incoming' ? (
            request.status === 'pending' ? (
              <>
                <button
                  onClick={() => handleReject(request)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-bold rounded-xl hover:bg-gray-200 transition-all flex items-center gap-2"
                >
                  <X size={16} />
                  Decline
                </button>
                <button
                  onClick={() => handleAccept(request)}
                  className="px-4 py-2 bg-teal-600 text-white text-sm font-bold rounded-xl hover:bg-teal-700 transition-all flex items-center gap-2"
                >
                  <Check size={16} />
                  Accept
                </button>
              </>
            ) : (
              <Link
                to={`/profile/${targetUid}`}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-bold rounded-xl hover:bg-gray-200"
              >
                View Profile
              </Link>
            )
          ) : (
            <>
              <Link
                to={`/profile/${targetUid}`}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-bold rounded-xl hover:bg-gray-200"
              >
                View Profile
              </Link>
              {request.status === 'pending' && (
                <button
                  onClick={() => handleCancel(request.id)}
                  className="px-4 py-2 bg-red-50 text-red-700 text-sm font-bold rounded-xl hover:bg-red-100 transition-all"
                >
                  Cancel
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
      <div className="flex items-center gap-3 sm:gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft size={22} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Friend Requests</h1>
          <p className="text-gray-500 text-xs sm:text-sm">Review received requests and track sent invites</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4 sm:mb-6">
        <button
          onClick={() => setActiveTab('incoming')}
          className={`py-3.5 px-3 text-sm font-bold transition-all rounded-2xl border relative ${
            activeTab === 'incoming'
              ? 'text-teal-700 bg-teal-50 border-teal-200'
              : 'text-gray-500 bg-white border-gray-200 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <UserPlus size={17} />
            Received
            {pendingIncomingCount > 0 && (
              <span className="bg-teal-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">{pendingIncomingCount}</span>
            )}
          </div>
        </button>
        <button
          onClick={() => setActiveTab('outgoing')}
          className={`py-3.5 px-3 text-sm font-bold transition-all rounded-2xl border relative ${
            activeTab === 'outgoing'
              ? 'text-teal-700 bg-teal-50 border-teal-200'
              : 'text-gray-500 bg-white border-gray-200 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Send size={17} />
            Sent
            {pendingOutgoingCount > 0 && (
              <span className="bg-gray-400 text-white text-[10px] px-1.5 py-0.5 rounded-full">{pendingOutgoingCount}</span>
            )}
          </div>
        </button>
      </div>

      <div>
        {loading ? (
          <div className="flex justify-center py-14">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {activeTab === 'incoming' ? (
              <motion.div
                key="incoming"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-3 sm:space-y-4"
              >
                {incomingRequests.length === 0 ? (
                  <EmptyState label="No incoming requests yet." icon={<UserPlus size={30} className="text-gray-300" />} />
                ) : (
                  incomingRequests.map((request) => <RequestCard key={request.id} request={request} direction="incoming" />)
                )}
              </motion.div>
            ) : (
              <motion.div
                key="outgoing"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-3 sm:space-y-4"
              >
                {outgoingRequests.length === 0 ? (
                  <EmptyState label="You have not sent any requests yet." icon={<Send size={30} className="text-gray-300" />} />
                ) : (
                  outgoingRequests.map((request) => <RequestCard key={request.id} request={request} direction="outgoing" />)
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

function EmptyState({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">{icon}</div>
      <p className="text-gray-500">{label}</p>
    </div>
  );
}
