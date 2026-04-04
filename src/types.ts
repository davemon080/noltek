export type UserRole = 'freelancer' | 'client';

export interface UserProfile {
  uid: string;
  publicId?: string;
  email: string;
  displayName: string;
  photoURL: string;
  coverPhotoURL?: string;
  role: UserRole;
  bio?: string;
  phoneNumber?: string;
  status?: string;
  location?: string;
  dateOfBirth?: string;
  skills?: string[];
  education?: {
    university: string;
    degree: string;
    year?: string;
    verified: boolean;
  };
  experience?: {
    title: string;
    company: string;
    type: string;
    period: string;
    description: string;
  }[];
  socialLinks?: {
    linkedin?: string;
    github?: string;
    twitter?: string;
    website?: string;
  };
  portfolio?: {
    title: string;
    imageUrl: string;
    link: string;
  }[];
  companyInfo?: {
    name: string;
    about: string;
  };
}

export interface Post {
  id: string;
  authorUid: string;
  authorName: string;
  authorPhoto: string;
  content: string;
  imageUrl?: string;
  type: 'social' | 'job';
  createdAt: string;
}

export interface Job {
  id: string;
  clientUid: string;
  title: string;
  description: string;
  budget: number;
  category: string;
  isStudentFriendly: boolean;
  isRemote: boolean;
  status: 'open' | 'closed';
  createdAt: string;
}

export interface CompanyPartnerRequest {
  id: string;
  userUid: string;
  companyName: string;
  companyLogoUrl: string;
  websiteUrl?: string;
  socialLinks: string[];
  about: string;
  location: string;
  registrationUrls: string[];
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface MarketItem {
  id: string;
  sellerUid: string;
  title: string;
  category: string;
  description?: string;
  price: number;
  priceCurrency: WalletCurrency;
  isNegotiable: boolean;
  isAnonymous: boolean;
  stockQuantity: number;
  imageUrls: string[];
  createdAt: string;
  seller?: UserProfile;
}

export interface MarketSettings {
  userUid: string;
  phoneNumber: string;
  location: string;
  brandName: string;
  isRegistered: boolean;
  registeredAt?: string;
  showPhoneNumber: boolean;
  showLocation: boolean;
  showBrandName: boolean;
}

export interface MarketSellerRating {
  id: string;
  sellerUid: string;
  userUid: string;
  rating: number;
  createdAt: string;
}

export interface Attachment {
  name: string;
  url: string;
  type: string;
  size: number;
}

export interface Message {
  id: string;
  senderUid: string;
  receiverUid: string;
  content: string;
  createdAt: string;
  readAt?: string;
  attachments?: Attachment[];
  isDeleted?: boolean;
}

export interface Proposal {
  id: string;
  freelancerUid: string;
  jobId: string;
  content: string;
  budget: number;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface ActiveGig {
  job: Job;
  proposal: Proposal;
  client?: UserProfile;
  freelancer?: UserProfile;
}

export interface FriendRequest {
  id: string;
  fromUid: string;
  fromName: string;
  fromPhoto: string;
  toUid: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface Connection {
  id: string;
  uids: string[];
  createdAt: string;
}

export type WalletCurrency = 'USD' | 'NGN' | 'EUR';

export interface Wallet {
  id: string;
  userUid: string;
  usdBalance: number;
  ngnBalance: number;
  eurBalance: number;
  updatedAt: string;
}

export interface WalletTransaction {
  id: string;
  userUid: string;
  currency: WalletCurrency;
  type: 'topup' | 'withdraw';
  method: 'card' | 'transfer';
  amount: number;
  status: 'completed' | 'pending' | 'failed';
  createdAt: string;
  reference?: string;
}

export interface AppNotification {
  id: string;
  type: 'message' | 'friend_request' | 'application' | 'job' | 'system' | 'wallet' | 'feed' | 'gig';
  title: string;
  body: string;
  createdAt: string;
  read?: boolean;
  link?: string;
}

export interface NotificationSettings {
  wallet: boolean;
  gigs: boolean;
  feed: boolean;
  friendRequests: boolean;
}

export type AppLanguage = 'en-US' | 'en-GB' | 'fr-FR';

export type AppearanceMode = 'light' | 'dark' | 'system';

export interface ConnectedDevice {
  id: string;
  label: string;
  platform: string;
  lastActiveAt: string;
  current: boolean;
}

export interface AppPreferences {
  language: AppLanguage;
  appearance: AppearanceMode;
  connectedDevices: ConnectedDevice[];
}

export interface UserPerformanceSummary {
  gigsCompleted: number;
  ratingAverage: number;
  ratingCount: number;
}

export interface PostLike {
  id: string;
  postId: string;
  userUid: string;
  createdAt: string;
}

export interface PostComment {
  id: string;
  postId: string;
  userUid: string;
  authorName: string;
  authorPhoto: string;
  content: string;
  createdAt: string;
  parentCommentId?: string;
}

export interface PostCommentLike {
  id: string;
  commentId: string;
  userUid: string;
  createdAt: string;
}
