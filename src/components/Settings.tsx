import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { NotificationSettings, UserProfile } from '../types';
import { supabaseService } from '../services/supabaseService';
import { supabase } from '../supabase';
import {
  User, 
  Lock, 
  Bell, 
  Shield, 
  LogOut, 
  ChevronRight, 
  Camera, 
  Check, 
  AlertCircle,
  Globe,
  Moon,
  Smartphone,
  Wallet,
  Copy,
  Store,
  ShieldCheck,
  CheckCircle2,
  LifeBuoy,
  Mail,
  MessageSquareWarning,
  BriefcaseBusiness
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import CachedImage from './CachedImage';
import { useConfirmDialog } from './ConfirmDialog';

interface SettingsProps {
  profile: UserProfile;
  onLogout: () => void;
  onProfileUpdate: (profile: UserProfile) => void;
}

export default function Settings({ profile, onLogout, onProfileUpdate }: SettingsProps) {
  const [searchParams] = useSearchParams();
  const [activeSection, setActiveSection] = useState<'main' | 'profile' | 'security' | 'notifications' | 'market' | 'support'>('main');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Profile Form State
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio || '');
  const [photoURL, setPhotoURL] = useState(profile.photoURL);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Security Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    wallet: true,
    gigs: true,
    feed: true,
    friendRequests: true,
  });
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [marketPhone, setMarketPhone] = useState(profile.phoneNumber || '');
  const [marketLocation, setMarketLocation] = useState(profile.location || '');
  const [marketBrandName, setMarketBrandName] = useState(profile.companyInfo?.name || '');
  const [marketRegistered, setMarketRegistered] = useState(false);
  const [marketRegisteredAt, setMarketRegisteredAt] = useState<string | undefined>(undefined);
  const [showPhoneNumber, setShowPhoneNumber] = useState(false);
  const [showLocation, setShowLocation] = useState(false);
  const [showBrandName, setShowBrandName] = useState(true);
  const [savingMarket, setSavingMarket] = useState(false);
  const [registeringMarket, setRegisteringMarket] = useState(false);
  const [showPinPad, setShowPinPad] = useState(false);
  const [marketPin, setMarketPin] = useState('');
  const [marketSuccess, setMarketSuccess] = useState<string | null>(null);
  const { confirm, confirmDialog } = useConfirmDialog();

  React.useEffect(() => {
    setNotificationSettings(supabaseService.getNotificationSettings(profile.uid));
  }, [profile.uid]);

  React.useEffect(() => {
    supabaseService.getMarketSettings(profile.uid).then((settings) => {
      setMarketPhone(settings.phoneNumber || profile.phoneNumber || '');
      setMarketLocation(settings.location || profile.location || '');
      setMarketBrandName(settings.brandName || profile.companyInfo?.name || '');
      setMarketRegistered(settings.isRegistered);
      setMarketRegisteredAt(settings.registeredAt);
      setShowPhoneNumber(settings.showPhoneNumber);
      setShowLocation(settings.showLocation);
      setShowBrandName(settings.showBrandName);
    });
  }, [profile.companyInfo?.name, profile.location, profile.phoneNumber, profile.uid]);

  React.useEffect(() => {
    const requestedSection = searchParams.get('section');
    if (requestedSection === 'market') {
      setActiveSection('market');
    } else if (requestedSection === 'support') {
      setActiveSection('support');
    }
  }, [searchParams]);

  const handleUpdateProfile = async () => {
    setLoading(true);
    setMessage(null);
    try {
      await supabase.auth.updateUser({
        data: {
          full_name: displayName,
          avatar_url: photoURL,
        },
      });
      const updatedProfile = { ...profile, displayName, bio, photoURL };
      await supabaseService.updateUserProfile(profile.uid, { displayName, bio, photoURL });
      onProfileUpdate(updatedProfile);
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      setTimeout(() => setActiveSection('main'), 1500);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: currentPassword,
      });
      if (reauthError) throw reauthError;

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;

      setMessage({ type: 'success', text: 'Password changed successfully!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setActiveSection('main'), 1500);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (file: File) => {
    setUploadingPhoto(true);
    try {
      const url = await supabaseService.uploadUserAsset(file, 'profile/avatar');
      setPhotoURL(url);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveNotificationSettings = () => {
    setSavingNotifications(true);
    setMessage(null);
    try {
      supabaseService.updateNotificationSettings(profile.uid, notificationSettings);
      setMessage({ type: 'success', text: 'Notification preferences updated.' });
      setTimeout(() => setActiveSection('main'), 1000);
    } finally {
      setSavingNotifications(false);
    }
  };

  const handleCopyUserId = async () => {
    const value = profile.publicId || profile.uid;
    await navigator.clipboard.writeText(value);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 1200);
  };

  const handleSaveMarketSettings = async () => {
    setSavingMarket(true);
    setMessage(null);
    try {
      const updated = await supabaseService.updateMarketSettings(profile.uid, {
        phoneNumber: marketPhone.trim(),
        location: marketLocation.trim(),
        brandName: marketBrandName.trim(),
        showPhoneNumber,
        showLocation,
        showBrandName,
      });
      setMarketRegistered(updated.isRegistered);
      setMarketRegisteredAt(updated.registeredAt);
      onProfileUpdate({
        ...profile,
        phoneNumber: updated.phoneNumber,
        location: updated.location,
        companyInfo: {
          name: updated.brandName,
          about: profile.companyInfo?.about || '',
        },
      });
      setMessage({ type: 'success', text: 'Market settings updated.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to save market settings.' });
    } finally {
      setSavingMarket(false);
    }
  };

  const handleRegisterMarketplace = async () => {
    const confirmed = await confirm({
      title: 'Register for the marketplace?',
      description: 'A one-time N500 fee will be charged from your NGN wallet balance.',
      confirmLabel: 'Pay N500',
    });
    if (!confirmed) return;
    setMarketPin('');
    setShowPinPad(true);
  };

  const submitMarketplaceRegistration = async () => {
    if (!/^\d{4}$/.test(marketPin)) {
      setMessage({ type: 'error', text: 'Enter your 4-digit wallet PIN.' });
      return;
    }

    setRegisteringMarket(true);
    setMessage(null);
    try {
      const saved = await supabaseService.updateMarketSettings(profile.uid, {
        phoneNumber: marketPhone.trim(),
        location: marketLocation.trim(),
        brandName: marketBrandName.trim(),
        showPhoneNumber,
        showLocation,
        showBrandName,
      });
      const registered = await supabaseService.registerMarketplace(profile.uid, marketPin);
      setMarketRegistered(registered.isRegistered);
      setMarketRegisteredAt(registered.registeredAt);
      setShowPinPad(false);
      setMarketSuccess('Payment successful. Marketplace registration complete.');
      setTimeout(() => setMarketSuccess(null), 2400);
      onProfileUpdate({
        ...profile,
        phoneNumber: saved.phoneNumber,
        location: saved.location,
        companyInfo: {
          name: saved.brandName,
          about: profile.companyInfo?.about || '',
        },
      });
      setMessage({ type: 'success', text: 'Marketplace registration completed successfully.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Marketplace registration failed.' });
    } finally {
      setRegisteringMarket(false);
    }
  };

  const SettingItem = ({ icon: Icon, label, sublabel, onClick, color = "text-gray-600" }: any) => (
    <button 
      onClick={onClick}
      className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0"
    >
      <div className="flex items-center gap-4">
        <div className={`p-2 rounded-xl bg-gray-50 ${color}`}>
          <Icon size={20} />
        </div>
        <div className="text-left">
          <p className="text-sm font-bold text-gray-900">{label}</p>
          {sublabel && <p className="text-xs text-gray-500">{sublabel}</p>}
        </div>
      </div>
      <ChevronRight size={18} className="text-gray-300" />
    </button>
  );

  const SettingLink = ({ icon: Icon, label, sublabel, to, color = "text-gray-600" }: any) => (
    <Link
      to={to}
      className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0"
    >
      <div className="flex items-center gap-4">
        <div className={`p-2 rounded-xl bg-gray-50 ${color}`}>
          <Icon size={20} />
        </div>
        <div className="text-left">
          <p className="text-sm font-bold text-gray-900">{label}</p>
          {sublabel && <p className="text-xs text-gray-500">{sublabel}</p>}
        </div>
      </div>
      <ChevronRight size={18} className="text-gray-300" />
    </Link>
  );

  return (
    <div className={`${activeSection === 'market' ? 'max-w-5xl' : 'max-w-2xl'} mx-auto pb-24 md:pb-8`}>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500">Manage your account and preferences</p>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
        <AnimatePresence mode="wait">
          {activeSection === 'main' && (
            <motion.div
              key="main"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <div className="p-6 bg-gray-50/50 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <CachedImage
                      src={profile.photoURL}
                      alt={profile.displayName}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      wrapperClassName="w-16 h-16 rounded-2xl shadow-md"
                      imgClassName="w-full h-full rounded-2xl object-cover"
                    />
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">{profile.displayName}</h2>
                      <p className="text-sm text-gray-500">{profile.email}</p>
                      <button
                        type="button"
                        onClick={handleCopyUserId}
                        className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:text-teal-800"
                      >
                        <Copy size={12} />
                        {copiedId ? 'Copied' : `ID: ${profile.publicId || profile.uid}`}
                      </button>
                    </div>
                  </div>
                  <Link 
                    to={`/profile/${profile.uid}`}
                    className="p-3 bg-white border border-gray-200 text-teal-700 rounded-xl hover:bg-teal-50 transition-all shadow-sm"
                  >
                    <User size={20} />
                  </Link>
                </div>
              </div>

              <div className="py-2">
                <div className="px-6 py-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Account</p>
                </div>
                <SettingItem 
                  icon={User} 
                  label="Personal Information" 
                  sublabel="Name, bio, and profile picture"
                  onClick={() => setActiveSection('profile')}
                  color="text-teal-600"
                />
                <SettingItem 
                  icon={Lock} 
                  label="Security" 
                  sublabel="Password and authentication"
                  onClick={() => setActiveSection('security')}
                  color="text-amber-600"
                />
                <SettingItem 
                  icon={Bell} 
                  label="Notifications" 
                  sublabel="Push and email alerts"
                  onClick={() => setActiveSection('notifications')}
                  color="text-blue-600"
                />
                <SettingLink
                  to="/wallets"
                  icon={Wallet}
                  label="Wallets"
                  sublabel="Balances, top-ups, withdrawals"
                  color="text-emerald-600"
                />
                <SettingLink
                  to="/active-gigs"
                  icon={BriefcaseBusiness}
                  label="My Active Gigs"
                  sublabel="Assigned gigs, approvals, and ongoing work"
                  color="text-teal-600"
                />
                <SettingItem
                  icon={Store}
                  label="Market"
                  sublabel={marketRegistered ? 'Marketplace registered' : 'Marketplace profile and registration'}
                  onClick={() => setActiveSection('market')}
                  color="text-fuchsia-600"
                />
                <SettingItem
                  icon={LifeBuoy}
                  label="Support"
                  sublabel="Help, issues, and account assistance"
                  onClick={() => setActiveSection('support')}
                  color="text-rose-600"
                />
              </div>

              <div className="py-2 border-t border-gray-100">
                <div className="px-6 py-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Preferences</p>
                </div>
                <SettingItem icon={Globe} label="Language" sublabel="English (US)" />
                <SettingItem icon={Moon} label="Appearance" sublabel="Light Mode" />
                <SettingItem icon={Smartphone} label="Connected Devices" sublabel="2 active sessions" />
              </div>

              <div className="p-4 bg-gray-50/50">
                <button 
                  onClick={async () => {
                    const confirmed = await confirm({
                      title: 'Log out now?',
                      description: 'You will need to sign back in to continue using your account.',
                      confirmLabel: 'Log Out',
                      tone: 'danger',
                    });
                    if (!confirmed) return;
                    onLogout();
                  }}
                  className="w-full flex items-center justify-center gap-2 p-4 text-red-600 font-bold hover:bg-red-50 rounded-2xl transition-all"
                >
                  <LogOut size={20} />
                  Log Out
                </button>
              </div>
            </motion.div>
          )}

          {activeSection === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-6 space-y-6"
            >
              <div className="flex items-center gap-4 mb-4">
                <button onClick={() => setActiveSection('main')} className="p-2 hover:bg-gray-100 rounded-xl transition-all">
                  <ChevronRight size={24} className="rotate-180" />
                </button>
                <h2 className="text-xl font-bold text-gray-900">Personal Info</h2>
              </div>

              <div className="flex flex-col items-center gap-4">
                <div className="relative group">
                  <CachedImage
                    src={photoURL}
                    alt="Profile"
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    wrapperClassName="w-32 h-32 rounded-3xl shadow-xl"
                    imgClassName="w-full h-full rounded-3xl object-cover"
                  />
                  <label className="absolute bottom-2 right-2 p-2 bg-teal-600 text-white rounded-xl shadow-lg hover:bg-teal-700 transition-all cursor-pointer">
                    <Camera size={18} />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handlePhotoUpload(e.target.files[0])}
                    />
                  </label>
                </div>
                {uploadingPhoto && <p className="text-xs text-gray-500">Uploading photo...</p>}
                <div className="w-full space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase">Profile Picture URL</label>
                  <input 
                    type="text" 
                    value={photoURL}
                    onChange={(e) => setPhotoURL(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border-transparent focus:bg-white focus:ring-2 focus:ring-teal-500 rounded-xl text-sm transition-all"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase">Full Name</label>
                  <input 
                    type="text" 
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border-transparent focus:bg-white focus:ring-2 focus:ring-teal-500 rounded-xl text-sm transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase">Bio</label>
                  <textarea 
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border-transparent focus:bg-white focus:ring-2 focus:ring-teal-500 rounded-xl text-sm transition-all min-h-[100px]"
                    placeholder="Tell us about yourself..."
                  />
                </div>
              </div>

              {message && (
                <div className={`p-4 rounded-xl flex items-center gap-3 text-sm ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                  {message.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
                  {message.text}
                </div>
              )}

              <button 
                onClick={handleUpdateProfile}
                disabled={loading}
                className="w-full bg-teal-700 text-white font-bold py-4 rounded-2xl hover:bg-teal-800 disabled:opacity-50 transition-all shadow-lg shadow-teal-100"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </motion.div>
          )}

          {activeSection === 'security' && (
            <motion.div
              key="security"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-6 space-y-6"
            >
              <div className="flex items-center gap-4 mb-4">
                <button onClick={() => setActiveSection('main')} className="p-2 hover:bg-gray-100 rounded-xl transition-all">
                  <ChevronRight size={24} className="rotate-180" />
                </button>
                <h2 className="text-xl font-bold text-gray-900">Security</h2>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase">Current Password</label>
                  <input 
                    type="password" 
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border-transparent focus:bg-white focus:ring-2 focus:ring-teal-500 rounded-xl text-sm transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase">New Password</label>
                  <input 
                    type="password" 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border-transparent focus:bg-white focus:ring-2 focus:ring-teal-500 rounded-xl text-sm transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase">Confirm New Password</label>
                  <input 
                    type="password" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border-transparent focus:bg-white focus:ring-2 focus:ring-teal-500 rounded-xl text-sm transition-all"
                  />
                </div>
              </div>

              {message && (
                <div className={`p-4 rounded-xl flex items-center gap-3 text-sm ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                  {message.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
                  {message.text}
                </div>
              )}

              <button 
                onClick={handleChangePassword}
                disabled={loading}
                className="w-full bg-teal-700 text-white font-bold py-4 rounded-2xl hover:bg-teal-800 disabled:opacity-50 transition-all shadow-lg shadow-teal-100"
              >
                {loading ? 'Changing Password...' : 'Update Password'}
              </button>

              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                <div className="flex gap-3">
                  <Shield className="text-amber-600 shrink-0" size={20} />
                  <p className="text-xs text-amber-800 leading-relaxed">
                    Changing your password will require you to re-authenticate. Make sure you remember your new password!
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {activeSection === 'notifications' && (
            <motion.div
              key="notifications"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-6 space-y-6"
            >
              <div className="flex items-center gap-4 mb-4">
                <button onClick={() => setActiveSection('main')} className="p-2 hover:bg-gray-100 rounded-xl transition-all">
                  <ChevronRight size={24} className="rotate-180" />
                </button>
                <h2 className="text-xl font-bold text-gray-900">Notifications</h2>
              </div>

              <div className="space-y-2">
                {[
                  { key: 'wallet', label: 'Wallet Activity', desc: 'Transfers, withdrawals and top-ups.' },
                  { key: 'gigs', label: 'Gig Activity', desc: 'Applications and updates on your gigs.' },
                  { key: 'feed', label: 'Feed Activity', desc: 'Likes and comments on your posts.' },
                  { key: 'friendRequests', label: 'Friend Requests', desc: 'New connection requests.' }
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                    <div>
                      <p className="text-sm font-bold text-gray-900">{item.label}</p>
                      <p className="text-xs text-gray-500">{item.desc}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setNotificationSettings((prev) => ({
                          ...prev,
                          [item.key]: !prev[item.key as keyof NotificationSettings],
                        }))
                      }
                      className={`w-12 h-6 rounded-full relative p-1 transition-all ${
                        notificationSettings[item.key as keyof NotificationSettings] ? 'bg-teal-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${
                          notificationSettings[item.key as keyof NotificationSettings] ? 'right-1' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>

              {message && (
                <div className={`p-4 rounded-xl flex items-center gap-3 text-sm ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                  {message.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
                  {message.text}
                </div>
              )}

              <button 
                onClick={handleSaveNotificationSettings}
                disabled={savingNotifications}
                className="w-full bg-teal-700 text-white font-bold py-4 rounded-2xl hover:bg-teal-800 transition-all shadow-lg shadow-teal-100 disabled:opacity-70"
              >
                {savingNotifications ? 'Saving...' : 'Save Preferences'}
              </button>
            </motion.div>
          )}

          {activeSection === 'market' && (
            <motion.div
              key="market"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-6 space-y-6"
            >
              <div className="flex items-center gap-4 mb-4">
                <button onClick={() => setActiveSection('main')} className="p-2 hover:bg-gray-100 rounded-xl transition-all">
                  <ChevronRight size={24} className="rotate-180" />
                </button>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Market</h2>
                  <p className="text-sm text-gray-500">Set your marketplace details and complete registration.</p>
                </div>
              </div>

              <div className={`p-4 rounded-2xl border text-sm font-semibold ${marketRegistered ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                {marketRegistered
                  ? `Marketplace registered${marketRegisteredAt ? ` on ${new Date(marketRegisteredAt).toLocaleDateString()}` : ''}.`
                  : 'Marketplace access is locked until you complete the one-time N500 registration.'}
              </div>

              {!marketRegistered ? (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-3xl border border-gray-200 bg-gray-50 p-6">
                    <h3 className="text-lg font-bold text-gray-900">Marketplace Registration</h3>
                    <p className="mt-2 text-sm text-gray-500">
                      Unlock market access, selling tools, ratings, stock management, and seller profile controls with a one-time N500 fee from your NGN wallet.
                    </p>
                    <div className="mt-5 space-y-3 text-sm text-gray-600">
                      <div className="rounded-2xl bg-white p-4">Access the market page and seller listings</div>
                      <div className="rounded-2xl bg-white p-4">Manage stock quantity for every item you list</div>
                      <div className="rounded-2xl bg-white p-4">Choose what buyers see on your item details page</div>
                    </div>
                  </div>
                  <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Registration Fee</p>
                    <p className="mt-2 text-4xl font-black text-teal-700">N500</p>
                    <p className="mt-2 text-sm text-gray-500">Charged once from your available NGN wallet balance after PIN confirmation.</p>
                    <button
                      onClick={handleRegisterMarketplace}
                      disabled={registeringMarket}
                      className="mt-6 w-full bg-teal-700 text-white font-bold py-4 rounded-2xl hover:bg-teal-800 disabled:opacity-50 transition-all"
                    >
                      {registeringMarket ? 'Processing...' : 'Register Marketplace'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div className="space-y-4 rounded-3xl border border-gray-200 bg-white p-6">
                    <h3 className="text-lg font-bold text-gray-900">Seller Information</h3>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 uppercase">Brand Name</label>
                      <input
                        type="text"
                        value={marketBrandName}
                        onChange={(e) => setMarketBrandName(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-50 border-transparent focus:bg-white focus:ring-2 focus:ring-teal-500 rounded-xl text-sm transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 uppercase">Phone Number</label>
                      <input
                        type="text"
                        value={marketPhone}
                        onChange={(e) => setMarketPhone(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-50 border-transparent focus:bg-white focus:ring-2 focus:ring-teal-500 rounded-xl text-sm transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 uppercase">Location</label>
                      <input
                        type="text"
                        value={marketLocation}
                        onChange={(e) => setMarketLocation(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-50 border-transparent focus:bg-white focus:ring-2 focus:ring-teal-500 rounded-xl text-sm transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-4 rounded-3xl border border-gray-200 bg-white p-6">
                    <h3 className="text-lg font-bold text-gray-900">Item Details Visibility</h3>
                    <label className="flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-3">
                      <span className="text-sm font-semibold text-gray-700">Show brand name</span>
                      <input type="checkbox" checked={showBrandName} onChange={(e) => setShowBrandName(e.target.checked)} className="h-5 w-5 rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                    </label>
                    <label className="flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-3">
                      <span className="text-sm font-semibold text-gray-700">Show phone number</span>
                      <input type="checkbox" checked={showPhoneNumber} onChange={(e) => setShowPhoneNumber(e.target.checked)} className="h-5 w-5 rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                    </label>
                    <label className="flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-3">
                      <span className="text-sm font-semibold text-gray-700">Show location</span>
                      <input type="checkbox" checked={showLocation} onChange={(e) => setShowLocation(e.target.checked)} className="h-5 w-5 rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                    </label>
                    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                      Stock is now managed per item when you create or edit listings.
                    </div>
                  </div>
                </div>
              )}

              {message && (
                <div className={`p-4 rounded-xl flex items-center gap-3 text-sm ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                  {message.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
                  {message.text}
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row">
                {marketRegistered && (
                  <button
                    onClick={handleSaveMarketSettings}
                    disabled={savingMarket}
                    className="flex-1 bg-gray-900 text-white font-bold py-4 rounded-2xl hover:bg-gray-800 disabled:opacity-50 transition-all"
                  >
                    {savingMarket ? 'Saving...' : 'Save Market Settings'}
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {activeSection === 'support' && (
            <motion.div
              key="support"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-6 space-y-6"
            >
              <div className="flex items-center gap-4 mb-4">
                <button onClick={() => setActiveSection('main')} className="p-2 hover:bg-gray-100 rounded-xl transition-all">
                  <ChevronRight size={24} className="rotate-180" />
                </button>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Support</h2>
                  <p className="text-sm text-gray-500">Get help with payments, gigs, chat, and marketplace issues.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-3xl border border-gray-200 bg-gray-50 p-5">
                  <div className="inline-flex rounded-2xl bg-white p-3 text-rose-600 shadow-sm">
                    <MessageSquareWarning size={22} />
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-gray-900">Report a problem</h3>
                  <p className="mt-2 text-sm text-gray-600">
                    Seeing an issue with gigs, chats, wallet transfers, or marketplace listings? Send the team a clear description with screenshots if possible.
                  </p>
                  <a
                    href={`mailto:support@connectapp.com?subject=${encodeURIComponent('Support request from ' + profile.displayName)}`}
                    className="mt-4 inline-flex rounded-2xl bg-teal-700 px-4 py-3 text-sm font-bold text-white hover:bg-teal-800"
                  >
                    Contact Support
                  </a>
                </div>

                <div className="rounded-3xl border border-gray-200 bg-white p-5">
                  <div className="inline-flex rounded-2xl bg-gray-100 p-3 text-teal-700">
                    <Mail size={22} />
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-gray-900">Quick help</h3>
                  <div className="mt-3 space-y-3 text-sm text-gray-600">
                    <p>For transfer help, make sure your wallet PIN is set before trying to pay another user.</p>
                    <p>For marketplace access, complete your market registration from the Market section in settings.</p>
                    <p>For gig issues, use Manage Gigs to review applicants, edit gig details, or close and reopen listings.</p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-dashed border-gray-300 bg-gray-50 p-5 text-sm text-gray-600">
                Support email: <span className="font-bold text-gray-900">support@connectapp.com</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {showPinPad && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 z-40" onClick={() => !registeringMarket && setShowPinPad(false)} />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 260, damping: 28 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl p-5 border-t border-gray-200"
            >
              <div className="max-w-md mx-auto space-y-4">
                <div className="text-center">
                  <p className="text-sm font-bold text-gray-900 inline-flex items-center gap-1">
                    <ShieldCheck size={14} />
                    Enter Wallet PIN
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Confirm your one-time N500 marketplace registration payment.</p>
                </div>

                <div className="flex items-center justify-center gap-2">
                  {Array.from({ length: 4 }).map((_, idx) => (
                    <span key={idx} className={`w-3 h-3 rounded-full ${idx < marketPin.length ? 'bg-teal-600' : 'bg-gray-300'}`} />
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'].map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        if (key === 'clear') return setMarketPin('');
                        if (key === 'back') return setMarketPin((prev) => prev.slice(0, -1));
                        setMarketPin((prev) => (prev.length < 4 ? `${prev}${key}` : prev));
                      }}
                      disabled={registeringMarket}
                      className="h-12 rounded-xl bg-gray-100 font-bold text-gray-900 disabled:opacity-60"
                    >
                      {key === 'back' ? 'Del' : key === 'clear' ? 'Clear' : key}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={submitMarketplaceRegistration}
                  disabled={registeringMarket || marketPin.length !== 4}
                  className="w-full py-3 rounded-xl bg-teal-700 text-white font-bold disabled:opacity-70"
                >
                  {registeringMarket ? 'Processing Payment...' : 'Pay and Register'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {marketSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-lg text-sm font-semibold inline-flex items-center gap-2"
          >
            <CheckCircle2 size={16} />
            {marketSuccess}
          </motion.div>
        )}
      </AnimatePresence>
      {confirmDialog}
    </div>
  );
}
