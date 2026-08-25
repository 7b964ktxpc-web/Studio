# «Сейчас» — data contract v1.4

This contract defines the smallest backend model for the MVP. It intentionally contains no secrets or production credentials.

## 1. requests

A question asked by a user for a specific place or point.

- `id`: uuid
- `author_id`: uuid, nullable for anonymous test mode
- `text`: string, 1–160 characters
- `lat`: number
- `lng`: number
- `radius_m`: integer, default 50, max 250
- `status`: `SEARCHING | ANSWERED | EXPIRED | CANCELLED`
- `created_at`: timestamptz
- `expires_at`: timestamptz

Indexes:
- `(status, created_at)`
- geospatial index for `lat/lng` when PostGIS is enabled

## 2. presence

An opt-in signal that a person is currently available to answer nearby questions.

- `user_id`: uuid
- `lat`: number
- `lng`: number
- `accuracy_m`: number, nullable
- `available`: boolean
- `last_seen_at`: timestamptz

Presence lifecycle:
- receiving nearby questions is **off by default**;
- user explicitly enables **«Я рядом»**;
- heartbeat target is 60 seconds;
- presence is fresh for 5 minutes only;
- disabling «Я рядом» immediately sets `available=false`;
- stale presence must not receive a nearby-request push;
- accuracy worse than 50 m is not eligible for automated matching;
- exact coordinates are never exposed to other users.

## 3. answers

A short response to a request.

- `id`: uuid
- `request_id`: uuid
- `author_id`: uuid, nullable for anonymous test mode
- `answer`: string, 1–240 characters
- `distance_m`: integer, nullable
- `created_at`: timestamptz

The client displays freshness and coarse proximity only, not exact coordinates or identity.

## 4. notification_events

An internal event used by push/Telegram adapters.

- `id`: uuid
- `user_id`: uuid
- `request_id`: uuid, nullable
- `kind`: `NEW_NEARBY_REQUEST | REQUEST_ANSWERED | REQUEST_EXPIRED`
- `created_at`: timestamptz
- `delivered_at`: timestamptz, nullable

## Matching rules

1. Match only requests with `status = SEARCHING`.
2. Ignore expired requests.
3. Match against the **request location**, never against the requester's current position.
4. Candidate stages are **0–50 m → 50–100 m → 100–150 m → 150–250 m**.
5. Never automatically match or notify beyond 250 m.
6. Expand only when the previous stage does not produce enough eligible recipients.
7. Prefer the nearest eligible recipients and stop once the recipient limit is reached.
8. Do not send the same request repeatedly to the same person during the request/cooldown window.
9. Do not notify the requester about their own request.
10. A request is fresh for the UI for 10 minutes; after that it becomes `EXPIRED`.
11. Map visibility can be wider than push matching; seeing an event on the map never implies a push.

## Realtime events

The first production Realtime channel should publish only safe public state:

- new requests relevant to an opted-in viewer;
- new answers for the viewer's own request;
- request status changes;
- presence status changes only for the current user's own session.

Exact coordinates and private profile data must not be broadcast.

Push notifications are a separate delivery layer and must not be required for the core database flow.
