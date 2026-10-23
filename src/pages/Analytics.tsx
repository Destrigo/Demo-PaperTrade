import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { useAuth } from '../auth/useAuth';
import { api } from '../api/api';
import {
  EMPTY_VALUE,
  formatCompactCurrency,
  formatCurrency,
  formatDate,
  formatPercent,
  formatPrice,
  formatQuantity,
  formatSignedCurrency,
  localIsoDate,
  pnlClass,
} from '../utils/format';
import { SIDE_LABEL_KEY } from '../utils/labels';
import { fetchPortfolio } from '../services/trading.service';
import type { Portfolio } from '../types/types';

interface PortfolioPoint {
  date: string;
  totalValue: number;
  balance: number;
  holdingsValue: number;
}
interface AllocationItem {
  symbol: string;
  name: string;
  value: number;
  percentage: number;
}
interface TradeStats {
  totalTrades: number;
  totalPnl: number;
  bestTrade: { symbol: string; pnl: number } | null;
  worstTrade: { symbol: string; pnl: number } | null;
}
interface Trade {
  filledAt: string;
  asset: { symbol: string; name: string };
  type: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  total: number;
}

const PIE_COLORS = [
  '#6366f1',
  '#22c55e',
  '#f59e0b',
  '#ec4899',
  '#14b8a6',
  '#f97316',
];

function fmt(n: number) {
  return formatCurrency(n);
}

function formatTooltipValue(value: unknown) {
  return fmt(Number(value ?? 0));
}

function rangeParams(from: string, to: string) {
  const params: Record<string, string> = {};
  if (from) params.from = from;
  if (to) params.to = to;
  return params;
}

// Local calendar dates: toISOString() would give the UTC date, which is
// "yesterday" for users east of UTC shortly after midnight.
function daysAgoIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return localIsoDate(d);
}

function todayIso() {
  return localIsoDate();
}

