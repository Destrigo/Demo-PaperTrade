// The backend's OAuth callbacks redirect to /settings. We want users to land
// on /dashboard after any login, so the login page drops a short-lived marker
// before leaving for the provider and the shell consumes it on the way back.
const KEY = 'oauthReturnAt';
const MAX_AGE_MS = 10 * 60 * 1000;

export function markOAuthReturn() {
  try {
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // storage unavailable (private mode…) — user just lands on /settings
  }
}

export function clearOAuthReturnFlag() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** True (once) when we are coming back from an OAuth provider. */
export function consumeOAuthReturn(): boolean {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return false;
    sessionStorage.removeItem(KEY);
    return Date.now() - Number(raw) < MAX_AGE_MS;
  } catch {
    return false;
  }
}
