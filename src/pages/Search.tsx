import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search as SearchIcon, UserPlus, MessageCircle, Loader2, Check } from 'lucide-react';
import { useDebounce } from '../hooks/useDebounce';
import { searchUsers, type PublicProfile } from '../services/user.service';
import { resolveAvatarUrl } from '../api/avatar';
import { fetchFriends, fetchOutgoingFriendRequests, sendFriendRequest } from '../services/social.service';
import { useAuth } from '../auth/useAuth';
import { apiErrorMessage } from '../utils/apiError';
import { formatRelativeTime } from '../utils/format';

const LIMIT = 20;

export default function SearchPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [results, setResults] = useState<PublicProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  // tracks a just-clicked action per user id, to flash a brief confirmation
  const [flashed, setFlashed] = useState<{ id: string; kind: 'sent' | 'error'; message?: string } | null>(null);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  const [retryKey, setRetryKey] = useState(0);

  // Messaging is only possible between friends, and "Add friend" is
  // pointless for people who already are friends / already have a request.
  useEffect(() => {
    fetchFriends()
      .then((f) => setFriendIds(new Set(f.map((x) => x.id))))
      .catch(() => {});
    fetchOutgoingFriendRequests()
      .then((o) => setSentRequests((prev) => new Set([...prev, ...o.map((r) => r.otherUser.id)])))
      .catch(() => {});
  }, []);

  const debouncedQuery = useDebounce(query, 350);

  // reset to page 1 whenever the search term changes
  useEffect(() => {
    setPage(1);
  }, [debouncedQuery]);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      setTotal(0);
      setTotalPages(0);
      setError(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(false);

    searchUsers(debouncedQuery.trim(), page, LIMIT)
      .then((data) => {
        if (cancelled) return;
        setResults(data.items);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, page, retryKey]);

  const handleAddFriend = (id: string) => async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await sendFriendRequest(id);
      setSentRequests((prev) => new Set(prev).add(id));
      setFlashed({ id, kind: 'sent' });
    } catch (err: unknown) {
      setFlashed({ id, kind: 'error', message: apiErrorMessage(err, t, 'search.requestFailed') });
    } finally {
      setTimeout(() => setFlashed(null), 2500);
    }
  };

  const handleMessage = (id: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/messages/${id}`);
  };

  const formatLastSeen = (iso: string | null) => {
    if (!iso) return t('friends.offline');
    return t('search.offlineSince', { time: formatRelativeTime(iso) ?? t('common.justNow') });
  };

  const visibleResults = results.filter((u) => u.id !== user?.id);

  const initials = (u: PublicProfile) =>
    (u.displayName || u.username).slice(0, 2).toUpperCase();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">
          {t('search.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('search.subtitle')}
        </p>
      </header>

      <div className="relative mb-6">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          maxLength={50}
          placeholder={t('search.placeholder')}
          aria-label={t('search.placeholder')}
          className="w-full rounded-xl border border-border bg-card py-2.5 pl-10 pr-4 text-sm text-foreground shadow-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/40"
          autoFocus
        />
      </div>

      {/* Empty / prompt state */}
      {!debouncedQuery.trim() && (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {t('search.noQuery')}
        </p>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('search.loading')}
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="flex flex-col items-center gap-3 py-12 text-sm text-muted-foreground">
          <span>{t('search.error')}</span>
          <button
            onClick={() => setRetryKey((k) => k + 1)}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent"
          >
            {t('search.retry')}
          </button>
        </div>
      )}

      {/* No results */}
      {!loading && !error && debouncedQuery.trim() && visibleResults.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {t('search.noResults', { query: debouncedQuery.trim() })}
        </p>
      )}

      {/* Results */}
      {!loading && !error && visibleResults.length > 0 && (
        <>
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('search.resultsCount', { count: total - (results.length - visibleResults.length) })}
          </p>

          <ul className="flex flex-col gap-2">
            {visibleResults.map((u) => {
              const isFriend = friendIds.has(u.id);
              const requested = sentRequests.has(u.id);
              return (
              <li
                key={u.id}
                onClick={() => navigate(`/profile/${u.id}`)}
                className="group flex cursor-pointer items-center gap-4 rounded-xl border border-border bg-card p-3 transition hover:border-primary hover:shadow-sm"
              >
                <div className="relative shrink-0">
                  {resolveAvatarUrl(u.avatarUrl) ? (
                    <img
                      src={resolveAvatarUrl(u.avatarUrl)!}
                      alt=""
                      className="h-11 w-11 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-sm font-semibold text-primary">
                      {initials(u)}
                    </div>
                  )}
                  <span
                    className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card ${
                      u.isOnline ? 'bg-up' : 'bg-muted-foreground/40'
                    }`}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {u.displayName || u.username}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    @{u.username}
                    {' · '}
                    {u.isOnline ? (
                      <span className="text-up">
                        {t('search.online')}
                      </span>
                    ) : (
                      formatLastSeen(u.lastSeen)
                    )}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {!isFriend && (
                  <button
                    title={requested ? t('friends.requestSent') : t('search.addFriend')}
                    aria-label={requested ? t('friends.requestSent') : t('search.addFriend')}
                    disabled={requested}
                    onClick={handleAddFriend(u.id)}
                    className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:border-primary hover:text-primary disabled:cursor-default disabled:opacity-50"
                  >
                    {requested ? <Check className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                    {flashed?.id === u.id && flashed.kind === 'sent' && (
                      <span className="absolute -top-8 right-0 whitespace-nowrap rounded-md bg-accent px-2 py-1 text-[11px] text-foreground shadow">
                        {t('friends.requestSent')}
                      </span>
                    )}
                    {flashed?.id === u.id && flashed.kind === 'error' && (
                      <span className="absolute -top-8 right-0 w-max max-w-[16rem] rounded-md bg-destructive px-2 py-1 text-[11px] text-destructive-foreground shadow">
                        {flashed.message}
                      </span>
                    )}
                  </button>
                  )}
                  <button
                    title={isFriend ? t('search.message') : t('search.messageFriendsOnly')}
                    aria-label={isFriend ? t('search.message') : t('search.messageFriendsOnly')}
                    disabled={!isFriend}
                    onClick={handleMessage(u.id)}
                    className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </button>
                </div>
              </li>
              );
            })}
          </ul>

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-4 text-sm">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-border px-3 py-1.5 font-medium disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t('search.prev')}
              </button>
              <span className="text-muted-foreground">
                {t('search.page', { page, totalPages })}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-lg border border-border px-3 py-1.5 font-medium disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t('search.next')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}