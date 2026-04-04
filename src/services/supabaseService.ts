import { supabase } from '../supabase';
import { UserProfile, Post, Job, Message, Proposal, Attachment, FriendRequest, Connection, Wallet, WalletTransaction, WalletCurrency, AppNotification, PostLike, PostComment, NotificationSettings, PostCommentLike, MarketItem, MarketSettings, MarketSellerRating, CompanyPartnerRequest, ActiveGig, AppPreferences, ConnectedDevice, UserPerformanceSummary } from '../types';
import { getCartoonAvatar } from '../utils/avatar';
import { getUploadOptimizationOptions, optimizeImageFile } from '../utils/image';

type DbUserProfile = {
  uid: string;
  public_id?: string | null;
  email: string;
  display_name: string;
  photo_url: string;
  cover_photo_url?: string | null;
  role: 'freelancer' | 'client' | 'admin';
  bio?: string | null;
  phone_number?: string | null;
  status?: string | null;
  location?: string | null;
  date_of_birth?: string | null;
  skills?: string[] | null;
  education?: UserProfile['education'] | null;
  experience?: UserProfile['experience'] | null;
  social_links?: UserProfile['socialLinks'] | null;
  portfolio?: UserProfile['portfolio'] | null;
  company_info?: UserProfile['companyInfo'] | null;
  created_at?: string;
};

type DbPost = {
  id: string;
  author_uid: string;
  author_name: string;
  author_photo: string;
  content: string;
  image_url?: string | null;
  type: 'social' | 'job';
  created_at: string;
};

type DbPostLike = {
  id: string;
  post_id: string;
  user_uid: string;
  created_at: string;
};

type DbPostComment = {
  id: string;
  post_id: string;
  user_uid: string;
  author_name: string;
  author_photo: string;
  content: string;
  created_at: string;
  parent_comment_id?: string | null;
};

type DbPostCommentLike = {
  id: string;
  comment_id: string;
  user_uid: string;
  created_at: string;
};

type DbJob = {
  id: string;
  client_uid: string;
  title: string;
  description: string;
  budget: number;
  category: string;
  is_student_friendly: boolean;
  is_remote: boolean;
  status: 'open' | 'closed';
  created_at: string;
};

type DbMarketItem = {
  id: string;
  seller_uid: string;
  title: string;
  category: string;
  description?: string | null;
  price: number;
  price_currency?: WalletCurrency | null;
  is_negotiable: boolean;
  is_anonymous: boolean;
  stock_quantity: number;
  image_urls: string[];
  created_at: string;
};

type DbCompanyPartnerRequest = {
  id: string;
  user_uid: string;
  company_name: string;
  company_logo_url: string;
  website_url?: string | null;
  social_links: string[] | null;
  about: string;
  location: string;
  registration_urls: string[] | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
};

type DbMarketSettings = {
  user_uid: string;
  phone_number: string | null;
  location: string | null;
  brand_name: string | null;
  is_registered: boolean | null;
  registered_at: string | null;
  show_phone_number: boolean | null;
  show_location: boolean | null;
  show_brand_name: boolean | null;
};

type DbMarketSellerRating = {
  id: string;
  seller_uid: string;
  user_uid: string;
  rating: number;
  created_at: string;
};

type DbMessage = {
  id: string;
  sender_uid: string;
  receiver_uid: string;
  content: string | null;
  created_at: string;
  read_at?: string | null;
  attachments?: Attachment[] | null;
};

type DbProposal = {
  id: string;
  freelancer_uid: string;
  job_id: string;
  content: string;
  budget: number;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
};

type DbFriendRequest = {
  id: string;
  from_uid: string;
  from_name: string;
  from_photo: string;
  to_uid: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
};

type DbConnection = {
  id: string;
  uids: string[];
  created_at: string;
};

type DbWallet = {
  id: string;
  user_uid: string;
  usd_balance: number;
  ngn_balance: number;
  eur_balance: number;
  updated_at: string;
};

type DbWalletTransaction = {
  id: string;
  user_uid: string;
  currency: WalletCurrency;
  type: 'topup' | 'withdraw';
  method: 'card' | 'transfer';
  amount: number;
  status: 'completed' | 'pending' | 'failed';
  created_at: string;
  reference?: string | null;
};

type DbWalletSecurity = {
  user_uid: string;
  pin_hash: string;
  updated_at: string;
  created_at: string;
};

type DbPostLikeNotificationRow = {
  id: string;
  post_id: string;
  user_uid: string;
  created_at: string;
  posts: { author_uid: string } | { author_uid: string }[] | null;
};

type DbPostCommentNotificationRow = {
  id: string;
  post_id: string;
  user_uid: string;
  author_name: string;
  content: string;
  created_at: string;
  posts: { author_uid: string } | { author_uid: string }[] | null;
};

const NOTIFICATION_SETTINGS_KEY_PREFIX = 'connect_notification_settings_';
const APP_PREFERENCES_KEY_PREFIX = 'connect_app_preferences_';
const CHAT_READ_KEY_PREFIX = 'connect_chat_read_map_';
const CHAT_READ_EVENT = 'connect:chat-read-updated';
const CHAT_CLEAR_KEY_PREFIX = 'connect_chat_cleared_map_';
const APP_CACHE_PREFIX = 'connect_app_cache_v2:';
const LEGACY_APP_CACHE_PREFIXES = ['connect_app_cache_v1:'];
const PRESENCE_CHANNEL_NAME = 'connect:presence';
const MESSAGE_DELETED_SENTINEL = '__connect_deleted_message__';

const CACHE_TTL = {
  users: 1000 * 60 * 60 * 6,
  posts: 1000 * 60 * 30,
  jobs: 1000 * 60 * 30,
  interactions: 1000 * 60 * 10,
  chats: 1000 * 60 * 5,
  wallet: 1000 * 30,
  notifications: 1000 * 30,
} as const;

type CacheEntry<T> = {
  data: T;
  updatedAt: number;
};

type FeedCacheSnapshot = {
  posts: Post[];
  jobs: Job[];
  likes: PostLike[];
  comments: PostComment[];
  topStudents: UserProfile[];
  hasMoreTopStudents: boolean;
  profileByUid: Record<string, UserProfile>;
};

type DeviceSeed = Omit<ConnectedDevice, 'lastActiveAt'>;

type ActiveChatSummary = {
  otherUid: string;
  user: UserProfile;
  lastMessage: string;
  updatedAt: string;
  lastMessageSenderUid?: string;
  lastMessageReadAt?: string;
};

const memoryCache = new Map<string, CacheEntry<unknown>>();
let presenceChannel: any = null;
let presenceTrackedUid: string | null = null;
let presenceHeartbeatTimer: number | null = null;
let presenceVisibilityCleanup: (() => void) | null = null;
const onlineUserIds = new Set<string>();
const onlineUserSubscribers = new Set<(uids: Set<string>) => void>();
const presenceStateSubscribers = new Set<(state: Record<string, { userUid: string; onlineAt?: string; visibilityState?: string; typingTo?: string | null; viewingChatUid?: string | null; updatedAt?: string }>) => void>();
const livePresenceState = new Map<string, { userUid: string; onlineAt?: string; visibilityState?: string; typingTo?: string | null; viewingChatUid?: string | null; updatedAt?: string }>();
let currentPresencePayload: { userUid: string; onlineAt?: string; visibilityState?: string; typingTo?: string | null; viewingChatUid?: string | null; updatedAt?: string } | null = null;
let notificationReadAtCache: { uid: string; value: string | null } | null = null;

