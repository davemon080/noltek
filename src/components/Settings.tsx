import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { supabaseService } from '../services/supabaseService';
import type { AppPreferences, NotificationSettings, UserProfile } from '../types';
import { User, Lock, Bell, LogOut, ChevronRight, Camera, Check, AlertCircle, Globe, Smartphone, Wallet, Copy, Store, Palette, BriefcaseBusiness, Trash2 } from 'lucide-react';
import CachedImage from './CachedImage';
import { getErrorMessage } from '../utils/errors';

interface SettingsProps { profile: UserProfile; onLogout: () => void; onProfileUpdate: (profile: UserProfile) => void; }
type Section = 'main' | 'profile' | 'security' | 'notifications' | 'market' | 'language' | 'appearance' | 'devices';
const INPUT = 'w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-teal-300 focus:bg-white focus:ring-2 focus:ring-teal-500/20';
const BTN = 'w-full rounded-2xl bg-teal-700 py-4 font-bold text-white hover:bg-teal-800 disabled:opacity-60';

export default function Settings({ profile, onLogout, onProfileUpdate }: SettingsProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const section = useMemo<Section>(() => {
    const part = location.pathname.split('/').filter(Boolean)[1];
    return (['profile','security','notifications','market','language','appearance','devices'] as const).includes(part as any) ? (part as Section) : 'main';
  }, [location.pathname]);
  const go = (next: Section) => navigate(next === 'main' ? '/settings' : `/settings/${next}`);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio || '');
  const [photoURL, setPhotoURL] = useState(profile.photoURL);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(supabaseService.getNotificationSettings(profile.uid));
  const [preferences, setPreferences] = useState<AppPreferences>(supabaseService.getAppPreferences(profile.uid));
  const [copiedId, setCopiedId] = useState(false);
  const [marketPhone, setMarketPhone] = useState(profile.phoneNumber || '');
  const [marketLocation, setMarketLocation] = useState(profile.location || '');
  const [marketBrandName, setMarketBrandName] = useState(profile.companyInfo?.name || '');
  const [showPhoneNumber, setShowPhoneNumber] = useState(false);
  const [showLocation, setShowLocation] = useState(false);
  const [showBrandName, setShowBrandName] = useState(true);

  useEffect(() => { setNotificationSettings(supabaseService.getNotificationSettings(profile.uid)); setPreferences(supabaseService.getAppPreferences(profile.uid)); }, [profile.uid]);
  useEffect(() => { supabaseService.getMarketSettings(profile.uid).then((s) => { setMarketPhone(s.phoneNumber || profile.phoneNumber || ''); setMarketLocation(s.location || profile.location || ''); setMarketBrandName(s.brandName || profile.companyInfo?.name || ''); setShowPhoneNumber(s.showPhoneNumber); setShowLocation(s.showLocation); setShowBrandName(s.showBrandName); }); }, [profile.companyInfo?.name, profile.location, profile.phoneNumber, profile.uid]);
  useEffect(() => { document.documentElement.lang = preferences.language; document.documentElement.dataset.connectAppearance = preferences.appearance; }, [preferences]);

  const flash = (type: 'success' | 'error', text: string) => setMessage({ type, text });
  const saveProfile = async () => {
    try { await supabase.auth.updateUser({ data: { full_name: displayName, avatar_url: photoURL } }); await supabaseService.updateUserProfile(profile.uid, { displayName, bio, photoURL }); onProfileUpdate({ ...profile, displayName, bio, photoURL }); flash('success', 'Profile updated.'); }
    catch (e) { flash('error', getErrorMessage(e, 'Unable to update profile.')); }
  };
  const changePassword = async () => {
    if (newPassword !== confirmPassword) return flash('error', 'Passwords do not match.');
    try { const { error: signInError } = await supabase.auth.signInWithPassword({ email: profile.email, password: currentPassword }); if (signInError) throw signInError; const { error } = await supabase.auth.updateUser({ password: newPassword }); if (error) throw error; flash('success', 'Password updated.'); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }
    catch (e) { flash('error', getErrorMessage(e, 'Unable to change password.')); }
  };
  const saveNotifications = () => { try { setNotificationSettings(supabaseService.updateNotificationSettings(profile.uid, notificationSettings)); flash('success', 'Notification preferences saved.'); } catch (e) { flash('error', getErrorMessage(e, 'Unable to save notifications.')); } };
  const savePreference = (key: 'language' | 'appearance') => { try { setPreferences(supabaseService.updateAppPreferences(profile.uid, { [key]: preferences[key] })); flash('success', `${key === 'language' ? 'Language' : 'Appearance'} saved.`); } catch (e) { flash('error', getErrorMessage(e, 'Unable to save preference.')); } };
  const saveMarket = async () => {
    try { const updated = await supabaseService.updateMarketSettings(profile.uid, { phoneNumber: marketPhone.trim(), location: marketLocation.trim(), brandName: marketBrandName.trim(), showPhoneNumber, showLocation, showBrandName }); onProfileUpdate({ ...profile, phoneNumber: updated.phoneNumber, location: updated.location, companyInfo: { name: updated.brandName, about: profile.companyInfo?.about || '' } }); flash('success', 'Market settings saved.'); }
    catch (e) { flash('error', getErrorMessage(e, 'Unable to save market settings.')); }
  };
  const uploadPhoto = async (file: File) => { setUploadingPhoto(true); try { setPhotoURL(await supabaseService.uploadUserAsset(file, 'profile/avatar')); } catch (e) { flash('error', getErrorMessage(e, 'Unable to upload photo.')); } finally { setUploadingPhoto(false); } };
  const copyId = async () => { await navigator.clipboard.writeText(profile.publicId || profile.uid); setCopiedId(true); setTimeout(() => setCopiedId(false), 1200); };

  if (section === 'main') {
    return (
      <div className="mx-auto max-w-3xl pb-24 md:pb-8">
        <div className="mb-8"><h1 className="text-3xl font-bold text-gray-900">Settings</h1><p className="text-gray-500">Manage your account and preferences.</p></div>
        <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 bg-gray-50/70 p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <CachedImage src={profile.photoURL} alt={profile.displayName} fallbackMode="avatar" wrapperClassName="h-16 w-16 rounded-2xl shadow-md" imgClassName="h-full w-full rounded-2xl object-cover" />
                <div><h2 className="text-lg font-bold text-gray-900">{profile.displayName}</h2><p className="text-sm text-gray-500">{profile.email}</p><button onClick={copyId} className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700"><Copy size={12} />{copiedId ? 'Copied' : `ID: ${profile.publicId || profile.uid}`}</button></div>
              </div>
              <Link to={`/profile/${profile.uid}`} className="rounded-xl border border-gray-200 bg-white p-3 text-teal-700"><User size={20} /></Link>
            </div>
          </div>
          <MenuRow icon={User} label="Personal Information" sublabel="Name, bio, and profile photo" onClick={() => go('profile')} />
          <MenuRow icon={Lock} label="Security" sublabel="Password management" onClick={() => go('security')} />
          <MenuRow icon={Bell} label="Notifications" sublabel="Control what notifications you receive" onClick={() => go('notifications')} />
          <LinkRow to="/wallets" icon={Wallet} label="Wallets" sublabel="Balances and transactions" />
          <LinkRow to="/active-gigs" icon={BriefcaseBusiness} label="My Active Gigs" sublabel="Current assigned gigs" />
          <MenuRow icon={Store} label="Market" sublabel="Seller details and visibility" onClick={() => go('market')} />
          <MenuRow icon={Globe} label="Language" sublabel={preferences.language} onClick={() => go('language')} />
          <MenuRow icon={Palette} label="Appearance" sublabel={preferences.appearance} onClick={() => go('appearance')} />
          <MenuRow icon={Smartphone} label="Connected Devices" sublabel={`${preferences.connectedDevices.length} device(s)`} onClick={() => go('devices')} />
          <div className="bg-gray-50/70 p-4"><button onClick={onLogout} className="flex w-full items-center justify-center gap-2 rounded-2xl p-4 font-bold text-red-600 hover:bg-red-50"><LogOut size={20} />Log Out</button></div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl pb-24 md:pb-8">
      <div className="mb-6 flex items-start gap-4"><button onClick={() => go('main')} className="rounded-xl p-2 hover:bg-gray-100"><ChevronRight size={24} className="rotate-180" /></button><div><h2 className="text-xl font-bold text-gray-900 capitalize">{section}</h2><p className="text-sm text-gray-500">Manage this settings page.</p></div></div>
      {message && <div className={`mb-6 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm ${message.type === 'success' ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : 'border border-red-200 bg-red-50 text-red-700'}`}>{message.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}{message.text}</div>}
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        {section === 'profile' && <div className="space-y-6"><div className="flex flex-col items-center gap-4 rounded-3xl border border-gray-200 bg-gray-50 p-6"><div className="relative"><CachedImage src={photoURL} alt="Profile" fallbackMode="avatar" wrapperClassName="h-28 w-28 rounded-3xl shadow-lg" imgClassName="h-full w-full rounded-3xl object-cover" /><label className="absolute bottom-2 right-2 cursor-pointer rounded-xl bg-teal-600 p-2 text-white"><Camera size={16} /><input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])} /></label></div><p className="text-xs text-gray-500">{uploadingPhoto ? 'Uploading...' : 'Upload a new profile photo.'}</p></div><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={INPUT} placeholder="Display name" /><textarea value={bio} onChange={(e) => setBio(e.target.value)} className={`${INPUT} min-h-[120px]`} placeholder="Bio" /><button onClick={saveProfile} className={BTN}>Save Profile</button></div>}
        {section === 'security' && <div className="space-y-4"><input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={INPUT} placeholder="Current password" /><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={INPUT} placeholder="New password" /><input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={INPUT} placeholder="Confirm password" /><button onClick={changePassword} className={BTN}>Change Password</button></div>}
        {section === 'notifications' && <div className="space-y-4">{([{ key: 'wallet', label: 'Wallet activity' }, { key: 'gigs', label: 'Gig activity' }, { key: 'feed', label: 'Feed activity' }, { key: 'friendRequests', label: 'Friend requests' }] as const).map((item) => <label key={item.key} className="flex items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4"><span className="text-sm font-bold text-gray-900">{item.label}</span><input type="checkbox" checked={notificationSettings[item.key]} onChange={(e) => setNotificationSettings((prev) => ({ ...prev, [item.key]: e.target.checked }))} className="h-5 w-5" /></label>)}<button onClick={saveNotifications} className={BTN}>Save Preferences</button></div>}
        {section === 'language' && <div className="space-y-4">{['en-US','en-GB','fr-FR'].map((item) => <label key={item} className="flex items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4"><span className="text-sm font-bold text-gray-900">{item}</span><input type="radio" checked={preferences.language === item} onChange={() => setPreferences((prev) => ({ ...prev, language: item as any }))} /></label>)}<button onClick={() => savePreference('language')} className={BTN}>Save Language</button></div>}
        {section === 'appearance' && <div className="space-y-4">{['system','light','dark'].map((item) => <label key={item} className="flex items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4"><span className="text-sm font-bold text-gray-900 capitalize">{item}</span><input type="radio" checked={preferences.appearance === item} onChange={() => setPreferences((prev) => ({ ...prev, appearance: item as any }))} /></label>)}<button onClick={() => savePreference('appearance')} className={BTN}>Save Appearance</button></div>}
        {section === 'devices' && <div className="space-y-4">{preferences.connectedDevices.map((device) => <div key={device.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-bold text-gray-900">{device.label}</p><p className="text-xs text-gray-500">{device.platform}</p><p className="mt-2 text-xs text-gray-400">Last active {new Date(device.lastActiveAt).toLocaleString()}</p></div><button disabled={device.current} onClick={() => { setPreferences(supabaseService.removeConnectedDevice(profile.uid, device.id)); flash('success', `${device.label} removed.`); }} className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-bold text-red-600 disabled:border-gray-200 disabled:text-gray-400"><Trash2 size={16} />Remove</button></div></div>)}</div>}
        {section === 'market' && <div className="space-y-4"><input value={marketBrandName} onChange={(e) => setMarketBrandName(e.target.value)} className={INPUT} placeholder="Brand name" /><input value={marketPhone} onChange={(e) => setMarketPhone(e.target.value)} className={INPUT} placeholder="Phone number" /><input value={marketLocation} onChange={(e) => setMarketLocation(e.target.value)} className={INPUT} placeholder="Location" /><label className="flex items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4"><span className="text-sm font-bold text-gray-900">Show brand name</span><input type="checkbox" checked={showBrandName} onChange={(e) => setShowBrandName(e.target.checked)} /></label><label className="flex items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4"><span className="text-sm font-bold text-gray-900">Show phone number</span><input type="checkbox" checked={showPhoneNumber} onChange={(e) => setShowPhoneNumber(e.target.checked)} /></label><label className="flex items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4"><span className="text-sm font-bold text-gray-900">Show location</span><input type="checkbox" checked={showLocation} onChange={(e) => setShowLocation(e.target.checked)} /></label><button onClick={saveMarket} className={BTN}>Save Market Settings</button></div>}
      </div>
    </div>
  );
}

function MenuRow({ icon: Icon, label, sublabel, onClick }: any) { return <button onClick={onClick} className="flex w-full items-center justify-between border-b border-gray-100 p-4 text-left hover:bg-gray-50"><div className="flex items-center gap-4"><div className="rounded-xl bg-gray-50 p-2 text-gray-700"><Icon size={20} /></div><div><p className="text-sm font-bold text-gray-900">{label}</p><p className="text-xs text-gray-500">{sublabel}</p></div></div><ChevronRight size={18} className="text-gray-300" /></button>; }
function LinkRow({ icon: Icon, label, sublabel, to }: any) { return <Link to={to} className="flex w-full items-center justify-between border-b border-gray-100 p-4 text-left hover:bg-gray-50"><div className="flex items-center gap-4"><div className="rounded-xl bg-gray-50 p-2 text-gray-700"><Icon size={20} /></div><div><p className="text-sm font-bold text-gray-900">{label}</p><p className="text-xs text-gray-500">{sublabel}</p></div></div><ChevronRight size={18} className="text-gray-300" /></Link>; }
