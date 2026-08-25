export type Presence = {
  userId: string;
  lat: number;
  lng: number;
  available: boolean;
  updatedAt: string;
};

export type MatchRequest = {
  requesterId: string;
  lat: number;
  lng: number;
  maxRecipients?: number;
};

export type MatchCandidate = Presence & {
  distanceM: number;
};

const RADII_M = [500, 1000, 1500] as const;
const DEFAULT_MAX_RECIPIENTS = 12;

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const earthRadius = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function selectRecipients(
  request: MatchRequest,
  presence: Presence[],
): MatchCandidate[] {
  const maxRecipients = request.maxRecipients ?? DEFAULT_MAX_RECIPIENTS;
  const candidates = presence
    .filter((person) => person.available)
    .filter((person) => person.userId !== request.requesterId)
    .map((person) => ({
      ...person,
      distanceM: Math.round(
        distanceMeters(request.lat, request.lng, person.lat, person.lng),
      ),
    }))
    .filter((person) => RADII_M.some((radius) => person.distanceM <= radius));

  // Prefer the nearest people; stable ordering makes retries deterministic.
  return candidates
    .sort((a, b) => a.distanceM - b.distanceM || a.updatedAt.localeCompare(b.updatedAt))
    .slice(0, maxRecipients);
}

export function isFresh(updatedAt: string, now = Date.now()): boolean {
  const timestamp = Date.parse(updatedAt);
  if (Number.isNaN(timestamp)) return false;
  return now - timestamp <= 5 * 60 * 1000;
}
