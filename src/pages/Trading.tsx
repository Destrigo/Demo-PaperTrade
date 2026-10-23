import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Asset, Holding, Order, Portfolio } from '../types/types';
import { fetchOrders, fetchPortfolio } from '../services/trading.service';
import AssetTable from '../components/AssetsTable';
import OrderPanel from '../components/OrdersPanel';
import HoldingsTable from '../components/HoldingsTable';
import OpenOrdersTable from '../components/OpenOrdersTable';
import OrderHistoryTable from '../components/OrderHistoryTable';
import { formatCurrency, formatPercent, formatSignedCurrency, pnlClass } from '../utils/format';

export default function TradingPage() {
  const { t } = useTranslation();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [openOrders, setOpenOrders] = useState<Order[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const orderPanelRef = useRef<HTMLDivElement>(null);

  // Below lg the order panel stacks under the (long) asset list, so picking
  // an asset would otherwise give no visible feedback.
  const selectAsset = useCallback((asset: Asset) => {
    setSelectedAsset(asset);
    if (!window.matchMedia('(min-width: 1024px)').matches) {
      requestAnimationFrame(() => orderPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }, []);

  const loadPortfolio = useCallback(() => {
    fetchPortfolio()
      .then(setPortfolio)
      .catch(() => setPortfolio(null));
  }, []);

  const loadOpenOrders = useCallback(() => {
    fetchOrders({ status: 'PENDING' })
      .then(setOpenOrders)
      .catch(() => setOpenOrders([]));
  }, []);

  const refreshAfterOrderChange = useCallback(() => {
    loadPortfolio();
    loadOpenOrders();
    setHistoryRefreshKey((k) => k + 1);
  }, [loadPortfolio, loadOpenOrders]);

  useEffect(() => {
    refreshAfterOrderChange();
  }, [refreshAfterOrderChange]);

  const holdingForSelected: Holding | null =
    (selectedAsset && portfolio?.holdings.find((h) => h.assetId === selectedAsset.id)) || null;

  const handleSelectHolding = (holding: Holding) => {
    selectAsset({
      id: holding.assetId,
      symbol: holding.symbol,
      name: holding.name,
      type: holding.type,
      currentPrice: holding.currentPrice,
      change24h: 0,
      volume24h: 0,
      marketCap: 0,
      high24h: 0,
      low24h: 0,
      logoUrl: holding.logoUrl,
      isActive: true,
    });
  };

  return (
    <div className="p-6">
      <header className="mb-6">
        <h1 className="mb-4 text-2xl font-bold">{t('trading.title')}</h1>
        <div className="grid grid-cols-1 divide-y divide-border rounded-lg bg-card font-mono text-sm shadow-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="px-4 py-3">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('trading.cash')}
            </div>
            <div className="text-lg">{portfolio ? formatCurrency(portfolio.balance) : '—'}</div>
          </div>
          <div className="px-4 py-3">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('trading.holdingsValue')}
            </div>
            <div className="text-lg">{portfolio ? formatCurrency(portfolio.holdingsValue) : '—'}</div>
          </div>
          <div className="px-4 py-3">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('trading.totalPnl')}
            </div>
            <div className={`break-words text-lg ${portfolio ? pnlClass(portfolio.totalPnl) : ''}`}>
              {portfolio
                ? `${formatSignedCurrency(portfolio.totalPnl)} (${formatPercent(portfolio.totalPnlPercent, { signed: true })})`
                : '—'}
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="min-w-0">
          <AssetTable selectedAssetId={selectedAsset?.id ?? null} onSelectAsset={selectAsset} />
        </div>

        <div ref={orderPanelRef} className="flex min-w-0 scroll-mt-4 flex-col gap-4">
          <OrderPanel
            asset={selectedAsset}
            holding={holdingForSelected}
            balance={portfolio?.balance ?? 0}
            onOrderPlaced={refreshAfterOrderChange}
          />
          <OpenOrdersTable orders={openOrders} onCancelled={refreshAfterOrderChange} />
          <HoldingsTable holdings={portfolio?.holdings ?? []} onSelectHolding={handleSelectHolding} />
          <OrderHistoryTable refreshKey={historyRefreshKey} />
        </div>
      </div>
    </div>
  );
}
