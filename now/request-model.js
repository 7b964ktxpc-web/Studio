// Domain model for the "Сейчас" MVP.
// This file intentionally contains no network calls yet; it is the contract
// that the Realtime backend will implement in the next stage.

export const REQUEST_STATUS = Object.freeze({
  SEARCHING: 'searching',
  ANSWERED: 'answered',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled'
});

export const ANSWER_STATUS = Object.freeze({
  YES: 'yes',
  MAYBE: 'maybe',
  NO: 'no'
});

export function createRequest({ question, latitude, longitude, radius = 1500 }) {
  if (!question || !question.trim()) throw new Error('question_required');
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error('location_required');
  }
  if (!Number.isFinite(radius) || radius < 100 || radius > 10000) {
    throw new Error('invalid_radius');
  }

  return {
    id: crypto.randomUUID(),
    question: question.trim().slice(0, 160),
    latitude,
    longitude,
    radius,
    status: REQUEST_STATUS.SEARCHING,
    createdAt: new Date().toISOString()
  };
}

export function createAnswer({ requestId, status, text = '', distanceMeters }) {
  if (!requestId) throw new Error('request_required');
  if (!Object.values(ANSWER_STATUS).includes(status)) {
    throw new Error('invalid_answer_status');
  }
  if (!Number.isFinite(distanceMeters) || distanceMeters < 0) {
    throw new Error('invalid_distance');
  }

  return {
    id: crypto.randomUUID(),
    requestId,
    status,
    text: text.trim().slice(0, 300),
    distanceMeters,
    createdAt: new Date().toISOString()
  };
}
