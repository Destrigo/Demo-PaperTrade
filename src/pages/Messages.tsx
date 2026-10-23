import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Loader2, Send } from 'lucide-react';
import Avatar from '../components/Avatar';
import MessageBubble from '../components/MessageBubble';
import { useAuth } from '../auth/useAuth';
import { useSocial } from '../social/SocialContext';
import {
  fetchConversation,
  fetchFriends,
  fetchUnreadMessageCounts,
  markConversationRead,
} from '../services/social.service';
import type { ChatMessage, Friend } from '../types/social';
import { apiErrorMessage } from '../utils/apiError';

// Matches the backend's MAX_MESSAGE_LENGTH.
const MAX_MESSAGE_LENGTH = 2000;

export default function MessagesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { userId: otherUserId } = useParams<{ userId?: string }>();
  const { user } = useAuth();
  const { onlineUserIds, presenceReady, onMessage, sendMessage, onNotification, seedPresence } = useSocial();

  const [friends, setFriends] = useState<Friend[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [draft, setDraft] = useState('');
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [sendError, setSendError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  // Anything written here since mount (a live increment, or a conversation
  // being marked read) is more current than the initial GET that seeds
  // unreadCounts — that fetch can still resolve *after* one of those, and
  // without this it would silently overwrite the correct value with a
  // stale pre-fetch snapshot.
  const localOverrides = useRef<Record<string, number>>({});

  const setUnreadCount = (id: string, valueOrUpdater: number | ((current: number) => number)) => {
    setUnreadCounts((prev) => {
      const next = typeof valueOrUpdater === 'function' ? valueOrUpdater(prev[id] ?? 0) : valueOrUpdater;
      localOverrides.current = { ...localOverrides.current, [id]: next };
      return { ...prev, [id]: next };
    });
  };

  const loadFriends = useCallback(() => {
    fetchFriends()
      .then((f) => {
        setFriends(f);
        seedPresence(f);
      })
      .catch(() => {})
      .finally(() => setLoadingFriends(false));
  }, [seedPresence]);

  useEffect(
    () =>
      onNotification((n) => {
        if (n.type.startsWith('friend_')) loadFriends();
      }),
    [onNotification, loadFriends],
  );

  useEffect(() => {
    loadFriends();
    fetchUnreadMessageCounts()
      .then((counts) => {
        const server = Object.fromEntries(counts.map((c) => [c.senderId, c.count]));
        setUnreadCounts({ ...server, ...localOverrides.current });
      })
      .catch(() => {});
  }, [loadFriends]);

  useEffect(() => {
    if (!otherUserId) return;
    setLoadingConversation(true);
    setSendError('');
    fetchConversation(otherUserId)
      .then((page) => setMessages([...page.messages].reverse()))
      .catch(() => setMessages([]))
      .finally(() => setLoadingConversation(false));
    markConversationRead(otherUserId)
      .then(() => setUnreadCount(otherUserId, 0))
      .catch(() => {});
  }, [otherUserId]);

  useEffect(() => {
    return onMessage((message) => {
      const inThisConversation =
        !!otherUserId &&
        ((message.senderId === otherUserId && message.receiverId === user?.id) ||
          (message.senderId === user?.id && message.receiverId === otherUserId));

      if (inThisConversation) {
        setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
      } else if (message.receiverId === user?.id) {
        // A message for a conversation that isn't currently open.
        setUnreadCount(message.senderId, (current) => current + 1);
      }
    });
  }, [onMessage, otherUserId, user?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const activeFriend = friends.find((f) => f.id === otherUserId) ?? null;

  const handleSend = useCallback(async () => {
    const content = draft.trim();
    if (!content || !otherUserId) return;
    if (content.length > MAX_MESSAGE_LENGTH) {
      setSendError(t('chat.tooLong', { max: MAX_MESSAGE_LENGTH }));
      return;
    }
    setDraft('');
    setSendError('');

    try {
      const message = await sendMessage(otherUserId, content);
      // The live `message:new` broadcast (see onMessage above) already
      // appends this for a connected socket — de-duped by id, so appending
      // here too is what actually delivers it for the REST fallback path.
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
    } catch (err: unknown) {
      setDraft(content);
      setSendError(apiErrorMessage(err, t, 'chat.sendFailed'));
    }
  }, [draft, otherUserId, sendMessage, t]);

  return (
    // Below md only one pane is visible: the list, or the open conversation
    // (with a back button). Side by side from md up.
    <div className="mx-auto flex h-[calc(100dvh-8rem)] min-h-[24rem] max-w-5xl gap-4 p-4 sm:p-6">
      <aside
        className={`min-h-0 w-full flex-col overflow-y-auto rounded-lg border border-border bg-card md:flex md:w-64 md:shrink-0 lg:w-72 ${
          otherUserId ? 'hidden' : 'flex'
        }`}
      >
        <div className="border-b border-border px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t('chat.conversations')}
        </div>
        {loadingFriends ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : friends.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">{t('chat.noFriendsToMessage')}</p>
        ) : (
          friends.map((f) => (
            <button
              key={f.id}
              onClick={() => navigate(`/messages/${f.id}`)}
              className={`flex min-w-0 items-center gap-2 border-b border-border px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-accent/60 ${
                f.id === otherUserId ? 'bg-accent' : ''
              }`}
            >
              <span className="relative shrink-0">
                <Avatar url={f.avatarUrl} label={f.displayName || f.username} size={8} />
                <span
                  className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card ${
                    (presenceReady ? onlineUserIds.has(f.id) : f.isOnline) ? 'bg-emerald-500' : 'bg-muted-foreground/40'
                  }`}
                />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{f.displayName || f.username}</span>
              {(() => {
                // Always 0 for whichever conversation is currently open —
                // computed at render time rather than cleared via setState,
                // so it can't be clobbered by the unread-counts fetch that's
                // still in flight on first mount (a real race: that fetch
                // and "mark this conversation read" can resolve in either
                // order otherwise).
                const count = f.id === otherUserId ? 0 : (unreadCounts[f.id] ?? 0);
                return (
                  count > 0 && (
                    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                      {count > 9 ? '9+' : count}
                    </span>
                  )
                );
              })()}
            </button>
          ))
        )}
      </aside>

      <section
        className={`min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-border bg-card md:flex ${
          otherUserId ? 'flex' : 'hidden'
        }`}
      >
        {!otherUserId || !activeFriend ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4 text-center text-sm text-muted-foreground">
            {otherUserId && !loadingFriends ? t('chat.notFriends') : t('chat.selectConversation')}
            {otherUserId && (
              <button
                type="button"
                onClick={() => navigate('/messages')}
                className="rounded border border-input px-3 py-1.5 text-sm font-medium hover:bg-accent md:hidden"
              >
                {t('chat.backToConversations')}
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="flex min-w-0 items-center gap-2 border-b border-border px-3 py-3 sm:px-4">
              <button
                type="button"
                onClick={() => navigate('/messages')}
                aria-label={t('chat.backToConversations')}
                title={t('chat.backToConversations')}
                className="-ml-1 rounded p-1 text-muted-foreground hover:bg-accent md:hidden"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <Avatar url={activeFriend.avatarUrl} label={activeFriend.displayName || activeFriend.username} size={8} />
              <span className="min-w-0 truncate text-sm font-semibold">
                {activeFriend.displayName || activeFriend.username}
              </span>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 sm:p-4">
              {loadingConversation ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">{t('chat.noMessagesYet')}</p>
              ) : (
                messages.map((m) => <MessageBubble key={m.id} message={m} isOwn={m.senderId === user?.id} />)
              )}
              <div ref={bottomRef} />
            </div>

            <div className="border-t border-border p-3">
              {sendError && <p className="mb-2 text-xs text-destructive">{sendError}</p>}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex min-w-0 gap-2"
              >
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  maxLength={MAX_MESSAGE_LENGTH}
                  placeholder={t('chat.messagePlaceholder')}
                  aria-label={t('chat.messagePlaceholder')}
                  className="min-w-0 flex-1 rounded border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  type="submit"
                  disabled={!draft.trim()}
                  aria-label={t('chat.send')}
                  title={t('chat.send')}
                  className="flex shrink-0 items-center justify-center rounded bg-primary px-3 text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
