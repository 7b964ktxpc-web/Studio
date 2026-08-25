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
  return !Number.isNaN(timestamp) && now - timestamp >= 0 && now - timestamp <= PRESENCE_TTL_MS;
}

function stageFor(distanceM: number): number | null {
  const index = MATCH_STAGES_M.findIndex((radius) => distanceM <= radius);
  return index === -1 ? null : index;
}

/**
 * Select the nearest opt-in users, expanding only when a stage has too few candidates.
 * The request location is the center of matching; requester coordinates are never used
 * as a substitute for the place being asked about.
 */
export function selectRecipients(
  request: MatchRequest,
  presence: Presence[],
  now = Date.now(),
): MatchCandidate[] {
  const maxRecipients = request.maxRecipients ?? DEFAULT_MAX_RECIPIENTS;
  if (!Number.isInteger(maxRecipients) || maxRecipients < 1) return [];

  const candidates = presence
    .filter((person) => person.available)
    .filter((person) => person.userId !== request.requesterId)
    .filter((person) => isFresh(person.updatedAt, now))
    .filter((person) => person.accuracyM === null || person.accuracyM <= 50)
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
  for (const stage of MATCH_STAGES_M.keys()) {
    for (const candidate of candidates) {
      if (candidate.stage !== stage) continue;
      if (selected.some((item) => item.userId === candidate.userId)) continue;
      selected.push(candidate);
      if (selected.length >= maxRecipients) return selected;
    }
    // No automatic jump over the next stage until every candidate in this stage
    // has been considered. This preserves the nearest-first notification policy.
  }

  return selected;
}
