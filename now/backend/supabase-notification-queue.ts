export type QueueClient = {
  rpc(name: string, args: Record<string, unknown>): Promise<{
    data: unknown;
    error: { message?: string } | null;
  }>;
};

export type NotificationEvent = {
  id: string;
  userId: string;
  requestId: string | null;
  kind: 'NEW_NEARBY_REQUEST' | 'REQUEST_ANSWERED' | 'REQUEST_FINALIZED' | 'REQUEST_EXPIRED';
  attempts: number;
};

function requireNoError(result: { data: unknown; error: { message?: string } | null }, operation: string): unknown {
  if (result.error) throw new Error(`${operation}: ${result.error.message || 'Supabase RPC failed'}`);
  return result.data;
}

function toEvent(row: Record<string, unknown>): NotificationEvent {
  const id = String(row.id || '').trim();
  const userId = String(row.user_id || '').trim();
  const requestId = row.request_id == null ? null : String(row.request_id).trim() || null;
  const kind = String(row.kind || '').toUpperCase();
  const attempts = Number(row.attempts);

  if (!id || !userId) throw new Error('Notification queue returned an invalid event identity');
  if (!['NEW_NEARBY_REQUEST', 'REQUEST_ANSWERED', 'REQUEST_FINALIZED', 'REQUEST_EXPIRED'].includes(kind)) {
    throw new Error(`Notification queue returned an unsupported event kind: ${kind}`);
  }
  if (!Number.isInteger(attempts) || attempts < 1) throw new Error('Notification queue returned an invalid attempts value');

  return { id, userId, requestId, kind: kind as NotificationEvent['kind'], attempts };
}

export function createSupabaseNotificationQueue(client: QueueClient) {
  if (!client || typeof client.rpc !== 'function') throw new Error('Supabase server client is required');

  return Object.freeze({
    async claim(batchSize = 20): Promise<NotificationEvent[]> {
      const normalized = Math.max(1, Math.min(Math.floor(batchSize), 100));
      const result = await client.rpc('claim_notification_events', { p_batch_size: normalized });
      const data = requireNoError(result, 'claim_notification_events');
      if (!Array.isArray(data)) return [];
      return data.map(row => toEvent((row || {}) as Record<string, unknown>));
    },

    async markDelivered(id: string): Promise<boolean> {
      const normalized = String(id || '').trim();
      if (!normalized) throw new Error('notification id is required');
      const result = await client.rpc('mark_notification_delivered', { p_id: normalized });
      return Boolean(requireNoError(result, 'mark_notification_delivered'));
    },

    async release(id: string, error: string, retrySeconds = 30): Promise<boolean> {
      const normalized = String(id || '').trim();
      if (!normalized) throw new Error('notification id is required');
      const seconds = Math.max(5, Math.min(Math.floor(Number(retrySeconds) || 30), 3600));
      const result = await client.rpc('release_notification_event', {
        p_id: normalized,
        p_error: String(error || 'delivery failed').slice(0, 1000),
        p_retry_seconds: seconds,
      });
      return Boolean(requireNoError(result, 'release_notification_event'));
    },
  });
}
