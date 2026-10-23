import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Bell } from 'lucide-react';
import { useSocial } from '../social/SocialContext';
import type { AppNotification } from '../types/social';
import { formatCurrency, formatPrice, formatQuantity, formatRelativeTime } from '../utils/format';
import { SIDE_LABEL_KEY } from '../utils/labels';

function timeAgo(iso: string, t: TFunction) {
  return formatRelativeTime(iso, 'narrow') ?? t('common.justNow');
}

function notificationLink(n: AppNotification): string | null {
  switch (n.type) {
    case 'friend_request':
    case 'friend_request_accepted':
    case 'friend_accepted':
      return '/friends';
    case 'message':
      return typeof n.data?.fromUserId === 'string' ? `/messages/${n.data.fromUserId}` : '/messages';
    case 'order_filled':
    case 'order_placed':
    case 'order_cancelled':
      return '/trade';
    case 'deposit':
    case 'password_changed':
    case 'two_factor_enabled':
    case 'two_factor_disabled':
    case 'profile_updated':
      return '/settings';
    default:
      return null;
  }
}

// Render params the backend puts in `data`, pre-formatted for the active locale.
function interpolationParams(data: AppNotification['data'], t: TFunction) {
  const params: Record<string, string> = {};
  if (!data) return params;
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined || typeof value === 'object') continue;
    params[key] = String(value);
  }
  if (params.side === 'BUY' || params.side === 'SELL') {
    params.side = t(`notifications.sides.${params.side}`, { defaultValue: t(SIDE_LABEL_KEY[params.side]) });
  }
  if (params.price !== undefined && Number.isFinite(Number(params.price))) params.price = formatPrice(params.price);
  if (params.amount !== undefined && Number.isFinite(Number(params.amount))) params.amount = formatCurrency(params.amount);
  if (params.quantity !== undefined && Number.isFinite(Number(params.quantity))) {
    params.quantity = formatQuantity(params.quantity);
  }
  return params;
}

/**
 * Translated title/body. A template is only used when every {{placeholder}}
 * it needs is present in `data` (older notifications may lack the params) —
 * otherwise the param-less "generic" variant, then the stored English text.
 */
function renderText(
  n: AppNotification,
  field: 'title' | 'body',
  params: Record<string, string>,
  t: TFunction,
  getRaw: (key: string) => unknown,
) {
  const base = `notifications.types.${n.type}`;
  const key = `${base}.${field}`;
  const raw = getRaw(key);
  if (typeof raw === 'string') {
    const needed = [...raw.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]);
    if (needed.every((name) => params[name] !== undefined)) {
      return t(key, { ...params, defaultValue: n[field] });
    }
  }
  const generic = `${key}Generic`;
  if (typeof getRaw(generic) === 'string') return t(generic);
  return n[field];
}

export default function NotificationBell() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useSocial();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const getRaw = (key: string) =>
    i18n.getResource(i18n.resolvedLanguage ?? 'en', 'translation', key) ?? i18n.getResource('en', 'translation', key);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleClick = async (n: AppNotification) => {
    if (!n.isRead) await markAsRead(n.id).catch(() => {});
    const link = notificationLink(n);
    if (link) navigate(link);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground"
        title={t('notifications.title')}
        aria-label={t('notifications.title')}
        aria-expanded={open}
      >
        <Bell className="h-4.5 w-4.5" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        // Phones: pinned to the viewport (an absolute right-0 panel would
        // start off-screen on the left); from sm up it hangs off the bell.
        <div className="fixed inset-x-2 top-14 z-20 rounded-lg border border-border bg-card shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-80 sm:max-w-[calc(100vw-1rem)]">
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
            <span className="text-sm font-semibold">{t('notifications.title')}</span>
            {unreadCount > 0 && (
              <button onClick={() => markAllAsRead().catch(() => {})} className="text-xs text-primary hover:underline">
                {t('notifications.markAllRead')}
              </button>
            )}
          </div>
          <div className="max-h-[70vh] overflow-y-auto sm:max-h-96">
            {notifications.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">{t('notifications.noNotifications')}</p>
            ) : (
              notifications.map((n) => {
                const params = interpolationParams(n.data, t);
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`flex w-full flex-col gap-0.5 border-b border-border px-3 py-2.5 text-left last:border-b-0 hover:bg-accent/60 ${
                      n.isRead ? '' : 'bg-primary/5'
                    }`}
                  >
                    <span className="flex min-w-0 items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{renderText(n, 'title', params, t, getRaw)}</span>
                      <time dateTime={n.createdAt} className="shrink-0 text-[10px] text-muted-foreground">
                        {timeAgo(n.createdAt, t)}
                      </time>
                    </span>
                    <span className="line-clamp-2 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
                      {renderText(n, 'body', params, t, getRaw)}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
