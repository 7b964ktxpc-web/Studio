# «Сейчас» — API contract v1.1

Цель: зафиксировать контракт до подключения Supabase, чтобы frontend/backend не расходились.

## Entities

### requests
- `id`: UUID
- `author_id`: UUID
- `text`: string, 1–160 chars
- `latitude`: number, -90..90
- `longitude`: number, -180..180
- `radius_m`: integer, default 1500, max 3000
- `status`: `SEARCHING | ANSWERED | EXPIRED | CANCELLED`
- `created_at`: ISO timestamp
- `expires_at`: ISO timestamp

### presence
- `user_id`: UUID
- `latitude`: number
- `longitude`: number
- `accuracy_m`: number|null
- `last_seen_at`: ISO timestamp
- `is_available`: boolean

### answers
- `id`: UUID
- `request_id`: UUID
- `author_id`: UUID
- `text`: string, max 500 chars
- `created_at`: ISO timestamp
- `distance_m`: number|null

## Rules

1. Never expose another user's exact coordinates.
2. Matching is performed server-side/database-side.
3. Presence is fresh only while `last_seen_at` is within 5 minutes.
4. Presence must have a cleanup/expiry strategy; stale rows must never receive requests.
5. A request expires after 10 minutes unless it is answered or cancelled.
6. The client treats realtime events as hints and refreshes authoritative request state when needed.
7. One user can answer a request only once in MVP.
8. Push notifications must not contain sensitive location data or exact coordinates.
9. A user must explicitly opt in to receiving nearby requests (`is_available=true`).
10. Do not reveal the answerer's identity to the requester in MVP; show freshness/distance only.
11. The same request must not generate duplicate pushes for the same recipient.
12. Rate-limit request creation and answers server-side.

## Realtime events

- `request.created`
- `request.status_changed`
- `answer.created`
- `presence.updated`

Event payloads contain public state/IDs only. Private profile data and exact coordinates are never broadcast.

## MVP matching

For a request, select fresh available users within `radius_m`. Start with a 1.5 km default radius. If there are too few candidates, the backend may expand it up to 3 km. Rank candidates by distance and freshness. Do not broadcast requests to everyone in the city.

## Error contract

```json
{
  "error": {
    "code": "REQUEST_EXPIRED",
    "message": "Запрос больше не принимает ответы"
  }
}
```

Known codes: `INVALID_REQUEST`, `LOCATION_REQUIRED`, `REQUEST_EXPIRED`, `RATE_LIMITED`, `UNAUTHORIZED`, `NOT_FOUND`.
