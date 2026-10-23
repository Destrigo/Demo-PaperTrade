import { AxiosError, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import {
  DEMO_USER_ID, assetBySymbol, assets, fillOrder, nextId, portfolioValue, priceHistory, state, users,
} from './state';
import type { Order } from '../types/types';

const DAY = 86_400_000;
const me = () => users[0];

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
const fail = (status: number, message: string): never => {
  throw new HttpError(status, message);
};

function body(config: InternalAxiosRequestConfig): Record<string, unknown> {
  if (!config.data) return {};
  if (typeof config.data === 'string') {
    try {
      return JSON.parse(config.data);
    } catch {
      return {};
    }
  }
  return config.data as Record<string, unknown>;
}

function publicUser(id: string) {
  const u = users.find((x) => x.id === id);
  if (!u) return fail(404, 'users.errors.notFound');
  return {
    id: u.id, username: u.username, displayName: u.displayName, avatarUrl: u.avatarUrl,
    isOnline: u.isOnline, lastSeen: u.lastSeen, createdAt: u.createdAt,
  };
}

function sessionUser() {
  const u = me();
  return {
    id: u.id, email: u.email, username: u.username, displayName: u.displayName, avatarUrl: u.avatarUrl,
    balance: state.balance, isOnline: true, lastSeen: null, language: u.language, twoFactorEnabled: u.twoFactorEnabled,
  };
}

function portfolio() {
  const { holdingsValue, totalValue } = portfolioValue();
  const holdings = state.holdings.map((h) => {
    const a = assets.find((x) => x.id === h.assetId)!;
    const currentValue = h.quantity * a.currentPrice;
    const costBasis = h.quantity * h.avgBuyPrice;
    return {
      assetId: a.id, symbol: a.symbol, name: a.name, type: a.type, logoUrl: a.logoUrl,
      quantity: h.quantity, avgBuyPrice: h.avgBuyPrice, currentPrice: a.currentPrice,
      currentValue, costBasis, pnl: currentValue - costBasis,
      pnlPercent: costBasis ? ((currentValue - costBasis) / costBasis) * 100 : 0,
    };
  });
  const totalPnl = totalValue - state.totalDeposited;
  return {
    balance: state.balance, holdingsValue, totalValue, totalPnl,
    totalPnlPercent: state.totalDeposited ? (totalPnl / state.totalDeposited) * 100 : 0,
    holdings,
  };
}

/** Daily portfolio value, replayed from the order history against each asset's synthetic price history. */
function portfolioHistory(from?: string, to?: string) {
  const first = state.orders.length
    ? Math.min(...state.orders.map((o) => new Date(o.filledAt ?? o.createdAt).getTime()))
    : Date.now() - 7 * DAY;
  const start = new Date(first);
  start.setUTCHours(0, 0, 0, 0);
  const points: Array<{ date: string; totalValue: number; balance: number; holdingsValue: number }> = [];
  const filled = state.orders.filter((o) => o.status === 'FILLED').slice().reverse();
  for (let t = start.getTime(); t <= Date.now(); t += DAY) {
    const end = t + DAY;
    let balance = state.totalDeposited;
    const qty = new Map<string, number>();
    for (const o of filled) {
      if (new Date(o.filledAt ?? o.createdAt).getTime() >= end) continue;
      balance += o.type === 'BUY' ? -o.total : o.total;
      qty.set(o.asset.symbol, (qty.get(o.asset.symbol) ?? 0) + (o.type === 'BUY' ? o.quantity : -o.quantity));
    }
    let holdingsValue = 0;
    for (const [symbol, q] of qty) {
      const hist = priceHistory(symbol, 120);
      const day = Math.floor(t / 1000);
      const p = hist.find((x) => x.time >= day) ?? hist[hist.length - 1];
      holdingsValue += q * (p?.value ?? 0);
    }
    points.push({ date: new Date(t).toISOString().slice(0, 10), balance, holdingsValue, totalValue: balance + holdingsValue });
  }
  // Pin the final point to the live value.
  const live = portfolioValue();
  if (points.length) points[points.length - 1] = { ...points[points.length - 1], balance: state.balance, holdingsValue: live.holdingsValue, totalValue: live.totalValue };
  return points.filter((p) => (!from || p.date >= from) && (!to || p.date <= to));
}

function tradesInRange(from?: string, to?: string) {
  return state.orders
    .filter((o) => o.status === 'FILLED')
    .filter((o) => {
      const d = (o.filledAt ?? o.createdAt).slice(0, 10);
      return (!from || d >= from) && (!to || d <= to);
    })
    .slice()
    .reverse();
}

function tradePnl() {
  // Realised P&L per SELL against the running average cost.
  const avg = new Map<string, { q: number; cost: number }>();
  const result: Array<{ symbol: string; pnl: number }> = [];
  for (const o of state.orders.filter((x) => x.status === 'FILLED').slice().reverse()) {
    const cur = avg.get(o.asset.symbol) ?? { q: 0, cost: 0 };
    if (o.type === 'BUY') {
      avg.set(o.asset.symbol, { q: cur.q + o.quantity, cost: cur.cost + o.total });
    } else {
      const unit = cur.q ? cur.cost / cur.q : o.price;
      result.push({ symbol: o.asset.symbol, pnl: (o.price - unit) * o.quantity });
      avg.set(o.asset.symbol, { q: cur.q - o.quantity, cost: cur.cost - unit * o.quantity });
    }
  }
  return result;
}

function leaderboard() {
  const { totalValue } = portfolioValue();
  const rows = users.map((u) => (u.id === DEMO_USER_ID
    ? { ...u, totalValue, pnlPercent: ((totalValue - state.totalDeposited) / state.totalDeposited) * 100 }
    : u));
  rows.sort((a, b) => b.totalValue - a.totalValue);
  return rows.map((u, i) => ({
    rank: i + 1, userId: u.id, username: u.username, displayName: u.displayName, avatarUrl: u.avatarUrl,
    totalValue: u.totalValue, pnlPercent: u.pnlPercent,
  }));
}

function createOrder(b: Record<string, unknown>): Order {
  const asset = assets.find((a) => a.id === b.assetId);
  if (!asset) return fail(404, 'errors.orders.assetNotFound');
  const side = b.type as 'BUY' | 'SELL';
  const kind = b.orderType as 'MARKET' | 'LIMIT';
  const qty = Number(b.quantity);
  if (!(qty > 0)) return fail(400, 'errors.orders.invalidQuantity');
  const price = kind === 'LIMIT' ? Number(b.price) : asset.currentPrice;
  if (!(price > 0)) return fail(400, 'errors.orders.invalidPrice');
  const holding = state.holdings.find((h) => h.assetId === asset.id);
  if (side === 'BUY' && qty * price > state.balance) return fail(400, 'errors.orders.insufficientBalance');
  if (side === 'SELL' && (holding?.quantity ?? 0) < qty) return fail(400, 'errors.orders.insufficientHoldings');

  const now = new Date().toISOString();
  if (kind === 'MARKET') return fillOrder(asset, side, qty, price, now);
  const order: Order = {
    id: nextId('o'), assetId: asset.id, type: side, orderType: 'LIMIT', quantity: qty, price,
    total: qty * price, status: 'PENDING', filledAt: null, createdAt: now, asset,
  };
  state.orders.unshift(order);
  return order;
}

type Params = Record<string, string | number | undefined>;
type Ctx = { method: string; path: string; params: Params; b: Record<string, unknown>; config: InternalAxiosRequestConfig };

function route({ method, path, params, b, config }: Ctx): unknown {
  let m: RegExpMatchArray | null;
  const is = (verb: string, re: RegExp) => method === verb && (m = path.match(re)) !== null;

  // --- auth
  if (is('GET', /^\/auth\/session$/)) return { user: state.loggedIn ? sessionUser() : null };
  if (is('GET', /^\/auth\/providers$/)) return {};
  if (is('POST', /^\/auth\/(login|register)$/)) {
    state.loggedIn = true;
    return { ok: true };
  }
  if (is('POST', /^\/auth\/logout$/)) {
    state.loggedIn = false;
    return { ok: true };
  }
  if (is('POST', /^\/auth\/refresh$/)) return { ok: true };
  if (is('POST', /^\/auth\/(change-password|login\/2fa|2fa\/.*)$/)) return fail(400, 'errors.common.generic');

  // --- market
  if (is('GET', /^\/assets$/)) {
    let list = assets.slice();
    const q = String(params.q ?? '').toLowerCase();
    if (q) list = list.filter((a) => a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q));
    if (params.type) list = list.filter((a) => a.type === params.type);
    const key = ({ price: 'currentPrice', change: 'change24h', name: 'name', volume: 'volume24h', marketCap: 'marketCap' } as const)[
      (params.sort as 'price') ?? 'marketCap'
    ] ?? 'marketCap';
    const dir = params.order === 'asc' ? 1 : -1;
    list.sort((a, b2) => {
      const av = a[key] as string | number, bv = b2[key] as string | number;
      return (typeof av === 'string' ? av.localeCompare(String(bv)) : Number(av) - Number(bv)) * dir;
    });
    const page = Number(params.page ?? 1), limit = Number(params.limit ?? 20);
    return {
      data: list.slice((page - 1) * limit, page * limit),
      meta: { total: list.length, page, limit, totalPages: Math.max(1, Math.ceil(list.length / limit)) },
    };
  }
  if (is('GET', /^\/assets\/([^/]+)\/history$/)) return priceHistory(m![1], Number(params.days ?? 30));
  if (is('GET', /^\/assets\/([^/]+)$/)) return assetBySymbol(m![1]) ?? fail(404, 'errors.orders.assetNotFound');

  // --- portfolio & orders
  if (is('GET', /^\/portfolio$/)) return portfolio();
  if (is('GET', /^\/orders$/)) {
    return state.orders.filter((o) =>
      (!params.status || o.status === params.status) && (!params.type || o.type === params.type) && (!params.assetId || o.assetId === params.assetId));
  }
  if (is('POST', /^\/orders$/)) return createOrder(b);
  if (is('DELETE', /^\/orders\/([^/]+)$/)) {
    const o = state.orders.find((x) => x.id === m![1]);
    if (!o || o.status !== 'PENDING') return fail(400, 'errors.orders.cannotCancel');
    o.status = 'CANCELLED';
    return { ok: true };
  }

  // --- analytics
  const from = params.from as string | undefined, to = params.to as string | undefined;
  if (is('GET', /^\/analytics\/portfolio$/)) return portfolioHistory(from, to);
  if (is('GET', /^\/analytics\/allocation$/)) {
    const p = portfolio();
    const rows = p.holdings.map((h) => ({ symbol: h.symbol, name: h.name, value: h.currentValue }));
    rows.push({ symbol: 'USD', name: 'Cash', value: p.balance });
    const total = rows.reduce((s, r) => s + r.value, 0) || 1;
    return rows.map((r) => ({ ...r, percentage: (r.value / total) * 100 }));
  }
  if (is('GET', /^\/analytics\/stats$/)) {
    const realised = tradePnl();
    const sorted = realised.slice().sort((a, c) => c.pnl - a.pnl);
    return {
      totalTrades: tradesInRange(from, to).length,
      totalPnl: portfolio().totalPnl,
      bestTrade: sorted[0] ?? null,
      worstTrade: sorted.length > 1 ? sorted[sorted.length - 1] : null,
    };
  }
  if (is('GET', /^\/analytics\/trades$/)) {
    return tradesInRange(from, to).map((o) => ({
      filledAt: o.filledAt, asset: { symbol: o.asset.symbol, name: o.asset.name },
      type: o.type, quantity: o.quantity, price: o.price, total: o.total,
    }));
  }
  if (is('GET', /^\/analytics\/export\/csv$/)) {
    const rows = tradesInRange(from, to).map((o) => [o.filledAt, o.asset.symbol, o.type, o.quantity, o.price, o.total].join(','));
    return new Blob([['filledAt,symbol,type,quantity,price,total', ...rows].join('\n')], { type: 'text/csv' });
  }
  if (is('GET', /^\/analytics\/export\/pdf$/)) return fail(400, 'errors.common.generic');

  // --- users
  if (is('POST', /^\/users\/deposit$/)) {
    const amount = Number(b.amount);
    if (!(amount > 0)) return fail(400, 'errors.common.generic');
    state.balance += amount;
    state.totalDeposited += amount;
    return sessionUser();
  }
  if (is('PUT', /^\/users\/me$/)) {
    const u = me();
    u.username = String(b.username ?? u.username);
    u.displayName = (b.displayName as string | null) ?? null;
    return sessionUser();
  }
  if (is('PUT', /^\/users\/me\/avatar$/)) return fail(400, 'errors.common.generic');
  if (is('GET', /^\/users\/search$/)) {
    const q = String(params.q ?? '').toLowerCase();
    const items = users.filter((u) => u.id !== DEMO_USER_ID && (!q || u.username.includes(q) || (u.displayName ?? '').toLowerCase().includes(q))).map((u) => publicUser(u.id));
    const page = Number(params.page ?? 1), limit = Number(params.limit ?? 20);
    return { items: items.slice((page - 1) * limit, page * limit), total: items.length, page, limit, totalPages: Math.max(1, Math.ceil(items.length / limit)) };
  }
  if (is('GET', /^\/users\/([^/]+)$/)) return publicUser(m![1]);
  if (is('GET', /^\/leaderboard$/)) {
    const all = leaderboard();
    const page = Number(params.page ?? 1), limit = Number(params.limit ?? 50);
    return { data: all.slice((page - 1) * limit, page * limit), meta: { page, limit, total: all.length, totalPages: Math.max(1, Math.ceil(all.length / limit)) } };
  }

  // --- friends
  const other = (f: (typeof state.friendships)[number]) => (f.requesterId === DEMO_USER_ID ? f.addresseeId : f.requesterId);
  if (is('GET', /^\/friends$/)) {
    return state.friendships.filter((f) => f.status === 'ACCEPTED').map((f) => ({ friendshipId: f.id, ...publicUser(other(f)) }));
  }
  if (is('GET', /^\/friends\/requests$/)) {
    return state.friendships.filter((f) => f.status === 'PENDING' && f.addresseeId === DEMO_USER_ID)
      .map((f) => ({ id: f.id, status: f.status, createdAt: f.createdAt, otherUser: publicUser(f.requesterId) }));
  }
  if (is('GET', /^\/friends\/requests\/outgoing$/)) {
    return state.friendships.filter((f) => f.status === 'PENDING' && f.requesterId === DEMO_USER_ID)
      .map((f) => ({ id: f.id, status: f.status, createdAt: f.createdAt, otherUser: publicUser(f.addresseeId) }));
  }
  if (is('POST', /^\/friends\/request\/([^/]+)$/)) {
    const f = { id: nextId('f'), status: 'PENDING' as const, requesterId: DEMO_USER_ID, addresseeId: m![1], createdAt: new Date().toISOString() };
    state.friendships.push(f);
    return f;
  }
  if (is('PUT', /^\/friends\/([^/]+)\/(accept|decline)$/)) {
    const f = state.friendships.find((x) => x.id === m![1]);
    if (f) f.status = m![2] === 'accept' ? 'ACCEPTED' : 'DECLINED';
    return f ?? {};
  }
  if (is('DELETE', /^\/friends\/([^/]+)$/)) {
    state.friendships = state.friendships.filter((x) => x.id !== m![1]);
    return { ok: true };
  }

  // --- messages
  if (is('GET', /^\/messages\/unread-counts$/)) {
    const counts = new Map<string, number>();
    for (const msg of state.messages) if (msg.receiverId === DEMO_USER_ID && !msg.isRead) counts.set(msg.senderId, (counts.get(msg.senderId) ?? 0) + 1);
    return [...counts].map(([senderId, count]) => ({ senderId, count }));
  }
  if (is('GET', /^\/messages\/([^/]+)$/)) {
    const id = m![1];
    const msgs = state.messages.filter((x) => (x.senderId === id && x.receiverId === DEMO_USER_ID) || (x.senderId === DEMO_USER_ID && x.receiverId === id));
    return { messages: msgs.slice().sort((a, c) => a.createdAt.localeCompare(c.createdAt)), hasMore: false };
  }
  if (is('POST', /^\/messages\/([^/]+)$/)) {
    const msg = { id: nextId('m'), senderId: DEMO_USER_ID, receiverId: m![1], content: String(b.content ?? ''), isRead: false, createdAt: new Date().toISOString() };
    state.messages.push(msg);
    return msg;
  }
  if (is('PUT', /^\/messages\/([^/]+)\/read$/)) {
    state.messages.forEach((x) => { if (x.senderId === m![1]) x.isRead = true; });
    return { ok: true };
  }

  // --- notifications
  if (is('GET', /^\/notifications\/unread-count$/)) return state.notifications.filter((n) => !n.isRead).length;
  if (is('GET', /^\/notifications$/)) {
    return { data: state.notifications, unreadCount: state.notifications.filter((n) => !n.isRead).length, meta: { page: 1, limit: 50, total: state.notifications.length, totalPages: 1 } };
  }
  if (is('PUT', /^\/notifications\/read-all$/)) {
    state.notifications.forEach((n) => { n.isRead = true; });
    return { ok: true };
  }
  if (is('PUT', /^\/notifications\/([^/]+)\/read$/)) {
    const n = state.notifications.find((x) => x.id === m![1]);
    if (n) n.isRead = true;
    return { ok: true };
  }

  // --- GDPR
  if (is('GET', /^\/gdpr\/export$/)) {
    return new Blob([JSON.stringify({ note: 'Demo data only', user: sessionUser(), orders: state.orders }, null, 2)], { type: 'application/json' });
  }
  if (is('DELETE', /^\/gdpr\/delete-account$/)) return fail(400, 'errors.common.generic');

  void config;
  return fail(404, 'errors.common.generic');
}

export const demoAdapter: AxiosAdapter = async (config) => {
  const path = (config.url ?? '').replace(/^https?:\/\/[^/]+/, '').replace(/^\/api/, '').split('?')[0];
  const respond = (status: number, data: unknown): AxiosResponse => ({
    data, status, statusText: String(status), headers: {}, config, request: {},
  });
  await new Promise((r) => setTimeout(r, 60 + Math.random() * 80));
  try {
    const data = route({ method: (config.method ?? 'get').toUpperCase(), path, params: (config.params ?? {}) as Params, b: body(config), config });
    return respond(200, data);
  } catch (e) {
    if (e instanceof HttpError) {
      const res = respond(e.status, { message: e.message });
      throw new AxiosError(e.message, String(e.status), config, {}, res);
    }
    throw e;
  }
};
