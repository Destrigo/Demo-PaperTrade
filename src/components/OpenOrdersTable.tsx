import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Order } from '../types/types';
import { cancelOrder } from '../services/trading.service';
import { formatDate, formatPrice, formatQuantity } from '../utils/format';
import { apiErrorMessage } from '../utils/apiError';
import { useToast } from '../toast/ToastContext';
import ConfirmDialog from './ConfirmDialog';

interface OpenOrdersTableProps {
  orders: Order[];
  onCancelled: () => void;
}

export default function OpenOrdersTable({ orders, onCancelled }: OpenOrdersTableProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [pendingCancel, setPendingCancel] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCancel = async (order: Order) => {
    setError(null);
    setCancellingId(order.id);
    try {
      await cancelOrder(order.id);
      showToast(t('trading.openOrdersTable.cancelSuccess', { symbol: order.asset.symbol }), 'success');
      onCancelled();
    } catch (err: unknown) {
      setError(apiErrorMessage(err, t, 'trading.openOrdersTable.errorCancel'));
    } finally {
      setCancellingId(null);
      setPendingCancel(null);
    }
  };

  if (orders.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground shadow-sm">
        {t('trading.openOrdersTable.noOrders')}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm">
      <div className="border-b border-border bg-muted px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t('trading.openOrders')}
      </div>
      {error && <p className="px-3 py-2 text-sm text-destructive">{error}</p>}
      <div className="divide-y divide-border">
        {orders.map((order) => (
          <div key={order.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-semibold uppercase ${
                    order.type === 'BUY' ? 'text-up' : 'text-down'
                  }`}
                >
                  {order.type === 'BUY' ? t('trading.buy') : t('trading.sell')}
                </span>
                <span className="font-mono text-sm font-semibold">{order.asset.symbol}</span>
                <span className="font-mono text-xs text-muted-foreground">{formatQuantity(order.quantity)}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {t('trading.openOrdersTable.targetInfo', {
                  price: formatPrice(order.price),
                  date: formatDate(order.createdAt),
                })}
              </div>
            </div>
            <button
              onClick={() => setPendingCancel(order)}
              disabled={cancellingId === order.id}
              className="shrink-0 rounded border border-input px-3 py-2 text-xs font-medium hover:bg-accent disabled:opacity-40"
            >
              {cancellingId === order.id ? t('trading.openOrdersTable.cancelling') : t('trading.cancelOrder')}
            </button>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={pendingCancel !== null}
        title={t('trading.cancelOrder')}
        message={
          pendingCancel
            ? t('trading.openOrdersTable.cancelConfirm', {
                side: pendingCancel.type === 'BUY' ? t('trading.buy') : t('trading.sell'),
                quantity: formatQuantity(pendingCancel.quantity),
                symbol: pendingCancel.asset.symbol,
                price: formatPrice(pendingCancel.price),
              })
            : ''
        }
        confirmLabel={t('trading.cancelOrder')}
        destructive
        busy={cancellingId !== null}
        onConfirm={() => pendingCancel && handleCancel(pendingCancel)}
        onCancel={() => setPendingCancel(null)}
      />
    </div>
  );
}
