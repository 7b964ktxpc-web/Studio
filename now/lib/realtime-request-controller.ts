import { bindRequestRealtime, type RealtimeRequestBinding } from './realtime-request-binding';
import type { RequestAnswerFlow, RequestSnapshot } from './request-answer-flow';
import type { RealtimeTransport } from './realtime-subscription';

const TERMINAL_REQUEST_STATUSES = new Set(['ANSWERED', 'EXPIRED', 'CANCELLED']);

function isTerminalSnapshot(snapshot: RequestSnapshot): boolean {
  return TERMINAL_REQUEST_STATUSES.has(snapshot.status);
}

export type ActiveRequestRealtimeController = {
  start(requestId: string): Promise<RequestSnapshot>;
  stop(): Promise<void>;
  refresh(): Promise<RequestSnapshot | null>;
  getActiveRequestId(): string | null;
};

export function createActiveRequestRealtimeController(deps: {
  transport: RealtimeTransport;
  flow: RequestAnswerFlow;
  onSnapshot?: (snapshot: RequestSnapshot) => void;
  onRefreshError?: (error: unknown) => void;
  onStatus?: (status: string) => void;
}): ActiveRequestRealtimeController {
  let generation = 0;
  let activeRequestId: string | null = null;
  let activeBinding: RealtimeRequestBinding | null = null;

  const stop = async (): Promise<void> => {
    generation += 1;
    activeRequestId = null;

    const binding = activeBinding;
    activeBinding = null;
    if (binding) await binding.subscription.unsubscribe();
  };

  const start = async (requestId: string): Promise<RequestSnapshot> => {
    const normalized = requestId.trim();
    if (!normalized) throw new Error('Invalid request id');

    await stop();
    const myGeneration = generation;
    activeRequestId = normalized;

    const binding = bindRequestRealtime({
      transport: deps.transport,
      flow: deps.flow,
      requestId: normalized,
      onSnapshot: snapshot => {
        if (myGeneration !== generation || activeRequestId !== normalized) return;
        deps.onSnapshot?.(snapshot);
      },
      onRefreshError: error => {
        if (myGeneration !== generation || activeRequestId !== normalized) return;
        deps.onRefreshError?.(error);
      },
      onStatus: status => {
        if (myGeneration !== generation || activeRequestId !== normalized) return;
        deps.onStatus?.(status);
      },
    });

    activeBinding = binding;

    try {
      const snapshot = await binding.refreshNow();
      if (myGeneration !== generation || activeRequestId !== normalized) {
        throw new Error('Request realtime binding became inactive');
      }

      if (isTerminalSnapshot(snapshot)) {
        await stop();
      }

      return snapshot;
    } catch (error) {
      if (myGeneration === generation && activeRequestId === normalized) {
        await stop();
      } else {
        await binding.subscription.unsubscribe();
      }
      throw error;
    }
  };

  const refresh = async (): Promise<RequestSnapshot | null> => {
    const binding = activeBinding;
    const requestId = activeRequestId;
    if (!binding || !requestId) return null;

    const myGeneration = generation;
    const snapshot = await binding.refreshNow();
    if (myGeneration !== generation || activeRequestId !== requestId) return null;

    if (isTerminalSnapshot(snapshot)) {
      await stop();
    }

    return snapshot;
  };

  return {
    start,
    stop,
    refresh,
    getActiveRequestId: () => activeRequestId,
  };
}
