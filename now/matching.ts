export type Presence = {
  userId: string;
  lat: number;
  lng: number;
  available: boolean;
  accuracyM: number | null;
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

// Push matching is deliberately local. Never expand automatically beyond 250 m.
export const MATCH_STAGES_M = [50, 100, 150, 250] as const;
export const DEFAULT_MAX_RECIPIENTS = 8;
export const PRESENCE_TTL_MS = 5 * 60 * 1000;
export const MAX_ACCURACY_M = 50;

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
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isFresh(updatedAt: string, now = Date.now()): boolean {
  const timestamp = Date.parse(updatedAt);
  return (
    !Number.isNaN(timestamp) &&
    now - timestamp >= 0 &&
    now - timestamp <= PRESENCE_TTL_MS
  );
}

function stageFor(distanceM: number): number | null {
  const index = MATCH_STAGES_M.findIndex((radius) => distanceM <= radius);
  return index === -1 ? null : index;
}

function isEligible(person: Presence, requesterId: string, now: number): boolean {
  if (person.userId === requesterId) return false;
  if (!person.available) return false;
  if (!isFresh(person.updatedAt, now)) return false;
  if (!Number.isFinite(person.lat) || !Number.isFinite(person.lng)) return false;
  if (person.accuracyM !== null && person.accuracyM > MAX_ACCURACY_M) return false;
  return true;
}

/**
 * Select the nearest opt-in users, expanding only when a stage has too few candidates.
 * Matching is always centered on the place/request coordinates, never on the requester.
 */
export function selectRecipients(
  request: MatchRequest,
  presence: Presence[],
  now = Date.now(),
): MatchCandidate[] {
  const requested = request.maxRecipients ?? DEFAULT_MAX_RECIPIENTS;
  if (!Number.isFinite(requested) || requested < 1) return [];
  const maxRecipients = Math.min(Math.floor(requested), DEFAULT_MAX_RECIPIENTS);

  const candidates = presence
    .filter((person) => isEligible(person, request.requesterId, now))
    .map((person) => ({
      ...person,
      distanceM: Math.round(
        distanceMeters(request.lat, request.lng, person.lat, person.lng),
      ),
    }))
    .map((person) => ({ ...person, stage: stageFor(person.distanceM) }))
    .filter((person) => person.stage !== null)
    .sort(
      (a, b) =>
        a.stage! - b.stage! ||
        a.distanceM - b.distanceM ||
        b.updatedAt.localeCompare(a.updatedAt),
    );

  const selected: MatchCandidate[] = [];
  const seen = new Set<string>();

  for (const stage of MATCH_STAGES_M.keys()) {
    for (const candidate of candidates) {
      if (candidate.stage !== stage || seen.has(candidate.userId)) continue;
      selected.push(candidate);
      seen.add(candidate.userId);
      if (selected.length >= maxRecipients) return selected;
    }
  }

  return selected;
}
