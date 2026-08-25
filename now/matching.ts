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
  radiusM?: number;
  maxRecipients?: number;
};

export type MatchCandidate = Presence & { distanceM: number };

// The product never searches beyond 500 m.
// Progressive search steps: 50 -> 100 -> 200 -> 300 -> 500 m.
const RADII_M = [50, 100, 200, 300, 500] as const;
const MAX_RADIUS_M = 500;
const DEFAULT_RADIUS_M = 100;
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

export function normalizeRadius(radiusM?: number): number {
  const requested = radiusM ?? DEFAULT_RADIUS_M;
  if (!Number.isFinite(requested)) return DEFAULT_RADIUS_M;

  let closest = RADII_M[0];
  for (const radius of RADII_M) {
    if (Math.abs(radius - requested) < Math.abs(closest - requested)) {
      closest = radius;
    }
  }
  return closest;
}

export function selectRecipients(
  request: MatchRequest,
  presence: Presence[],
): MatchCandidate[] {
  const radiusM = Math.min(normalizeRadius(request.radiusM), MAX_RADIUS_M);
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
    .filter((person) => person.distanceM <= radiusM);

  return candidates
    .sort(
      (a, b) =>
        a.distanceM - b.distanceM ||
        a.updatedAt.localeCompare(b.updatedAt),
    )
    .slice(0, maxRecipients);
}

export function isFresh(updatedAt: string, now = Date.now()): boolean {
  const timestamp = Date.parse(updatedAt);
  if (Number.isNaN(timestamp)) return false;
  return now - timestamp <= 5 * 60 * 1000;
}
