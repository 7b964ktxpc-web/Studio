# «Сейчас» — API contract v1.3

Цель: фиксировать контракт до подключения Supabase, чтобы frontend/backend не расходились.

## Entities

### requests
- `id`: UUID
- `author_id`: UUID
- `text`: string, 1–160 chars
- `latitude`: number, -90..90
- `longitude`: number, -180..180
- `radius_m`: integer, default 50, max 250
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

## Nearby notification policy

1. Default notification radius is **50 m** from the request location.
2. Never send a nearby-request push to users more than **250 m** from the request location.
3. Expand matching in stages: 50 m → 100 m → 150 m → 250 m, only when the previous stage has too few eligible recipients.
4. A wider stage must never notify a user if the earlier stages already contain enough eligible recipients.
5. Being in the same neighbourhood, building, street, or district is not sufficient; distance to the request location is what matters.
6. The user must explicitly opt in to nearby requests (`is_available=true`).
7. The device's reported location must be fresh and sufficiently accurate for matching.
8. Pushes are deduplicated per request/recipient.
9. The requester can view wider activity on the map manually, but map visibility does not imply a push notification.
10. Each request uses a fixed recipient budget (default 8). The budget is consumed by the nearest eligible users first.

## Presence policy

- Presence TTL: **5 minutes**.
- `last_seen_at` in the future is invalid and must not match.
- Presence with `accuracy_m > 50` is not eligible for push matching.
- `is_available=false` immediately removes a user from matching.
- Client location is used for presence only after explicit permission.
- Server/database calculates distance; never trust a client-supplied distance.

## Privacy and security rules

1. Never expose another user's exact coordinates.
2. Matching is performed server-side/database-side.
3. Stale presence must never receive requests.
4. A request expires after 10 minutes unless answered or cancelled.
5. The client treats realtime events as hints and refreshes authoritative request state when needed.
6. One user can answer a request only once in MVP.
7. Push notifications must not contain sensitive location data or exact coordinates.
8. Do not reveal the answerer's identity to the requester in MVP; show freshness/distance only.
9. Rate-limit request creation and answers server-side.
10. Users may disable nearby notifications without disabling the ability to answer manually.

## Realtime events

- `request.created`
- `request.status_changed`
- `answer.created`
- `presence.updated`

Event payloads contain public state/IDs only. Private profile data and exact coordinates are never broadcast.

## MVP matching

Candidate selection is performed against the request's exact location, not against the requester's current location. Candidates are considered in stages:

- Stage 1: 0–50 m
- Stage 2: 50–100 m
- Stage 3: 100–150 m
- Stage 4: 150–250 m

The backend ranks candidates by stage, then distance, then freshness. It stops after the recipient budget is filled. There is no automatic matching beyond 250 m. Do not broadcast requests to everyone in the city.

## Error contract

```json
{
  "error": {
    "code": "REQUEST_EXPIRED",
    "message": "Запрос больше не принимает ответы"
  }
}
```

Known codes: `INVALID_REQUEST`, `LOCATION_REQUIRED`, `INACCURATE_LOCATION`, `REQUEST_EXPIRED`, `RATE_LIMITED`, `UNAUTHORIZED`, `NOT_FOUND`.
