import { distanceMeters } from './geo.js';

export const MATCH_STAGES_M = Object.freeze([50, 100, 150, 250]);
export const PRESENCE_TTL_MS = 5 * 60 * 1000;
export const MAX_ACCURACY_M = 50;
export const DEFAULT_MAX_RECIPIENTS = 8;

function stageFor(distanceM) {
  const index = MATCH_STAGES_M.findIndex(radius => distanceM <= radius);
  return index === -1 ? null : index;
}

export function matchPresenceToRequest(request, presenceList, now = Date.now()) {
  if (!request?.author_id || !Number.isFinite(request.latitude) || !Number.isFinite(request.longitude)) return [];

  const expiresAt = Date.parse(request.expires_at);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return [];

  const requestedLimit = Number.isFinite(request.max_recipients) ? Math.floor(request.max_recipients) : DEFAULT_MAX_RECIPIENTS;
  const maxRecipients = Math.min(Math.max(requestedLimit, 1), DEFAULT_MAX_RECIPIENTS);

  const candidates = presenceList
    .filter(item => item?.user_id && item.user_id !== request.author_id && item.is_available)
    .filter(item => Number.isFinite(Date.parse(item.last_seen_at)) && now - Date.parse(item.last_seen_at) >= 0 && now - Date.parse(item.last_seen_at) <= PRESENCE_TTL_MS)
    .filter(item => Number.isFinite(item.latitude) && Number.isFinite(item.longitude))
    .filter(item => item.accuracy_m == null || (Number.isFinite(item.accuracy_m) && item.accuracy_m <= MAX_ACCURACY_M))
    .map(item => {
      const distance_m = Math.round(distanceMeters(request, item));
      return { user_id: item.user_id, distance_m, stage: stageFor(distance_m) };
    })
    .filter(item => item.stage !== null)
    .sort((a, b) => a.stage - b.stage || a.distance_m - b.distance_m);

  const selected = [];
  const seen = new Set();

  for (let stage = 0; stage < MATCH_STAGES_M.length; stage += 1) {
    for (const candidate of candidates) {
      if (candidate.stage !== stage || seen.has(candidate.user_id)) continue;
      selected.push({ user_id: candidate.user_id, distance_m: candidate.distance_m });
      seen.add(candidate.user_id);
      if (selected.length >= maxRecipients) return selected;
    }
  }

  return selected;
}

export function notificationPayload(request, distanceM = null) {
  return {
    title: 'Вопрос рядом',
    body: Number.isFinite(distanceM)
      ? `Человек в ${Math.round(distanceM)} м от места задал вопрос. Поможешь ответить?`
      : 'Человек рядом задал вопрос. Поможешь ответить?',
    request_id: request.id
  };
}
