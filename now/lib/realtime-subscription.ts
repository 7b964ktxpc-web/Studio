import { handleRealtimeEvent, type RequestRefresher } from './realtime-client';

type ChannelLike = {
  on: (event: string, filter: Record<string, unknown>, callback: (payload: unknown) => void) => ChannelLike;
  subscribe: (callback?: (status: string) => void) => ChannelLike;
  unsubscribe?: () => Promise<unknown> | unknown;
};

export type RealtimeTransport = {
  channel: (name: string) => ChannelLike;
};

export type RealtimeSubscription = {
  channelName: string;
  unsubscribe: () => Promise<void>;
};

const ANSWER_EVENTS = Object.freeze({
  event: 'INSERT',
  schema: 'public',
  table: 'answers',
});

const REQUEST_STATUSES = new Set(['SEARCHING', 'ANSWERED', 'EXPIRED', 'CANCELLED']);
const MAX_DEDUPE_KEYS = 256;

function createEventDeduper() {
  const seen = new Set<string>();
  const order: string[] = [];

  return {
    shouldProcess(eventId: string): boolean {
      if (seen.has(eventId)) return false;

      seen.add(eventId);
      order.push(eventId);

      if (order.length > MAX_DEDUPE_KEYS) {
        const oldest = order.shift();
        if (oldest) seen.delete(oldest);
      }

      return true;
    },
    clear(): void {
      seen.clear();
      order.length = 0;
    },
  };
}

export function subscribeToRequestRealtime(
  transport: RealtimeTransport,
  requestId: string,
  refreshRequest: RequestRefresher,
  onStatus?: (status: string) => void,
): RealtimeSubscription {
  if (!requestId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
    throw new Error('Invalid request id');
  }

  const channelName = `now:request:${requestId}`;
  const channel = transport.channel(channelName);
  const deduper = createEventDeduper();

  channel.on(
    'postgres_changes',
    { ...ANSWER_EVENTS, filter: `request_id=eq.${requestId}` },
    payload => {
      const record = (payload as { new?: Record<string, unknown> })?.new;
      if (!record) return;

      const answerId = typeof record.id === 'string' ? record.id : null;
      const text = typeof record.answer === 'string' ? record.answer : null;
      const createdAt = typeof record.created_at === 'string' ? record.created_at : null;

      if (!answerId || !text || !createdAt || !deduper.shouldProcess(`answer:${answerId}`)) return;

      handleRealtimeEvent(
        {
          kind: 'answer.created',
          id: answerId,
          requestId,
          createdAt,
          answer: {
            id: answerId,
            text,
            distanceM: typeof record.distance_m === 'number' ? record.distance_m : null,
          },
        },
        refreshRequest,
      );
    },
  );

  channel.on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'requests',
      filter: `id=eq.${requestId}`,
    },
    payload => {
      const record = (payload as { new?: Record<string, unknown> })?.new;
      if (!record || typeof record.status !== 'string' || !REQUEST_STATUSES.has(record.status)) return;
      if (!deduper.shouldProcess(`status:${record.status}`)) return;

      handleRealtimeEvent(
        {
          kind: 'request.status_changed',
          id: `${requestId}:${record.status}`,
          requestId,
          createdAt: new Date().toISOString(),
          status: record.status as 'SEARCHING' | 'ANSWERED' | 'EXPIRED' | 'CANCELLED',
        },
        refreshRequest,
      );
    },
  );

  channel.subscribe(status => onStatus?.(status));

  return {
    channelName,
    unsubscribe: async () => {
      deduper.clear();
      await channel.unsubscribe?.();
    },
  };
}
