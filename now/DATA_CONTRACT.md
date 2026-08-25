# «Сейчас» — data contract

This contract defines the smallest backend model for the MVP. It intentionally contains no secrets and no production credentials.

## 1. requests

A question asked by a user for a place or area.

- `id`: uuid
- `author_id`: uuid, nullable for anonymous MVP mode
- `text`: string, 1–160 characters
- `lat`: number
- `lng`: number
- `radius_m`: integer, default 1500
- `status`: `WAITING | ANSWERED | EXPIRED | CANCELLED`
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

Privacy rule: presence is used for matching and must not expose a user's exact location to another user.

## 3. answers

A short response to a request.

- `id`: uuid
- `request_id`: uuid
- `author_id`: uuid, nullable for anonymous test mode
- `answer`: string, 1–240 characters
- `distance_m`: integer, nullable
- `created_at`: timestamptz

The client should display freshness and approximate proximity, not exact coordinates.

## 4. notification_events

An internal event used later by push/Telegram adapters.

- `id`: uuid
- `user_id`: uuid
- `request_id`: uuid, nullable
- `kind`: `NEW_NEARBY_REQUEST | REQUEST_ANSWERED | REQUEST_EXPIRED`
- `created_at`: timestamptz
- `delivered_at`: timestamptz, nullable

## Matching rules

1. Match only requests with `status = WAITING`.
2. Ignore expired requests.
3. Prefer people within 500 m, then 1 km, then 1.5 km.
4. Do not send the same request repeatedly to the same person during a cooldown window.
5. Do not reveal the request author's identity or exact location to the responder.
6. A request is considered fresh for the UI only while `now() - created_at <= 10 minutes`.

## Realtime events

The first production Realtime channel should publish:

- new `requests` matching the viewer's approximate area;
- new `answers` for the viewer's own request;
- request status changes.

Push notifications are a separate delivery layer and must not be required for the core database flow.
