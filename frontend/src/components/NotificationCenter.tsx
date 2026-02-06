import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import {
  Bell,
  FileText,
  Award,
  MessageSquare,
  Mail,
  Check,
  X,
} from 'lucide-react';
import api from '@/lib/api';
import type { Notification } from '@/types/rfq-extended';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function notificationIcon(type: string) {
  switch (type) {
    case 'rfq_response':
      return <FileText className="w-4 h-4" />;
    case 'rfq_awarded':
      return <Award className="w-4 h-4" />;
    case 'message':
      return <MessageSquare className="w-4 h-4" />;
    case 'invitation':
      return <Mail className="w-4 h-4" />;
    case 'system':
    default:
      return <Bell className="w-4 h-4" />;
  }
}

function notificationIconColor(type: string): string {
  switch (type) {
    case 'rfq_response':
      return 'bg-blue-50 text-blue-600';
    case 'rfq_awarded':
      return 'bg-green-50 text-green-600';
    case 'message':
      return 'bg-purple-50 text-purple-600';
    case 'invitation':
      return 'bg-amber-50 text-amber-600';
    case 'system':
    default:
      return 'bg-secondary-100 text-secondary-600';
  }
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

const SkeletonItem = () => (
  <div className="flex items-start gap-3 px-4 py-3 animate-pulse">
    <div className="w-8 h-8 rounded-lg bg-secondary-100 flex-shrink-0" />
    <div className="flex-1 space-y-2">
      <div className="h-3 bg-secondary-100 rounded w-3/4" />
      <div className="h-2.5 bg-secondary-100 rounded w-1/2" />
    </div>
    <div className="h-2.5 bg-secondary-100 rounded w-10 flex-shrink-0" />
  </div>
);

// ── Component ────────────────────────────────────────────────────────────────

const NotificationCenter: React.FC = () => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── Fetch helpers ────────────────────────────────────────────────────────

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await api.get('/api/v1/notifications/unread-count');
      setUnreadCount(res.data?.count ?? 0);
    } catch {
      // silently ignore – badge simply won't update
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/v1/notifications', {
        params: { limit: 20 },
      });
      setNotifications(res.data?.items ?? res.data ?? []);
    } catch {
      // keep stale data
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Lifecycle ────────────────────────────────────────────────────────────

  // Poll unread count every 30 seconds
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30_000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Load full list when dropdown opens
  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open, fetchNotifications]);

  // Click-outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const markAsRead = async (notification: Notification) => {
    if (!notification.is_read) {
      try {
        await api.put(`/api/v1/notifications/${notification.id}/read`);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        // ignore
      }
    }
    if (notification.action_url) {
      setOpen(false);
      router.push(notification.action_url);
    }
  };

  const markAllRead = async () => {
    try {
      await api.put('/api/v1/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div ref={dropdownRef} className="relative">
      {/* Bell trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2.5 text-secondary-600 hover:text-primary-600 hover:bg-secondary-50 rounded-xl transition-all"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full ring-2 ring-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white/95 backdrop-blur-xl border border-secondary-200/60 rounded-2xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-secondary-100">
            <h3 className="text-sm font-semibold text-secondary-900">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs font-medium text-primary-600 hover:text-primary-700 transition-colors flex items-center gap-1"
                >
                  <Check className="w-3 h-3" />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 text-secondary-400 hover:text-secondary-600 rounded-lg hover:bg-secondary-50 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-[400px] overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <>
                <SkeletonItem />
                <SkeletonItem />
                <SkeletonItem />
                <SkeletonItem />
              </>
            ) : notifications.length === 0 ? (
              /* Empty state */
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <div className="w-12 h-12 rounded-full bg-secondary-100 flex items-center justify-center mb-3">
                  <Bell className="w-6 h-6 text-secondary-400" />
                </div>
                <p className="text-sm font-medium text-secondary-700">No notifications yet</p>
                <p className="text-xs text-secondary-400 mt-1">
                  We&rsquo;ll let you know when something arrives
                </p>
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => markAsRead(n)}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors ${
                    n.is_read
                      ? 'bg-white hover:bg-secondary-50/60'
                      : 'bg-primary-50/30 hover:bg-primary-50/50'
                  }`}
                >
                  {/* Icon */}
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${notificationIconColor(
                      n.type
                    )}`}
                  >
                    {notificationIcon(n.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm leading-snug truncate ${
                        n.is_read ? 'text-secondary-700' : 'text-secondary-900 font-medium'
                      }`}
                    >
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="text-xs text-secondary-500 mt-0.5 line-clamp-2">
                        {n.body}
                      </p>
                    )}
                  </div>

                  {/* Meta */}
                  <div className="flex flex-col items-end gap-1 flex-shrink-0 pt-0.5">
                    <span className="text-[11px] text-secondary-400 whitespace-nowrap">
                      {formatRelativeTime(n.created_at)}
                    </span>
                    {!n.is_read && (
                      <span className="w-2 h-2 rounded-full bg-primary-500" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-secondary-100 px-4 py-2.5">
              <button
                onClick={() => {
                  setOpen(false);
                  router.push('/dashboard/notifications');
                }}
                className="w-full text-center text-xs font-medium text-primary-600 hover:text-primary-700 transition-colors"
              >
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
