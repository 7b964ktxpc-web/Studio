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

  channel.on(
    'postgres_changes',
    { ...ANSWER_EVENTS, filter: `request_id=eq.${requestId}` },
    payload => {
      const record = (payload as { new?: Record<string, unknown> })?.new;
      if (!record) return;

      const answerId = typeof record.id === 'string' ? record.id : null;
      const text = typeof record.answer === 'string' ? record.answer : null;
      const createdAt = typeof record.created_at === 'string' ? record.created_at : null;

      if (!answerId || !text || !createdAt) return;

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
      if (!record || typeof record.status !== 'string') return;

      handleRealtimeEvent(
        {
          kind: 'request.status_changed',
          id: `${requestId}:${record.status}`,
          requestId,
          createdAt: new Date().toISOString(),
          status: record.status,
        },
        refreshRequest,
      );
    },
  );

  channel.subscribe(status => onStatus?.(status));

  return {
    channelName,
    unsubscribe: async () => {
      await channel.unsubscribe?.();
    },
  };
}
