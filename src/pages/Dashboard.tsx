import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Order, Portfolio } from '../types/types';
import { fetchOrders, fetchPortfolio } from '../services/trading.service';
import { formatCurrency, formatDateTime, formatQuantity, formatSignedCurrency, pnlClass } from '../utils/format';
import { SIDE_LABEL_KEY, STATUS_LABEL_KEY } from '../utils/labels';

const Dashboard = () => {
  const { t } = useTranslation();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [recentTrades, setRecentTrades] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetchPortfolio().catch(() => null),
      fetchOrders().catch(() => [] as Order[]),
    ]).then(([portfolioData, orders]) => {
      if (cancelled) return;
      setPortfolio(portfolioData);
      setRecentTrades(orders.slice(0, 5));
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);


  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">{t('dashboard.title')}</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">{t('dashboard.portfolioValue')}</p>
          <p className="mt-1 break-words font-mono text-xl font-bold sm:text-2xl">
            {loading || !portfolio ? '—' : formatCurrency(portfolio.totalValue)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">{t('dashboard.balance')}</p>
          <p className="mt-1 break-words font-mono text-xl font-bold sm:text-2xl">
            {loading || !portfolio ? '—' : formatCurrency(portfolio.balance)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">{t('dashboard.totalPnl')}</p>
          <p
            className={`mt-1 break-words font-mono text-xl font-bold sm:text-2xl ${
              portfolio ? pnlClass(portfolio.totalPnl) : ''
            }`}
          >
            {loading || !portfolio ? '—' : formatSignedCurrency(portfolio.totalPnl)}
          </p>
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('dashboard.recentTrades')}</h2>
          <Link to="/trade" className="text-sm text-primary underline-offset-2 hover:underline">
            {t('common.seeAll')}
          </Link>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : recentTrades.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">{t('analytics.colDate')}</th>
                  <th className="px-3 py-2">{t('analytics.colSymbol')}</th>
                  <th className="px-3 py-2">{t('analytics.colType')}</th>
                  <th className="px-3 py-2">{t('analytics.colQty')}</th>
                  <th className="px-3 py-2">{t('analytics.colTotal')}</th>
                  <th className="px-3 py-2">{t('trading.status')}</th>
                </tr>
              </thead>
              <tbody>
                {recentTrades.map((order) => (
                  <tr key={order.id} className="border-t border-border">
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{formatDateTime(order.createdAt)}</td>
                    <td className="px-3 py-2 font-medium">{order.asset?.symbol ?? '—'}</td>
                    <td className={`px-3 py-2 font-semibold ${order.type === 'BUY' ? 'text-primary' : 'text-destructive'}`}>
                      {t(SIDE_LABEL_KEY[order.type])}
                    </td>
                    <td className="px-3 py-2 font-mono">{formatQuantity(order.quantity)}</td>
                    <td className="px-3 py-2 font-mono">{formatCurrency(order.total)}</td>
                    <td className="px-3 py-2">{t(STATUS_LABEL_KEY[order.status])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
