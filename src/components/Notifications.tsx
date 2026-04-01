import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ArrowLeft } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { AppNotification, UserProfile } from '../types';
import { supabaseService } from '../services/supabaseService';

interface NotificationsProps {
  profile: UserProfile;
}

export default function Notifications({ profile }: NotificationsProps) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = supabaseService.subscribeToNotifications(profile.uid, (items) => {
      setNotifications(items);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile.uid]);

  useEffect(() => {
    supabaseService
      .markNotificationsReadThrough(profile.uid)
      .then(async () => {
        const items = await supabaseService.getNotifications(profile.uid);
        setNotifications(items);
      })
      .catch(() => undefined);
  }, [profile.uid]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const markAllAsRead = async () => {
    await supabaseService.markNotificationsReadThrough(profile.uid);
    const next = await supabaseService.getNotifications(profile.uid);
    setNotifications(next);
  };

  const handleOpen = async (notification: AppNotification) => {
    await supabaseService.markNotificationsReadThrough(profile.uid, notification.createdAt);
    const next = await supabaseService.getNotifications(profile.uid);
    setNotifications(next);
    if (notification.link) navigate(notification.link);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-100">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-sm text-gray-500">{unreadCount} unread</p>
        </div>
        <button
          onClick={markAllAsRead}
          className="ml-auto px-4 py-2 text-sm font-semibold bg-white border border-gray-200 rounded-xl hover:bg-gray-50"
        >
          Mark all as read
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-gray-500">Loading notifications...</p>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center">
            <Bell size={36} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No notifications yet.</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <button
              key={notification.id}
              onClick={() => handleOpen(notification)}
              className={`w-full p-4 text-left border-b border-gray-100 hover:bg-gray-50 ${
                notification.read ? 'bg-white' : 'bg-teal-50/30'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-1 w-2.5 h-2.5 rounded-full ${notification.read ? 'bg-gray-300' : 'bg-teal-500'}`} />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">{notification.title}</p>
                  <p className="text-xs text-gray-600 mt-1">{notification.body}</p>
                  <p className="text-[11px] text-gray-400 mt-2">
                    {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
