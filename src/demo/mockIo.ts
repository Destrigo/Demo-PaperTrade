// Stand-in for socket.io-client: same small surface the app uses, backed by local timers.
import { DEMO_USER_ID, assets, state, tickPrices, nextId, users } from './state';
import type { ChatMessage } from '../types/social';

type Handler = (...args: never[]) => void;

export interface DemoSocket {
  connected: boolean;
  on(event: string, handler: Handler): DemoSocket;
  emit(event: string, payload?: unknown, ack?: (response: ChatMessage | { error: string }) => void): DemoSocket;
  disconnect(): void;
}

export function io(url: string): DemoSocket {
  const handlers = new Map<string, Set<Handler>>();
  const timers: number[] = [];
  const fire = (event: string, payload: unknown) =>
    handlers.get(event)?.forEach((h) => (h as (p: unknown) => void)(payload));

  const socket: DemoSocket = {
    connected: true,
    on(event, handler) {
      const set = handlers.get(event) ?? new Set<Handler>();
      set.add(handler);
      handlers.set(event, set);
      return socket;
    },
    emit(event, payload, ack) {
      if (event === 'message:send') {
        const { receiverId, content } = payload as { receiverId: string; content: string };
        const msg: ChatMessage = { id: nextId('m'), senderId: DEMO_USER_ID, receiverId, content, isRead: false, createdAt: new Date().toISOString() };
        state.messages.push(msg);
        ack?.(msg);
      }
      return socket;
    },
    disconnect() {
      socket.connected = false;
      timers.forEach((t) => window.clearInterval(t));
      handlers.clear();
    },
  };

  // Handlers are attached synchronously after io() returns, so seed on the next tick.
  window.setTimeout(() => {
    if (url.endsWith('/prices')) {
      fire('price:batch', assets.map((a) => ({ symbol: a.symbol, price: a.currentPrice, change24h: a.change24h })));
      timers.push(window.setInterval(() => {
        const moved = tickPrices();
        if (moved.length) fire('price:update', moved);
      }, 2000));
    } else if (url.endsWith('/social')) {
      fire('presence:snapshot', { onlineUserIds: users.filter((u) => u.isOnline && u.id !== DEMO_USER_ID).map((u) => u.id) });
    }
  }, 0);

  return socket;
}
