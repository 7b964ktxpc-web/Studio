export type NearbyPresenceState = 'OFF' | 'STARTING' | 'ENABLED' | 'LOW_ACCURACY' | 'PAUSED';

export type PresenceSnapshot = {
  state: NearbyPresenceState;
  accuracyM: number | null;
  updatedAt: string | null;
  message: string;
};

export const PRESENCE_COPY: Record<NearbyPresenceState, string> = {
  OFF: 'Вы не получаете вопросы рядом',
  STARTING: 'Определяем ваше место…',
  ENABLED: 'Я рядом — можно присылать вопросы',
  LOW_ACCURACY: 'Слишком неточная геолокация',
  PAUSED: 'Режим временно приостановлен',
};

export function buildPresenceSnapshot(
  state: NearbyPresenceState,
  accuracyM: number | null,
  updatedAt: string | null = null,
): PresenceSnapshot {
  return {
    state,
    accuracyM,
    updatedAt,
    message: PRESENCE_COPY[state],
  };
}

export function canReceiveNearbyRequests(snapshot: PresenceSnapshot): boolean {
  return snapshot.state === 'ENABLED' && snapshot.accuracyM !== null && snapshot.accuracyM <= 50;
}
