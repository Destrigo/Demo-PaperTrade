// Mirrors the backend password policy so users get feedback before submitting.
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72; // bcrypt ignores bytes past 72

/** Returns the i18n key of the first broken rule, or null when the password is acceptable. */
export function passwordPolicyErrorKey(password: string): string | null {
  if (password.length < PASSWORD_MIN) return 'auth.validation.passwordTooShort';
  if (password.length > PASSWORD_MAX) return 'auth.validation.passwordTooLong';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'auth.validation.passwordTooWeak';
  return null;
}

export const DEPOSIT_MIN = 1;
export const DEPOSIT_MAX = 1_000_000;

/** Returns the i18n key for an invalid deposit amount, or null when valid. */
export function depositErrorKey(raw: string): string | null {
  const trimmed = raw.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return /^\d+\.\d{3,}$/.test(trimmed) ? 'profile.depositTooManyDecimals' : 'profile.invalidAmount';
  }
  const amount = Number(trimmed);
  if (amount <= 0) return 'profile.invalidAmount';
  if (amount < DEPOSIT_MIN) return 'profile.depositTooSmall';
  if (amount > DEPOSIT_MAX) return 'profile.depositTooLarge';
  return null;
}
