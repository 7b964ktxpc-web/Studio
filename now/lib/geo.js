export const DEFAULT_RADIUS_M = 1500;

export function validateCoordinates(latitude, longitude) {
  return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 &&
    Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
}

export function distanceMeters(a, b) {
  if (!validateCoordinates(a.latitude, a.longitude) || !validateCoordinates(b.latitude, b.longitude)) {
    throw new Error('INVALID_COORDINATES');
  }
  const R = 6371000;
  const toRad = value => value * Math.PI / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function isWithinRadius(origin, point, radiusM = DEFAULT_RADIUS_M) {
  if (!Number.isFinite(radiusM) || radiusM < 100 || radiusM > 10000) return false;
  return distanceMeters(origin, point) <= radiusM;
}

export function getCurrentPosition(options = {}) {
  if (!('geolocation' in navigator)) {
    return Promise.reject(new Error('GEOLOCATION_UNAVAILABLE'));
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 30000,
      ...options
    });
  });
}
