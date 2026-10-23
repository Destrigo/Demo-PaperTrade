// In-browser demo backend: all data below is fictional and simulated.
// Prices are static seeds that random-walk locally; nothing is fetched from CoinGecko or Finnhub.
import type { Asset, Order } from '../types/types';
import type { AppNotification, ChatMessage } from '../types/social';

export const DEMO_USER_ID = 'u-demo';

// Small deterministic PRNG so history looks the same on every load.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED_ASSETS: Array<[string, string, 'CRYPTO' | 'STOCK', number, number, number]> = [
  // symbol, name, type, price, change24h %, market cap
  ['BTC', 'Bitcoin', 'CRYPTO', 67000, 1.4, 1.3e12],
  ['ETH', 'Ethereum', 'CRYPTO', 3300, -0.8, 4.0e11],
  ['SOL', 'Solana', 'CRYPTO', 160, 2.9, 7.2e10],
  ['ADA', 'Cardano', 'CRYPTO', 0.45, -1.2, 1.6e10],
  ['DOT', 'Polkadot', 'CRYPTO', 6.8, 0.6, 9.5e9],
  ['LINK', 'Chainlink', 'CRYPTO', 14.2, 3.1, 8.4e9],
  ['AVAX', 'Avalanche', 'CRYPTO', 34, -2.1, 1.3e10],
  ['UNI', 'Uniswap', 'CRYPTO', 9.6, 0.9, 5.8e9],
  ['LTC', 'Litecoin', 'CRYPTO', 82, -0.3, 6.1e9],
  ['DOGE', 'Dogecoin', 'CRYPTO', 0.15, 4.2, 2.2e10],
  ['AAPL', 'Apple Inc.', 'STOCK', 189, 0.5, 2.9e12],
  ['MSFT', 'Microsoft Corp.', 'STOCK', 415, 0.8, 3.1e12],
  ['GOOGL', 'Alphabet Inc.', 'STOCK', 172, -0.4, 2.1e12],
  ['AMZN', 'Amazon.com Inc.', 'STOCK', 182, 1.1, 1.9e12],
  ['TSLA', 'Tesla Inc.', 'STOCK', 178, -2.4, 5.7e11],
  ['META', 'Meta Platforms', 'STOCK', 485, 1.7, 1.2e12],
  ['NVDA', 'NVIDIA Corp.', 'STOCK', 880, 2.3, 2.2e12],
  ['JPM', 'JPMorgan Chase', 'STOCK', 195, 0.2, 5.6e11],
  ['AMD', 'Advanced Micro Devices', 'STOCK', 160, -1.0, 2.6e11],
  ['JNJ', 'Johnson & Johnson', 'STOCK', 155, 0.1, 3.7e11],
];

export const assets: Asset[] = SEED_ASSETS.map(([symbol, name, type, price, change, cap], i) => ({
  id: `a-${symbol}`,
  symbol,
  name,
  type,
  currentPrice: price,
  change24h: change,
  volume24h: Math.round(cap * (0.01 + ((i * 7) % 5) / 200)),
  marketCap: cap,
  high24h: price * 1.02,
  low24h: price * 0.98,
  logoUrl: null,
  isActive: true,
}));

export const assetBySymbol = (symbol: string) => assets.find((a) => a.symbol === symbol.toUpperCase());

const DAY = 86_400_000;

/** Backwards random walk from the current price, so the chart always ends where the asset is now. */
export function priceHistory(symbol: string, days: number) {
  const asset = assetBySymbol(symbol);
  if (!asset) return [];
  const rand = mulberry32([...symbol].reduce((s, c) => s + c.charCodeAt(0) * 31, 7));
  const vol = asset.type === 'CRYPTO' ? 0.035 : 0.014;
  const points: Array<{ time: number; value: number; open: number; high: number; low: number; volume: number }> = [];
  let value = asset.currentPrice;
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  for (let d = 0; d <= days; d++) {
    const open = value / (1 + (rand() - 0.5) * 2 * vol);
    const wick = () => 1 + rand() * vol * 0.6;
    points.push({
      time: Math.floor((end.getTime() - d * DAY) / 1000),
      value,
      open,
      high: Math.max(open, value) * wick(),
      low: Math.min(open, value) / wick(),
      volume: Math.round(asset.volume24h * (0.4 + rand() * 1.2) / asset.currentPrice),
    });
    value = open;
  }
  return points.reverse();
}

