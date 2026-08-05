import React, { useState, useEffect } from 'react';
import { Bell, Check, Trash2, Zap, AlertTriangle, Gift, Info, CheckCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface LiveNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  userKey?: string;
}

interface LiveNotificationCenterProps {
  telegramId?: string;
}

export const LiveNotificationCenter: React.FC<LiveNotificationCenterProps> = ({ telegramId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<LiveNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const fetchNotifications = () => {
    fetch(`/api/live-event/notifications${telegramId ? `?telegramId=${encodeURIComponent(telegramId)}` : ''}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.notifications)) {
          setNotifications(data.notifications);
          setUnreadCount(data.unreadCount || 0);
        }
      })
      .catch((err) => console.warn('Notification fetch note:', err));
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5000);
    return () => clearInterval(interval);
  }, [telegramId]);

  const handleMarkAsRead = (notifId: string) => {
    fetch('/api/live-event/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notifId }),
    }).then(() => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    });
  };

  const handleClearAll = () => {
    fetch('/api/live-event/notifications/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userKey: telegramId }),
    }).then(() => {
      setNotifications([]);
      setUnreadCount(0);
    });
  };

  const getNotifIcon = (type: string) => {
    switch (type) {
      case 'YOU_WON':
      case 'REWARD_CREDITED':
        return <Gift className="h-4 w-4 text-emerald-400" />;
      case 'CODE_RELEASED':
      case 'EVENT_STARTED':
        return <Zap className="h-4 w-4 text-amber-400" />;
      case 'EMERGENCY_LOCK':
        return <AlertTriangle className="h-4 w-4 text-rose-400" />;
      default:
        return <Info className="h-4 w-4 text-cyan-400" />;
    }
  };

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-gray-800 bg-gray-900/80 text-gray-300 hover:border-amber-500/50 hover:text-white transition shadow-lg"
        title="Live Notification Center"
      >
        <Bell className="h-5 w-5 text-amber-400" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white shadow-md animate-bounce">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-gray-800 bg-gray-900 p-4 shadow-2xl z-50 text-white"
          >
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-amber-400" />
                <h4 className="text-sm font-bold text-gray-200">Live Alerts</h4>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/30">
                    {unreadCount} UNREAD
                  </span>
                )}
              </div>
              <button
                onClick={handleClearAll}
                className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-rose-400"
              >
                <Trash2 className="h-3 w-3" /> Clear
              </button>
            </div>

            <div className="mt-3 max-h-72 overflow-y-auto space-y-2 pr-1">
              {notifications.length === 0 ? (
                <p className="py-6 text-center text-xs text-gray-500 italic">No notifications yet.</p>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => !n.read && handleMarkAsRead(n.id)}
                    className={`flex items-start gap-3 rounded-xl border p-3 text-xs transition cursor-pointer ${
                      n.read
                        ? 'border-gray-800/50 bg-black/30 text-gray-400'
                        : 'border-amber-500/30 bg-amber-500/10 text-gray-200 font-medium'
                    }`}
                  >
                    <div className="mt-0.5">{getNotifIcon(n.type)}</div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-200">{n.title}</span>
                        <span className="text-[10px] font-mono text-gray-500">
                          {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-gray-300 leading-tight">{n.message}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
