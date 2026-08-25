import { isSafeRealtimeEvent, shouldRefreshRequest, type RealtimeEvent } from './realtime-events';
import { addNotification, showLocalNotification } from './notification-center';

export type RequestRefresher = (requestId: string) => Promise<void> | void;
export type EventSubscriber = (event: RealtimeEvent) => void;

export function handleRealtimeEvent(
  raw: unknown,
  refreshRequest: RequestRefresher,
  onEvent?: EventSubscriber,
): boolean {
  if (!isSafeRealtimeEvent(raw)) return false;
  const event = raw;

  onEvent?.(event);

  if (event.kind === 'answer.created' && event.answer) {
    const notification = {
      id: event.id,
      requestId: event.requestId,
      title: 'Есть ответ',
      body: event.answer.text,
      createdAt: event.createdAt,
      kind: 'REQUEST_ANSWERED' as const,
      distanceM: event.answer.distanceM ?? undefined,
    };
    addNotification(notification);
    showLocalNotification(notification);
  }

  if (shouldRefreshRequest(event)) {
    void refreshRequest(event.requestId);
  }

  return true;
}
