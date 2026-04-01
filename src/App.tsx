import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { supabaseService } from './services/supabaseService';
import { UserProfile } from './types';
import { getCartoonAvatar } from './utils/avatar';
import { Mail, Lock, User as UserIcon, LogIn, UserPlus, Link2, Eye, EyeOff } from 'lucide-react';

// Components
import Layout from './components/Layout';
import Onboarding from './components/Onboarding';
import Feed from './components/Feed';
import JobBoard from './components/JobBoard';
import Profile from './components/Profile';
import Network from './components/Network';
import Chat from './components/Chat';
import Settings from './components/Settings';
import FriendRequests from './components/FriendRequests';
import ManageGigs from './components/ManageGigs';
import Wallets from './components/Wallets';
import ProcessTransfer from './components/ProcessTransfer';
import ProcessTransferDetails from './components/ProcessTransferDetails';
import JobDetails from './components/JobDetails';
import JobApply from './components/JobApply';
import Notifications from './components/Notifications';
import Comments from './components/Comments';
import Market from './components/Market';
import SellItem from './components/SellItem';
import MarketItemDetails from './components/MarketItemDetails';
import EditMarketItem from './components/EditMarketItem';
import EditPost from './components/EditPost';
import PartnershipPage from './components/PartnershipPage';
import ActiveGigs from './components/ActiveGigs';

