# «Сейчас» — data contract v1.5

This contract defines the smallest backend model for the MVP. It intentionally contains no production credentials.

## requests
- `id`: uuid
- `author_id`: uuid, nullable for anonymous test mode
- `text`: string, 1–160 characters
- `location`: geography(Point, 4326)
- `radius_m`: integer, 50–250
- `status`: `SEARCHING | ANSWERED | EXPIRED | CANCELLED`
- `created_at`: timestamptz
- `expires_at`: timestamptz

## presence
- `user_id`: uuid
- `location`: geography(Point, 4326)
- `accuracy_m`: number|null
- `available`: boolean
- `last_seen_at`: timestamptz

Presence is eligible for push matching only when:
- `available = true`;
- `last_seen_at` is no older than 5 minutes;
- `accuracy_m` is null or <= 50 m.

## answers
- `id`: uuid
- `request_id`: uuid
- `author_id`: uuid
- `answer`: string, 1–240 characters
- `distance_m`: integer|null
- `created_at`: timestamptz

One user may answer a request only once. The author of the request cannot answer their own request.

## notification_events
- `id`: uuid
- `user_id`: uuid
- `request_id`: uuid|null
- `kind`: `NEW_NEARBY_REQUEST | REQUEST_ANSWERED | REQUEST_EXPIRED`
- `created_at`: timestamptz
- `delivered_at`: timestamptz|null

Unique `(user_id, request_id, kind)` prevents duplicate notification events.

## Request lifecycle

`SEARCHING` → `ANSWERED`

`SEARCHING` → `EXPIRED`

`SEARCHING` → `CANCELLED`

Rules:
1. A new request is valid for 10 minutes.
2. The first accepted answer moves the request to `ANSWERED` atomically.
3. Expired requests reject answers.
4. Cancellation is available only to the request author.
5. After `ANSWERED`, no new answers are accepted in MVP.

## Matching

Matching is performed against the request location, never the requester's current location.

Stages:
- 0–50 m
- 50–100 m
- 100–150 m
- 150–250 m

Never automatically notify beyond 250 m.

## Privacy

- Exact coordinates are never broadcast to clients.
- Requesters see only answer freshness and coarse proximity.
- Responders do not see request author identity.
- Presence coordinates remain server-side and are used only for matching.

## Realtime

Safe events only:
- request status changed;
- answer created for the request author;
- nearby request made available to an eligible opted-in user.

Push/Telegram delivery is an adapter layer over `notification_events`, not part of the core transaction.
