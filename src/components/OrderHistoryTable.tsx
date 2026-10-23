import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Order, OrderStatus } from '../types/types';
import { fetchOrders } from '../services/trading.service';
import { STATUS_LABEL_KEY } from '../utils/labels';
import { formatCurrency, formatDateTime, formatPrice, formatQuantity } from '../utils/format';

const STATUS_STYLES: Record<OrderStatus, string> = {
  FILLED: 'bg-up/15 text-up',
  PENDING: 'bg-amber-500/15 text-amber-600',
  CANCELLED: 'bg-muted text-muted-foreground',
};


interface OrderHistoryTableProps {
  /** Bump this (e.g. after placing/cancelling an order) to force a refetch. */
  refreshKey?: number;
}

export default function OrderHistoryTable({ refreshKey }: OrderHistoryTableProps) {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchOrders({})
      .then((data) => {
        if (!cancelled) setOrders(data);
      })
      .catch(() => {
        if (!cancelled) setOrders([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm">
      <div className="border-b border-border bg-muted px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t('trading.orderHistory')}
      </div>

      {loading && <p className="p-4 text-sm text-muted-foreground">{t('trading.assetTable.loading')}</p>}

      {!loading && orders.length === 0 && (
        <p className="p-4 text-sm text-muted-foreground">{t('trading.orderHistoryTable.noOrders')}</p>
      )}

      {!loading && orders.length > 0 && (
        <div className="max-h-80 divide-y divide-border overflow-y-auto">
          {orders.map((order) => (
            <div key={order.id} className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`text-xs font-semibold uppercase ${
                      order.type === 'BUY' ? 'text-up' : 'text-down'
                    }`}
                  >
                    {order.type === 'BUY' ? t('trading.buy') : t('trading.sell')}
                  </span>
                  <span className="font-mono font-semibold">{order.asset.symbol}</span>
                  <span className="font-mono text-xs text-muted-foreground">{formatQuantity(order.quantity)}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${STATUS_STYLES[order.status]}`}
                  >
                    {t(STATUS_LABEL_KEY[order.status])}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDateTime(order.createdAt)}
                </div>
              </div>
              <div className="shrink-0 text-right text-xs text-muted-foreground">
                <div className="font-mono text-foreground">{formatPrice(order.price)}</div>
                <div>{formatCurrency(order.total)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
