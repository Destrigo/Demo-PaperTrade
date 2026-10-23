import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';

const RAIN = [
  { text: 'SELECT*FROMtrades', duration: 9, opacity: 0.45 },
  { text: '0x4D54A9F2', duration: 12, opacity: 0.3 },
  { text: 'BUY0.05BTC@67012', duration: 7, opacity: 0.55 },
  { text: 'PARTITIONdate=2026', duration: 11, opacity: 0.35 },
  { text: '0xDEADBEEF', duration: 8, opacity: 0.6 },
  { text: 'SELL2SOL@160.2', duration: 13, opacity: 0.28 },
  { text: 'ORDERBYtsDESC', duration: 10, opacity: 0.4 },
  { text: '0x7F3A00C1', duration: 9.5, opacity: 0.5 },
];

const Index = () => {
  const { t } = useTranslation();

  return (
    <div className="relative flex min-h-[80vh] flex-1 items-center overflow-hidden">
      <div className="rain" aria-hidden="true">
        {RAIN.map((col) => (
          <span key={col.text} className="rain-col" style={{ animationDuration: `${col.duration}s`, opacity: col.opacity }}>
            {col.text}
          </span>
        ))}
      </div>
      <div className="rain-veil" aria-hidden="true" />

      <div className="relative mx-auto w-full max-w-5xl px-6 py-16">
        <p className="eyebrow mb-4">Simulated trading · demo</p>
        <h1 className="mb-5 text-[clamp(48px,9vw,112px)] leading-[0.9] tracking-tight">PaperTrade</h1>
        <p className="mb-8 max-w-xl text-lg text-muted-foreground">{t('index.tagline')}</p>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/login"
            className="inline-flex min-h-12 items-center bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-up"
          >
            {t('auth.loginButton')}
          </Link>
          <Link
            to="/register"
            className="inline-flex min-h-12 items-center border border-up px-5 text-sm font-medium text-up transition-colors hover:border-primary hover:text-primary"
          >
            {t('auth.registerButton')}
          </Link>
          <LanguageSwitcher className="py-2" />
        </div>
      </div>
    </div>
  );
};

export default Index;
