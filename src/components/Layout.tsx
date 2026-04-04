import React from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Home, Users, Briefcase, MessageSquare, LogOut, Search, Settings as SettingsIcon, Link2, Bell } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { UserProfile } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { supabaseService } from '../services/supabaseService';
import GlobalSearch from './GlobalSearch';
import CachedImage from './CachedImage';
import { useConfirmDialog } from './ConfirmDialog';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  profile: UserProfile;
  onLogout: () => void;
}

export default function Layout({ children, user, profile, onLogout }: LayoutProps) {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const targetUid = searchParams.get('uid');
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const [unreadNotifications, setUnreadNotifications] = React.useState(0);
  const [unreadMessages, setUnreadMessages] = React.useState(0);
  const { confirm, confirmDialog } = useConfirmDialog();

  const navItems = [
    { icon: Home, label: 'Feed', path: '/' },
    { icon: Users, label: 'Network', path: '/network' },
    { icon: Briefcase, label: 'Jobs', path: '/jobs' },
    { icon: MessageSquare, label: 'Messages', path: '/messages' },
    { icon: SettingsIcon, label: 'Settings', path: '/settings' },
  ];

  const isMessagesPage = location.pathname === '/messages';

  React.useEffect(() => {
    const unsubscribe = supabaseService.subscribeToNotifications(profile.uid, (items) => {
      const unread = items.filter((item) => !item.read).length;
      setUnreadNotifications(unread);
    });
    return () => unsubscribe();
  }, [profile.uid]);

  React.useEffect(() => {
    if (location.pathname !== '/notifications') return;
    supabaseService
      .markNotificationsReadThrough(profile.uid)
      .then(() => setUnreadNotifications(0))
      .catch(() => undefined);
  }, [location.pathname, profile.uid]);

  React.useEffect(() => {
    const unsubscribeUnreadCounts = supabaseService.subscribeToUnreadMessageCounts(profile.uid, (counts) => {
      setUnreadMessages(Object.values(counts).reduce((sum, count) => sum + count, 0));
    });

    if (location.pathname === '/messages' && targetUid) {
      supabaseService.markMessagesAsRead(profile.uid, targetUid).catch(() => undefined);
    }

    return () => {
      unsubscribeUnreadCounts();
    };
  }, [location.pathname, profile.uid, targetUid]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside className={cn(
        "hidden md:flex flex-col w-64 bg-white border-r border-gray-200 fixed h-full z-20 transition-all",
        isMessagesPage && "w-20"
      )}>
        <div className={cn("p-6", isMessagesPage && "px-2 text-center")}>
          <Link to="/" className={cn("flex items-center gap-2 text-2xl font-bold text-teal-700", isMessagesPage && "text-sm justify-center")}>
            <span className={cn("inline-flex items-center justify-center w-8 h-8 rounded-xl bg-teal-600 text-white", isMessagesPage && "w-7 h-7")}>
              <Link2 size={16} />
            </span>
            {!isMessagesPage && 'Connect'}
          </Link>
        </div>
        
        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors",
                location.pathname === item.path 
                  ? "bg-teal-50 text-teal-700" 
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                isMessagesPage && "px-2 justify-center"
              )}
              title={item.label}
            >
              <item.icon size={20} />
              {!isMessagesPage && item.label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className={cn("flex items-center gap-3 px-4 py-3 mb-4", isMessagesPage && "px-0 justify-center")}>
            <CachedImage
              src={profile.photoURL}
              alt={profile.displayName}
              fallbackMode="avatar"
              wrapperClassName="w-10 h-10 rounded-full border border-gray-200"
              imgClassName="w-full h-full rounded-full object-cover"
            />
            {!isMessagesPage && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{profile.displayName}</p>
                <p className="text-xs text-gray-500 capitalize">{profile.role}</p>
              </div>
            )}
          </div>
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
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-red-50 hover:text-red-600 rounded-xl transition-colors font-medium",
              isMessagesPage && "px-0 justify-center"
            )}
            title="Logout"
          >
            <LogOut size={20} />
            {!isMessagesPage && 'Logout'}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={cn(
        "flex-1 transition-all",
        isMessagesPage 
          ? (targetUid ? "md:ml-20 pb-0" : "md:ml-20 pb-16 md:pb-0") 
          : "md:ml-64 pb-20 md:pb-0"
      )}>
        {/* Top Search Bar (Desktop) */}
        {!isMessagesPage && (
          <header className="hidden md:flex items-center justify-between px-8 py-4 bg-white border-b border-gray-200 sticky top-0 z-10">
            <div className="relative w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search market, gigs, partners, settings, or anything..."
                readOnly
                onClick={() => setIsSearchOpen(true)}
                className="w-full pl-10 pr-4 py-2 bg-gray-100 border-transparent focus:bg-white focus:ring-2 focus:ring-teal-500 rounded-xl text-base transition-all"
              />
            </div>
            <div className="flex items-center gap-4">
              <Link to="/notifications" className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-600">
                <Bell size={20} />
                {unreadNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadNotifications > 99 ? '99+' : unreadNotifications}
                  </span>
                )}
              </Link>
            </div>
          </header>
        )}

        {/* Mobile Header */}
        {!isMessagesPage && (
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 sticky top-0 z-10">
          <span className="flex items-center gap-2 text-xl font-bold text-teal-700">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-teal-600 text-white">
              <Link2 size={14} />
            </span>
            Connect
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setIsSearchOpen(true)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-full">
              <Search size={20} />
            </button>
            <Link to="/notifications" className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-full">
              <Bell size={20} />
              {unreadNotifications > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </span>
              )}
            </Link>
          </div>
        </header>
        )}

        <div className={cn(
          "transition-all",
          isMessagesPage 
            ? (targetUid ? "w-full min-h-[100dvh] md:h-screen" : "w-full") 
            : "max-w-6xl mx-auto p-4 md:p-8"
        )}>
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      {!(isMessagesPage && targetUid) && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex items-center justify-around px-2 py-2 z-20">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center gap-1 p-2 rounded-lg transition-colors min-w-[64px]",
                location.pathname === item.path 
                  ? "text-teal-700" 
                  : "text-gray-500"
              )}
            >
              <div className="relative">
                <item.icon size={22} />
                {item.path === '/messages' && unreadMessages > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {unreadMessages > 9 ? '9+' : unreadMessages}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>
      )}
      <GlobalSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      {confirmDialog}
    </div>
  );
}
