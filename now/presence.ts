export type PresenceLocation = {
  lat: number;
  lng: number;
  accuracyM: number | null;
};

export type PresenceState = {
  available: boolean;
  location: PresenceLocation | null;
  updatedAt: string | null;
};

export const PRESENCE_TTL_MS = 5 * 60 * 1000;
export const PRESENCE_HEARTBEAT_MS = 60 * 1000;
export const MAX_MATCH_ACCURACY_M = 50;

export function isValidCoordinates(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export function isUsableAccuracy(accuracyM: number | null): boolean {
  return accuracyM === null || (Number.isFinite(accuracyM) && accuracyM >= 0 && accuracyM <= MAX_MATCH_ACCURACY_M);
}

export function isPresenceFresh(updatedAt: string | null, now = Date.now()): boolean {
  if (!updatedAt) return false;
  const time = Date.parse(updatedAt);
  return !Number.isNaN(time) && time <= now && now - time <= PRESENCE_TTL_MS;
}

export function shouldAdvertisePresence(state: PresenceState, now = Date.now()): boolean {
  if (!state.available || !state.location) return false;
  return isValidCoordinates(state.location.lat, state.location.lng)
    && isUsableAccuracy(state.location.accuracyM)
    && isPresenceFresh(state.updatedAt, now);
}

export function nextHeartbeatAt(now = Date.now()): number {
  return now + PRESENCE_HEARTBEAT_MS;
}
