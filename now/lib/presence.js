const PRESENCE_KEY = 'now_presence_v1';
const DEFAULT_TTL_MS = 2 * 60 * 1000;

export function savePresence({ latitude, longitude, accuracy = null, isAvailable = true }) {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new Error('INVALID_LATITUDE');
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new Error('INVALID_LONGITUDE');
  const value = { latitude, longitude, accuracy, isAvailable, lastSeenAt: new Date().toISOString() };
  localStorage.setItem(PRESENCE_KEY, JSON.stringify(value));
  return value;
}

export function readPresence(ttlMs = DEFAULT_TTL_MS) {
  try {
    const value = JSON.parse(localStorage.getItem(PRESENCE_KEY) || 'null');
    if (!value?.lastSeenAt) return null;
    const age = Date.now() - Date.parse(value.lastSeenAt);
    return age >= 0 && age <= ttlMs && value.isAvailable ? value : null;
  } catch {
    return null;
  }
}

export function clearPresence() {
  localStorage.removeItem(PRESENCE_KEY);
}
