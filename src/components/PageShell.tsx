import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { consumeOAuthReturn } from '../auth/oauthReturn';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import Footer from './Footer';
import TickerTape from './TickerTape';

export default function PageShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (consumeOAuthReturn() && pathname === '/settings') {
      navigate('/dashboard', { replace: true });
    }
    // Only on first mount: that's the landing from the OAuth redirect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TickerTape />
        <Navbar onMenuClick={() => setMobileNavOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  );
}