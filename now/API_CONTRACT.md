# «Сейчас» — API contract v1

## Goal

Сначала фиксируем контракт данных до подключения Supabase. Это снижает риск расхождения фронтенда и backend.

## Entities

### requests
- `id`: UUID
- `author_id`: UUID
- `text`: string, 1–160 chars
- `latitude`: number, -90..90
- `longitude`: number, -180..180
- `radius_m`: integer, default 1500
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
2. Matching uses distance on the server/database side.
3. Presence is considered fresh only for a short TTL; stale presence must not receive requests.
4. A request must expire automatically after its TTL.
5. The client must treat realtime events as hints and refresh authoritative request state when needed.
6. One user can answer a request only once unless an explicit edit flow is introduced later.
7. Push notifications must not contain sensitive location data.
8. The frontend keeps working when realtime is unavailable by polling the request state as a fallback.

## Realtime events

- `request.created`
- `request.status_changed`
- `answer.created`
- `presence.updated`

## MVP matching

For a request, select fresh available users within `radius_m`. Start with 1.5 km default radius. Do not send to everyone in the city. Later add ranking by distance, recent answer quality, and rate limits.

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
