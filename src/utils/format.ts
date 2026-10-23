import i18n from '../i18n';

const LOCALE_MAP: Record<string, string> = {
  en: 'en-US',
  fr: 'fr-FR',
  nl: 'nl-NL',
};

export const EMPTY_VALUE = '—';

export function currentLocale(): string {
  return LOCALE_MAP[i18n.resolvedLanguage ?? 'en'] ?? 'en-US';
}

// Rounds to `decimals` and turns -0 into 0, so e.g. -0.001 never renders as
// "-0.00" (or gets a red/negative color).
export function roundTo(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  const rounded = Math.round(value * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function toNumber(value: number | string | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

// The app's balances/prices are always denominated in (virtual) USD — only
// the grouping/decimal formatting conventions follow the active language.

/** Money amounts (balances, totals, P&L): always 2 decimals. */
export function formatCurrency(value: number | string | null | undefined) {
  return roundTo(toNumber(value), 2).toLocaleString(currentLocale(), {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Money with an explicit "+" for gains (no sign for zero). */
export function formatSignedCurrency(value: number | string | null | undefined) {
  return roundTo(toNumber(value), 2).toLocaleString(currentLocale(), {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: 'exceptZero',
  });
}

/** Asset unit prices: sub-$1 assets keep extra precision, everything else 2 decimals. */
export function formatPrice(value: number | string | null | undefined) {
  const n = toNumber(value);
  const small = n !== 0 && Math.abs(n) < 1;
  return n.toLocaleString(currentLocale(), {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: small ? 6 : 2,
  });
}

export function formatPercent(value: number | string | null | undefined, opts?: { signed?: boolean }) {
  return (roundTo(toNumber(value), 2) / 100).toLocaleString(currentLocale(), {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: opts?.signed ? 'exceptZero' : 'auto',
  });
}

/** Tailwind text color for a gain/loss value — neutral when it rounds to 0. */
export function pnlClass(value: number | string | null | undefined, decimals = 2) {
  const r = roundTo(toNumber(value), decimals);
  if (r > 0) return 'text-emerald-600';
  if (r < 0) return 'text-destructive';
  return '';
}

export function formatQuantity(value: number | string | null | undefined) {
  return toNumber(value).toLocaleString(currentLocale(), { maximumFractionDigits: 8 });
}

export function formatCompact(value: number | string | null | undefined) {
  return new Intl.NumberFormat(currentLocale(), { notation: 'compact', maximumFractionDigits: 1 }).format(
    toNumber(value),
  );
}

/** Compact number, or "—" when the provider has no value (reported as 0). */
export function formatCompactOrDash(value: number | string | null | undefined) {
  const n = toNumber(value);
  return n === 0 ? EMPTY_VALUE : formatCompact(n);
}

/** Short currency for chart axes, e.g. "$10K" / "10 k $". */
export function formatCompactCurrency(value: number | string | null | undefined) {
  return new Intl.NumberFormat(currentLocale(), {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(toNumber(value));
}

type DateInput = string | number | Date;

export function formatDate(value: DateInput, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }) {
  return new Date(value).toLocaleDateString(currentLocale(), opts);
}

export function formatDateTime(value: DateInput) {
  return new Date(value).toLocaleString(currentLocale(), { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatTime(value: DateInput) {
  return new Date(value).toLocaleTimeString(currentLocale(), { hour: '2-digit', minute: '2-digit' });
}

/** Localized "5 min ago" / "il y a 5 min"; under a minute returns null so callers can show their own "just now". */
export function formatRelativeTime(value: DateInput, style: Intl.RelativeTimeFormatStyle = 'short'): string | null {
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return null;
  const rtf = new Intl.RelativeTimeFormat(currentLocale(), { numeric: 'auto', style });
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(seconds / 86400), 'day');
  if (abs < 86400 * 365) return rtf.format(Math.round(seconds / (86400 * 30)), 'month');
  return rtf.format(Math.round(seconds / (86400 * 365)), 'year');
}

/** YYYY-MM-DD in the user's local timezone (toISOString() would give the UTC date). */
export function localIsoDate(d: Date = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
