# Signal aggregation acceptance cases

1. Two fresh «нет очереди» answers → `FREE`, strong confidence.
2. Two fresh «очередь небольшая» answers → `SMALL`.
3. Two fresh «очередь большая» answers → `LARGE`.
4. One known answer only → `UNKNOWN`; do not present it as a strong signal.
5. Equal fresh votes between statuses → `UNKNOWN`; avoid misleading certainty.
6. Stale answers older than 10 minutes do not influence the current signal.
7. Future-dated answers do not influence the current signal.
8. Unknown/free-form answers do not inflate known-status counts.
9. The summary never includes responder identity or coordinates.
10. A later contradictory fresh answer can change the aggregate instead of permanently locking the first result.
