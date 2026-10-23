import axios from 'axios';
import type { TFunction } from 'i18next';

// Backend error messages are i18n keys ("auth.errors.x", "errors.orders.y").
// Anything not shaped like one (raw English from a library, stack text…) must
// never reach the UI, so it falls back to the caller's generic message.
const KEY_SHAPE = /^[a-zA-Z][\w-]*(\.[\w-]+)+$/;

function rawMessages(err: unknown): string[] {
  let message: unknown;
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: unknown } | undefined;
    message = data?.message;
  } else if (err instanceof Error) {
    // Socket acks reject with a plain Error carrying the backend's message.
    message = err.message;
  } else if (typeof err === 'string') {
    message = err;
  }
  if (typeof message === 'string') return [message];
  if (Array.isArray(message)) return message.filter((m): m is string => typeof m === 'string');
  return [];
}

function statusFallbackKey(err: unknown): string | null {
  if (!axios.isAxiosError(err)) return null;
  return err.response?.status === 429 ? 'errors.common.tooManyRequests' : null;
}

/**
 * Turns an API error into user-facing, translated text.
 * Handles a single key or an array of keys (class-validator), de-duplicates,
 * and falls back to `fallbackKey` (then a generic message) for anything unknown.
 */
export function apiErrorMessage(err: unknown, t: TFunction, fallbackKey = 'errors.common.generic'): string {
  const translated = rawMessages(err)
    .map((m) => m.trim())
    .filter((m) => KEY_SHAPE.test(m))
    .map((key) => t(key, { defaultValue: '' }) as string)
    .filter((text) => text !== '');

  const unique = [...new Set(translated)];
  if (unique.length > 0) return unique.join(' ');

  const statusKey = statusFallbackKey(err);
  if (statusKey) return t(statusKey);

  return t(fallbackKey, { defaultValue: t('errors.common.generic') });
}
