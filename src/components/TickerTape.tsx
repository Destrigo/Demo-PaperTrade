import { usePriceFeed } from '../prices/PriceFeedContext';
import { useLivePrice } from '../prices/useLivePrice';
import { formatPercent, formatPrice, pnlClass } from '../utils/format';

function TickerItem({ symbol, price, change24h }: { symbol: string; price: number; change24h: number }) {
  const live = useLivePrice(symbol, price, change24h);
  const arrow = live.change24h > 0 ? '▲' : live.change24h < 0 ? '▼' : '•';
  return (
    <span
      className={`flex items-center gap-2 whitespace-nowrap px-4 py-1.5 text-xs transition-colors duration-500 ${
        live.flash === 'up' ? 'bg-up/20' : live.flash === 'down' ? 'bg-down/20' : ''
      }`}
    >
      <span className="font-semibold text-foreground">{symbol}</span>
      <span className="text-muted-foreground">{formatPrice(live.price)}</span>
      <span className={pnlClass(live.change24h) || 'text-muted-foreground'}>
        {arrow} {formatPercent(live.change24h, { signed: true })}
      </span>
    </span>
  );
}

/** Scrolling strip of every symbol on the (simulated) price feed. */
export default function TickerTape() {
  const { prices } = usePriceFeed();
  const entries = Object.entries(prices);
  if (entries.length === 0) return <div className="ticker h-[34px]" aria-hidden="true" />;

  const items = entries.map(([symbol, p]) => (
    <TickerItem key={symbol} symbol={symbol} price={p.price} change24h={p.change24h} />
  ));

  return (
    <div className="ticker" role="region" aria-label="Market ticker, simulated prices">
      <div className="ticker-track">
        <div className="flex">{items}</div>
        <div className="flex" aria-hidden="true">
          {entries.map(([symbol, p]) => (
            <TickerItem key={symbol} symbol={symbol} price={p.price} change24h={p.change24h} />
          ))}
        </div>
      </div>
    </div>
  );
}
