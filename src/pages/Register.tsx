import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { api } from '../api/api';
import { apiErrorMessage } from '../utils/apiError';
import { PASSWORD_MAX, PASSWORD_MIN, passwordPolicyErrorKey } from '../utils/validation';
import { useAuth } from '../auth/useAuth';

export default function Register() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const policyError = passwordPolicyErrorKey(password);
    if (policyError) {
      setError(t(policyError));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('auth.passwordsDontMatch'));
      return;
    }

    try {
      await api.post('/auth/register', {
        email,
        username,
        password,
      });

      await refreshUser();
      navigate('/dashboard');
    } catch (err: unknown) {
      setError(apiErrorMessage(err, t, 'auth.registerFailed'));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4 py-8">
      <div className="w-full max-w-sm rounded-lg bg-card p-8 shadow-md">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t('auth.registerTitle')}</h1>
          <LanguageSwitcher />
        </div>
        <p className="mb-6 text-sm text-muted-foreground">{t('auth.registerSubtitle')}</p>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium">{t('auth.email')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.emailPlaceholder')}
              className="w-full rounded border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t('auth.username')}</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t('auth.usernamePlaceholder')}
              className="w-full rounded border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              minLength={3}
              maxLength={50}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t('auth.password')}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.passwordPlaceholder')}
              className="w-full rounded border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              minLength={PASSWORD_MIN}
              maxLength={PASSWORD_MAX}
              autoComplete="new-password"
              required
            />
            <p className="mt-1 text-xs text-muted-foreground">{t('auth.passwordHint')}</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t('auth.confirmPassword')}</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('auth.confirmPassword')}
              maxLength={PASSWORD_MAX}
              autoComplete="new-password"
              className="w-full rounded border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            {t('auth.registerButton')}
          </button>
        </form>
        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
        <p className="mt-4 text-center text-sm text-muted-foreground">
          {t('auth.alreadyHaveAccount')}{' '}
          <Link to="/login" className="text-primary underline">
            {t('auth.loginButton')}
          </Link>
        </p>
      </div>
    </div>
  );
}