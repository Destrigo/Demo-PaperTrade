import type { OrderSide, OrderStatus } from '../types/types';

/** i18n keys for backend enum values that are shown to the user. */
export const SIDE_LABEL_KEY: Record<OrderSide, string> = {
  BUY: 'trading.buy',
  SELL: 'trading.sell',
};

export const STATUS_LABEL_KEY: Record<OrderStatus, string> = {
  FILLED: 'trading.filled',
  PENDING: 'trading.pending',
  CANCELLED: 'trading.cancelled',
};
