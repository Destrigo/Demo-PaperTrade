import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';

const Index = () => {
  const { t } = useTranslation();

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-lg flex-1 flex-col items-center justify-center px-4 text-center">
      <h1 className="text-4xl font-bold">PaperTrade</h1>
      <p className="mt-3 text-muted-foreground">{t('index.tagline')}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/login"
          className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
          {t('auth.loginButton')}
        </Link>
        <Link
          to="/register"
          className="rounded border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent">
          {t('auth.registerButton')}
        </Link>
        <LanguageSwitcher className="py-2" />
      </div>
    </div>
  );
};

export default Index;
