# «Сейчас» — backend security checklist

## Location privacy

- [x] Exact request coordinates are stored server-side in PostGIS.
- [x] Direct `SELECT` from `requests` is revoked for `authenticated` clients.
- [x] Presence is not directly readable by other authenticated users.
- [x] Nearby matching happens server-side.
- [x] Client-facing RPCs return distance/freshness, not coordinates.
- [x] Automatic push matching is capped at 250 m.

## Presence

- [x] User must explicitly opt in with `available=true`.
- [x] Heartbeat updates `last_seen_at`.
- [x] Presence older than 5 minutes is ignored.
- [x] Invalid latitude/longitude is rejected.
- [x] Invalid negative accuracy is rejected.
- [x] Stale presence can be disabled by scheduled cleanup.

## Requests and answers

- [x] Request text is limited to 160 characters.
- [x] Requests expire after 10 minutes.
- [x] One answer per request/user in MVP.
- [x] Author cannot answer their own request.
- [x] Request and answer identifiers are UUIDs.
- [x] Notification deduplication is represented in the database.

## Before production

- [ ] Apply migrations only to a newly created «Сейчас» Supabase project.
- [ ] Verify RLS using real authenticated roles.
- [ ] Add rate-limit enforcement in an Edge Function/API layer.
- [ ] Add push delivery credentials only in server-side environment variables.
- [ ] Enable Realtime only for non-sensitive public state/IDs.
- [ ] Run a manual privacy test with two separate accounts.