// --- Users -------------------------------------------------------------

export interface DemoUser {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  isOnline: boolean;
  lastSeen: string | null;
  createdAt: string;
  language: string;
  twoFactorEnabled: boolean;
  totalValue: number;
  pnlPercent: number;
}

const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

export const users: DemoUser[] = [
  { id: DEMO_USER_ID, email: 'demo@papertrade.demo', username: 'demo', displayName: 'Demo Trader', avatarUrl: null, isOnline: true, lastSeen: null, createdAt: ago(60 * DAY), language: 'en', twoFactorEnabled: false, totalValue: 0, pnlPercent: 0 },
  { id: 'u-ada', email: 'ada@demo.test', username: 'ada_l', displayName: 'Ada L.', avatarUrl: null, isOnline: true, lastSeen: null, createdAt: ago(90 * DAY), language: 'en', twoFactorEnabled: false, totalValue: 14820, pnlPercent: 48.2 },
  { id: 'u-linus', email: 'linus@demo.test', username: 'linus_t', displayName: 'Linus T.', avatarUrl: null, isOnline: false, lastSeen: ago(3 * 3600_000), createdAt: ago(80 * DAY), language: 'en', twoFactorEnabled: false, totalValue: 12310, pnlPercent: 23.1 },
  { id: 'u-grace', email: 'grace@demo.test', username: 'grace_h', displayName: 'Grace H.', avatarUrl: null, isOnline: true, lastSeen: null, createdAt: ago(70 * DAY), language: 'en', twoFactorEnabled: false, totalValue: 11640, pnlPercent: 16.4 },
  { id: 'u-alan', email: 'alan@demo.test', username: 'alan_t', displayName: 'Alan T.', avatarUrl: null, isOnline: false, lastSeen: ago(26 * 3600_000), createdAt: ago(65 * DAY), language: 'en', twoFactorEnabled: false, totalValue: 10420, pnlPercent: 4.2 },
  { id: 'u-margaret', email: 'margaret@demo.test', username: 'margaret_h', displayName: 'Margaret H.', avatarUrl: null, isOnline: false, lastSeen: ago(5 * DAY), createdAt: ago(50 * DAY), language: 'en', twoFactorEnabled: false, totalValue: 9380, pnlPercent: -6.2 },
  { id: 'u-dennis', email: 'dennis@demo.test', username: 'dennis_r', displayName: 'Dennis R.', avatarUrl: null, isOnline: false, lastSeen: ago(2 * DAY), createdAt: ago(40 * DAY), language: 'en', twoFactorEnabled: false, totalValue: 8870, pnlPercent: -11.3 },
];

// --- Mutable session state --------------------------------------------

export interface Holding {
  assetId: string;
  quantity: number;
  avgBuyPrice: number;
}

export const state = {
  loggedIn: true,
  balance: 10_000,
  totalDeposited: 10_000,
  holdings: [] as Holding[],
  orders: [] as Order[],
  friendships: [
    { id: 'f-1', status: 'ACCEPTED' as const, requesterId: 'u-ada', addresseeId: DEMO_USER_ID, createdAt: ago(30 * DAY) },
    { id: 'f-2', status: 'ACCEPTED' as const, requesterId: DEMO_USER_ID, addresseeId: 'u-grace', createdAt: ago(20 * DAY) },
    { id: 'f-3', status: 'PENDING' as const, requesterId: 'u-linus', addresseeId: DEMO_USER_ID, createdAt: ago(2 * DAY) },
  ] as Array<{ id: string; status: 'PENDING' | 'ACCEPTED' | 'DECLINED'; requesterId: string; addresseeId: string; createdAt: string }>,
  messages: [
    { id: 'm-1', senderId: 'u-ada', receiverId: DEMO_USER_ID, content: 'Welcome to the demo! Try placing a market order on BTC.', isRead: false, createdAt: ago(2 * 3600_000) },
  ] as ChatMessage[],
  notifications: [
    { id: 'n-1', type: 'friend_request', title: 'New friend request', body: 'Linus T. sent you a friend request.', data: null, isRead: false, createdAt: ago(2 * DAY) },
  ] as AppNotification[],
};

