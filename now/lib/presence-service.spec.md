# Presence service acceptance cases

1. `start()` with a location accuracy of 50m or better creates/refreshes presence with `available=true`.
2. `start()` with accuracy greater than 50m never sends a usable presence heartbeat.
3. Heartbeat uses the authenticated Supabase user id; client-provided user ids are ignored.
4. A heartbeat older than 2 minutes is rejected by the backend adapter.
5. `pause()` and `stop()` set `available=false`.
6. A backend heartbeat failure does not silently mark the UI as healthy; `onError` is invoked.
7. The controller still enforces the 5-minute stale-presence rule even if the backend is temporarily unavailable.
8. No exact coordinates are exposed by the service to other users; only the backend receives the current point.
