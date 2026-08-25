export type NotificationEvent = {
  id: string;
  userId: string;
  requestId: string | null;
  kind: 'NEW_NEARBY_REQUEST' | 'REQUEST_ANSWERED' | 'REQUEST_EXPIRED';
  attempts: number;
};

export type DeliveryResult =
  | { delivered: true }
  | { delivered: false; error: string; retrySeconds?: number };

export interface PushAdapter {
  send(userId: string, event: NotificationEvent): Promise<DeliveryResult>;
}

export interface NotificationQueue {
  claim(batchSize: number): Promise<NotificationEvent[]>;
  markDelivered(id: string): Promise<boolean>;
  release(id: string, error: string, retrySeconds: number): Promise<boolean>;
}

/**
 * The worker deliberately knows nothing about coordinates or private profiles.
 * Matching happens in Postgres; this layer only delivers already-authorized events.
 */
export async function processNotificationBatch(
  queue: NotificationQueue,
  push: PushAdapter,
  batchSize = 20,
): Promise<{ delivered: number; retried: number; failed: number }> {
  const events = await queue.claim(Math.max(1, Math.min(batchSize, 100)));
  let delivered = 0;
  let retried = 0;
  let failed = 0;

  for (const event of events) {
    try {
      const result = await push.send(event.userId, event);

      if (result.delivered) {
        if (await queue.markDelivered(event.id)) delivered += 1;
        continue;
      }

      const retrySeconds = result.retrySeconds ?? Math.min(300, 30 * Math.max(1, event.attempts));
      if (await queue.release(event.id, result.error, retrySeconds)) retried += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown delivery error';
      if (await queue.release(event.id, message, 30)) retried += 1;
      else failed += 1;
    }
  }

  return { delivered, retried, failed };
}