export default function App() {
  const ONBOARDING_KEY = 'connect_onboarding_uid';
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    const createDefaultProfile = async (sessionUser: User): Promise<UserProfile> => {
      const defaultProfile: UserProfile = {
        uid: sessionUser.id,
        publicId: `SL-${sessionUser.id.replace(/-/g, '').slice(0, 10).toUpperCase()}`,
        email: sessionUser.email || '',
        displayName: sessionUser.user_metadata?.full_name || sessionUser.user_metadata?.name || 'Anonymous',
        photoURL:
          sessionUser.user_metadata?.avatar_url ||
          getCartoonAvatar(sessionUser.user_metadata?.full_name || sessionUser.id),
        role: 'freelancer',
        bio: '',
        skills: [],
        education: {
          university: '',
          degree: '',
          verified: false,
        },
        portfolio: [],
        companyInfo: {
          name: '',
          about: '',
        },
      };
      await supabaseService.createUserProfile(defaultProfile);
      return defaultProfile;
    };

    const loadProfile = async (sessionUser: User | null) => {
      if (!active) return;
      setUser(sessionUser);
      if (sessionUser) {
        try {
          const userProfile = await supabaseService.getUserProfile(sessionUser.id);
          if (userProfile) {
            setProfile(userProfile);
            setShowOnboarding(false);
          } else {
            const pendingOnboardingUid = localStorage.getItem(ONBOARDING_KEY);
            if (pendingOnboardingUid === sessionUser.id) {
              setShowOnboarding(true);
              setProfile(null);
            } else {
              // For login/no-profile cases, create profile directly without showing onboarding.
              const quickProfile = await createDefaultProfile(sessionUser);
              setProfile(quickProfile);
              setShowOnboarding(false);
            }
          }
        } catch (err) {
          console.error('Error fetching profile:', err);
        }
      } else {
        setProfile(null);
        setShowOnboarding(false);
      }
      setLoading(false);
    };

    supabase.auth.getSession().then(({ data }) => {
      loadProfile(data.session?.user ?? null);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      loadProfile(session?.user ?? null);
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = supabaseService.subscribeToUserProfile(user.id, (nextProfile) => {
      if (!nextProfile) return;
      setProfile(nextProfile);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) {
      supabaseService.stopPresenceTracking();
      return;
    }
    const stopPresence = supabaseService.startPresenceTracking(user.id);
    return () => stopPresence();
  }, [user]);

  const handleGoogleLogin = async () => {
    try {
      setAuthSubmitting(true);
      setError('');
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (error) {
        setError(error.message);
      }
    } catch (error: any) {
      console.error('Login error:', error);
      setError(error.message || 'Login failed. Please try again.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setAuthSubmitting(true);
    try {
      if (authMode === 'register') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: displayName,
            },
          },
        });
        if (error) throw error;
        if (data.user) {
          localStorage.setItem(ONBOARDING_KEY, data.user.id);
        }
        if (!data.session) {
          setError('Check your email to confirm your account before signing in.');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      setError(error.message);
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogout = async () => {
    supabaseService.stopPresenceTracking();
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <Router>
      {!user ? (
        <Routes>
          <Route
            path="/partner-with-connect"
            element={<PartnershipPage onBack={() => window.history.length > 1 ? window.history.back() : undefined} />}
          />
          <Route
            path="*"
            element={
              <AuthScreen
                authMode={authMode}
                setAuthMode={setAuthMode}
                email={email}
                setEmail={setEmail}
                password={password}
                setPassword={setPassword}
                displayName={displayName}
                setDisplayName={setDisplayName}
                error={error}
                showPassword={showPassword}
                setShowPassword={setShowPassword}
                authSubmitting={authSubmitting}
                onEmailAuth={handleEmailAuth}
                onGoogleLogin={handleGoogleLogin}
              />
            }
          />
        </Routes>
      ) : !profile ? (
        showOnboarding ? (
          <Onboarding
            user={user}
            onComplete={(nextProfile) => {
              localStorage.removeItem(ONBOARDING_KEY);
              setShowOnboarding(false);
              setProfile(nextProfile);
            }}
          />
        ) : (
          <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
          </div>
        )
      ) : (
        <Layout user={user} profile={profile} onLogout={handleLogout}>
          <Routes>
            <Route path="/" element={<Feed profile={profile} />} />
            <Route path="/jobs" element={<JobBoard profile={profile} />} />
            <Route path="/jobs/:jobId" element={<JobDetails profile={profile} />} />
            <Route path="/jobs/:jobId/apply" element={<JobApply profile={profile} />} />
            <Route path="/market" element={<Market profile={profile} />} />
            <Route path="/market/sell" element={<SellItem profile={profile} />} />
            <Route path="/market/:itemId" element={<MarketItemDetails profile={profile} />} />
            <Route path="/market/:itemId/edit" element={<EditMarketItem profile={profile} />} />
            <Route path="/network" element={<Network profile={profile} />} />
            <Route path="/requests" element={<FriendRequests profile={profile} />} />
            <Route path="/manage-gigs" element={<ManageGigs profile={profile} />} />
            <Route path="/notifications" element={<Notifications profile={profile} />} />
            <Route path="/profile/:uid" element={<Profile profile={profile} />} />
            <Route path="/messages" element={<Chat profile={profile} />} />
            <Route path="/wallets" element={<Wallets profile={profile} />} />
            <Route path="/wallets/transfer" element={<ProcessTransfer profile={profile} />} />
            <Route path="/wallets/transfer/details" element={<ProcessTransferDetails profile={profile} />} />
            <Route path="/comments/:postId" element={<Comments profile={profile} />} />
            <Route path="/posts/:postId/edit" element={<EditPost profile={profile} />} />
            <Route path="/active-gigs" element={<ActiveGigs profile={profile} />} />
            <Route path="/settings" element={<Settings profile={profile} onLogout={handleLogout} onProfileUpdate={setProfile} />} />
            <Route path="/partner-with-connect" element={<PartnershipPage profile={profile} />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Layout>
      )}
    </Router>
  );
}

interface AuthScreenProps {
  authMode: 'login' | 'register';
  setAuthMode: React.Dispatch<React.SetStateAction<'login' | 'register'>>;
  email: string;
  setEmail: React.Dispatch<React.SetStateAction<string>>;
  password: string;
  setPassword: React.Dispatch<React.SetStateAction<string>>;
  displayName: string;
  setDisplayName: React.Dispatch<React.SetStateAction<string>>;
  error: string;
  showPassword: boolean;
  setShowPassword: React.Dispatch<React.SetStateAction<boolean>>;
  authSubmitting: boolean;
  onEmailAuth: (e: React.FormEvent) => Promise<void>;
  onGoogleLogin: () => Promise<void>;
}

function AuthScreen({
  authMode,
  setAuthMode,
  email,
  setEmail,
  password,
  setPassword,
  displayName,
  setDisplayName,
  error,
  showPassword,
  setShowPassword,
  authSubmitting,
  onEmailAuth,
  onGoogleLogin,
}: AuthScreenProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 text-teal-700 mb-2">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-teal-600 text-white">
              <Link2 size={18} />
            </span>
            <h1 className="text-3xl font-bold">Connect</h1>
          </div>
          <p className="text-gray-600">The professional network for students and freelancers.</p>
        </div>

        <form onSubmit={onEmailAuth} className="space-y-4 mb-6">
          {authMode === 'register' && (
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Full Name"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 focus:bg-white focus:ring-2 focus:ring-teal-500 rounded-xl text-base transition-all"
              />
            </div>
          )}
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="email"
              placeholder="Email Address"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 focus:bg-white focus:ring-2 focus:ring-teal-500 rounded-xl text-base transition-all"
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-12 py-3 bg-gray-50 border border-gray-200 focus:bg-white focus:ring-2 focus:ring-teal-500 rounded-xl text-base transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {error && <p className="text-red-500 text-xs mt-2">{error}</p>}

          <button
            type="submit"
            disabled={authSubmitting}
            className="w-full bg-teal-700 text-white font-bold py-3 px-4 rounded-xl hover:bg-teal-800 transition-all flex items-center justify-center gap-2"
          >
            {authMode === 'login' ? <LogIn size={18} /> : <UserPlus size={18} />}
            {authSubmitting ? (authMode === 'login' ? 'Signing In...' : 'Creating Account...') : (authMode === 'login' ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
          <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-gray-500">Or continue with</span></div>
        </div>

        <button
          onClick={onGoogleLogin}
          disabled={authSubmitting}
          className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 text-gray-700 font-semibold py-3 px-4 rounded-xl hover:bg-gray-50 transition-colors shadow-sm mb-6"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
          Google
        </button>

        <p className="text-center text-sm text-gray-600">
          {authMode === 'login' ? "Don't have an account?" : "Already have an account?"}{' '}
          <button
            onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
            className="text-teal-700 font-bold hover:underline"
          >
            {authMode === 'login' ? 'Register' : 'Sign In'}
          </button>
        </p>
        <button
          type="button"
          onClick={() => navigate('/partner-with-connect')}
          className="mt-5 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-700 hover:bg-white hover:border-teal-200"
        >
          Partner With Us
        </button>
        <p className="mt-3 text-center text-xs text-gray-500">
          Companies can also open the dedicated <Link to="/partner-with-connect" className="font-bold text-teal-700 hover:underline">partnership page</Link>.
        </p>
      </div>
    </div>
  );
}
