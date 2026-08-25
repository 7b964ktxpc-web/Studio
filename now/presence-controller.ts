import {
  MAX_MATCH_ACCURACY_M,
  PRESENCE_HEARTBEAT_MS,
  PRESENCE_TTL_MS,
  isPresenceFresh,
  isUsableAccuracy,
  isValidCoordinates,
  nextHeartbeatAt,
} from './presence';

export type GeoSnapshot = {
  lat: number;
  lng: number;
  accuracyM: number | null;
  capturedAt: number;
};

export type PresenceControllerState = {
  available: boolean;
  geo: GeoSnapshot | null;
  nextHeartbeatAt: number | null;
  error: string | null;
};

export const DEFAULT_PRESENCE_STATE: PresenceControllerState = {
  available: false,
  geo: null,
  nextHeartbeatAt: null,
  error: null,
};

export function validateGeoSnapshot(snapshot: GeoSnapshot, now = Date.now()): void {
  if (!isValidCoordinates(snapshot.lat, snapshot.lng)) {
    throw new Error('INVALID_COORDINATES');
  }
  if (!isUsableAccuracy(snapshot.accuracyM)) {
    throw new Error('LOCATION_ACCURACY_TOO_LOW');
  }
  if (snapshot.capturedAt > now || now - snapshot.capturedAt > PRESENCE_TTL_MS) {
    throw new Error('LOCATION_STALE');
  }
}

export function buildPresencePayload(
  snapshot: GeoSnapshot,
  available: boolean,
  now = Date.now(),
): { lat: number; lng: number; accuracyM: number | null; available: boolean } {
  validateGeoSnapshot(snapshot, now);

  return {
    lat: snapshot.lat,
    lng: snapshot.lng,
    accuracyM: snapshot.accuracyM,
    available,
  };
}

export function shouldRefreshPresence(
  lastCapturedAt: number | null,
  now = Date.now(),
): boolean {
  if (lastCapturedAt === null) return true;
  return now - lastCapturedAt >= PRESENCE_HEARTBEAT_MS;
}

export function canReceiveNearbyRequests(
  available: boolean,
  snapshot: GeoSnapshot | null,
  now = Date.now(),
): boolean {
  if (!available || !snapshot) return false;
  return isPresenceFresh(new Date(snapshot.capturedAt).toISOString(), now)
    && isValidCoordinates(snapshot.lat, snapshot.lng)
    && isUsableAccuracy(snapshot.accuracyM);
}

export function heartbeatDeadline(now = Date.now()): number {
  return nextHeartbeatAt(now);
}

export const MATCH_ACCURACY_LIMIT_M = MAX_MATCH_ACCURACY_M;
