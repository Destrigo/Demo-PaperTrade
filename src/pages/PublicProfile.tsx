import { useEffect, useState } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, UserPlus, MessageCircle, Loader2, Check } from 'lucide-react';
import { getPublicProfile, type PublicProfile as PublicProfileType } from '../services/user.service';
import { useAuth } from '../auth/useAuth';
import { resolveAvatarUrl } from '../api/avatar';
import { fetchFriends, fetchOutgoingFriendRequests, sendFriendRequest } from '../services/social.service';
import { apiErrorMessage } from '../utils/apiError';
import { formatDate, formatRelativeTime } from '../utils/format';

export default function PublicProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();

  const [profile, setProfile] = useState<PublicProfileType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [friendRequestError, setFriendRequestError] = useState('');
  const [isFriend, setIsFriend] = useState(false);

  const isSelf = !!currentUser && currentUser.id === id;

  useEffect(() => {
    if (!id || isSelf) return;
    let cancelled = false;
    setLoading(true);
    setError(false);

    fetchFriends()
      .then((f) => {
        if (!cancelled) setIsFriend(f.some((x) => x.id === id));
      })
      .catch(() => {});
    fetchOutgoingFriendRequests()
      .then((o) => {
        if (!cancelled && o.some((r) => r.otherUser.id === id)) setRequestSent(true);
      })
      .catch(() => {});

    getPublicProfile(id)
      .then((data) => {
        if (!cancelled) setProfile(data);
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
  }, [id, isSelf]);

  if (isSelf) {
    return <Navigate to="/settings" replace />;
  }

  const handleAddFriend = async () => {
    if (!id || requestSent) return;
    try {
      await sendFriendRequest(id);
      setRequestSent(true);
    } catch (err: unknown) {
      setFriendRequestError(apiErrorMessage(err, t, 'search.requestFailed'));
      setTimeout(() => setFriendRequestError(''), 2500);
    }
  };

  const handleMessage = () => {
    if (id && isFriend) navigate(`/messages/${id}`);
  };

  const formatLastSeen = (iso: string | null) => {
    if (!iso) return t('friends.offline');
    return t('search.offlineSince', { time: formatRelativeTime(iso) ?? t('common.justNow') });
  };

  const formatJoined = (iso: string) => formatDate(iso, { year: 'numeric', month: 'long' });

  const initials = (p: PublicProfileType) =>
    (p.displayName || p.username).slice(0, 2).toUpperCase();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <button
        onClick={() => navigate(-1)}
        className="mb-6 flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('common.back')}
      </button>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('profile.loading')}
        </div>
      )}

      {!loading && (error || !profile) && (
        <div className="flex flex-col items-center gap-3 py-24 text-center">
          <p className="text-sm text-muted-foreground">
            {t('profile.notFound')}
          </p>
          <button
            onClick={() => navigate('/search')}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent"
          >
            {t('search.title')}
          </button>
        </div>
      )}

      {!loading && !error && profile && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-start gap-5">
            <div className="relative shrink-0">
              {resolveAvatarUrl(profile.avatarUrl) ? (
                <img
                  src={resolveAvatarUrl(profile.avatarUrl)!}
                  alt=""
                  className="h-20 w-20 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent text-xl font-semibold text-primary">
                  {initials(profile)}
                </div>
              )}
              <span
                className={`absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-card ${
                  profile.isOnline ? 'bg-up' : 'bg-muted-foreground/40'
                }`}
              />
            </div>

            <div className="min-w-0 flex-1 pt-1">
              <h1 className="truncate text-xl font-semibold text-foreground">
                {profile.displayName || profile.username}
              </h1>
              <p className="truncate text-sm text-muted-foreground">@{profile.username}</p>

              <p className="mt-2 text-sm">
                {profile.isOnline ? (
                  <span className="font-medium text-up">
                    {t('search.online')}
                  </span>
                ) : (
                  <span className="text-muted-foreground">{formatLastSeen(profile.lastSeen)}</span>
                )}
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                {t('profile.joined', { date: formatJoined(profile.createdAt) })}
              </p>
            </div>
          </div>

          <div className="mt-6 flex gap-2 border-t border-border pt-5">
            {!isFriend && (
            <button
              onClick={handleAddFriend}
              disabled={requestSent}
              className="relative flex flex-1 items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary disabled:cursor-default disabled:opacity-60"
            >
              {requestSent ? <Check className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
              {requestSent ? t('friends.requestSent') : t('search.addFriend')}
              {friendRequestError && (
                <span className="absolute -top-9 w-max max-w-[16rem] rounded-md bg-destructive px-2 py-1 text-[11px] text-destructive-foreground shadow">
                  {friendRequestError}
                </span>
              )}
            </button>
            )}
            <button
              onClick={handleMessage}
              disabled={!isFriend}
              title={isFriend ? undefined : t('search.messageFriendsOnly')}
              className="relative disabled:cursor-not-allowed disabled:opacity-50 flex flex-1 items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
            >
              <MessageCircle className="h-4 w-4" />
              {t('search.message')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}