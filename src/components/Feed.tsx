import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserProfile, Post, Job, PostLike, PostComment } from '../types';
import { supabaseService } from '../services/supabaseService';
import { Image, Send, Briefcase, Star, MapPin, DollarSign, Plus, X, Heart, MessageCircle, Share2, Copy, Link as LinkIcon, Pencil, Trash2, MoreVertical, Flag } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { useCurrency } from '../context/CurrencyContext';
import { formatMoneyFromUSD } from '../utils/currency';
import CachedImage from './CachedImage';
import { useConfirmDialog } from './ConfirmDialog';

interface FeedProps {
  profile: UserProfile;
}

export default function Feed({ profile }: FeedProps) {
  const TOP_ACTIVE_LIMIT = 15;
  const { currency } = useCurrency();
  const initialFeedSnapshot = useMemo(() => supabaseService.getFeedCacheSnapshot(), []);
  const [posts, setPosts] = useState<Post[]>(() => initialFeedSnapshot?.posts || []);
  const [jobs, setJobs] = useState<Job[]>(() => initialFeedSnapshot?.jobs || []);
  const [likes, setLikes] = useState<PostLike[]>(() => initialFeedSnapshot?.likes || []);
  const [comments, setComments] = useState<PostComment[]>(() => initialFeedSnapshot?.comments || []);
  const [likingPostIds, setLikingPostIds] = useState<string[]>([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [backgroundPostingCount, setBackgroundPostingCount] = useState(0);
  const [showComposer, setShowComposer] = useState(false);
  const [postImageFile, setPostImageFile] = useState<File | null>(null);
  const [postImagePreview, setPostImagePreview] = useState<string | null>(null);
  const [sharePost, setSharePost] = useState<Post | null>(null);
  const [copied, setCopied] = useState(false);
  const [openPostMenuId, setOpenPostMenuId] = useState<string | null>(null);
  const [postActionToast, setPostActionToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [topStudents, setTopStudents] = useState<UserProfile[]>(() => initialFeedSnapshot?.topStudents || []);
  const [hasMoreTopStudents, setHasMoreTopStudents] = useState(() => initialFeedSnapshot?.hasMoreTopStudents || false);
  const [profileByUid, setProfileByUid] = useState<Record<string, UserProfile>>(() => initialFeedSnapshot?.profileByUid || {});
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const { confirm, confirmDialog } = useConfirmDialog();

  useEffect(() => {
    supabaseService.writeFeedCacheSnapshot({
      posts,
      jobs,
      likes,
      comments,
      topStudents,
      hasMoreTopStudents,
      profileByUid,
    });
  }, [posts, jobs, likes, comments, topStudents, hasMoreTopStudents, profileByUid]);

  useEffect(() => {
    return supabaseService.subscribeToOnlineUsers((uids) => {
      setOnlineUserIds(new Set(uids));
    });
  }, []);

  useEffect(() => {
    const unsubscribePosts = supabaseService.subscribeToPosts(setPosts);
    const unsubscribeJobs = supabaseService.subscribeToJobs((allJobs) => setJobs(allJobs.slice(0, 3)));
    const unsubscribeLikes = supabaseService.subscribeToPostLikes(setLikes);
    const unsubscribeComments = supabaseService.subscribeToAllPostComments(setComments);

    const fetchTopStudents = async () => {
      const users = await supabaseService.listUsersPaginated(TOP_ACTIVE_LIMIT + 1, 0);
      setHasMoreTopStudents(users.length > TOP_ACTIVE_LIMIT);
      setTopStudents(users.slice(0, TOP_ACTIVE_LIMIT));
    };
    fetchTopStudents();

    return () => {
      unsubscribePosts();
      unsubscribeJobs();
      unsubscribeLikes();
      unsubscribeComments();
    };
  }, []);

  useEffect(() => {
    const authorUids = Array.from(new Set(posts.map((post) => post.authorUid).filter(Boolean)));
    if (authorUids.length === 0) return;
    let active = true;
    supabaseService
      .getUsersByUids(authorUids)
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
      .catch(() => {
        // Keep existing avatars if fetch fails.
      });
    return () => {
      active = false;
    };
  }, [posts]);

  useEffect(() => {
    setProfileByUid((prev) => ({ ...prev, [profile.uid]: profile }));
  }, [profile]);

  const topStudentsPreview = useMemo(() => topStudents.slice(0, 3), [topStudents]);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostContent.trim() && !postImageFile) return;
    const content = newPostContent;
    const selectedImage = postImageFile;

    setIsPosting(true);
    setBackgroundPostingCount((prev) => prev + 1);
    setShowComposer(false);
    setNewPostContent('');
    setPostImageFile(null);
    setPostImagePreview(null);

    try {
      let imageUrl: string | undefined;
      if (selectedImage) {
        const upload = await supabaseService.uploadFile(selectedImage, 'posts');
        imageUrl = upload.url;
      }

      const optimistic: Post = {
        id: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        authorUid: profile.uid,
        authorName: profile.displayName,
        authorPhoto: profile.photoURL,
        content,
        imageUrl,
        type: 'social',
        createdAt: new Date().toISOString(),
      };
      setPosts((prev) => [optimistic, ...prev]);

      const inserted = await supabaseService.createPost({
        authorUid: profile.uid,
        authorName: profile.displayName,
        authorPhoto: profile.photoURL,
        content,
        imageUrl,
        type: 'social',
      });
      setPosts((prev) => prev.map((p) => (p.id === optimistic.id ? inserted : p)));
    } catch {
      // If upload/insert fails, feed remains unchanged and user can retry.
    } finally {
      setBackgroundPostingCount((prev) => Math.max(0, prev - 1));
      setIsPosting(false);
    }
  };

  const likeCountMap = likes.reduce<Record<string, number>>((acc, like) => {
    acc[like.postId] = (acc[like.postId] || 0) + 1;
    return acc;
  }, {});

  const commentCountMap = comments.reduce<Record<string, number>>((acc, comment) => {
    acc[comment.postId] = (acc[comment.postId] || 0) + 1;
    return acc;
  }, {});

  const likedPostIds = new Set(likes.filter((item) => item.userUid === profile.uid).map((item) => item.postId));

  const handleToggleLike = async (postId: string) => {
    if (postId.startsWith('temp-')) return;
    if (likingPostIds.includes(postId)) return;
    const shouldLike = !likedPostIds.has(postId);
    const previousLikes = likes;
    setLikingPostIds((prev) => [...prev, postId]);
    setLikes((prev) => {
      const filtered = prev.filter((item) => !(item.postId === postId && item.userUid === profile.uid));
      if (!shouldLike) return filtered;
      return [
        ...filtered,
        {
          id: `temp-like-${postId}-${profile.uid}`,
          postId,
          userUid: profile.uid,
          createdAt: new Date().toISOString(),
        },
      ];
    });

    try {
      await supabaseService.setPostLike(postId, profile.uid, shouldLike);
      const refreshed = await supabaseService.listPostLikes();
      setLikes(refreshed);
    } catch {
      setLikes(previousLikes);
    } finally {
      setLikingPostIds((prev) => prev.filter((id) => id !== postId));
    }
  };

  const getPostShareLink = (post: Post) => `${window.location.origin}/#/comments/${post.id}`;

  const openShareSheet = (post: Post) => {
    setCopied(false);
    setSharePost(post);
  };

  const shareTo = (platform: 'whatsapp' | 'facebook' | 'x' | 'linkedin' | 'telegram' | 'email') => {
    if (!sharePost) return;
    const link = encodeURIComponent(getPostShareLink(sharePost));
    const text = encodeURIComponent(`Check out this post from ${sharePost.authorName} on Connect`);

    const urls: Record<typeof platform, string> = {
      whatsapp: `https://wa.me/?text=${text}%20${link}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${link}`,
      x: `https://twitter.com/intent/tweet?text=${text}&url=${link}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${link}`,
      telegram: `https://t.me/share/url?url=${link}&text=${text}`,
      email: `mailto:?subject=${encodeURIComponent('Connect post')}&body=${text}%0A${link}`,
    };

    window.open(urls[platform], '_blank', 'noopener,noreferrer');
  };

  const sharePlatforms: Array<{
    key: 'whatsapp' | 'facebook' | 'x' | 'linkedin' | 'telegram' | 'email';
    label: string;
    icon: string;
  }> = [
    { key: 'whatsapp', label: 'WhatsApp', icon: 'https://cdn.simpleicons.org/whatsapp/25D366' },
    { key: 'facebook', label: 'Facebook', icon: 'https://cdn.simpleicons.org/facebook/1877F2' },
    { key: 'x', label: 'X', icon: 'https://cdn.simpleicons.org/x/111827' },
    { key: 'linkedin', label: 'LinkedIn', icon: 'https://cdn.simpleicons.org/linkedin/0A66C2' },
    { key: 'telegram', label: 'Telegram', icon: 'https://cdn.simpleicons.org/telegram/229ED9' },
    { key: 'email', label: 'Gmail', icon: 'https://cdn.simpleicons.org/gmail/EA4335' },
  ];

  const copyPostLink = async () => {
    if (!sharePost) return;
    await navigator.clipboard.writeText(getPostShareLink(sharePost));
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  const showToast = (message: string) => {
    setPostActionToast(message);
    window.setTimeout(() => setPostActionToast(null), 1800);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <div className="lg:col-span-12 -mt-2">
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-xs sm:text-sm font-bold text-gray-900 tracking-wide">
            Top active freelancers
          </h3>
          {hasMoreTopStudents && (
            <button
              onClick={() => navigate('/network')}
              className="text-[10px] sm:text-xs font-semibold text-teal-700 hover:text-teal-800"
            >
              View more
            </button>
          )}
        </div>
        <div className="flex items-start gap-5 sm:gap-6 overflow-x-auto px-1 pb-2">
          {topStudents.length > 0 ? (
            topStudents.map((student) => (
              <button
                key={student.uid}
                onClick={() => navigate(`/profile/${student.uid}`)}
                className="shrink-0 flex flex-col items-center gap-2 min-w-[92px] sm:min-w-[110px]"
              >
                <div className="relative">
                  <CachedImage
                    src={student.photoURL}
                    alt={student.displayName}
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    wrapperClassName="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 border-teal-100"
                    imgClassName="w-full h-full rounded-full object-cover"
                  />
                  {onlineUserIds.has(student.uid) && (
                    <span className="absolute bottom-1 right-1 block h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500 shadow-sm sm:h-4 sm:w-4" />
                  )}
                </div>
                <span className="text-[10px] sm:text-xs font-semibold text-gray-700 text-center truncate w-20 sm:w-24">
                  {student.displayName}
                </span>
                <span className="text-[9px] sm:text-[10px] text-teal-600 font-medium text-center truncate w-20 sm:w-24">
                  {student.skills?.[0] || student.role}
                </span>
              </button>
            ))
          ) : (
            <p className="text-xs text-gray-400 italic">No active freelancers yet.</p>
          )}
        </div>
      </div>

      <div className="lg:col-span-12 px-2 -mt-2">
        <div className="mx-auto w-[92%] sm:w-[88%] h-px bg-gradient-to-r from-transparent via-teal-300/70 to-transparent relative">
          <span className="absolute left-1/2 -translate-x-1/2 -top-[2px] w-1.5 h-1.5 rounded-full bg-teal-500 shadow-[0_0_10px_rgba(20,184,166,0.5)]" />
        </div>
      </div>

      <div className="hidden lg:block lg:col-span-3 space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="h-20 bg-teal-600"></div>
          <div className="px-6 pb-6 -mt-10 text-center">
            <CachedImage
              src={profile.photoURL}
              alt={profile.displayName}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              wrapperClassName="w-20 h-20 rounded-2xl border-4 border-white mx-auto mb-4 shadow-md"
              imgClassName="w-full h-full rounded-2xl object-cover"
            />
            <h3 className="text-lg font-bold text-gray-900">{profile.displayName}</h3>
            <p className="text-sm text-gray-500 mb-4 capitalize">{profile.role}</p>
            <div className="pt-4 border-t border-gray-100 flex justify-around text-center">
              <div>
                <p className="text-lg font-bold text-teal-700">12</p>
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Gigs</p>
              </div>
              <div>
                <p className="text-lg font-bold text-teal-700">4.9</p>
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Rating</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h4 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">My Skills</h4>
          <div className="flex flex-wrap gap-2">
            {profile.skills?.length ? (
              profile.skills.map((skill) => (
                <span key={skill} className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full">
                  {skill}
                </span>
              ))
            ) : (
              <p className="text-xs text-gray-400 italic">No skills added yet.</p>
            )}
          </div>
        </div>
      </div>

      <div className="lg:col-span-6 space-y-4 sm:space-y-6">
        {backgroundPostingCount > 0 && (
          <div className="sticky top-20 z-20 bg-amber-50 border border-amber-200 text-amber-800 text-xs sm:text-sm font-semibold rounded-xl px-4 py-2.5">
            {backgroundPostingCount === 1 ? 'Your post is updating in background...' : `${backgroundPostingCount} posts are updating in background...`}
          </div>
        )}
        <AnimatePresence>
          {posts.map((post) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden"
            >
              <div className="p-4 sm:p-6">
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <Link to={`/profile/${post.authorUid}`} className="shrink-0">
                      <CachedImage
                        src={profileByUid[post.authorUid]?.photoURL || post.authorPhoto}
                        alt={post.authorName}
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        wrapperClassName="w-8 h-8 sm:w-10 sm:h-10 rounded-xl"
                        imgClassName="w-full h-full rounded-xl object-cover"
                      />
                    </Link>
                    <div>
                      <Link to={`/profile/${post.authorUid}`} className="text-xs sm:text-sm font-bold text-gray-900 hover:text-teal-700 transition-colors">
                        {post.authorName}
                      </Link>
                      <p className="text-[10px] sm:text-xs text-gray-500">{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}</p>
                    </div>
                  </div>
                  {post.type === 'job' && (
                    <span className="px-2 py-0.5 sm:px-3 sm:py-1 bg-teal-50 text-teal-700 text-[8px] sm:text-[10px] font-bold uppercase tracking-wider rounded-full">
                      Job Highlight
                    </span>
                  )}
                  {!post.id.startsWith('temp-') && (
                    <div className="relative">
                      {openPostMenuId === post.id && (
                        <button
                          type="button"
                          className="fixed inset-0 z-10 cursor-default"
                          onClick={() => setOpenPostMenuId(null)}
                          aria-label="Close post actions"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => setOpenPostMenuId((current) => current === post.id ? null : post.id)}
                        className="relative z-20 rounded-full p-2 text-gray-500 hover:bg-gray-100"
                        aria-label="Post actions"
                      >
                        <MoreVertical size={16} />
                      </button>
                      {openPostMenuId === post.id && (
                        <div className="absolute right-0 top-10 z-20 min-w-[170px] rounded-2xl border border-gray-200 bg-white p-2 shadow-xl">
                          {post.authorUid === profile.uid ? (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenPostMenuId(null);
                                  navigate(`/posts/${post.id}/edit`);
                                }}
                                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-gray-700 hover:bg-gray-50"
                              >
                                <Pencil size={14} />
                                Edit post
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  setOpenPostMenuId(null);
                                  const confirmed = await confirm({
                                    title: 'Delete this post?',
                                    description: 'This will permanently remove the post, its likes, and its comments.',
                                    confirmLabel: 'Delete',
                                    tone: 'danger',
                                  });
                                  if (!confirmed) return;
                                  await supabaseService.deletePost(post.id);
                                }}
                                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
                              >
                                <Trash2 size={14} />
                                Delete post
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={async () => {
                                setOpenPostMenuId(null);
                                const confirmed = await confirm({
                                  title: 'Report this user?',
                                  description: 'We will treat this post as reported and you can also contact support for urgent issues.',
                                  confirmLabel: 'Report',
                                  tone: 'danger',
                                });
                                if (!confirmed) return;
                                showToast('Report submitted. Our team will review it.');
                              }}
                              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
                            >
                              <Flag size={14} />
                              Report user
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <p className="text-gray-700 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>
                {post.imageUrl && (
                  <CachedImage
                    src={post.imageUrl}
                    alt="Post content"
                    loading="lazy"
                    decoding="async"
                    wrapperClassName="mt-3 sm:mt-4 rounded-xl w-full max-h-64 sm:max-h-96"
                    imgClassName="w-full h-full rounded-xl object-cover max-h-64 sm:max-h-96"
                  />
                )}
              </div>
              <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gray-50 border-t border-gray-100 flex items-center gap-4 sm:gap-6">
                <button
                  onClick={() => handleToggleLike(post.id)}
                  disabled={post.id.startsWith('temp-') || likingPostIds.includes(post.id)}
                  className={`text-[10px] sm:text-xs font-bold transition-colors inline-flex items-center gap-1 ${likedPostIds.has(post.id) ? 'text-rose-600' : 'text-gray-500 hover:text-teal-700'}`}
                >
                  <Heart size={14} className={likedPostIds.has(post.id) ? 'fill-current' : ''} />
                  Like ({likeCountMap[post.id] || 0})
                </button>
                <button
                  onClick={() => !post.id.startsWith('temp-') && navigate(`/comments/${post.id}`)}
                  disabled={post.id.startsWith('temp-')}
                  className="text-[10px] sm:text-xs font-bold text-gray-500 hover:text-teal-700 transition-colors inline-flex items-center gap-1 disabled:opacity-50"
                >
                  <MessageCircle size={14} />
                  Comment ({commentCountMap[post.id] || 0})
                </button>
                <button
                  onClick={() => !post.id.startsWith('temp-') && openShareSheet(post)}
                  disabled={post.id.startsWith('temp-')}
                  className="text-[10px] sm:text-xs font-bold text-gray-500 hover:text-teal-700 transition-colors inline-flex items-center gap-1 disabled:opacity-50"
                >
                  <Share2 size={14} />
                  Share
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <button
        onClick={() => setShowComposer(true)}
        className="fixed bottom-24 md:bottom-8 right-6 z-30 w-14 h-14 rounded-full bg-teal-600 text-white shadow-xl hover:bg-teal-700 transition-all flex items-center justify-center"
        aria-label="Create post"
      >
        <Plus size={24} />
      </button>

      {showComposer && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Create Post</h2>
              <button onClick={() => setShowComposer(false)} className="p-2 rounded-full hover:bg-gray-100 transition-colors" aria-label="Close">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreatePost} className="space-y-4">
              <div className="flex gap-3 sm:gap-4">
                <CachedImage
                  src={profile.photoURL}
                  alt={profile.displayName}
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  wrapperClassName="w-10 h-10 sm:w-12 sm:h-12 rounded-xl"
                  imgClassName="w-full h-full rounded-xl object-cover"
                />
                <div className="flex-1 space-y-2">
                  <textarea
                    value={newPostContent}
                    onChange={(e) => setNewPostContent(e.target.value)}
                    placeholder="Share an update or a project..."
                    className="w-full bg-gray-50 border-transparent focus:bg-white focus:ring-2 focus:ring-teal-500 rounded-xl p-3 sm:p-4 text-sm resize-none transition-all min-h-[120px]"
                  />
                  {postImagePreview && (
                    <div className="relative rounded-xl overflow-hidden border border-gray-200">
                      <CachedImage
                        src={postImagePreview}
                        alt="Post preview"
                        loading="lazy"
                        decoding="async"
                        wrapperClassName="w-full max-h-56"
                        imgClassName="w-full h-full max-h-56 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setPostImageFile(null);
                          setPostImagePreview(null);
                        }}
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-black/55 text-white"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between pt-3 sm:pt-4 border-t border-gray-100">
                <div className="flex gap-1 sm:gap-2">
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors">
                    <Image size={18} />
                  </button>
                  <button type="button" className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors">
                    <Star size={18} />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setPostImageFile(file);
                      setPostImagePreview(URL.createObjectURL(file));
                      e.currentTarget.value = '';
                    }}
                  />
                </div>
                <button type="submit" disabled={(!newPostContent.trim() && !postImageFile) || isPosting} className="bg-teal-700 text-white px-4 sm:px-6 py-2 rounded-xl font-bold text-xs sm:text-sm hover:bg-teal-800 disabled:opacity-50 transition-all flex items-center gap-2">
                  {isPosting ? 'Posting...' : 'Post Update'}
                  <Send size={14} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="hidden lg:block lg:col-span-3 space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h4 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider flex items-center gap-2">
            <Briefcase size={16} className="text-teal-600" />
            Recommended Gigs
          </h4>
          <div className="space-y-4">
            {jobs.map((job) => (
              <div key={job.id} className="p-3 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer border border-transparent hover:border-gray-100">
                <p className="text-sm font-bold text-gray-900 mb-1">{job.title}</p>
                <div className="flex items-center gap-3 text-[10px] text-gray-500 font-medium">
                  <span className="flex items-center gap-1">
                    <DollarSign size={10} /> {formatMoneyFromUSD(job.budget, currency)}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin size={10} /> {job.isRemote ? 'Remote' : 'On-site'}
                  </span>
                </div>
              </div>
            ))}
            <button onClick={() => navigate('/jobs')} className="w-full py-2 text-xs font-bold text-teal-700 hover:bg-teal-50 rounded-lg transition-colors">
              View All Gigs
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h4 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider flex items-center gap-2">
            <Star size={16} className="text-yellow-500" />
            Top Rated Students
          </h4>
          <div className="space-y-4">
            {topStudentsPreview.map((student) => (
              <div key={student.uid} className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded-xl transition-all" onClick={() => navigate(`/profile/${student.uid}`)}>
                <CachedImage
                  src={student.photoURL}
                  alt={student.displayName}
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  wrapperClassName="w-10 h-10 rounded-xl"
                  imgClassName="w-full h-full rounded-xl object-cover"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{student.displayName}</p>
                  <p className="text-[10px] text-gray-500 truncate">{student.skills?.[0] || 'Student'} · 4.9 ★</p>
                </div>
              </div>
            ))}
            {topStudents.length === 0 && <p className="text-xs text-gray-400 italic text-center">No students found.</p>}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {sharePost && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/35 z-40" onClick={() => setSharePost(null)} />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 280, damping: 30 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl border-t border-gray-200 shadow-2xl p-5"
            >
              <div className="max-w-2xl mx-auto">
                <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-4" />
                <h3 className="text-lg font-bold text-gray-900 mb-1">Share Post</h3>
                <p className="text-xs text-gray-500 mb-4">Share to social platforms or copy post link.</p>

                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
                  {sharePlatforms.map((item) => (
                    <button
                      key={item.key}
                      onClick={() => shareTo(item.key as 'whatsapp' | 'facebook' | 'x' | 'linkedin' | 'telegram' | 'email')}
                      className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-xs font-semibold text-gray-700 flex flex-col items-center gap-1.5"
                    >
                      <img src={item.icon} alt={item.label} className="w-5 h-5 object-contain" loading="lazy" />
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-50 border border-gray-200">
                  <LinkIcon size={14} className="text-gray-500" />
                  <input readOnly value={getPostShareLink(sharePost)} className="flex-1 bg-transparent text-xs text-gray-600 outline-none" />
                  <button onClick={copyPostLink} className="px-3 py-1.5 rounded-lg bg-teal-700 text-white text-xs font-bold inline-flex items-center gap-1">
                    <Copy size={12} />
                    {copied ? 'Copied' : 'Copy Link'}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {postActionToast && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="fixed top-4 left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white shadow-lg"
          >
            {postActionToast}
          </motion.div>
        )}
      </AnimatePresence>
      {confirmDialog}
    </div>
  );
}