let idSeq = 100;
export const nextId = (prefix: string) => `${prefix}-${++idSeq}`;

// Seed a few filled trades so analytics and portfolio are not empty on first load.
function seedTrades() {
  const trades: Array<[string, 'BUY' | 'SELL', number, number, number]> = [
    // symbol, side, quantity, price multiplier vs now, days ago
    ['BTC', 'BUY', 0.05, 0.93, 21],
    ['ETH', 'BUY', 0.8, 1.04, 14],
    ['NVDA', 'BUY', 3, 0.9, 9],
    ['SOL', 'BUY', 5, 1.08, 5],
    ['SOL', 'SELL', 2, 1.0, 2],
  ];
  for (const [symbol, side, qty, mult, daysAgo] of trades) {
    const asset = assetBySymbol(symbol)!;
    const price = asset.currentPrice * mult;
    fillOrder(asset, side, qty, price, new Date(Date.now() - daysAgo * DAY).toISOString());
  }
}

export function fillOrder(asset: Asset, side: 'BUY' | 'SELL', qty: number, price: number, when: string, orderType: 'MARKET' | 'LIMIT' = 'MARKET', existing?: Order) {
  const total = qty * price;
  const h = state.holdings.find((x) => x.assetId === asset.id);
  if (side === 'BUY') {
    state.balance -= total;
    if (h) {
      h.avgBuyPrice = (h.avgBuyPrice * h.quantity + total) / (h.quantity + qty);
      h.quantity += qty;
    } else {
      state.holdings.push({ assetId: asset.id, quantity: qty, avgBuyPrice: price });
    }
  } else if (h) {
    state.balance += total;
    h.quantity -= qty;
    if (h.quantity <= 1e-9) state.holdings = state.holdings.filter((x) => x !== h);
  }
  const order: Order = existing ?? {
    id: nextId('o'), assetId: asset.id, type: side, orderType, quantity: qty, price, total,
    status: 'FILLED', filledAt: when, createdAt: when, asset,
  };
  order.status = 'FILLED';
  order.filledAt = when;
  order.price = price;
  order.total = total;
  if (!existing) state.orders.unshift(order);
  return order;
}

seedTrades();

export function portfolioValue() {
  const holdingsValue = state.holdings.reduce((s, h) => s + h.quantity * (assets.find((a) => a.id === h.assetId)?.currentPrice ?? 0), 0);
  return { holdingsValue, totalValue: state.balance + holdingsValue };
}

/** Random-walk step used by the fake price feed; returns the symbols that moved. */
export function tickPrices() {
  const moved: Array<{ symbol: string; price: number; change24h: number }> = [];
  for (const a of assets) {
    if (Math.random() < 0.45) continue;
    const vol = a.type === 'CRYPTO' ? 0.0012 : 0.0005;
    a.currentPrice = Math.max(0.0001, a.currentPrice * (1 + (Math.random() - 0.5) * 2 * vol));
    a.change24h = a.change24h + (Math.random() - 0.5) * 0.05;
    a.high24h = Math.max(a.high24h, a.currentPrice);
    a.low24h = Math.min(a.low24h, a.currentPrice);
    moved.push({ symbol: a.symbol, price: a.currentPrice, change24h: a.change24h });
  }
  // Fill any limit orders the move has crossed.
  for (const o of state.orders) {
    if (o.status !== 'PENDING') continue;
    const a = assets.find((x) => x.id === o.assetId);
    if (!a) continue;
    const hit = o.type === 'BUY' ? a.currentPrice <= o.price : a.currentPrice >= o.price;
    const holding = state.holdings.find((h) => h.assetId === a.id);
    const affordable = o.type === 'BUY' ? state.balance >= o.quantity * o.price : (holding?.quantity ?? 0) >= o.quantity;
    if (hit && affordable) fillOrder(a, o.type, o.quantity, o.price, new Date().toISOString(), 'LIMIT', o);
  }
  return moved;
}
