# Request → answer flow acceptance tests

These tests are contract checks only. They do not require a Supabase project.

1. Create request with valid text and coordinates → `SEARCHING` and `request_id` returned.
2. Create request with invalid coordinates → rejected before RPC.
3. Create request with text >160 characters → rejected before RPC.
4. Answer with empty text → rejected before RPC.
5. Answer with >240 characters → rejected before RPC.
6. Answer without an authenticated user → rejected.
7. Snapshot without an authenticated user → rejected.
8. Answer result must remain `SEARCHING` while aggregation is pending.
9. Snapshot must accept only `SEARCHING`, `ANSWERED`, `EXPIRED`, `CANCELLED`.
10. Refresh after Realtime event must read authoritative `my_request`, not trust the event payload as final state.
11. Duplicate Realtime events must not cause duplicate refresh-side effects.
12. No client adapter may access exact coordinates from another user's request.
