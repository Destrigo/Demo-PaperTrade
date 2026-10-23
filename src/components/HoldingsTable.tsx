import { useTranslation } from 'react-i18next';
import type { Holding } from '../types/types';
import { formatCurrency, formatPercent, formatPrice, formatQuantity, formatSignedCurrency, pnlClass } from '../utils/format';

interface HoldingsTableProps {
  holdings: Holding[];
  onSelectHolding: (holding: Holding) => void;
}

export default function HoldingsTable({
  holdings,
  onSelectHolding,
}: HoldingsTableProps) {
  const { t } = useTranslation();

  if (holdings.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        {t('trading.holdingsTable.noHoldings')}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm">
      <div className="border-b border-border px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t('trading.holdingsTable.title')}
      </div>

      <div>
        {holdings.map((h) => {
          return (
            <button
              key={h.assetId}
              onClick={() => onSelectHolding(h)}
              className="grid w-full grid-cols-[1fr_auto] items-center gap-1 border-b border-border px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-accent/60"
            >
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold">
                    {h.symbol}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {formatQuantity(h.quantity)}
                  </span>
                </span>

                <span className="text-xs text-muted-foreground">
                  {t('trading.holdingsTable.avg')} {formatPrice(h.avgBuyPrice)}
                </span>
              </span>

              <span className="text-right">
                <span className="block font-mono text-sm">
                  {formatCurrency(h.currentValue)}
                </span>

                <span
                  className={`block font-mono text-xs ${pnlClass(h.pnl)}`}
                >
                  {formatSignedCurrency(h.pnl)} ({formatPercent(h.pnlPercent, { signed: true })})
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
