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

export function subscribeToRequestRealtime(
  transport: RealtimeTransport,
  requestId: string,
  refreshRequest: RequestRefresher,
  onStatus?: (status: string) => void,
): RealtimeSubscription {
  if (!requestId || requestId.length < 20) throw new Error('Invalid request id');

  const channelName = `now:request:${requestId}`;
  const channel = transport.channel(channelName);

  channel.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'answers', filter: `request_id=eq.${requestId}` },
    payload => {
      const record = (payload as { new?: Record<string, unknown> })?.new ?? {};
      const createdAt = typeof record.created_at === 'string' ? record.created_at : new Date().toISOString();
      handleRealtimeEvent(
        {
          kind: 'answer.created',
          id: typeof record.id === 'string' ? record.id : crypto.randomUUID(),
          requestId,
          createdAt,
          answer: {
            id: typeof record.id === 'string' ? record.id : crypto.randomUUID(),
            text: typeof record.answer === 'string' ? record.answer : '',
            distanceM: typeof record.distance_m === 'number' ? record.distance_m : null,
          },
        },
        refreshRequest,
      );
    },
  );

  channel.on(
    'postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'requests', filter: `id=eq.${requestId}` },
    payload => {
      const record = (payload as { new?: Record<string, unknown> })?.new ?? {};
      handleRealtimeEvent(
        {
          kind: 'request.status_changed',
          id: crypto.randomUUID(),
          requestId,
          createdAt: new Date().toISOString(),
          status: typeof record.status === 'string' ? record.status : undefined,
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
