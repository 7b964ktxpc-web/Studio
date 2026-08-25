# Presence controller acceptance cases

1. `OFF -> STARTING -> ENABLED` only after a valid GPS fix with accuracy <= 50m.
2. Accuracy > 50m must produce `LOW_ACCURACY` and must not expose coordinates to matching.
3. Heartbeat runs every 60 seconds while `ENABLED`.
4. A stale snapshot older than 5 minutes moves to `PAUSED` and stops the watch/heartbeat timers.
5. `pause()` clears timers and calls the persistence stop callback without resetting browser permission.
6. `stop()` clears timers, resets the snapshot to `OFF`, and calls the persistence stop callback.
7. A geolocation error moves the controller to `PAUSED` and rejects `start()`.
8. Coordinates outside valid latitude/longitude bounds are rejected.
9. `onHeartbeat` must only receive an `ENABLED` snapshot.
10. No controller state permits automated push matching beyond the product's 250m maximum; distance policy remains server-side.
