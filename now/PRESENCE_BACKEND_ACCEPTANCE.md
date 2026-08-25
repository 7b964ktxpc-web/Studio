# Presence backend acceptance

1. `ENABLED` + accuracy 20m + fresh heartbeat => upsert with `available=true`.
2. Accuracy 51m => reject heartbeat and do not enable matching.
3. Heartbeat older than 2 minutes => reject as stale.
4. Invalid latitude/longitude => reject.
5. `stop()` => backend update sets `available=false`.
6. `pause()` => backend update sets `available=false`.
7. User id is taken from authenticated Supabase session; client code never supplies another user's id.
8. Location is sent as PostGIS WKT `SRID=4326;POINT(longitude latitude)`.
9. Backend adapter never returns another user's exact coordinates to the client.
10. Matching remains server-side and capped at 250m.
