import { distanceMeters } from './geo.js';

export function matchPresenceToRequest(request, presenceList, now = Date.now()) {
  if (!request?.author_id || !Number.isFinite(request.latitude) || !Number.isFinite(request.longitude)) return [];
  const radius = Number.isFinite(request.radius_m) ? request.radius_m : 1500;
  const expiresAt = Date.parse(request.expires_at);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return [];

  return presenceList
    .filter(item => item?.user_id && item.user_id !== request.author_id && item.is_available)
    .filter(item => Number.isFinite(Date.parse(item.last_seen_at)) && now - Date.parse(item.last_seen_at) <= 120000)
    .filter(item => Number.isFinite(item.latitude) && Number.isFinite(item.longitude))
    .map(item => ({ user_id: item.user_id, distance_m: distanceMeters(request, item) }))
    .filter(item => item.distance_m <= radius)
    .sort((a, b) => a.distance_m - b.distance_m);
}

export function notificationPayload(request) {
  return {
    title: 'Вопрос рядом',
    body: 'Человек рядом задал вопрос. Поможешь ответить?',
    request_id: request.id
  };
}
