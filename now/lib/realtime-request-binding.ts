import { subscribeToRequestRealtime, type RealtimeSubscription, type RealtimeTransport } from './realtime-subscription';
import type { RequestAnswerFlow, RequestSnapshot } from './request-answer-flow';

export type RealtimeRequestBinding = {
  subscription: RealtimeSubscription;
  refreshNow: () => Promise<RequestSnapshot>;
};

export function bindRequestRealtime(deps: {
  transport: RealtimeTransport;
  flow: RequestAnswerFlow;
  requestId: string;
  onSnapshot?: (snapshot: RequestSnapshot) => void;
  onRefreshError?: (error: unknown) => void;
  onStatus?: (status: string) => void;
}): RealtimeRequestBinding {
  const refreshNow = async (): Promise<RequestSnapshot> => {
    const snapshot = await deps.flow.refreshRequest(deps.requestId);
    deps.onSnapshot?.(snapshot);
    return snapshot;
  };

  const refreshFromRealtime = (): void => {
    void refreshNow().catch(error => deps.onRefreshError?.(error));
  };

  const subscription = subscribeToRequestRealtime(
    deps.transport,
    deps.requestId,
    refreshFromRealtime,
    deps.onStatus,
  );

  return { subscription, refreshNow };
}