function clearLegacyAppCaches() {
  if (typeof window === 'undefined') return;
  try {
    const keysToDelete: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      if (LEGACY_APP_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Ignore localStorage cleanup failures.
  }
}

clearLegacyAppCaches();

function mapUserProfileFromDb(row: DbUserProfile): UserProfile {
  const isLegacyLetterAvatar =
    !!row.photo_url &&
    (row.photo_url.includes('ui-avatars.com') || row.photo_url.includes('via.placeholder.com'));

  const resolvedPhoto =
    !row.photo_url || isLegacyLetterAvatar
      ? getCartoonAvatar(row.display_name || row.uid)
      : row.photo_url;

  return {
    uid: row.uid,
    publicId: row.public_id || undefined,
    email: row.email,
    displayName: row.display_name,
    photoURL: resolvedPhoto,
    coverPhotoURL: row.cover_photo_url || undefined,
    role: row.role === 'admin' ? 'client' : row.role,
    bio: row.bio || undefined,
    phoneNumber: row.phone_number || undefined,
    status: row.status || undefined,
    location: row.location || undefined,
    dateOfBirth: row.date_of_birth || undefined,
    skills: row.skills || undefined,
    education: row.education || undefined,
    experience: row.experience || undefined,
    socialLinks: row.social_links || undefined,
    portfolio: row.portfolio || undefined,
    companyInfo: row.company_info || undefined,
  };
}

function mapUserProfileToDb(data: Partial<UserProfile>): Partial<DbUserProfile> {
  return {
    uid: data.uid,
    public_id: data.publicId,
    email: data.email,
    display_name: data.displayName,
    photo_url: data.photoURL,
    cover_photo_url: data.coverPhotoURL ?? null,
    role: data.role as DbUserProfile['role'] | undefined,
    bio: data.bio ?? null,
    phone_number: data.phoneNumber ?? null,
    status: data.status ?? null,
    location: data.location ?? null,
    date_of_birth: data.dateOfBirth ?? null,
    skills: data.skills ?? null,
    education: data.education ?? null,
    experience: data.experience ?? null,
    social_links: data.socialLinks ?? null,
    portfolio: data.portfolio ?? null,
    company_info: data.companyInfo ?? null,
  };
}

function mapPostFromDb(row: DbPost): Post {
  return {
    id: row.id,
    authorUid: row.author_uid,
    authorName: row.author_name,
    authorPhoto: row.author_photo,
    content: row.content,
    imageUrl: row.image_url || undefined,
    type: row.type,
    createdAt: row.created_at,
  };
}

function mapPostLikeFromDb(row: DbPostLike): PostLike {
  return {
    id: row.id,
    postId: row.post_id,
    userUid: row.user_uid,
    createdAt: row.created_at,
  };
}

function mapPostCommentFromDb(row: DbPostComment): PostComment {
  return {
    id: row.id,
    postId: row.post_id,
    userUid: row.user_uid,
    authorName: row.author_name,
    authorPhoto: row.author_photo,
    content: row.content,
    createdAt: row.created_at,
    parentCommentId: row.parent_comment_id || undefined,
  };
}

function mapPostCommentLikeFromDb(row: DbPostCommentLike): PostCommentLike {
  return {
    id: row.id,
    commentId: row.comment_id,
    userUid: row.user_uid,
    createdAt: row.created_at,
  };
}

function mapJobFromDb(row: DbJob): Job {
  return {
    id: row.id,
    clientUid: row.client_uid,
    title: row.title,
    description: row.description,
    budget: row.budget,
    category: row.category,
    isStudentFriendly: row.is_student_friendly,
    isRemote: row.is_remote,
    status: row.status,
    createdAt: row.created_at,
  };
}

function mapMarketItemFromDb(row: DbMarketItem, seller?: UserProfile): MarketItem {
  return {
    id: row.id,
    sellerUid: row.seller_uid,
    title: row.title,
    category: row.category,
    description: row.description || undefined,
    price: row.price,
    priceCurrency: row.price_currency || 'USD',
    isNegotiable: row.is_negotiable,
    isAnonymous: row.is_anonymous,
    stockQuantity: row.stock_quantity,
    imageUrls: row.image_urls || [],
    createdAt: row.created_at,
    seller,
  };
}

function mapCompanyPartnerRequestFromDb(row: DbCompanyPartnerRequest): CompanyPartnerRequest {
  return {
    id: row.id,
    userUid: row.user_uid,
    companyName: row.company_name,
    companyLogoUrl: row.company_logo_url,
    websiteUrl: row.website_url || undefined,
    socialLinks: row.social_links || [],
    about: row.about,
    location: row.location,
    registrationUrls: row.registration_urls || [],
    status: row.status,
    createdAt: row.created_at,
  };
}

function mapMarketSettingsFromDb(row: DbMarketSettings): MarketSettings {
  return {
    userUid: row.user_uid,
    phoneNumber: row.phone_number || '',
    location: row.location || '',
    brandName: row.brand_name || '',
    isRegistered: !!row.is_registered,
    registeredAt: row.registered_at || undefined,
    showPhoneNumber: row.show_phone_number ?? false,
    showLocation: row.show_location ?? false,
    showBrandName: row.show_brand_name ?? true,
  };
}

function mapMarketSellerRatingFromDb(row: DbMarketSellerRating): MarketSellerRating {
  return {
    id: row.id,
    sellerUid: row.seller_uid,
    userUid: row.user_uid,
    rating: row.rating,
    createdAt: row.created_at,
  };
}

function normalizeAttachment(raw: any): Attachment | null {
  if (!raw || typeof raw !== 'object') return null;
  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name : 'Attachment';
  const url = typeof raw.url === 'string' ? raw.url : '';
  const type = typeof raw.type === 'string' ? raw.type : 'application/octet-stream';
  const size = typeof raw.size === 'number' && Number.isFinite(raw.size) ? raw.size : 0;
  return { name, url, type, size };
}

function mapMessageFromDb(row: DbMessage): Message {
  const attachments = Array.isArray(row.attachments)
    ? row.attachments.map(normalizeAttachment).filter((item): item is Attachment => item !== null)
    : undefined;
  const isDeleted = row.content === MESSAGE_DELETED_SENTINEL;
  return {
    id: row.id,
    senderUid: row.sender_uid,
    receiverUid: row.receiver_uid,
    content: isDeleted ? 'This message was deleted' : row.content || '',
    createdAt: row.created_at,
    readAt: row.read_at || undefined,
    attachments: isDeleted ? undefined : attachments,
    isDeleted,
  };
}

function mapProposalFromDb(row: DbProposal): Proposal {
  return {
    id: row.id,
    freelancerUid: row.freelancer_uid,
    jobId: row.job_id,
    content: row.content,
    budget: row.budget,
    status: row.status,
    createdAt: row.created_at,
  };
}

function mapFriendRequestFromDb(row: DbFriendRequest): FriendRequest {
  return {
    id: row.id,
    fromUid: row.from_uid,
    fromName: row.from_name,
    fromPhoto: row.from_photo,
    toUid: row.to_uid,
    status: row.status,
    createdAt: row.created_at,
  };
}

function mapConnectionFromDb(row: DbConnection): Connection {
  return {
    id: row.id,
    uids: row.uids,
    createdAt: row.created_at,
  };
}

function mapWalletFromDb(row: DbWallet): Wallet {
  return {
    id: row.id,
    userUid: row.user_uid,
    usdBalance: row.usd_balance,
    ngnBalance: row.ngn_balance,
    eurBalance: row.eur_balance,
    updatedAt: row.updated_at,
  };
}

function mapWalletTransactionFromDb(row: DbWalletTransaction): WalletTransaction {
  return {
    id: row.id,
    userUid: row.user_uid,
    currency: row.currency,
    type: row.type,
    method: row.method,
    amount: row.amount,
    status: row.status,
    createdAt: row.created_at,
    reference: row.reference || undefined,
  };
}

async function runQuery<T>(promise: any, context: string): Promise<T> {
  const { data, error } = await promise;
  if (error) {
    console.error(`Supabase error (${context}):`, error);
    throw error;
  }
  return data as T;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function buildPublicId(uid: string) {
  return `SL-${uid.replace(/-/g, '').slice(0, 10).toUpperCase()}`;
}

async function hashSecret(value: string) {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    throw new Error('Secure hashing is not available in this environment.');
  }
  const data = new TextEncoder().encode(value);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function loadJsonFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function getDefaultConnectedDevices(): ConnectedDevice[] {
  const now = new Date().toISOString();
  const seeds: DeviceSeed[] = [
    {
      id: 'current-session',
      label: 'Current browser session',
      platform: typeof navigator !== 'undefined' ? navigator.userAgent : 'Browser',
      current: true,
    },
    {
      id: 'mobile-sync',
      label: 'Mobile app sync',
      platform: 'Connect Mobile',
      current: false,
    },
  ];

  return seeds.map((seed, index) => ({
    ...seed,
    lastActiveAt: new Date(Date.now() - index * 1000 * 60 * 45).toISOString(),
  }));
}

function getDefaultAppPreferences(): AppPreferences {
  return {
    language: 'en-US',
    appearance: 'system',
    connectedDevices: getDefaultConnectedDevices(),
  };
}

function getConversationKey(uid: string, otherUid: string) {
  return [uid, otherUid].sort().join(':');
}

function loadClearedConversationMap(uid: string): Record<string, string> {
  return loadJsonFromStorage<Record<string, string>>(`${CHAT_CLEAR_KEY_PREFIX}${uid}`, {});
}

function getConversationClearedAt(uid: string, otherUid: string): string | null {
  const map = loadClearedConversationMap(uid);
  return map[getConversationKey(uid, otherUid)] || null;
}

function setConversationClearedAt(uid: string, otherUid: string, clearedAt: string) {
  if (typeof window === 'undefined') return;
  const key = `${CHAT_CLEAR_KEY_PREFIX}${uid}`;
  const next = loadClearedConversationMap(uid);
  next[getConversationKey(uid, otherUid)] = clearedAt;
  try {
    window.localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // Ignore storage failures.
  }
}

async function fetchAcceptedJobIds(): Promise<Set<string>> {
  const rows = await runQuery<Array<Pick<DbProposal, 'job_id'>>>(
    supabase.from('proposals').select('job_id').eq('status', 'accepted'),
    'fetchAcceptedJobIds'
  );
  return new Set(rows.map((row) => row.job_id).filter(Boolean));
}

async function fetchAvailableJobs(): Promise<Job[]> {
  const [rows, acceptedJobIds] = await Promise.all([
    runQuery<DbJob[]>(
      supabase.from('jobs').select('*').eq('status', 'open').order('created_at', { ascending: false }),
      'fetchAvailableJobs:jobs'
    ),
    fetchAcceptedJobIds(),
  ]);

  return rows
    .map(mapJobFromDb)
    .filter((job) => !acceptedJobIds.has(job.id));
}


function readMemoryCache<T>(key: string, maxAgeMs: number): T | null {
  const cached = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (!cached) return null;
  if (Date.now() - cached.updatedAt > maxAgeMs) return null;
  return cached.data;
}

function readMemoryCacheAnyAge<T>(key: string): T | null {
  const cached = memoryCache.get(key) as CacheEntry<T> | undefined;
  return cached?.data ?? null;
}

function readCache<T>(key: string, maxAgeMs: number): T | null {
  const memoryValue = readMemoryCache<T>(key, maxAgeMs);
  if (memoryValue !== null) return memoryValue;
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(`${APP_CACHE_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (!parsed || typeof parsed.updatedAt !== 'number') return null;
    if (Date.now() - parsed.updatedAt > maxAgeMs) return null;
    memoryCache.set(key, parsed as CacheEntry<unknown>);
    return parsed.data;
  } catch {
    return null;
  }
}

function readCacheAnyAge<T>(key: string): T | null {
  const memoryValue = readMemoryCacheAnyAge<T>(key);
  if (memoryValue !== null) return memoryValue;
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(`${APP_CACHE_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    memoryCache.set(key, parsed as CacheEntry<unknown>);
    return parsed?.data ?? null;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, data: T): void {
  const payload: CacheEntry<T> = {
    data,
    updatedAt: Date.now(),
  };
  memoryCache.set(key, payload as CacheEntry<unknown>);
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${APP_CACHE_PREFIX}${key}`, JSON.stringify(payload));
  } catch {
    // Ignore quota / serialization errors and continue with network-first behavior.
  }
}

function removeCache(key: string): void {
  memoryCache.delete(key);
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(`${APP_CACHE_PREFIX}${key}`);
  } catch {
    // Ignore cache cleanup failures.
  }
}

function removeCacheByPrefix(prefix: string): void {
  Array.from(memoryCache.keys())
    .filter((key) => key.startsWith(prefix))
    .forEach((key) => memoryCache.delete(key));

  if (typeof window === 'undefined') return;
  try {
    const keysToDelete: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(APP_CACHE_PREFIX)) continue;
      const normalizedKey = key.slice(APP_CACHE_PREFIX.length);
      if (normalizedKey.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Ignore cache cleanup failures.
  }
}

function emitOnlineUsers() {
  const snapshot = new Set(onlineUserIds);
  onlineUserSubscribers.forEach((callback) => callback(snapshot));
}

function emitPresenceState() {
  const snapshot = Object.fromEntries(Array.from(livePresenceState.entries()));
  presenceStateSubscribers.forEach((callback) => callback(snapshot));
}

function extractPresenceMetas(entry: any): Array<Record<string, any>> {
  if (!entry) return [];
  if (Array.isArray(entry)) return entry;
  if (Array.isArray(entry.metas)) return entry.metas;
  return [];
}

function rebuildOnlineUsersFromPresenceState() {
  onlineUserIds.clear();
  livePresenceState.clear();
  if (!presenceChannel) {
    emitOnlineUsers();
    emitPresenceState();
    return;
  }

  const state = presenceChannel.presenceState?.() || {};
  Object.values(state).forEach((entry) => {
    extractPresenceMetas(entry).forEach((meta) => {
      const uid = typeof meta?.userUid === 'string' ? meta.userUid : null;
      if (!uid) return;
      onlineUserIds.add(uid);
      const existing = livePresenceState.get(uid);
      const nextState = {
        userUid: uid,
        onlineAt: typeof meta?.onlineAt === 'string' ? meta.onlineAt : existing?.onlineAt,
        visibilityState: typeof meta?.visibilityState === 'string' ? meta.visibilityState : existing?.visibilityState,
        typingTo: typeof meta?.typingTo === 'string' ? meta.typingTo : null,
        viewingChatUid: typeof meta?.viewingChatUid === 'string' ? meta.viewingChatUid : null,
        updatedAt: typeof meta?.updatedAt === 'string' ? meta.updatedAt : existing?.updatedAt,
      };
      const previousUpdatedAt = existing?.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
      const nextUpdatedAt = nextState.updatedAt ? new Date(nextState.updatedAt).getTime() : 0;
      if (!existing || nextUpdatedAt >= previousUpdatedAt) {
        livePresenceState.set(uid, nextState);
      }
    });
  });

  emitOnlineUsers();
  emitPresenceState();
}

function mergeChatSummaries(...chatGroups: ActiveChatSummary[][]): ActiveChatSummary[] {
  const merged = new Map<string, ActiveChatSummary>();

  chatGroups.flat().forEach((chat) => {
    const existing = merged.get(chat.otherUid);
    if (!existing) {
      merged.set(chat.otherUid, chat);
      return;
    }

    if (new Date(chat.updatedAt).getTime() >= new Date(existing.updatedAt).getTime()) {
      merged.set(chat.otherUid, chat);
    }
  });

  return Array.from(merged.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

async function uploadToSupabaseStorage(file: File, folder: string): Promise<string> {
  const safeName = file.name.replace(/\s+/g, '_');
  const filePath = `${folder}/${Date.now()}_${safeName}`;
  await runQuery(
    supabase.storage.from('chat-attachments').upload(filePath, file, {
      contentType: file.type,
      upsert: false,
    }),
    'uploadToSupabaseStorage'
  );

  const { data } = supabase.storage.from('chat-attachments').getPublicUrl(filePath);
  return data.publicUrl;
}

function subscribeToTable<T>(
  table: string,
  fetcher: () => Promise<T>,
  callback: (data: T) => void,
  filter?: string,
  onError?: (error: any) => void,
  cacheKey?: string
) {
  let active = true;
  let fetchVersion = 0;

  if (cacheKey) {
    const cached = readCacheAnyAge<T>(cacheKey);
    if (cached) callback(cached);
  }

  const refresh = () => {
    const currentVersion = ++fetchVersion;
    fetcher()
      .then((data) => {
        // Prevent stale fetch responses from overwriting newer state.
        if (cacheKey) writeCache(cacheKey, data);
        if (active && currentVersion === fetchVersion) callback(data);
      })
      .catch((error) => {
        console.error(`Supabase fetch error (${table}):`, error);
        if (onError) onError(error);
      });
  };

  refresh();

  const channel = supabase
    .channel(`realtime:${table}:${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter },
      refresh
    )
    .subscribe();

  return () => {
    active = false;
    supabase.removeChannel(channel);
  };
}

export const supabaseService = {
  profileCache: new Map<string, UserProfile>(),

  startPresenceTracking(uid: string) {
    if (typeof window === 'undefined' || !uid) return () => undefined;
    if (presenceTrackedUid === uid && presenceChannel) {
      return () => undefined;
    }

    this.stopPresenceTracking();

    presenceTrackedUid = uid;
    presenceChannel = supabase.channel(PRESENCE_CHANNEL_NAME, {
      config: {
        presence: { key: uid },
      },
    });

    currentPresencePayload = {
      userUid: uid,
      onlineAt: new Date().toISOString(),
      visibilityState: document.visibilityState,
      typingTo: null,
      viewingChatUid: null,
      updatedAt: new Date().toISOString(),
    };

    const trackPresence = (overrides?: Partial<typeof currentPresencePayload>) => {
      currentPresencePayload = {
        ...(currentPresencePayload || {
          userUid: uid,
          onlineAt: new Date().toISOString(),
        }),
        visibilityState: document.visibilityState,
        updatedAt: new Date().toISOString(),
        ...overrides,
      };
      return presenceChannel?.track?.(currentPresencePayload);
    };

    presenceChannel
      .on('presence', { event: 'sync' }, rebuildOnlineUsersFromPresenceState)
      .on('presence', { event: 'join' }, rebuildOnlineUsersFromPresenceState)
      .on('presence', { event: 'leave' }, rebuildOnlineUsersFromPresenceState)
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          await trackPresence();
          rebuildOnlineUsersFromPresenceState();
        }
      });

    const handleVisibilityChange = () => {
      if (!presenceChannel) return;
      if (document.visibilityState === 'visible') {
        trackPresence();
      } else {
        presenceChannel.untrack?.();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', this.stopPresenceTracking);
    presenceVisibilityCleanup = () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', this.stopPresenceTracking);
    };

    presenceHeartbeatTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        trackPresence();
      }
    }, 30000);

    return () => {
      if (presenceTrackedUid === uid) {
        this.stopPresenceTracking();
      }
    };
  },

  stopPresenceTracking() {
    if (presenceHeartbeatTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(presenceHeartbeatTimer);
      presenceHeartbeatTimer = null;
    }
    presenceVisibilityCleanup?.();
    presenceVisibilityCleanup = null;

    if (presenceChannel) {
      try {
        presenceChannel.untrack?.();
      } catch {
        // Ignore presence untrack failures.
      }
      supabase.removeChannel(presenceChannel);
      presenceChannel = null;
    }

    presenceTrackedUid = null;
    currentPresencePayload = null;
    onlineUserIds.clear();
    livePresenceState.clear();
    emitOnlineUsers();
    emitPresenceState();
  },

  subscribeToOnlineUsers(callback: (uids: Set<string>) => void) {
    onlineUserSubscribers.add(callback);
    callback(new Set(onlineUserIds));
    return () => {
      onlineUserSubscribers.delete(callback);
    };
  },

  subscribeToPresenceState(
    callback: (state: Record<string, { userUid: string; onlineAt?: string; visibilityState?: string; typingTo?: string | null; viewingChatUid?: string | null; updatedAt?: string }>) => void
  ) {
    presenceStateSubscribers.add(callback);
    callback(Object.fromEntries(Array.from(livePresenceState.entries())));
    return () => {
      presenceStateSubscribers.delete(callback);
    };
  },

  async setPresenceTyping(typingTo?: string | null) {
    if (!presenceChannel || !currentPresencePayload) return;
    const nextPayload = {
      ...currentPresencePayload,
      visibilityState: typeof document !== 'undefined' ? document.visibilityState : currentPresencePayload.visibilityState,
      typingTo: typingTo || null,
      updatedAt: new Date().toISOString(),
    };
    currentPresencePayload = nextPayload;
    await presenceChannel.track(nextPayload);
  },

  async setPresenceViewingChat(viewingChatUid?: string | null) {
    if (!presenceChannel || !currentPresencePayload) return;
    const nextPayload = {
      ...currentPresencePayload,
      visibilityState: typeof document !== 'undefined' ? document.visibilityState : currentPresencePayload.visibilityState,
      viewingChatUid: viewingChatUid || null,
      updatedAt: new Date().toISOString(),
    };
    currentPresencePayload = nextPayload;
    await presenceChannel.track(nextPayload);
  },

  isUserOnline(uid: string) {
    return onlineUserIds.has(uid);
  },

  getNotificationSettings(uid: string): NotificationSettings {
    const defaults: NotificationSettings = {
      wallet: true,
      gigs: true,
      feed: true,
      friendRequests: true,
    };
    return {
      ...defaults,
      ...loadJsonFromStorage<Partial<NotificationSettings>>(`${NOTIFICATION_SETTINGS_KEY_PREFIX}${uid}`, {}),
    };
  },

  updateNotificationSettings(uid: string, updates: Partial<NotificationSettings>): NotificationSettings {
    const next = { ...this.getNotificationSettings(uid), ...updates };
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(`${NOTIFICATION_SETTINGS_KEY_PREFIX}${uid}`, JSON.stringify(next));
    }
    removeCache(`notifications:${uid}`);
    return next;
  },

  getAppPreferences(uid: string): AppPreferences {
    const stored = loadJsonFromStorage<Partial<AppPreferences>>(`${APP_PREFERENCES_KEY_PREFIX}${uid}`, {});
    const defaults = getDefaultAppPreferences();

    return {
      language: stored.language || defaults.language,
      appearance: stored.appearance || defaults.appearance,
      connectedDevices:
        stored.connectedDevices?.length
          ? stored.connectedDevices.map((device, index) => ({
              id: device.id || `device-${index + 1}`,
              label: device.label || `Device ${index + 1}`,
              platform: device.platform || 'Unknown device',
              lastActiveAt: device.lastActiveAt || new Date().toISOString(),
              current: !!device.current,
            }))
          : defaults.connectedDevices,
    };
  },

  updateAppPreferences(uid: string, updates: Partial<AppPreferences>): AppPreferences {
    const next = {
      ...this.getAppPreferences(uid),
      ...updates,
    };
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(`${APP_PREFERENCES_KEY_PREFIX}${uid}`, JSON.stringify(next));
    }
    return next;
  },

  removeConnectedDevice(uid: string, deviceId: string): AppPreferences {
    const current = this.getAppPreferences(uid);
    const nextDevices = current.connectedDevices.filter((device) => device.id !== deviceId || device.current);
    return this.updateAppPreferences(uid, { connectedDevices: nextDevices });
  },

  getFeedCacheSnapshot(): FeedCacheSnapshot | null {
    return readCacheAnyAge<FeedCacheSnapshot>('feed:snapshot');
  },

  writeFeedCacheSnapshot(snapshot: FeedCacheSnapshot) {
    writeCache('feed:snapshot', snapshot);
  },

  getChatReadMap(uid: string): Record<string, string> {
    return loadJsonFromStorage<Record<string, string>>(`${CHAT_READ_KEY_PREFIX}${uid}`, {});
  },

  markChatAsRead(uid: string, otherUid: string, readAt: string = new Date().toISOString()) {
    const readMap = this.getChatReadMap(uid);
    readMap[otherUid] = readAt;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(`${CHAT_READ_KEY_PREFIX}${uid}`, JSON.stringify(readMap));
      window.dispatchEvent(new CustomEvent(CHAT_READ_EVENT, { detail: { uid, otherUid, readAt } }));
    }
  },

  computeUnreadChatCount(
    uid: string,
    chats: Array<{ otherUid: string; updatedAt: string }>
  ): number {
    const readMap = this.getChatReadMap(uid);
    return chats.filter((chat) => {
      const lastReadAt = readMap[chat.otherUid];
      if (!lastReadAt) return true;
      return new Date(chat.updatedAt).getTime() > new Date(lastReadAt).getTime();
    }).length;
  },

  onChatReadUpdated(handler: (event: Event) => void) {
    if (typeof window === 'undefined') return () => undefined;
    window.addEventListener(CHAT_READ_EVENT, handler);
    return () => window.removeEventListener(CHAT_READ_EVENT, handler);
  },

  // User Profile
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
      const data = await runQuery<DbUserProfile | null>(
        supabase.from('users').select('*').eq('uid', uid).maybeSingle(),
        `getUserProfile:${uid}`
      );
      const mapped = data ? mapUserProfileFromDb(data) : null;
      if (mapped) {
        this.profileCache.set(mapped.uid, mapped);
        writeCache(`user:${uid}`, mapped);
      }
      return mapped;
    } catch (error) {
      const memoryCached = this.profileCache.get(uid);
      if (memoryCached) return memoryCached;
      const persisted = readCache<UserProfile | null>(`user:${uid}`, CACHE_TTL.users);
      if (persisted) {
        this.profileCache.set(uid, persisted);
        return persisted;
      }
      throw error;
    }
  },

  subscribeToUserProfile(uid: string, callback: (profile: UserProfile | null) => void, onError?: (error: any) => void) {
    const fetcher = async () => {
      const row = await runQuery<DbUserProfile | null>(
        supabase.from('users').select('*').eq('uid', uid).maybeSingle(),
        `subscribeToUserProfile:${uid}`
      );
      const mapped = row ? mapUserProfileFromDb(row) : null;
      if (mapped) this.profileCache.set(mapped.uid, mapped);
      return mapped;
    };
    return subscribeToTable('users', fetcher, callback, `uid=eq.${uid}`, onError, `user:${uid}`);
  },

  subscribeToAllUsers(callback: (profiles: UserProfile[]) => void, onError?: (error: any) => void) {
    const fetcher = async () => {
      const rows = await runQuery<DbUserProfile[]>(
        supabase.from('users').select('*').order('created_at', { ascending: false }),
        'subscribeToAllUsers'
      );
      const profiles = rows.map(mapUserProfileFromDb);
      profiles.forEach((profile) => this.profileCache.set(profile.uid, profile));
      return profiles;
    };
    return subscribeToTable('users', fetcher, callback, undefined, onError, 'users:all');
  },

  async getUsersByUids(uids: string[]): Promise<UserProfile[]> {
    const uniqueUids = Array.from(new Set(uids.filter(Boolean)));
    if (uniqueUids.length === 0) return [];
    try {
      const rows = await runQuery<DbUserProfile[]>(
        supabase.from('users').select('*').in('uid', uniqueUids),
        'getUsersByUids'
      );
      const fetched = rows.map(mapUserProfileFromDb);
      fetched.forEach((profile) => this.profileCache.set(profile.uid, profile));
      const profileByUid = new Map(fetched.map((p) => [p.uid, p]));
      return uniqueUids.map((id) => profileByUid.get(id)).filter((p): p is UserProfile => Boolean(p));
    } catch (error) {
      const fromMemory = uniqueUids
        .map((id) => this.profileCache.get(id))
        .filter((p): p is UserProfile => Boolean(p));
      if (fromMemory.length > 0) return fromMemory;
      throw error;
    }
  },

  async getUserProfileByPublicId(publicId: string): Promise<UserProfile | null> {
    const normalized = publicId.trim();
    if (!normalized) return null;
    const row = await runQuery<DbUserProfile | null>(
      supabase.from('users').select('*').eq('public_id', normalized).maybeSingle(),
      `getUserProfileByPublicId:${normalized}`
    );
    const mapped = row ? mapUserProfileFromDb(row) : null;
    if (mapped) this.profileCache.set(mapped.uid, mapped);
    return mapped;
  },

  async resolveUserByIdentifier(identifier: string): Promise<UserProfile | null> {
    const normalized = identifier.trim();
    if (!normalized) return null;
    return isUuid(normalized)
      ? this.getUserProfile(normalized)
      : this.getUserProfileByPublicId(normalized);
  },

  async createUserProfile(profile: UserProfile): Promise<void> {
    const payload = mapUserProfileToDb({
      ...profile,
      publicId: profile.publicId || buildPublicId(profile.uid),
    }) as DbUserProfile;
    await runQuery(
      supabase.from('users').upsert(
        { ...payload, created_at: new Date().toISOString() },
        { onConflict: 'uid' }
      ),
      'createUserProfile'
    );
    const nextProfile = {
      ...profile,
      publicId: profile.publicId || buildPublicId(profile.uid),
    };
    this.profileCache.set(profile.uid, nextProfile);
    writeCache(`user:${profile.uid}`, nextProfile);
    removeCache('users:all');
    removeCacheByPrefix('users:page:');
  },

  async updateUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
    const payload = mapUserProfileToDb(data);
    try {
      await runQuery(
        supabase.from('users').update(payload).eq('uid', uid),
        'updateUserProfile'
      );
    } catch (error: any) {
      const message = String(error?.message || '').toLowerCase();
      if ('date_of_birth' in payload && (message.includes('date_of_birth') || message.includes('column'))) {
        // Backward compatibility for databases that have not added users.date_of_birth yet.
        const fallbackPayload = { ...payload };
        delete fallbackPayload.date_of_birth;
        await runQuery(
          supabase.from('users').update(fallbackPayload).eq('uid', uid),
          'updateUserProfile:fallbackWithoutDateOfBirth'
        );
      } else {
        throw error;
      }
    }
    const prev = this.profileCache.get(uid);
    const nextProfile = { ...(prev || { uid }), ...data } as UserProfile;
    this.profileCache.set(uid, nextProfile);
    writeCache(`user:${uid}`, nextProfile);
    removeCache('users:all');
    removeCacheByPrefix('users:page:');
    removeCacheByPrefix('friends:');
  },

  async getTopStudents(limitCount: number): Promise<UserProfile[]> {
    const rows = await runQuery<DbUserProfile[]>(
      supabase
        .from('users')
        .select('*')
        .eq('role', 'freelancer')
        .order('created_at', { ascending: false })
        .limit(limitCount),
      'getTopStudents'
    );
    const profiles = rows.map(mapUserProfileFromDb);
    profiles.forEach((profile) => this.profileCache.set(profile.uid, profile));
    return profiles;
  },

  async getAllUsers(): Promise<UserProfile[]> {
    try {
      const rows = await runQuery<DbUserProfile[]>(
        supabase.from('users').select('*'),
        'getAllUsers'
      );
      const profiles = rows.map(mapUserProfileFromDb);
      profiles.forEach((profile) => this.profileCache.set(profile.uid, profile));
      writeCache('users:all', profiles);
      return profiles;
    } catch (error) {
      const cached = readCache<UserProfile[]>('users:all', CACHE_TTL.users);
      if (cached) return cached;
      throw error;
    }
  },

  async listUsersPaginated(limitCount: number, offsetCount: number, excludeUid?: string): Promise<UserProfile[]> {
    const cacheKey = `users:page:${limitCount}:${offsetCount}:${excludeUid || 'none'}`;
    try {
      let query = supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offsetCount, offsetCount + limitCount - 1);

      if (excludeUid) {
        query = query.neq('uid', excludeUid);
      }

      const rows = await runQuery<DbUserProfile[]>(
        query,
        'listUsersPaginated'
      );
      const profiles = rows.map(mapUserProfileFromDb);
      profiles.forEach((profile) => this.profileCache.set(profile.uid, profile));
      writeCache(cacheKey, profiles);
      return profiles;
    } catch (error) {
      const cached = readCache<UserProfile[]>(cacheKey, CACHE_TTL.users);
      if (cached) return cached;
      throw error;
    }
  },

  // Posts
  async createPost(post: Omit<Post, 'id' | 'createdAt'>): Promise<Post> {
    const row = await runQuery<DbPost>(
      supabase
        .from('posts')
        .insert({
          author_uid: post.authorUid,
          author_name: post.authorName,
          author_photo: post.authorPhoto,
          content: post.content,
          image_url: post.imageUrl || null,
          type: post.type,
          created_at: new Date().toISOString(),
        })
        .select('*')
        .single(),
      'createPost'
    );
    const mapped = mapPostFromDb(row);
    writeCache(`post:${mapped.id}`, mapped);
    removeCacheByPrefix('posts:list:');
    removeCacheByPrefix(`posts:user:${mapped.authorUid}`);
    removeCacheByPrefix('posts:highlights:');
    removeCache('posts:all');
    return mapped;
  },

  async listPosts(limitCount: number = 100): Promise<Post[]> {
    const cacheKey = `posts:list:${limitCount}`;
    const cached = readCache<Post[]>(cacheKey, CACHE_TTL.posts);
    if (cached) return cached;

    const rows = await runQuery<DbPost[]>(
      supabase.from('posts').select('*').order('created_at', { ascending: false }).limit(limitCount),
      'listPosts'
    );
    const mapped = rows.map(mapPostFromDb);
    writeCache(cacheKey, mapped);
    return mapped;
  },

  async getPostById(postId: string): Promise<Post | null> {
    const cached = readCache<Post | null>(`post:${postId}`, CACHE_TTL.posts);
    if (cached) return cached;

    const row = await runQuery<DbPost | null>(
      supabase.from('posts').select('*').eq('id', postId).maybeSingle(),
      'getPostById'
    );
    const mapped = row ? mapPostFromDb(row) : null;
    if (mapped) writeCache(`post:${postId}`, mapped);
    return mapped;
  },

  async updatePost(postId: string, updates: { content: string; imageUrl?: string | null }): Promise<Post> {
    const row = await runQuery<DbPost>(
      supabase
        .from('posts')
        .update({
          content: updates.content,
          image_url: updates.imageUrl || null,
        })
        .eq('id', postId)
        .select('*')
        .single(),
      'updatePost'
    );
    const mapped = mapPostFromDb(row);
    writeCache(`post:${postId}`, mapped);
    removeCache('posts:all');
    removeCacheByPrefix('posts:list:');
    removeCacheByPrefix(`posts:user:${mapped.authorUid}`);
    return mapped;
  },

  async deletePost(postId: string): Promise<void> {
    await runQuery(
      supabase.from('post_likes').delete().eq('post_id', postId),
      'deletePost:likes'
    );
    await runQuery(
      supabase.from('post_comments').delete().eq('post_id', postId),
      'deletePost:comments'
    );
    await runQuery(
      supabase.from('posts').delete().eq('id', postId),
      'deletePost'
    );
    removeCache(`post:${postId}`);
    removeCache('posts:all');
    removeCache('posts:likes');
    removeCache('posts:comments:all');
    removeCacheByPrefix('posts:list:');
    removeCacheByPrefix('posts:user:');
    removeCacheByPrefix('posts:comments:');
    removeCacheByPrefix('posts:comment-likes:');
  },

  subscribeToPosts(callback: (posts: Post[]) => void) {
    const fetcher = async () => {
      const rows = await runQuery<DbPost[]>(
        supabase.from('posts').select('*').order('created_at', { ascending: false }),
        'subscribeToPosts'
      );
      return rows.map(mapPostFromDb);
    };
    return subscribeToTable('posts', fetcher, callback, undefined, undefined, 'posts:all');
  },

  async getPostsByUser(uid: string): Promise<Post[]> {
    const cacheKey = `posts:user:${uid}`;
    const cached = readCache<Post[]>(cacheKey, CACHE_TTL.posts);
    if (cached) return cached;

    const rows = await runQuery<DbPost[]>(
      supabase.from('posts').select('*').eq('author_uid', uid).order('created_at', { ascending: false }),
      'getPostsByUser'
    );
    const mapped = rows.map(mapPostFromDb);
    writeCache(cacheKey, mapped);
    return mapped;
  },

  subscribeToPostsByUser(uid: string, callback: (posts: Post[]) => void, onError?: (error: any) => void) {
    const fetcher = async () => {
      const rows = await runQuery<DbPost[]>(
        supabase.from('posts').select('*').eq('author_uid', uid).order('created_at', { ascending: false }),
        `subscribeToPostsByUser:${uid}`
      );
      return rows.map(mapPostFromDb);
    };
    return subscribeToTable('posts', fetcher, callback, `author_uid=eq.${uid}`, onError, `posts:user:${uid}`);
  },

  async getHighlights(limitCount: number): Promise<Post[]> {
    const cacheKey = `posts:highlights:${limitCount}`;
    const cached = readCache<Post[]>(cacheKey, CACHE_TTL.posts);
    if (cached) return cached;

    const rows = await runQuery<DbPost[]>(
      supabase.from('posts').select('*').order('created_at', { ascending: false }).limit(limitCount),
      'getHighlights'
    );
    const mapped = rows.map(mapPostFromDb);
    writeCache(cacheKey, mapped);
    return mapped;
  },

  async listPostLikes(): Promise<PostLike[]> {
    const cached = readCache<PostLike[]>('posts:likes', CACHE_TTL.interactions);
    if (cached) return cached;

    const rows = await runQuery<DbPostLike[]>(
      supabase.from('post_likes').select('*'),
      'listPostLikes'
    );
    const mapped = rows.map(mapPostLikeFromDb);
    writeCache('posts:likes', mapped);
    return mapped;
  },

  subscribeToPostLikes(callback: (likes: PostLike[]) => void) {
    const fetcher = async () => {
      const rows = await runQuery<DbPostLike[]>(
        supabase.from('post_likes').select('*'),
        'subscribeToPostLikes'
      );
      return rows.map(mapPostLikeFromDb);
    };
    return subscribeToTable('post_likes', fetcher, callback, undefined, undefined, 'posts:likes');
  },

  async setPostLike(postId: string, userUid: string, shouldLike: boolean): Promise<void> {
    const existingRows = await runQuery<Pick<DbPostLike, 'id'>[]>(
      supabase.from('post_likes').select('id').eq('post_id', postId).eq('user_uid', userUid),
      'setPostLike:existing'
    );

    if (!shouldLike) {
      if (existingRows.length === 0) return;
      const existingIds = existingRows.map((row) => row.id);
      await runQuery(
        supabase.from('post_likes').delete().in('id', existingIds),
        'setPostLike:delete'
      );
      removeCache('posts:likes');
      return;
    }

    if (existingRows.length === 0) {
      await runQuery(
        supabase.from('post_likes').insert({
          post_id: postId,
          user_uid: userUid,
          created_at: new Date().toISOString(),
        }),
        'setPostLike:insert'
      );
      removeCache('posts:likes');
      return;
    }

    if (existingRows.length > 1) {
      const duplicateIds = existingRows.slice(1).map((row) => row.id);
      await runQuery(
        supabase.from('post_likes').delete().in('id', duplicateIds),
        'setPostLike:dedupe'
      );
    }
    removeCache('posts:likes');
  },

  async listPostComments(postId: string): Promise<PostComment[]> {
    const cacheKey = `posts:comments:${postId}`;
    const cached = readCache<PostComment[]>(cacheKey, CACHE_TTL.interactions);
    if (cached) return cached;

    const rows = await runQuery<DbPostComment[]>(
      supabase.from('post_comments').select('*').eq('post_id', postId).order('created_at', { ascending: true }),
      'listPostComments'
    );
    const mapped = rows.map(mapPostCommentFromDb);
    writeCache(cacheKey, mapped);
    return mapped;
  },

  async listAllPostComments(): Promise<PostComment[]> {
    const cached = readCache<PostComment[]>('posts:comments:all', CACHE_TTL.interactions);
    if (cached) return cached;

    const rows = await runQuery<DbPostComment[]>(
      supabase.from('post_comments').select('*'),
      'listAllPostComments'
    );
    const mapped = rows.map(mapPostCommentFromDb);
    writeCache('posts:comments:all', mapped);
    return mapped;
  },

  subscribeToAllPostComments(callback: (comments: PostComment[]) => void) {
    const fetcher = async () => {
      const rows = await runQuery<DbPostComment[]>(
        supabase.from('post_comments').select('*'),
        'subscribeToAllPostComments'
      );
      return rows.map(mapPostCommentFromDb);
    };
    return subscribeToTable('post_comments', fetcher, callback, undefined, undefined, 'posts:comments:all');
  },

  subscribeToPostComments(postId: string, callback: (comments: PostComment[]) => void) {
    const fetcher = async () => {
      const rows = await runQuery<DbPostComment[]>(
        supabase.from('post_comments').select('*').eq('post_id', postId).order('created_at', { ascending: true }),
        'subscribeToPostComments'
      );
      return rows.map(mapPostCommentFromDb);
    };
    return subscribeToTable('post_comments', fetcher, callback, `post_id=eq.${postId}`, undefined, `posts:comments:${postId}`);
  },

  async listPostCommentLikes(commentIds: string[]): Promise<PostCommentLike[]> {
    const uniqueIds = Array.from(new Set(commentIds.filter(Boolean)));
    if (uniqueIds.length === 0) return [];
    const cacheKey = `posts:comment-likes:${uniqueIds.slice().sort().join(',')}`;
    const cached = readCache<PostCommentLike[]>(cacheKey, CACHE_TTL.interactions);
    if (cached) return cached;

    const rows = await runQuery<DbPostCommentLike[]>(
      supabase.from('post_comment_likes').select('*').in('comment_id', uniqueIds),
      'listPostCommentLikes'
    );
    const mapped = rows.map(mapPostCommentLikeFromDb);
    writeCache(cacheKey, mapped);
    return mapped;
  },

  subscribeToPostCommentLikes(commentIds: string[], callback: (likes: PostCommentLike[]) => void) {
    const uniqueIds = Array.from(new Set(commentIds.filter(Boolean)));
    if (uniqueIds.length === 0) {
      callback([]);
      return () => undefined;
    }

    const cacheKey = `posts:comment-likes:${uniqueIds.slice().sort().join(',')}`;
    const fetcher = async () => {
      const rows = await runQuery<DbPostCommentLike[]>(
        supabase.from('post_comment_likes').select('*').in('comment_id', uniqueIds),
        'subscribeToPostCommentLikes'
      );
      return rows.map(mapPostCommentLikeFromDb);
    };

    return subscribeToTable('post_comment_likes', fetcher, callback, undefined, undefined, cacheKey);
  },

  async setPostCommentLike(commentId: string, userUid: string, shouldLike: boolean): Promise<void> {
    const existingRows = await runQuery<Pick<DbPostCommentLike, 'id'>[]>(
      supabase.from('post_comment_likes').select('id').eq('comment_id', commentId).eq('user_uid', userUid),
      'setPostCommentLike:existing'
    );

    if (!shouldLike) {
      if (existingRows.length === 0) return;
      await runQuery(
        supabase.from('post_comment_likes').delete().in('id', existingRows.map((row) => row.id)),
        'setPostCommentLike:delete'
      );
      removeCacheByPrefix('posts:comment-likes:');
      return;
    }

    if (existingRows.length === 0) {
      await runQuery(
        supabase.from('post_comment_likes').insert({
          comment_id: commentId,
          user_uid: userUid,
          created_at: new Date().toISOString(),
        }),
        'setPostCommentLike:insert'
      );
      removeCacheByPrefix('posts:comment-likes:');
      return;
    }

    if (existingRows.length > 1) {
      await runQuery(
        supabase.from('post_comment_likes').delete().in('id', existingRows.slice(1).map((row) => row.id)),
        'setPostCommentLike:dedupe'
      );
    }
    removeCacheByPrefix('posts:comment-likes:');
  },

  async addPostComment(postId: string, author: UserProfile, content: string, parentCommentId?: string): Promise<void> {
    await runQuery(
      supabase.from('post_comments').insert({
        post_id: postId,
        user_uid: author.uid,
        author_name: author.displayName,
        author_photo: author.photoURL,
        content,
        created_at: new Date().toISOString(),
        parent_comment_id: parentCommentId || null,
      }),
      'addPostComment'
    );
    removeCache(`posts:comments:${postId}`);
    removeCache('posts:comments:all');
    removeCacheByPrefix('posts:comment-likes:');
  },

  async updatePostComment(commentId: string, content: string): Promise<void> {
    const existing = await runQuery<Pick<DbPostComment, 'post_id'> | null>(
      supabase.from('post_comments').select('post_id').eq('id', commentId).maybeSingle(),
      'updatePostComment:lookup'
    );
    await runQuery(
      supabase.from('post_comments').update({ content }).eq('id', commentId),
      'updatePostComment'
    );
    if (existing?.post_id) {
      removeCache(`posts:comments:${existing.post_id}`);
    }
    removeCache('posts:comments:all');
  },

  async deletePostComment(commentId: string): Promise<void> {
    const existing = await runQuery<Pick<DbPostComment, 'post_id'> | null>(
      supabase.from('post_comments').select('post_id').eq('id', commentId).maybeSingle(),
      'deletePostComment:lookup'
    );
    await runQuery(
      supabase.from('post_comment_likes').delete().eq('comment_id', commentId),
      'deletePostComment:likes'
    );
    await runQuery(
      supabase.from('post_comments').delete().eq('id', commentId),
      'deletePostComment'
    );
    if (existing?.post_id) {
      removeCache(`posts:comments:${existing.post_id}`);
    }
    removeCache('posts:comments:all');
    removeCacheByPrefix('posts:comment-likes:');
  },

  // Jobs
  async createJob(job: Omit<Job, 'id' | 'createdAt' | 'status'>): Promise<void> {
    await runQuery(
      supabase.from('jobs').insert({
        client_uid: job.clientUid,
        title: job.title,
        description: job.description,
        budget: job.budget,
        category: job.category,
        is_student_friendly: job.isStudentFriendly,
        is_remote: job.isRemote,
        status: 'open',
        created_at: new Date().toISOString(),
      }),
      'createJob'
    );
    removeCache('jobs:all');
    removeCacheByPrefix('jobs:client:');
    removeCacheByPrefix('gigs:active:');
  },

  async updateJob(jobId: string, updates: Partial<Pick<Job, 'title' | 'description' | 'budget' | 'category' | 'isStudentFriendly' | 'isRemote'>>): Promise<void> {
    const payload: Partial<DbJob> = {};
    if (typeof updates.title === 'string') payload.title = updates.title;
    if (typeof updates.description === 'string') payload.description = updates.description;
    if (typeof updates.budget === 'number' && Number.isFinite(updates.budget)) payload.budget = updates.budget;
    if (typeof updates.category === 'string') payload.category = updates.category;
    if (typeof updates.isStudentFriendly === 'boolean') payload.is_student_friendly = updates.isStudentFriendly;
    if (typeof updates.isRemote === 'boolean') payload.is_remote = updates.isRemote;

    await runQuery(
      supabase.from('jobs').update(payload).eq('id', jobId),
      'updateJob'
    );
    removeCache(`job:${jobId}`);
    removeCache('jobs:all');
    removeCacheByPrefix('jobs:client:');
  },

  async listJobs(): Promise<Job[]> {
    const cached = readCache<Job[]>('jobs:all', CACHE_TTL.jobs);
    if (cached) return cached;

    const mapped = await fetchAvailableJobs();
    writeCache('jobs:all', mapped);
    return mapped;
  },

  async getJobById(jobId: string): Promise<Job | null> {
    const cached = readCache<Job | null>(`job:${jobId}`, CACHE_TTL.jobs);
    if (cached) return cached;

    const row = await runQuery<DbJob | null>(
      supabase.from('jobs').select('*').eq('id', jobId).maybeSingle(),
      'getJobById'
    );
    const mapped = row ? mapJobFromDb(row) : null;
    if (mapped) writeCache(`job:${jobId}`, mapped);
    return mapped;
  },

  subscribeToJobs(callback: (jobs: Job[]) => void) {
    let active = true;
    let fetchVersion = 0;

    const refresh = () => {
      const currentVersion = ++fetchVersion;
      fetchAvailableJobs()
        .then((jobs) => {
          writeCache('jobs:all', jobs);
          if (active && currentVersion === fetchVersion) callback(jobs);
        })
        .catch((error) => {
          console.error('Supabase fetch error (subscribeToJobs):', error);
        });
    };

    const cached = readCacheAnyAge<Job[]>('jobs:all');
    if (cached) callback(cached);
    refresh();

    const jobsChannel = supabase
      .channel(`realtime:jobs:available:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, refresh)
      .subscribe();

    const proposalsChannel = supabase
      .channel(`realtime:jobs:assignments:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'proposals' }, refresh)
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(jobsChannel);
      supabase.removeChannel(proposalsChannel);
    };
  },

  async createMarketItem(item: Omit<MarketItem, 'id' | 'createdAt' | 'seller'>): Promise<void> {
    await runQuery(
      supabase.from('market_items').insert({
        seller_uid: item.sellerUid,
        title: item.title,
        category: item.category,
        description: item.description || null,
        price: item.price,
        price_currency: item.priceCurrency,
        is_negotiable: item.isNegotiable,
        is_anonymous: item.isAnonymous,
        stock_quantity: item.stockQuantity,
        image_urls: item.imageUrls,
        created_at: new Date().toISOString(),
      }),
      'createMarketItem'
    );
    removeCache('market:all');
  },

  async updateMarketItem(itemId: string, updates: Omit<MarketItem, 'id' | 'createdAt' | 'seller' | 'sellerUid'> & { sellerUid?: string }): Promise<MarketItem> {
    const row = await runQuery<DbMarketItem>(
      supabase
        .from('market_items')
        .update({
          title: updates.title,
          category: updates.category,
          description: updates.description || null,
          price: updates.price,
          price_currency: updates.priceCurrency,
          is_negotiable: updates.isNegotiable,
          is_anonymous: updates.isAnonymous,
          stock_quantity: updates.stockQuantity,
          image_urls: updates.imageUrls,
        })
        .eq('id', itemId)
        .select('*')
        .single(),
      'updateMarketItem'
    );
    const seller =
      this.profileCache.get(row.seller_uid) || (await this.getUserProfile(row.seller_uid));
    const mapped = mapMarketItemFromDb(row, seller || undefined);
    writeCache(`market:${itemId}`, mapped);
    removeCache('market:all');
    return mapped;
  },

  async deleteMarketItem(itemId: string): Promise<void> {
    await runQuery(
      supabase.from('market_items').delete().eq('id', itemId),
      'deleteMarketItem'
    );
    removeCache(`market:${itemId}`);
    removeCache('market:all');
  },

  async listMarketItems(): Promise<MarketItem[]> {
    const cached = readCache<MarketItem[]>('market:all', CACHE_TTL.jobs);
    if (cached) return cached;

    const rows = await runQuery<DbMarketItem[]>(
      supabase.from('market_items').select('*').order('created_at', { ascending: false }),
      'listMarketItems'
    );

    const sellerUids = Array.from(new Set(rows.map((row) => row.seller_uid)));
    const sellers = sellerUids.length > 0 ? await this.getUsersByUids(sellerUids) : [];
    const sellerMap = new Map<string, UserProfile>(sellers.map((seller) => [seller.uid, seller]));
    const mapped = rows.map((row) => mapMarketItemFromDb(row, sellerMap.get(row.seller_uid)));
    writeCache('market:all', mapped);
    return mapped;
  },

  async getMarketItemById(itemId: string): Promise<MarketItem | null> {
    const cached = readCache<MarketItem | null>(`market:${itemId}`, CACHE_TTL.jobs);
    if (cached) return cached;

    const row = await runQuery<DbMarketItem | null>(
      supabase.from('market_items').select('*').eq('id', itemId).maybeSingle(),
      'getMarketItemById'
    );

    if (!row) return null;
    const seller =
      this.profileCache.get(row.seller_uid) || (await this.getUserProfile(row.seller_uid));
    const mapped = mapMarketItemFromDb(row, seller || undefined);
    writeCache(`market:${itemId}`, mapped);
    return mapped;
  },

  subscribeToMarketItems(callback: (items: MarketItem[]) => void, onError?: (error: any) => void) {
    const fetcher = async () => this.listMarketItems();
    return subscribeToTable('market_items', fetcher, callback, undefined, onError, 'market:all');
  },

  async getMyCompanyPartnerRequest(uid: string, options?: { forceRefresh?: boolean }): Promise<CompanyPartnerRequest | null> {
      const cacheKey = `partner:request:${uid}`;
      if (!options?.forceRefresh) {
        const cached = readCache<CompanyPartnerRequest | null>(cacheKey, CACHE_TTL.users);
        if (cached) return cached;
      }

      const row = await runQuery<DbCompanyPartnerRequest | null>(
        supabase.from('company_partner_requests').select('*').eq('user_uid', uid).maybeSingle(),
      'getMyCompanyPartnerRequest'
    );
      const mapped = row ? mapCompanyPartnerRequestFromDb(row) : null;
      writeCache(cacheKey, mapped);
      return mapped;
    },

  async getUserProfileByEmail(email: string): Promise<UserProfile | null> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return null;
    const row = await runQuery<DbUserProfile | null>(
      supabase.from('users').select('*').ilike('email', normalizedEmail).maybeSingle(),
      'getUserProfileByEmail'
    );
    const mapped = row ? mapUserProfileFromDb(row) : null;
    if (mapped) {
      this.profileCache.set(mapped.uid, mapped);
      writeCache(`user:${mapped.uid}`, mapped);
    }
    return mapped;
  },

  subscribeToMyCompanyPartnerRequest(uid: string, callback: (request: CompanyPartnerRequest | null) => void, onError?: (error: any) => void) {
    const fetcher = async () => this.getMyCompanyPartnerRequest(uid, { forceRefresh: true });
    return subscribeToTable('company_partner_requests', fetcher, callback, `user_uid=eq.${uid}`, onError, `partner:request:${uid}`);
  },

  async submitCompanyPartnerRequest(request: Omit<CompanyPartnerRequest, 'id' | 'createdAt' | 'status'>): Promise<CompanyPartnerRequest> {
      const existing = await this.getMyCompanyPartnerRequest(request.userUid, { forceRefresh: true });
      const row = await runQuery<DbCompanyPartnerRequest>(
        supabase
          .from('company_partner_requests')
        .upsert(
          {
            user_uid: request.userUid,
            company_name: request.companyName,
            company_logo_url: request.companyLogoUrl,
            website_url: request.websiteUrl || null,
              social_links: request.socialLinks,
              about: request.about,
              location: request.location,
              registration_urls: request.registrationUrls,
              status: existing?.status === 'approved' ? 'approved' : 'pending',
              created_at: existing?.createdAt || new Date().toISOString(),
            },
            { onConflict: 'user_uid' }
          )
        .select('*')
        .single(),
      'submitCompanyPartnerRequest'
    );
      const mapped = mapCompanyPartnerRequestFromDb(row);
      writeCache(`partner:request:${request.userUid}`, mapped);
      return mapped;
    },

  async getApprovedCompanyPartnerRequestsByUserUids(userUids: string[]): Promise<Record<string, CompanyPartnerRequest>> {
    const uniqueUids = Array.from(new Set(userUids.filter(Boolean)));
    if (uniqueUids.length === 0) return {};
    const rows = await runQuery<DbCompanyPartnerRequest[]>(
      supabase.from('company_partner_requests').select('*').in('user_uid', uniqueUids).eq('status', 'approved'),
      'getApprovedCompanyPartnerRequestsByUserUids'
    );
    return rows.reduce<Record<string, CompanyPartnerRequest>>((acc, row) => {
      acc[row.user_uid] = mapCompanyPartnerRequestFromDb(row);
      return acc;
    }, {});
  },

  async getApprovedCompanyPartnerRequestByUserUid(userUid: string): Promise<CompanyPartnerRequest | null> {
    const records = await this.getApprovedCompanyPartnerRequestsByUserUids([userUid]);
    return records[userUid] || null;
  },

  async listApprovedCompanyPartnerRequests(limitCount: number = 12): Promise<CompanyPartnerRequest[]> {
    const rows = await runQuery<DbCompanyPartnerRequest[]>(
      supabase
        .from('company_partner_requests')
        .select('*')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(limitCount),
      'listApprovedCompanyPartnerRequests'
    );
    return rows.map(mapCompanyPartnerRequestFromDb);
  },

  subscribeToApprovedCompanyPartnerRequests(
    limitCount: number,
    callback: (requests: CompanyPartnerRequest[]) => void,
    onError?: (error: any) => void
  ) {
    const cacheKey = `partner:approved:${limitCount}`;
    const fetcher = async () => {
      const rows = await runQuery<DbCompanyPartnerRequest[]>(
        supabase
          .from('company_partner_requests')
          .select('*')
          .eq('status', 'approved')
          .order('created_at', { ascending: false })
          .limit(limitCount),
        `subscribeToApprovedCompanyPartnerRequests:${limitCount}`
      );
      return rows.map(mapCompanyPartnerRequestFromDb);
    };
    return subscribeToTable('company_partner_requests', fetcher, callback, `status=eq.approved`, onError, cacheKey);
  },

  async listMarketSellerRatings(): Promise<MarketSellerRating[]> {
    const cacheKey = 'market:seller-ratings';
    const cached = readCache<MarketSellerRating[]>(cacheKey, CACHE_TTL.interactions);
    if (cached) return cached;

    const rows = await runQuery<DbMarketSellerRating[]>(
      supabase.from('market_seller_ratings').select('*'),
      'listMarketSellerRatings'
    );
    const mapped = rows.map(mapMarketSellerRatingFromDb);
    writeCache(cacheKey, mapped);
    return mapped;
  },

  async getUserPerformanceSummaries(uids: string[]): Promise<Record<string, UserPerformanceSummary>> {
    const uniqueUids = Array.from(new Set(uids.filter(Boolean)));
    if (uniqueUids.length === 0) return {};

    const cacheKey = `users:performance:${uniqueUids.slice().sort().join(',')}`;
    const cached = readCache<Record<string, UserPerformanceSummary>>(cacheKey, CACHE_TTL.interactions);
    if (cached) return cached;

    const [proposalRows, ratings] = await Promise.all([
      runQuery<DbProposal[]>(
        supabase
          .from('proposals')
          .select('*')
          .eq('status', 'accepted')
          .in('freelancer_uid', uniqueUids),
        'getUserPerformanceSummaries:proposals'
      ),
      this.listMarketSellerRatings(),
    ]);

    const summary: Record<string, UserPerformanceSummary> = {};
    uniqueUids.forEach((uid) => {
      summary[uid] = {
        gigsCompleted: 0,
        ratingAverage: 0,
        ratingCount: 0,
      };
    });

    proposalRows.forEach((proposal) => {
      if (!summary[proposal.freelancer_uid]) return;
      summary[proposal.freelancer_uid].gigsCompleted += 1;
    });

    ratings.forEach((rating) => {
      if (!summary[rating.sellerUid]) return;
      summary[rating.sellerUid].ratingAverage += rating.rating;
      summary[rating.sellerUid].ratingCount += 1;
    });

    uniqueUids.forEach((uid) => {
      const item = summary[uid];
      item.ratingAverage = item.ratingCount > 0 ? Number((item.ratingAverage / item.ratingCount).toFixed(1)) : 0;
    });

    writeCache(cacheKey, summary);
    return summary;
  },

  subscribeToMarketSellerRatings(callback: (ratings: MarketSellerRating[]) => void, onError?: (error: any) => void) {
    const fetcher = async () => this.listMarketSellerRatings();
    return subscribeToTable('market_seller_ratings', fetcher, callback, undefined, onError, 'market:seller-ratings');
  },

  async upsertMarketSellerRating(sellerUid: string, userUid: string, rating: number): Promise<void> {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5.');
    }
    await runQuery(
      supabase.from('market_seller_ratings').upsert(
        {
          seller_uid: sellerUid,
          user_uid: userUid,
          rating,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'seller_uid,user_uid' }
      ),
      'upsertMarketSellerRating'
    );
    removeCache('market:seller-ratings');
    removeCacheByPrefix('users:performance:');
  },

  async getMarketSettings(uid: string): Promise<MarketSettings> {
    const cacheKey = `market:settings:${uid}`;
    const cached = readCache<MarketSettings>(cacheKey, CACHE_TTL.users);
    if (cached) return cached;

    const row = await runQuery<DbMarketSettings | null>(
      supabase.from('market_settings').select('*').eq('user_uid', uid).maybeSingle(),
      'getMarketSettings'
    );

    if (row) {
      const mapped = mapMarketSettingsFromDb(row);
      writeCache(cacheKey, mapped);
      return mapped;
    }

    const fallback: MarketSettings = {
      userUid: uid,
      phoneNumber: '',
      location: '',
      brandName: '',
      isRegistered: false,
      showPhoneNumber: false,
      showLocation: false,
      showBrandName: true,
    };
    writeCache(cacheKey, fallback);
    return fallback;
  },

  async updateMarketSettings(uid: string, updates: Pick<MarketSettings, 'phoneNumber' | 'location' | 'brandName' | 'showPhoneNumber' | 'showLocation' | 'showBrandName'>): Promise<MarketSettings> {
    const existing = await this.getMarketSettings(uid);
    const row = await runQuery<DbMarketSettings>(
      supabase
        .from('market_settings')
        .upsert(
          {
            user_uid: uid,
            phone_number: updates.phoneNumber || null,
            location: updates.location || null,
            brand_name: updates.brandName || null,
            is_registered: existing.isRegistered,
            registered_at: existing.registeredAt || null,
            show_phone_number: updates.showPhoneNumber,
            show_location: updates.showLocation,
            show_brand_name: updates.showBrandName,
          },
          { onConflict: 'user_uid' }
        )
        .select('*')
        .single(),
      'updateMarketSettings'
    );

    const mapped = mapMarketSettingsFromDb(row);
    writeCache(`market:settings:${uid}`, mapped);
    await this.updateUserProfile(uid, {
      phoneNumber: mapped.phoneNumber,
      location: mapped.location,
      companyInfo: {
        name: mapped.brandName,
        about: this.profileCache.get(uid)?.companyInfo?.about || '',
      },
    });
    return mapped;
  },

  async registerMarketplace(uid: string, pin: string): Promise<MarketSettings> {
    const settings = await this.getMarketSettings(uid);
    if (settings.isRegistered) {
      throw new Error('Marketplace registration has already been completed.');
    }
    const pinValid = await this.verifyTransactionPin(uid, pin);
    if (!pinValid) {
      throw new Error('Invalid transaction PIN.');
    }

    const wallet = await this.getOrCreateWallet(uid);
    if (wallet.ngnBalance < 500) {
      throw new Error('You need at least N500 in your NGN wallet balance to register.');
    }

    const timestamp = new Date().toISOString();
    await runQuery(
      supabase
        .from('wallets')
        .update({
          usd_balance: wallet.usdBalance,
          ngn_balance: wallet.ngnBalance - 500,
          eur_balance: wallet.eurBalance,
          updated_at: timestamp,
        })
        .eq('user_uid', uid),
      'registerMarketplace:wallet'
    );

    await runQuery(
      supabase.from('wallet_transactions').insert({
        user_uid: uid,
        currency: 'NGN',
        type: 'withdraw',
        method: 'transfer',
        amount: 500,
        status: 'completed',
        created_at: timestamp,
        reference: 'Marketplace registration',
      }),
      'registerMarketplace:transaction'
    );

    const row = await runQuery<DbMarketSettings>(
      supabase
        .from('market_settings')
        .upsert(
          {
            user_uid: uid,
            phone_number: settings.phoneNumber || null,
            location: settings.location || null,
            brand_name: settings.brandName || null,
            is_registered: true,
            registered_at: timestamp,
            show_phone_number: settings.showPhoneNumber,
            show_location: settings.showLocation,
            show_brand_name: settings.showBrandName,
          },
          { onConflict: 'user_uid' }
        )
        .select('*')
        .single(),
      'registerMarketplace:settings'
    );

    removeCache(`wallet:${uid}`);
    removeCache(`wallet:transactions:${uid}`);
    const mapped = mapMarketSettingsFromDb(row);
    writeCache(`market:settings:${uid}`, mapped);
    return mapped;
  },

  // Messages
  async uploadFile(file: File, folder: string = 'chat'): Promise<Attachment> {
    const optimizedFile = await optimizeImageFile(file, getUploadOptimizationOptions(folder));
    const url = await uploadToSupabaseStorage(optimizedFile, folder);
    return {
      name: optimizedFile.name,
      url,
      type: optimizedFile.type,
      size: optimizedFile.size,
    };
  },

  async uploadUserAsset(file: File, folder: string = 'profile'): Promise<string> {
    const optimizedFile = await optimizeImageFile(file, getUploadOptimizationOptions(folder));
    return uploadToSupabaseStorage(optimizedFile, folder);
  },

  async sendMessage(message: Omit<Message, 'id' | 'createdAt'>): Promise<Message> {
    const createdAt = new Date().toISOString();
    const inserted = await runQuery<DbMessage>(
      supabase
        .from('messages')
        .insert({
          sender_uid: message.senderUid,
          receiver_uid: message.receiverUid,
          content: message.content || null,
          attachments: message.attachments || null,
          created_at: createdAt,
          read_at: null,
        })
        .select('*')
        .single(),
      'sendMessage'
    );

    const lastMessageText =
      message.content || (message.attachments && message.attachments.length > 0 ? 'Attachment' : '');

    try {
      await runQuery(
        supabase.from('active_chats').upsert(
          [
            {
              user_uid: message.senderUid,
              other_uid: message.receiverUid,
              last_message: lastMessageText,
              updated_at: createdAt,
            },
            {
              user_uid: message.receiverUid,
              other_uid: message.senderUid,
              last_message: lastMessageText,
              updated_at: createdAt,
            },
          ],
          { onConflict: 'user_uid,other_uid' }
        ),
        'updateActiveChats'
      );

      const senderProfile =
        this.profileCache.get(message.senderUid) || (await this.getUserProfile(message.senderUid));
      const receiverProfile =
        this.profileCache.get(message.receiverUid) || (await this.getUserProfile(message.receiverUid));

      if (receiverProfile) {
        this.upsertActiveChatCache(message.senderUid, {
          otherUid: receiverProfile.uid,
          user: receiverProfile,
          lastMessage: lastMessageText,
          updatedAt: createdAt,
          lastMessageSenderUid: message.senderUid,
          lastMessageReadAt: undefined,
        });
      }

      if (senderProfile) {
        this.upsertActiveChatCache(message.receiverUid, {
          otherUid: senderProfile.uid,
          user: senderProfile,
          lastMessage: lastMessageText,
          updatedAt: createdAt,
          lastMessageSenderUid: message.senderUid,
          lastMessageReadAt: undefined,
        });
      }
    } catch (error) {
      console.error('Post-send chat sync failed:', error);
    }

    return mapMessageFromDb(inserted);
  },

  async updateMessage(messageId: string, senderUid: string, content: string): Promise<Message> {
    const normalized = content.trim();
    if (!normalized) {
      throw new Error('Message cannot be empty.');
    }

    const existing = await runQuery<DbMessage | null>(
      supabase.from('messages').select('*').eq('id', messageId).eq('sender_uid', senderUid).maybeSingle(),
      'updateMessage:existing'
    );
    if (!existing) {
      throw new Error('Message not found.');
    }

    const row = await runQuery<DbMessage>(
      supabase
        .from('messages')
        .update({ content: normalized })
        .eq('id', messageId)
        .eq('sender_uid', senderUid)
        .select('*')
        .single(),
      'updateMessage'
    );

    await this.syncConversationPreview(existing.sender_uid, existing.receiver_uid);
    removeCache(`messages:${existing.sender_uid}:${existing.receiver_uid}`);
    removeCache(`messages:${existing.receiver_uid}:${existing.sender_uid}`);
    return mapMessageFromDb(row);
  },

  async deleteMessage(messageId: string, senderUid: string): Promise<Message> {
    const existing = await runQuery<DbMessage | null>(
      supabase.from('messages').select('*').eq('id', messageId).eq('sender_uid', senderUid).maybeSingle(),
      'deleteMessage:existing'
    );
    if (!existing) {
      throw new Error('Message not found.');
    }

    const row = await runQuery<DbMessage>(
      supabase
        .from('messages')
        .update({
          content: MESSAGE_DELETED_SENTINEL,
          attachments: [],
        })
        .eq('id', messageId)
        .eq('sender_uid', senderUid)
        .select('*')
        .single(),
      'deleteMessage'
    );

    await this.syncConversationPreview(existing.sender_uid, existing.receiver_uid);
    removeCache(`messages:${existing.sender_uid}:${existing.receiver_uid}`);
    removeCache(`messages:${existing.receiver_uid}:${existing.sender_uid}`);
    return mapMessageFromDb(row);
  },

  async clearConversation(uid: string, otherUid: string): Promise<void> {
    const clearedAt = new Date().toISOString();
    setConversationClearedAt(uid, otherUid, clearedAt);
    await runQuery(
      supabase.from('active_chats').delete().eq('user_uid', uid).eq('other_uid', otherUid),
      'clearConversation'
    );
    removeCache(`messages:${uid}:${otherUid}`);
    removeCache(`messages:${otherUid}:${uid}`);
    removeCache(`chats:active:${uid}`);
    removeCache(`chats:recent:${uid}`);
  },

  async syncConversationPreview(uid: string, otherUid: string): Promise<void> {
    const latest = await runQuery<DbMessage[]>(
      supabase
        .from('messages')
        .select('*')
        .or(`and(sender_uid.eq.${uid},receiver_uid.eq.${otherUid}),and(sender_uid.eq.${otherUid},receiver_uid.eq.${uid})`)
        .order('created_at', { ascending: false })
        .limit(1),
      'syncConversationPreview'
    );

    const latestMessage = latest[0];
    if (!latestMessage) {
      await runQuery(
        supabase.from('active_chats').delete().or(`and(user_uid.eq.${uid},other_uid.eq.${otherUid}),and(user_uid.eq.${otherUid},other_uid.eq.${uid})`),
        'syncConversationPreview:deleteEmpty'
      );
      removeCache(`chats:active:${uid}`);
      removeCache(`chats:active:${otherUid}`);
      removeCache(`chats:recent:${uid}`);
      removeCache(`chats:recent:${otherUid}`);
      return;
    }

    const lastMessageText =
      latestMessage.content === MESSAGE_DELETED_SENTINEL
        ? 'This message was deleted'
        : latestMessage.content || (Array.isArray(latestMessage.attachments) && latestMessage.attachments.length > 0 ? 'Attachment' : '');

    await runQuery(
      supabase.from('active_chats').upsert(
        [
          {
            user_uid: uid,
            other_uid: otherUid,
            last_message: lastMessageText,
            updated_at: latestMessage.created_at,
          },
          {
            user_uid: otherUid,
            other_uid: uid,
            last_message: lastMessageText,
            updated_at: latestMessage.created_at,
          },
        ],
        { onConflict: 'user_uid,other_uid' }
      ),
      'syncConversationPreview:upsert'
    );

    removeCache(`chats:active:${uid}`);
    removeCache(`chats:active:${otherUid}`);
    removeCache(`chats:recent:${uid}`);
    removeCache(`chats:recent:${otherUid}`);
  },

  subscribeToMessages(
    uid: string,
    otherUid: string,
    callback: (messages: Message[]) => void,
    onError?: (error: any) => void
  ) {
    const cacheKey = `messages:${uid}:${otherUid}`;
    const cached = readCacheAnyAge<Message[]>(cacheKey);
    if (cached) callback(cached);

    let active = true;
    let fetchVersion = 0;

    const fetcher = async () => {
      try {
        const rows = await runQuery<DbMessage[]>(
          supabase
            .from('messages')
            .select('*')
            .or(`and(sender_uid.eq.${uid},receiver_uid.eq.${otherUid}),and(sender_uid.eq.${otherUid},receiver_uid.eq.${uid})`)
            .order('created_at', { ascending: true })
            .limit(100),
          'subscribeToMessages'
        );
        const clearedAt = getConversationClearedAt(uid, otherUid);
        const mapped = rows.map(mapMessageFromDb);
        return clearedAt
          ? mapped.filter((message) => new Date(message.createdAt).getTime() > new Date(clearedAt).getTime())
          : mapped;
      } catch (error) {
        if (onError) onError(error);
        throw error;
      }
    };

    const refresh = async () => {
      const currentVersion = ++fetchVersion;
      try {
        const messages = await fetcher();
        writeCache(cacheKey, messages);
        if (active && currentVersion === fetchVersion) {
          callback(messages);
        }
      } catch (error) {
        console.error('Supabase fetch error (subscribeToMessages):', error);
      }
    };

    refresh();

    const channels = [
      supabase.channel(`realtime:conversation:sender:${uid}:${otherUid}:${Math.random().toString(36).slice(2)}`).on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `sender_uid=eq.${uid}` },
        refresh
      ),
      supabase.channel(`realtime:conversation:receiver:${uid}:${otherUid}:${Math.random().toString(36).slice(2)}`).on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `receiver_uid=eq.${uid}` },
        refresh
      ),
      supabase.channel(`realtime:conversation:sender:${otherUid}:${uid}:${Math.random().toString(36).slice(2)}`).on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `sender_uid=eq.${otherUid}` },
        refresh
      ),
      supabase.channel(`realtime:conversation:receiver:${otherUid}:${uid}:${Math.random().toString(36).slice(2)}`).on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `receiver_uid=eq.${otherUid}` },
        refresh
      ),
    ];

    channels.forEach((channel) => channel.subscribe());
    const interval = window.setInterval(refresh, 2500);

    return () => {
      active = false;
      window.clearInterval(interval);
      channels.forEach((channel) => supabase.removeChannel(channel));
    };
  },

  async markMessagesAsRead(uid: string, otherUid: string, readAt: string = new Date().toISOString()) {
    await runQuery(
      supabase
        .from('messages')
        .update({ read_at: readAt })
        .eq('receiver_uid', uid)
        .eq('sender_uid', otherUid)
        .is('read_at', null),
      'markMessagesAsRead'
    );
    this.markChatAsRead(uid, otherUid, readAt);
    removeCache(`messages:${uid}:${otherUid}`);
    removeCache(`messages:${otherUid}:${uid}`);
    removeCache(`unread:messages:${uid}`);
  },

  async getUnreadMessageCounts(uid: string): Promise<Record<string, number>> {
    const cacheKey = `unread:messages:${uid}`;
    const cached = readCache<Record<string, number>>(cacheKey, CACHE_TTL.chats);
    if (cached) return cached;

    const rows = await runQuery<Pick<DbMessage, 'sender_uid'>[]>(
      supabase
        .from('messages')
        .select('sender_uid')
        .eq('receiver_uid', uid)
        .is('read_at', null),
      'getUnreadMessageCounts'
    );

    const counts = rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.sender_uid] = (acc[row.sender_uid] || 0) + 1;
      return acc;
    }, {});

    writeCache(cacheKey, counts);
    return counts;
  },

  subscribeToUnreadMessageCounts(uid: string, callback: (counts: Record<string, number>) => void, onError?: (error: any) => void) {
    const cacheKey = `unread:messages:${uid}`;
    const cached = readCacheAnyAge<Record<string, number>>(cacheKey);
    if (cached) callback(cached);

    let active = true;
    let fetchVersion = 0;
    const fetcher = async () => this.getUnreadMessageCounts(uid);

    const refresh = async () => {
      const currentVersion = ++fetchVersion;
      try {
        const counts = await fetcher();
        writeCache(cacheKey, counts);
        if (active && currentVersion === fetchVersion) {
          callback(counts);
        }
      } catch (error) {
        console.error('Supabase fetch error (subscribeToUnreadMessageCounts):', error);
        onError?.(error);
      }
    };

    refresh();

    const receiverChannel = supabase.channel(`realtime:unread:receiver:${uid}:${Math.random().toString(36).slice(2)}`).on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'messages', filter: `receiver_uid=eq.${uid}` },
      refresh
    );
    const senderChannel = supabase.channel(`realtime:unread:sender:${uid}:${Math.random().toString(36).slice(2)}`).on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'messages', filter: `sender_uid=eq.${uid}` },
      refresh
    );

    receiverChannel.subscribe();
    senderChannel.subscribe();
    const interval = window.setInterval(refresh, 2500);

    return () => {
      active = false;
      window.clearInterval(interval);
      supabase.removeChannel(receiverChannel);
      supabase.removeChannel(senderChannel);
    };
  },

  subscribeToMessageEvents(
    uid: string,
    callback: (event: { type: 'INSERT' | 'UPDATE' | 'DELETE'; message?: Message; oldMessage?: Message }) => void
  ) {
    const handlePayload = (eventType: 'INSERT' | 'UPDATE' | 'DELETE', payload: any) => {
      const nextRow = payload?.new && payload.new.id ? mapMessageFromDb(payload.new as DbMessage) : undefined;
      const prevRow = payload?.old && payload.old.id ? mapMessageFromDb(payload.old as DbMessage) : undefined;
      callback({
        type: eventType,
        message: nextRow,
        oldMessage: prevRow,
      });
    };

    const senderChannel = supabase
      .channel(`realtime:messages:sender:${uid}:${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `sender_uid=eq.${uid}` },
        (payload: any) => handlePayload(payload.eventType, payload)
      )
      .subscribe();

    const receiverChannel = supabase
      .channel(`realtime:messages:receiver:${uid}:${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `receiver_uid=eq.${uid}` },
        (payload: any) => handlePayload(payload.eventType, payload)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(senderChannel);
      supabase.removeChannel(receiverChannel);
    };
  },

  upsertActiveChatCache(uid: string, chat: ActiveChatSummary) {
    const activeCacheKey = `chats:active:${uid}`;
    const recentCacheKey = `chats:recent:${uid}`;
    const nextActiveChats = mergeChatSummaries(readCacheAnyAge<ActiveChatSummary[]>(activeCacheKey) || [], [chat]);
    writeCache(activeCacheKey, nextActiveChats);

    const nextRecentChats = mergeChatSummaries(readCacheAnyAge<ActiveChatSummary[]>(recentCacheKey) || [], [chat]);
    writeCache(recentCacheKey, nextRecentChats);
    return nextActiveChats;
  },

  ensureChatVisible(uid: string, otherUser: UserProfile, options?: { lastMessage?: string; updatedAt?: string }) {
    return this.upsertActiveChatCache(uid, {
      otherUid: otherUser.uid,
      user: otherUser,
      lastMessage: options?.lastMessage || '',
      updatedAt: options?.updatedAt || new Date().toISOString(),
    });
  },

  async fetchActiveChats(uid: string) {
    const cacheKey = `chats:active:${uid}`;
    const cached = readCache<any[]>(cacheKey, CACHE_TTL.chats);
    if (cached) return cached;

    const rows = await runQuery<any[]>(
      supabase
        .from('active_chats')
        .select('*')
        .eq('user_uid', uid)
        .order('updated_at', { ascending: false })
        .limit(50),
      'fetchActiveChats'
    );

    const normalizedRows = rows.filter((row) => typeof row?.other_uid === 'string' && row.other_uid.trim().length > 0);
    const otherUids = normalizedRows.map((r) => r.other_uid as string);
    if (otherUids.length === 0) return [];

    const messageRows = await runQuery<DbMessage[]>(
      supabase
        .from('messages')
        .select('*')
        .or(`sender_uid.eq.${uid},receiver_uid.eq.${uid}`)
        .order('created_at', { ascending: false })
        .limit(300),
      'fetchActiveChats:messages'
    );
    const latestMessageByOtherUid = new Map<string, DbMessage>();
    messageRows.forEach((row) => {
      const otherUid = row.sender_uid === uid ? row.receiver_uid : row.sender_uid;
      if (!otherUid || latestMessageByOtherUid.has(otherUid)) return;
      latestMessageByOtherUid.set(otherUid, row);
    });

    const profiles = await this.getUsersByUids(otherUids);
    const profileMap = new Map<string, UserProfile>(profiles.map((p) => [p.uid, p]));

    const mapped = normalizedRows
      .map((chat): ActiveChatSummary | null => {
        const user = profileMap.get(chat.other_uid);
        if (!user) return null;
        const latestMessage = latestMessageByOtherUid.get(chat.other_uid);
        return {
          lastMessage: typeof chat.last_message === 'string' ? chat.last_message : '',
          updatedAt: typeof chat.updated_at === 'string' ? chat.updated_at : new Date().toISOString(),
          otherUid: chat.other_uid as string,
          user,
          lastMessageSenderUid: latestMessage?.sender_uid,
          lastMessageReadAt: latestMessage?.read_at || undefined,
        };
      })
      .filter((c): c is NonNullable<typeof c> => {
        if (!c) return false;
        const clearedAt = getConversationClearedAt(uid, c.otherUid);
        return !clearedAt || new Date(c.updatedAt).getTime() > new Date(clearedAt).getTime();
      });

    const recent = readCacheAnyAge<ActiveChatSummary[]>(`chats:recent:${uid}`) || [];
    const merged = mergeChatSummaries(mapped, recent);
    writeCache(cacheKey, merged);
    return merged;
  },

  subscribeToActiveChats(uid: string, callback: (chats: any[]) => void, onError?: (error: any) => void) {
    const cacheKey = `chats:active:${uid}`;
    const cached = readCacheAnyAge<any[]>(cacheKey);
    if (cached) callback(cached);

    let active = true;
    let fetchVersion = 0;

    const refresh = async () => {
      const currentVersion = ++fetchVersion;
      try {
        const chats = await this.fetchActiveChats(uid);
        writeCache(cacheKey, chats);
        if (active && currentVersion === fetchVersion) {
          callback(chats);
        }
      } catch (error) {
        console.error('Supabase fetch error (subscribeToActiveChats):', error);
        onError?.(error);
      }
    };

    refresh();

    const channels = [
      supabase.channel(`realtime:active_chats:${uid}:${Math.random().toString(36).slice(2)}`).on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'active_chats', filter: `user_uid=eq.${uid}` },
        refresh
      ),
      supabase.channel(`realtime:messages:sidebar-sender:${uid}:${Math.random().toString(36).slice(2)}`).on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `sender_uid=eq.${uid}` },
        refresh
      ),
      supabase.channel(`realtime:messages:sidebar-receiver:${uid}:${Math.random().toString(36).slice(2)}`).on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `receiver_uid=eq.${uid}` },
        refresh
      ),
    ];

    channels.forEach((channel) => channel.subscribe());

    return () => {
      active = false;
      channels.forEach((channel) => supabase.removeChannel(channel));
    };
  },

  async getRecentConversations(uid: string) {
    const cacheKey = `chats:recent:${uid}`;
    const cached = readCache<any[]>(cacheKey, CACHE_TTL.chats);
    if (cached) return cached;

    const rows = await runQuery<DbMessage[]>(
      supabase
        .from('messages')
        .select('*')
        .or(`sender_uid.eq.${uid},receiver_uid.eq.${uid}`)
        .order('created_at', { ascending: false })
        .limit(200),
      'getRecentConversations'
    );

    const convoMap = new Map<string, { lastMessage: string; updatedAt: string; lastMessageSenderUid?: string; lastMessageReadAt?: string }>();
    rows.forEach((msg) => {
      const otherUid = msg.sender_uid === uid ? msg.receiver_uid : msg.sender_uid;
      if (!otherUid) return;
      if (!convoMap.has(otherUid)) {
        convoMap.set(otherUid, {
          lastMessage: msg.content || (Array.isArray(msg.attachments) && msg.attachments.length > 0 ? 'Attachment' : ''),
          updatedAt: msg.created_at || new Date().toISOString(),
          lastMessageSenderUid: msg.sender_uid,
          lastMessageReadAt: msg.read_at || undefined,
        });
      }
    });

    const otherUids = Array.from(convoMap.keys());
    if (otherUids.length === 0) return [];

    const profiles = await this.getUsersByUids(otherUids);
    const profileMap = new Map<string, UserProfile>(profiles.map((p) => [p.uid, p]));

    const mapped = otherUids
      .map((otherUid): ActiveChatSummary | null => {
        const user = profileMap.get(otherUid);
        if (!user) return null;
        const convo = convoMap.get(otherUid)!;
        return {
          otherUid,
          user,
          lastMessage: convo.lastMessage,
          updatedAt: convo.updatedAt,
          lastMessageSenderUid: convo.lastMessageSenderUid,
          lastMessageReadAt: convo.lastMessageReadAt,
        };
      })
      .filter((c): c is NonNullable<typeof c> => {
        if (!c) return false;
        const clearedAt = getConversationClearedAt(uid, c.otherUid);
        return !clearedAt || new Date(c.updatedAt).getTime() > new Date(clearedAt).getTime();
      });
    writeCache(cacheKey, mapped);
    return mapped;
  },

  // Friend Requests
  subscribeToIncomingFriendRequests(uid: string, callback: (requests: FriendRequest[]) => void) {
    const fetcher = async () => {
      const rows = await runQuery<DbFriendRequest[]>(
        supabase
          .from('friend_requests')
          .select('*')
          .eq('to_uid', uid)
          .order('created_at', { ascending: false }),
        'subscribeToIncomingFriendRequests'
      );
      return rows.map(mapFriendRequestFromDb);
    };
    return subscribeToTable('friend_requests', fetcher, callback, `to_uid=eq.${uid}`, undefined, `requests:incoming:${uid}`);
  },

  subscribeToOutgoingFriendRequests(uid: string, callback: (requests: FriendRequest[]) => void) {
    const fetcher = async () => {
      const rows = await runQuery<DbFriendRequest[]>(
        supabase
          .from('friend_requests')
          .select('*')
          .eq('from_uid', uid)
          .order('created_at', { ascending: false }),
        'subscribeToOutgoingFriendRequests'
      );
      return rows.map(mapFriendRequestFromDb);
    };
    return subscribeToTable('friend_requests', fetcher, callback, `from_uid=eq.${uid}`, undefined, `requests:outgoing:${uid}`);
  },

  async sendFriendRequest(targetUser: UserProfile, myProfile: UserProfile): Promise<void> {
    await runQuery(
      supabase.from('friend_requests').insert({
        from_uid: myProfile.uid,
        from_name: myProfile.displayName,
        from_photo: myProfile.photoURL,
        to_uid: targetUser.uid,
        status: 'pending',
        created_at: new Date().toISOString(),
      }),
      'sendFriendRequest'
    );
  },

  async deleteFriendRequest(requestId: string): Promise<void> {
    await runQuery(
      supabase.from('friend_requests').delete().eq('id', requestId),
      'deleteFriendRequest'
    );
  },

  async acceptFriendRequest(request: FriendRequest, myProfile: UserProfile): Promise<void> {
    const timestamp = new Date().toISOString();
    await runQuery(
      supabase.from('friend_requests').update({ status: 'accepted' }).eq('id', request.id),
      'acceptFriendRequest:update'
    );

    await runQuery(
      supabase.from('connections').insert({
        uids: [myProfile.uid, request.fromUid],
        created_at: timestamp,
      }),
      'acceptFriendRequest:connection'
    );

    await runQuery(
      supabase.from('active_chats').upsert(
        [
          {
            user_uid: myProfile.uid,
            other_uid: request.fromUid,
            last_message: 'You are now connected! Say hi.',
            updated_at: timestamp,
          },
          {
            user_uid: request.fromUid,
            other_uid: myProfile.uid,
            last_message: 'You are now connected! Say hi.',
            updated_at: timestamp,
          },
        ],
        { onConflict: 'user_uid,other_uid' }
      ),
      'acceptFriendRequest:activeChats'
    );
  },

  async rejectFriendRequest(requestId: string): Promise<void> {
    await runQuery(
      supabase.from('friend_requests').update({ status: 'rejected' }).eq('id', requestId),
      'rejectFriendRequest'
    );
  },

  subscribeToConnections(uid: string, callback: (connections: Connection[]) => void) {
    const fetcher = async () => {
      const rows = await runQuery<DbConnection[]>(
        supabase.from('connections').select('*').contains('uids', [uid]),
        'subscribeToConnections'
      );
      return rows.map(mapConnectionFromDb);
    };
    return subscribeToTable('connections', fetcher, callback, undefined, undefined, `connections:${uid}`);
  },

  async getFriends(uid: string): Promise<UserProfile[]> {
    const cached = readCache<UserProfile[]>(`friends:${uid}`, CACHE_TTL.users);
    if (cached) return cached;

    const connections = await runQuery<DbConnection[]>(
      supabase.from('connections').select('*').contains('uids', [uid]),
      'getFriends:connections'
    );
    const otherUids = connections.flatMap((c) => c.uids.filter((id) => id !== uid));
    if (otherUids.length === 0) return [];
    const friends = await this.getUsersByUids(otherUids);
    writeCache(`friends:${uid}`, friends);
    return friends;
  },

  // Wallets
  async getOrCreateWallet(uid: string): Promise<Wallet> {
    const cached = readCache<Wallet>(`wallet:${uid}`, CACHE_TTL.wallet);
    if (cached) return cached;

    const existing = await runQuery<DbWallet | null>(
      supabase.from('wallets').select('*').eq('user_uid', uid).maybeSingle(),
      'getOrCreateWallet'
    );

    if (existing) {
      const mapped = mapWalletFromDb(existing);
      writeCache(`wallet:${uid}`, mapped);
      return mapped;
    }

    const created = await runQuery<DbWallet>(
      supabase
        .from('wallets')
        .insert({
          user_uid: uid,
          usd_balance: 0,
          ngn_balance: 0,
          eur_balance: 0,
          updated_at: new Date().toISOString(),
        })
        .select('*')
        .single(),
      'createWallet'
    );

    const mapped = mapWalletFromDb(created);
    writeCache(`wallet:${uid}`, mapped);
    return mapped;
  },

  async listWalletTransactions(uid: string): Promise<WalletTransaction[]> {
    const cacheKey = `wallet:transactions:${uid}`;
    const cached = readCache<WalletTransaction[]>(cacheKey, CACHE_TTL.wallet);
    if (cached) return cached;

    const rows = await runQuery<DbWalletTransaction[]>(
      supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_uid', uid)
        .order('created_at', { ascending: false })
        .limit(100),
      'listWalletTransactions'
    );
    const mapped = rows.map(mapWalletTransactionFromDb);
    writeCache(cacheKey, mapped);
    return mapped;
  },

  subscribeToWallet(uid: string, callback: (wallet: Wallet) => void, onError?: (error: any) => void) {
    const fetcher = async () => this.getOrCreateWallet(uid);
    return subscribeToTable('wallets', fetcher, callback, `user_uid=eq.${uid}`, onError, `wallet:${uid}`);
  },

  subscribeToWalletTransactions(
    uid: string,
    callback: (transactions: WalletTransaction[]) => void,
    onError?: (error: any) => void
  ) {
    const fetcher = async () => this.listWalletTransactions(uid);
    return subscribeToTable(
      'wallet_transactions',
      fetcher,
      callback,
      `user_uid=eq.${uid}`,
      onError,
      `wallet:transactions:${uid}`
    );
  },

  async hasTransactionPin(uid: string): Promise<boolean> {
    const row = await runQuery<Pick<DbWalletSecurity, 'user_uid'> | null>(
      supabase.from('wallet_security').select('user_uid').eq('user_uid', uid).maybeSingle(),
      'hasTransactionPin'
    );
    return !!row;
  },

  async setTransactionPin(uid: string, nextPin: string, currentPin?: string): Promise<void> {
    if (!/^\d{4}$/.test(nextPin)) {
      throw new Error('PIN must be exactly 4 digits.');
    }

    const existing = await runQuery<DbWalletSecurity | null>(
      supabase.from('wallet_security').select('*').eq('user_uid', uid).maybeSingle(),
      'setTransactionPin:existing'
    );

    if (existing) {
      if (!currentPin || !/^\d{4}$/.test(currentPin)) {
        throw new Error('Current PIN is required.');
      }
      const currentHash = await hashSecret(currentPin);
      if (currentHash !== existing.pin_hash) {
        throw new Error('Current PIN is incorrect.');
      }
    }

    const nextHash = await hashSecret(nextPin);
    await runQuery(
      supabase.from('wallet_security').upsert(
        {
          user_uid: uid,
          pin_hash: nextHash,
          updated_at: new Date().toISOString(),
          created_at: existing?.created_at || new Date().toISOString(),
        },
        { onConflict: 'user_uid' }
      ),
      'setTransactionPin:upsert'
    );
  },

  async verifyTransactionPin(uid: string, pin: string): Promise<boolean> {
    if (!/^\d{4}$/.test(pin)) return false;
    const row = await runQuery<DbWalletSecurity | null>(
      supabase.from('wallet_security').select('*').eq('user_uid', uid).maybeSingle(),
      'verifyTransactionPin'
    );
    if (!row) return false;
    const incomingHash = await hashSecret(pin);
    return incomingHash === row.pin_hash;
  },

  async topUpWallet(uid: string, currency: WalletCurrency, amount: number, method: 'card' | 'transfer') {
    const wallet = await this.getOrCreateWallet(uid);
    const nextBalances = {
      usd_balance: wallet.usdBalance + (currency === 'USD' ? amount : 0),
      ngn_balance: wallet.ngnBalance + (currency === 'NGN' ? amount : 0),
      eur_balance: wallet.eurBalance + (currency === 'EUR' ? amount : 0),
    };

    await runQuery(
      supabase
        .from('wallets')
        .update({ ...nextBalances, updated_at: new Date().toISOString() })
        .eq('user_uid', uid),
      'topUpWallet:update'
    );

    await runQuery(
      supabase.from('wallet_transactions').insert({
        user_uid: uid,
        currency,
        type: 'topup',
        method,
        amount,
        status: 'completed',
        created_at: new Date().toISOString(),
      }),
      'topUpWallet:transaction'
    );
  },

  async withdrawFromWallet(uid: string, currency: WalletCurrency, amount: number, method: 'card' | 'transfer') {
    const wallet = await this.getOrCreateWallet(uid);
    const current = currency === 'USD' ? wallet.usdBalance : currency === 'NGN' ? wallet.ngnBalance : wallet.eurBalance;
    if (amount > current) {
      throw new Error('Insufficient balance.');
    }

    const nextBalances = {
      usd_balance: wallet.usdBalance - (currency === 'USD' ? amount : 0),
      ngn_balance: wallet.ngnBalance - (currency === 'NGN' ? amount : 0),
      eur_balance: wallet.eurBalance - (currency === 'EUR' ? amount : 0),
    };

    await runQuery(
      supabase
        .from('wallets')
        .update({ ...nextBalances, updated_at: new Date().toISOString() })
        .eq('user_uid', uid),
      'withdrawWallet:update'
    );

    await runQuery(
      supabase.from('wallet_transactions').insert({
        user_uid: uid,
        currency,
        type: 'withdraw',
        method,
        amount,
        status: 'completed',
        created_at: new Date().toISOString(),
      }),
      'withdrawWallet:transaction'
    );
  },

  async transferByUserId(senderUid: string, recipientIdentifier: string, currency: WalletCurrency, amount: number) {
    const normalizedRecipient = recipientIdentifier.trim();
    if (!normalizedRecipient) {
      throw new Error('Recipient user ID is required.');
    }
    if (senderUid === normalizedRecipient) {
      throw new Error('You cannot transfer funds to yourself.');
    }
    if (amount <= 0) {
      throw new Error('Transfer amount must be greater than zero.');
    }

    const recipientProfile = await this.resolveUserByIdentifier(normalizedRecipient);
    if (!recipientProfile) {
      throw new Error('Recipient user ID was not found.');
    }
    const recipientUid = recipientProfile.uid;
    if (senderUid === recipientUid) {
      throw new Error('You cannot transfer funds to yourself.');
    }

    const [senderWallet, recipientWallet] = await Promise.all([
      this.getOrCreateWallet(senderUid),
      this.getOrCreateWallet(recipientUid),
    ]);

    const senderCurrent =
      currency === 'USD' ? senderWallet.usdBalance : currency === 'NGN' ? senderWallet.ngnBalance : senderWallet.eurBalance;
    if (amount > senderCurrent) {
      throw new Error('Insufficient balance.');
    }

    const senderNextBalances = {
      usd_balance: senderWallet.usdBalance - (currency === 'USD' ? amount : 0),
      ngn_balance: senderWallet.ngnBalance - (currency === 'NGN' ? amount : 0),
      eur_balance: senderWallet.eurBalance - (currency === 'EUR' ? amount : 0),
    };

    const recipientNextBalances = {
      usd_balance: recipientWallet.usdBalance + (currency === 'USD' ? amount : 0),
      ngn_balance: recipientWallet.ngnBalance + (currency === 'NGN' ? amount : 0),
      eur_balance: recipientWallet.eurBalance + (currency === 'EUR' ? amount : 0),
    };

    const timestamp = new Date().toISOString();
    const transferRef = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    await runQuery(
      supabase.from('wallets').update({ ...senderNextBalances, updated_at: timestamp }).eq('user_uid', senderUid),
      'transferWallet:updateSender'
    );

    await runQuery(
      supabase.from('wallets').update({ ...recipientNextBalances, updated_at: timestamp }).eq('user_uid', recipientUid),
      'transferWallet:updateRecipient'
    );

    await runQuery(
      supabase.from('wallet_transactions').insert([
        {
          user_uid: senderUid,
          currency,
          type: 'withdraw',
          method: 'transfer',
          amount,
          status: 'completed',
          reference: `transfer_out:${recipientUid}:${transferRef}`,
          created_at: timestamp,
        },
        {
          user_uid: recipientUid,
          currency,
          type: 'topup',
          method: 'transfer',
          amount,
          status: 'completed',
          reference: `transfer_in:${senderUid}:${transferRef}`,
          created_at: timestamp,
        },
      ]),
      'transferWallet:transactions'
    );
  },

  async transferByUserIdWithPin(
    senderUid: string,
    recipientIdentifier: string,
    currency: WalletCurrency,
    amount: number,
    pin: string
  ) {
    const pinValid = await this.verifyTransactionPin(senderUid, pin);
    if (!pinValid) {
      throw new Error('Invalid transaction PIN.');
    }

    try {
      const { error } = await supabase.rpc('wallet_transfer_with_pin', {
        p_recipient_identifier: recipientIdentifier.trim(),
        p_currency: currency,
        p_amount: amount,
        p_pin: pin,
      });
      if (error) {
        // Fallback for older DB function definitions with digest() issues.
        if ((error.message || '').toLowerCase().includes('digest(')) {
          await this.transferByUserId(senderUid, recipientIdentifier, currency, amount);
          return;
        }
        throw new Error(error.message || 'Transfer failed.');
      }
    } catch (e: any) {
      if ((e?.message || '').toLowerCase().includes('digest(')) {
        await this.transferByUserId(senderUid, recipientIdentifier, currency, amount);
        return;
      }
      throw e;
    }
  },

  // Client Job Management
  subscribeToClientJobs(clientUid: string, callback: (jobs: Job[]) => void) {
    const fetcher = async () => {
      const rows = await runQuery<DbJob[]>(
        supabase
          .from('jobs')
          .select('*')
          .eq('client_uid', clientUid)
          .order('created_at', { ascending: false }),
        'subscribeToClientJobs'
      );
      return rows.map(mapJobFromDb);
    };
    return subscribeToTable('jobs', fetcher, callback, `client_uid=eq.${clientUid}`, undefined, `jobs:client:${clientUid}`);
  },

  async updateJobStatus(jobId: string, status: 'open' | 'closed'): Promise<void> {
    await runQuery(
      supabase.from('jobs').update({ status }).eq('id', jobId),
      'updateJobStatus'
    );
    removeCache(`job:${jobId}`);
    removeCache('jobs:all');
    removeCacheByPrefix('jobs:client:');
    removeCacheByPrefix('gigs:active:');
  },

  async deleteJob(jobId: string): Promise<void> {
    await runQuery(
      supabase.from('jobs').delete().eq('id', jobId),
      'deleteJob'
    );
    removeCache(`job:${jobId}`);
    removeCache('jobs:all');
    removeCacheByPrefix('jobs:client:');
    removeCacheByPrefix('proposals:job:');
    removeCacheByPrefix('gigs:active:');
  },

  // Proposals
  subscribeToJobProposals(jobId: string, callback: (proposals: Proposal[]) => void) {
    const fetcher = async () => {
      const rows = await runQuery<DbProposal[]>(
        supabase
          .from('proposals')
          .select('*')
          .eq('job_id', jobId)
          .order('created_at', { ascending: false }),
        'subscribeToJobProposals'
      );
      return rows.map(mapProposalFromDb);
    };
    return subscribeToTable('proposals', fetcher, callback, `job_id=eq.${jobId}`, undefined, `proposals:job:${jobId}`);
  },

  async createProposal(proposal: Omit<Proposal, 'id' | 'createdAt' | 'status'>): Promise<void> {
    await runQuery(
      supabase.from('proposals').insert({
        freelancer_uid: proposal.freelancerUid,
        job_id: proposal.jobId,
        content: proposal.content,
        budget: proposal.budget,
        status: 'pending',
        created_at: new Date().toISOString(),
      }),
      'createProposal'
    );
    removeCache('jobs:all');
    removeCacheByPrefix('proposals:job:');
    removeCacheByPrefix('gigs:active:');
    removeCacheByPrefix('users:performance:');
  },

  async updateProposalStatus(proposalId: string, status: 'pending' | 'accepted' | 'rejected') {
    const proposal = await runQuery<DbProposal | null>(
      supabase.from('proposals').select('*').eq('id', proposalId).maybeSingle(),
      'updateProposalStatus:lookup'
    );
    if (!proposal) {
      throw new Error('Proposal not found.');
    }

    await runQuery(
      supabase.from('proposals').update({ status }).eq('id', proposalId),
      'updateProposalStatus'
    );

    if (status === 'accepted') {
      await runQuery(
        supabase
          .from('proposals')
          .update({ status: 'rejected' })
          .eq('job_id', proposal.job_id)
          .neq('id', proposalId)
          .in('status', ['pending', 'accepted']),
        'updateProposalStatus:rejectOthers'
      );
      await runQuery(
        supabase.from('jobs').update({ status: 'closed' }).eq('id', proposal.job_id),
        'updateProposalStatus:closeJob'
      );
    } else {
      const acceptedRemaining = await runQuery<Array<Pick<DbProposal, 'id'>>>(
        supabase.from('proposals').select('id').eq('job_id', proposal.job_id).eq('status', 'accepted').limit(1),
        'updateProposalStatus:acceptedRemaining'
      );

      if (acceptedRemaining.length === 0) {
        await runQuery(
          supabase.from('jobs').update({ status: 'open' }).eq('id', proposal.job_id),
          'updateProposalStatus:reopenJob'
        );
      }
    }

    removeCache(`job:${proposal.job_id}`);
    removeCache('jobs:all');
    removeCacheByPrefix('jobs:client:');
    removeCache(`proposals:job:${proposal.job_id}`);
    removeCacheByPrefix('gigs:active:');
    removeCacheByPrefix('users:performance:');
  },

  async hasAppliedToJob(jobId: string, freelancerUid: string): Promise<boolean> {
    const row = await runQuery<DbProposal | null>(
      supabase
        .from('proposals')
        .select('*')
        .eq('job_id', jobId)
        .eq('freelancer_uid', freelancerUid)
        .maybeSingle(),
      'hasAppliedToJob'
    );
    return !!row;
  },

  async getNotificationLastReadAt(uid: string): Promise<string | null> {
    if (notificationReadAtCache?.uid === uid) {
      return notificationReadAtCache.value;
    }

    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.error('Supabase error (getNotificationLastReadAt):', error);
      return null;
    }

    const authUid = data.user?.id;
    const metadataValue =
      authUid === uid && typeof data.user?.user_metadata?.notifications_last_read_at === 'string'
        ? data.user.user_metadata.notifications_last_read_at
        : null;

    notificationReadAtCache = { uid, value: metadataValue };
    return metadataValue;
  },

  async markNotificationsReadThrough(uid: string, readAt: string = new Date().toISOString()): Promise<void> {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.error('Supabase error (markNotificationsReadThrough:getUser):', error);
      throw error;
    }
    if (!data.user || data.user.id !== uid) {
      throw new Error('Unable to update notification read state for this account.');
    }

    const existingMetadata = data.user.user_metadata || {};
    const existingReadAt =
      typeof existingMetadata.notifications_last_read_at === 'string'
        ? existingMetadata.notifications_last_read_at
        : null;
    const nextReadAt =
      existingReadAt && new Date(existingReadAt).getTime() > new Date(readAt).getTime()
        ? existingReadAt
        : readAt;

    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        ...existingMetadata,
        notifications_last_read_at: nextReadAt,
      },
    });
    if (updateError) {
      console.error('Supabase error (markNotificationsReadThrough:updateUser):', updateError);
      throw updateError;
    }

    notificationReadAtCache = { uid, value: nextReadAt };
    removeCache(`notifications:${uid}`);
  },

  async getFreelancerActiveGigs(freelancerUid: string): Promise<ActiveGig[]> {
    const cacheKey = `gigs:active:freelancer:${freelancerUid}`;
    const cached = readCache<ActiveGig[]>(cacheKey, CACHE_TTL.jobs);
    if (cached) return cached;

    const proposalRows = await runQuery<DbProposal[]>(
      supabase
        .from('proposals')
        .select('*')
        .eq('freelancer_uid', freelancerUid)
        .eq('status', 'accepted')
        .order('created_at', { ascending: false }),
      'getFreelancerActiveGigs:proposals'
    );

    if (proposalRows.length === 0) {
      writeCache(cacheKey, []);
      return [];
    }

    const jobIds = Array.from(new Set(proposalRows.map((proposal) => proposal.job_id)));
    const jobRows = await runQuery<DbJob[]>(
      supabase.from('jobs').select('*').in('id', jobIds),
      'getFreelancerActiveGigs:jobs'
    );
    const jobsById = new Map(jobRows.map((row) => [row.id, mapJobFromDb(row)]));
    const clientUids = Array.from(new Set(jobRows.map((row) => row.client_uid)));
    const clients = clientUids.length > 0 ? await this.getUsersByUids(clientUids) : [];
    const clientByUid: Record<string, UserProfile> = {};
    clients.forEach((client) => {
      clientByUid[client.uid] = client;
    });

    const activeGigs: ActiveGig[] = proposalRows
      .map((proposalRow) => {
        const job = jobsById.get(proposalRow.job_id);
        if (!job) return null;
        return {
          job,
          proposal: mapProposalFromDb(proposalRow),
          client: clientByUid[job.clientUid],
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    writeCache(cacheKey, activeGigs);
    return activeGigs;
  },

  subscribeToFreelancerActiveGigs(freelancerUid: string, callback: (gigs: ActiveGig[]) => void, onError?: (error: any) => void) {
    const cacheKey = `gigs:active:freelancer:${freelancerUid}`;
    const cached = readCacheAnyAge<ActiveGig[]>(cacheKey);
    if (cached) callback(cached);

    let active = true;
    let fetchVersion = 0;

    const refresh = () => {
      const currentVersion = ++fetchVersion;
      this.getFreelancerActiveGigs(freelancerUid)
        .then((gigs) => {
          writeCache(cacheKey, gigs);
          if (active && currentVersion === fetchVersion) callback(gigs);
        })
        .catch((error) => {
          console.error('Supabase fetch error (subscribeToFreelancerActiveGigs):', error);
          onError?.(error);
        });
    };

    refresh();

    const proposalsChannel = supabase
      .channel(`realtime:gigs:active:freelancer:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'proposals', filter: `freelancer_uid=eq.${freelancerUid}` }, refresh)
      .subscribe();

    const jobsChannel = supabase
      .channel(`realtime:gigs:jobs:freelancer:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, refresh)
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(proposalsChannel);
      supabase.removeChannel(jobsChannel);
    };
  },

  async getClientActiveGigs(clientUid: string): Promise<ActiveGig[]> {
    const cacheKey = `gigs:active:client:${clientUid}`;
    const cached = readCache<ActiveGig[]>(cacheKey, CACHE_TTL.jobs);
    if (cached) return cached;

    const jobRows = await runQuery<DbJob[]>(
      supabase
        .from('jobs')
        .select('*')
        .eq('client_uid', clientUid)
        .order('created_at', { ascending: false }),
      'getClientActiveGigs:jobs'
    );

    if (jobRows.length === 0) {
      writeCache(cacheKey, []);
      return [];
    }

    const jobIds = jobRows.map((job) => job.id);
    const acceptedProposalRows = await runQuery<DbProposal[]>(
      supabase
        .from('proposals')
        .select('*')
        .eq('status', 'accepted')
        .in('job_id', jobIds)
        .order('created_at', { ascending: false }),
      'getClientActiveGigs:proposals'
    );

    if (acceptedProposalRows.length === 0) {
      writeCache(cacheKey, []);
      return [];
    }

    const jobsById = new Map(jobRows.map((row) => [row.id, mapJobFromDb(row)]));
    const freelancerUids = Array.from(new Set(acceptedProposalRows.map((proposal) => proposal.freelancer_uid)));
    const freelancers = freelancerUids.length > 0 ? await this.getUsersByUids(freelancerUids) : [];
    const freelancerByUid: Record<string, UserProfile> = {};
    freelancers.forEach((freelancer) => {
      freelancerByUid[freelancer.uid] = freelancer;
    });

    const activeGigs: ActiveGig[] = acceptedProposalRows
      .map((proposalRow) => {
        const job = jobsById.get(proposalRow.job_id);
        if (!job) return null;
        return {
          job,
          proposal: mapProposalFromDb(proposalRow),
          freelancer: freelancerByUid[proposalRow.freelancer_uid],
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    writeCache(cacheKey, activeGigs);
    return activeGigs;
  },

  subscribeToClientActiveGigs(clientUid: string, callback: (gigs: ActiveGig[]) => void, onError?: (error: any) => void) {
    const cacheKey = `gigs:active:client:${clientUid}`;
    const cached = readCacheAnyAge<ActiveGig[]>(cacheKey);
    if (cached) callback(cached);

    let active = true;
    let fetchVersion = 0;

    const refresh = () => {
      const currentVersion = ++fetchVersion;
      this.getClientActiveGigs(clientUid)
        .then((gigs) => {
          writeCache(cacheKey, gigs);
          if (active && currentVersion === fetchVersion) callback(gigs);
        })
        .catch((error) => {
          console.error('Supabase fetch error (subscribeToClientActiveGigs):', error);
          onError?.(error);
        });
    };

    refresh();

    const jobsChannel = supabase
      .channel(`realtime:gigs:client:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs', filter: `client_uid=eq.${clientUid}` }, refresh)
      .subscribe();

    const proposalsChannel = supabase
      .channel(`realtime:gigs:client-proposals:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'proposals' }, refresh)
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(jobsChannel);
      supabase.removeChannel(proposalsChannel);
    };
  },

  async getNotifications(uid: string): Promise<AppNotification[]> {
    const cacheKey = `notifications:${uid}`;
    const cached = readCache<AppNotification[]>(cacheKey, CACHE_TTL.notifications);
    if (cached) return cached;

    const settings = this.getNotificationSettings(uid);
    const readThrough = await this.getNotificationLastReadAt(uid);
    const readThroughTime = readThrough ? new Date(readThrough).getTime() : 0;

    const [incomingRequests, proposals, myJobs, walletTransactions, feedLikes, feedComments] = await Promise.all([
      runQuery<DbFriendRequest[]>(
        supabase.from('friend_requests').select('*').eq('to_uid', uid).order('created_at', { ascending: false }).limit(20),
        'notifications:friendRequests'
      ),
      runQuery<DbProposal[]>(
        supabase.from('proposals').select('*').order('created_at', { ascending: false }).limit(30),
        'notifications:proposals'
      ),
      runQuery<DbJob[]>(
        supabase.from('jobs').select('*').eq('client_uid', uid),
        'notifications:myJobs'
      ),
      runQuery<DbWalletTransaction[]>(
        supabase
          .from('wallet_transactions')
          .select('*')
          .eq('user_uid', uid)
          .order('created_at', { ascending: false })
          .limit(20),
        'notifications:walletTransactions'
      ),
      settings.feed
        ? runQuery<DbPostLikeNotificationRow[]>(
            supabase
              .from('post_likes')
              .select('id,post_id,user_uid,created_at,posts!inner(author_uid)')
              .eq('posts.author_uid', uid)
              .neq('user_uid', uid)
              .order('created_at', { ascending: false })
              .limit(20),
            'notifications:feedLikes'
          )
        : Promise.resolve([]),
      settings.feed
        ? runQuery<DbPostCommentNotificationRow[]>(
            supabase
              .from('post_comments')
              .select('id,post_id,user_uid,author_name,content,created_at,posts!inner(author_uid)')
              .eq('posts.author_uid', uid)
              .neq('user_uid', uid)
              .order('created_at', { ascending: false })
              .limit(20),
            'notifications:feedComments'
          )
        : Promise.resolve([]),
    ]);

    const myJobIds = new Set(myJobs.map((j) => j.id));
    const gigNotifications = settings.gigs
      ? proposals
      .filter((p) => myJobIds.has(p.job_id))
      .slice(0, 20)
      .map<AppNotification>((p) => ({
        id: `proposal-${p.id}`,
        type: 'gig',
        title: 'New job application received',
        body: p.content.slice(0, 110),
        createdAt: p.created_at,
        link: '/manage-gigs',
      }))
      : [];

    const requestNotifications = settings.friendRequests
      ? incomingRequests.slice(0, 20).map<AppNotification>((r) => ({
          id: `friend-${r.id}`,
          type: 'friend_request',
          title: `${r.from_name} sent you a request`,
          body: r.status === 'pending' ? 'Tap to review connection request.' : `Request ${r.status}.`,
          createdAt: r.created_at,
          link: '/requests',
        }))
      : [];

    const walletNotifications = settings.wallet
      ? walletTransactions.map<AppNotification>((tx) => {
          const isTransferOut = tx.reference?.startsWith('transfer_out:');
          const isTransferIn = tx.reference?.startsWith('transfer_in:');
          const counterpartyUid = tx.reference?.split(':')[1];
          const title = isTransferIn
            ? 'Funds received'
            : isTransferOut
            ? 'Transfer sent'
            : tx.type === 'topup'
            ? 'Wallet funded'
            : 'Withdrawal completed';
          const body = isTransferIn || isTransferOut
            ? `${tx.amount} ${tx.currency} ${isTransferIn ? 'from' : 'to'} user ${counterpartyUid || ''}`.trim()
            : `${tx.amount} ${tx.currency} via ${tx.method}`;
          return {
            id: `wallet-${tx.id}`,
            type: 'wallet',
            title,
            body,
            createdAt: tx.created_at,
            link: '/wallets',
          };
        })
      : [];

    const feedLikeNotifications = feedLikes.map<AppNotification>((like) => ({
      id: `feed-like-${like.id}`,
      type: 'feed',
      title: 'New like on your post',
      body: 'Someone liked your post.',
      createdAt: like.created_at,
      link: `/comments/${like.post_id}`,
    }));

    const feedCommentNotifications = feedComments.map<AppNotification>((comment) => ({
      id: `feed-comment-${comment.id}`,
      type: 'feed',
      title: 'New comment on your post',
      body: `${comment.author_name}: ${comment.content.slice(0, 90)}`,
      createdAt: comment.created_at,
      link: `/comments/${comment.post_id}`,
    }));

    const mapped = [
      ...requestNotifications,
      ...gigNotifications,
      ...walletNotifications,
      ...feedLikeNotifications,
      ...feedCommentNotifications,
    ].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ).map((item) => ({
      ...item,
      read: readThroughTime > 0 && new Date(item.createdAt).getTime() <= readThroughTime,
    }));
    writeCache(cacheKey, mapped);
    return mapped;
  },

  subscribeToNotifications(uid: string, callback: (items: AppNotification[]) => void, onError?: (error: any) => void) {
    let active = true;

    const refresh = async () => {
      try {
        const items = await this.getNotifications(uid);
        if (active) callback(items);
      } catch (error) {
        if (onError) onError(error);
      }
    };

    refresh();

    const channels = [
      supabase.channel(`realtime:friend_requests:${uid}`).on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'friend_requests' },
        refresh
      ),
      supabase.channel(`realtime:proposals:${uid}`).on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'proposals' },
        refresh
      ),
      supabase.channel(`realtime:jobs:${uid}`).on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jobs' },
        refresh
      ),
      supabase.channel(`realtime:wallet_transactions:${uid}`).on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wallet_transactions', filter: `user_uid=eq.${uid}` },
        refresh
      ),
      supabase.channel(`realtime:post_likes:${uid}`).on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'post_likes' },
        refresh
      ),
      supabase.channel(`realtime:post_comments:${uid}`).on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'post_comments' },
        refresh
      ),
    ];

    channels.forEach((channel) => channel.subscribe());
    const interval = setInterval(refresh, 30000);

    return () => {
      active = false;
      clearInterval(interval);
      channels.forEach((channel) => supabase.removeChannel(channel));
    };
  },
};
