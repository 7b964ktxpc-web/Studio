export type RealtimeEventKind =
  | 'request.created'
  | 'request.status_changed'
  | 'answer.created';

export type RealtimeEvent = {
  kind: RealtimeEventKind;
  id: string;
  requestId: string;
  createdAt: string;
  status?: 'SEARCHING' | 'ANSWERED' | 'EXPIRED' | 'CANCELLED';
  answer?: {
    id: string;
    text: string;
    distanceM: number | null;
  };
};

const REQUEST_ID = /^[0-9a-fA-F-]{20,80}$/;
const EVENT_ID = /^[0-9a-fA-F-]{20,80}$/;

export function isSafeRealtimeEvent(value: unknown): value is RealtimeEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Record<string, unknown>;
  if (typeof event.id !== 'string' || !EVENT_ID.test(event.id)) return false;
  if (typeof event.requestId !== 'string' || !REQUEST_ID.test(event.requestId)) return false;
  if (typeof event.createdAt !== 'string' || Number.isNaN(Date.parse(event.createdAt))) return false;
  if (!['request.created', 'request.status_changed', 'answer.created'].includes(String(event.kind))) return false;

  if (event.status !== undefined && !['SEARCHING', 'ANSWERED', 'EXPIRED', 'CANCELLED'].includes(String(event.status))) return false;

  if (event.answer !== undefined) {
    if (!event.answer || typeof event.answer !== 'object') return false;
    const answer = event.answer as Record<string, unknown>;
    if (typeof answer.id !== 'string' || !EVENT_ID.test(answer.id)) return false;
    if (typeof answer.text !== 'string' || answer.text.length < 1 || answer.text.length > 240) return false;
    if (answer.distanceM !== null && (typeof answer.distanceM !== 'number' || !Number.isFinite(answer.distanceM) || answer.distanceM < 0 || answer.distanceM > 250)) return false;
  }

  return true;
}

export function shouldRefreshRequest(event: RealtimeEvent): boolean {
  return event.kind === 'answer.created' || event.kind === 'request.status_changed';
}