function useIsNarrow(maxWidth = 640) {
  const query = `(max-width: ${maxWidth - 1}px)`;
  const [narrow, setNarrow] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setNarrow(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return narrow;
}

// Snapshot dates are plain YYYY-MM-DD; parse them as local midnight.
function formatDay(day: unknown, opts?: Intl.DateTimeFormatOptions) {
  return formatDate(`${String(day)}T00:00:00`, opts);
}

async function downloadViaApi(path: string, params: Record<string, string>, filename: string) {
  const res = await api.get(path, { params, responseType: 'blob' });
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Analytics() {
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const [portfolioData, setPortfolioData] = useState<PortfolioPoint[]>([]);
  const [livePortfolio, setLivePortfolio] = useState<Portfolio | null>(null);
  const [allocation, setAllocation] = useState<AllocationItem[]>([]);
  const [stats, setStats] = useState<TradeStats | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const isNarrow = useIsNarrow();

  const load = useCallback(
    async (nextFrom: string, nextTo: string, opts?: { silent?: boolean }) => {
      if (new Date(nextFrom) > new Date(nextTo)) {
        setError('analytics.invalidDateRange');
        return;
      }
      const silent = opts?.silent ?? false;
      if (!silent) {
        setError('');
        setLoading(true);
      }

      try {
        const params = rangeParams(nextFrom, nextTo);
        const [portfolio, alloc, tradeStats, tradeList, live] = await Promise.all([
          api.get<PortfolioPoint[]>('/analytics/portfolio', { params }),
          api.get<AllocationItem[]>('/analytics/allocation'),
          api.get<TradeStats>('/analytics/stats', { params }),
          api.get<Trade[]>('/analytics/trades', { params }),
          fetchPortfolio().catch(() => null),
        ]);

        setPortfolioData(portfolio.data);
        setAllocation(alloc.data);
        setStats(tradeStats.data);
        setTrades(tradeList.data);
        setLivePortfolio(live);
      } catch {
        // A silent background refresh failing shouldn't blank out an
        // already-loaded dashboard with an error message — just keep
        // showing the last good data and try again on the next tick.
        if (!silent) setError('analytics.loadError');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (authLoading || !user) return;
    void load('', '');
  }, [authLoading, user, load]);

  // Keep the dashboard current without a manual reload: live portfolio
  // value/P&L and trade stats depend on `assets.current_price`, which the
  // backend's market-data cron updates every 30-60s — a 15s poll comfortably
  // catches those changes.
  useEffect(() => {
    if (authLoading || !user) return;
    const id = setInterval(() => {
      void load(from, to, { silent: true });
    }, 15_000);
    return () => clearInterval(id);
  }, [authLoading, user, from, to, load]);

  function applyPreset(days: number | null) {
    if (days === null) {
      setFrom('');
      setTo('');
      void load('', '');
      return;
    }
    const nextFrom = daysAgoIso(days);
    const nextTo = todayIso();
    setFrom(nextFrom);
    setTo(nextTo);
    void load(nextFrom, nextTo);
  }

  async function downloadCsv() {
    try {
      await downloadViaApi('/analytics/export/csv', rangeParams(from, to), 'trades.csv');
    } catch {
      setError('analytics.exportError');
    }
  }

  async function downloadPdf() {
    try {
      await downloadViaApi('/analytics/export/pdf', rangeParams(from, to), 'analytics-report.pdf');
    } catch {
      setError('analytics.exportError');
    }
  }

  const lastSnapshot =
    portfolioData.length > 0 ? portfolioData[portfolioData.length - 1] : null;
  const liveValue = livePortfolio?.totalValue ?? null;
  const livePnl = livePortfolio?.totalPnl ?? null;

  // Stats are per symbol: with a single traded symbol best and worst are the
  // same entry, which reads as a contradiction.
  const worstTrade =
    stats?.worstTrade && stats.worstTrade.symbol !== stats.bestTrade?.symbol ? stats.worstTrade : null;

  const chartData = useMemo(() => {
    if (!livePortfolio) return portfolioData;
    const today = todayIso();
    const livePoint: PortfolioPoint = {
      date: today,
      totalValue: livePortfolio.totalValue,
      balance: livePortfolio.balance,
      holdingsValue: livePortfolio.holdingsValue,
    };
    const withoutToday = portfolioData.filter((p) => p.date !== today);
    return [...withoutToday, livePoint];
  }, [portfolioData, livePortfolio]);

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">{t('analytics.title')}</h1>

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">
            {t('analytics.from')}
          </span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">
            {t('analytics.to')}
          </span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={() => load(from, to)}
          className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          {t('analytics.apply')}
        </button>

        <div className="flex flex-wrap gap-2">
          <PresetButton label={t('analytics.allTime')} onClick={() => applyPreset(null)} />
          <PresetButton label={t('analytics.last7Days')} onClick={() => applyPreset(7)} />
          <PresetButton label={t('analytics.last30Days')} onClick={() => applyPreset(30)} />
          <PresetButton label={t('analytics.last90Days')} onClick={() => applyPreset(90)} />
        </div>

        <div className="flex gap-2 sm:ml-auto">
          <button
            type="button"
            onClick={downloadCsv}
            className="rounded border border-border px-4 py-2 text-sm hover:bg-accent"
          >
            {t('analytics.exportCsv')}
          </button>
          <button
            type="button"
            onClick={downloadPdf}
            className="rounded border border-border px-4 py-2 text-sm hover:bg-accent"
          >
            {t('analytics.exportPdf')}
          </button>
        </div>
      </div>

      {loading && (
        <p className="text-sm text-muted-foreground">{t('analytics.loading')}</p>
      )}
      {error && <p className="text-sm text-destructive">{t(error)}</p>}

      {!loading && !error && (
        <>
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard
              label={t('analytics.livePortfolioValue')}
              value={liveValue !== null ? fmt(liveValue) : EMPTY_VALUE}
            />
            <StatCard
              label={t('analytics.liveTotalPnl')}
              value={livePnl !== null ? formatSignedCurrency(livePnl) : EMPTY_VALUE}
              toneValue={livePnl}
            />
            <StatCard
              label={t('analytics.snapshotPortfolioValue')}
              value={lastSnapshot ? fmt(lastSnapshot.totalValue) : EMPTY_VALUE}
            />
            <StatCard
              label={t('analytics.totalTrades')}
              value={String(stats?.totalTrades ?? 0)}
            />
            <StatCard
              label={t('analytics.bestTrade')}
              value={
                stats?.bestTrade
                  ? `${stats.bestTrade.symbol} ${formatSignedCurrency(stats.bestTrade.pnl)}`
                  : EMPTY_VALUE
              }
              toneValue={stats?.bestTrade?.pnl ?? null}
            />
            <StatCard
              label={t('analytics.worstTrade')}
              value={worstTrade ? `${worstTrade.symbol} ${formatSignedCurrency(worstTrade.pnl)}` : EMPTY_VALUE}
              toneValue={worstTrade?.pnl ?? null}
            />
          </div>

          <Section title={t('analytics.performance')}>
            {chartData.length === 0 ? (
              <EmptyState msg={t('analytics.noSnapshots')} />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart
                  data={chartData}
                  margin={{ top: 10, right: 16, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(d) => formatDay(d, { day: 'numeric', month: 'short' })}
                    minTickGap={16}
                  />
                  <YAxis
                    tickFormatter={(v: number) => formatCompactCurrency(v)}
                    tick={{ fontSize: 11 }}
                    width={64}
                  />
                  <Tooltip formatter={formatTooltipValue} labelFormatter={(d) => formatDay(d)} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="totalValue"
                    name={t('analytics.seriesTotalValue')}
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="holdingsValue"
                    name={t('analytics.seriesHoldingsValue')}
                    stroke="#22c55e"
                    strokeWidth={1.5}
                    dot={false}
                    strokeDasharray="4 2"
                  />
                  <Line
                    type="monotone"
                    dataKey="balance"
                    name={t('analytics.seriesCashBalance')}
                    stroke="#f59e0b"
                    strokeWidth={1.5}
                    dot={false}
                    strokeDasharray="4 2"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Section>

          <Section title={t('analytics.allocation')}>
            {allocation.length === 0 ? (
              <EmptyState msg={t('analytics.noHoldings')} />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={allocation}
                    dataKey="value"
                    nameKey="symbol"
                    cx="50%"
                    cy="50%"
                    outerRadius={isNarrow ? 80 : 100}
                    // Outside labels get clipped on phones; the legend carries the names there.
                    label={
                      isNarrow
                        ? false
                        : (entry) => {
                            const item = entry.payload as AllocationItem | undefined;
                            if (!item) return '';
                            return `${item.symbol} ${formatPercent(item.percentage)}`;
                          }
                    }
                    labelLine={!isNarrow}
                  >
                    {allocation.map((_, i) => (
                      <Cell
                        key={i}
                        fill={PIE_COLORS[i % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={formatTooltipValue} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Section>

          <Section title={t('analytics.tradeHistory')}>
            {trades.length === 0 ? (
              <EmptyState msg={t('analytics.noTrades')} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b-2 border-border text-left">
                      <th className="px-3 py-2 font-semibold">
                        {t('analytics.colDate')}
                      </th>
                      <th className="px-3 py-2 font-semibold">
                        {t('analytics.colSymbol')}
                      </th>
                      <th className="px-3 py-2 font-semibold">
                        {t('analytics.colType')}
                      </th>
                      <th className="px-3 py-2 font-semibold">
                        {t('analytics.colQty')}
                      </th>
                      <th className="px-3 py-2 font-semibold">
                        {t('analytics.colPrice')}
                      </th>
                      <th className="px-3 py-2 font-semibold">
                        {t('analytics.colTotal')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map((trade, i) => (
                      <tr key={i} className="border-b border-border/60">
                        <td className="whitespace-nowrap px-3 py-2">
                          {formatDate(trade.filledAt)}
                        </td>
                        <td className="px-3 py-2 font-semibold">
                          {trade.asset?.symbol}
                        </td>
                        <td
                          className={`px-3 py-2 font-semibold ${
                            trade.type === 'BUY'
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}
                        >
                          {t(SIDE_LABEL_KEY[trade.type])}
                        </td>
                        <td className="px-3 py-2">
                          {formatQuantity(trade.quantity)}
                        </td>
                        <td className="px-3 py-2">
                          {formatPrice(trade.price)}
                        </td>
                        <td className="px-3 py-2">
                          {fmt(Number(trade.total))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  );
}

function PresetButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded border border-border px-3 py-2 text-xs hover:bg-accent"
    >
      {label}
    </button>
  );
}

function StatCard({
  label,
  value,
  toneValue,
}: {
  label: string;
  value: string;
  /** Colors the value by its sign (gain/loss); omit for neutral stats. */
  toneValue?: number | null;
}) {
  const valueClass = toneValue === undefined || toneValue === null ? '' : pnlClass(toneValue);

  return (
    <div className="min-w-0 rounded-lg border border-border bg-card p-4">
      <div className="mb-1 text-xs text-muted-foreground">{label}</div>
      <div className={`break-words text-lg font-bold [overflow-wrap:anywhere] xl:text-base 2xl:text-lg ${valueClass}`}>
        {value}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return <p className="py-6 text-sm text-muted-foreground">{msg}</p>;
}
