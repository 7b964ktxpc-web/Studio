# Live two-user Supabase E2E

Этот harness проверяет реальный отдельный Supabase project `now-mvp`, а не simulator.

Файл: `e2e-live-two-user-supabase-flow.html`

## Preconditions

- Supabase project: `now-mvp`.
- Browser Auth: Anonymous Sign-Ins enabled.
- `supabase-preview-config.js` points to the dedicated `now-mvp` project.
- Draft migrations `001..020` have been applied to that project.

## Flow

1. Создать requester anonymous session.
2. Создать responder anonymous session.
3. Responder publishes presence at accuracy `10 m`.
4. Requester subscribes to `public.notification_events` Realtime.
5. Requester calls `create_request(text, latitude, longitude)`.
6. Responder calls `nearby_request_for_answer(request_id)` and must see the request.
7. Responder calls `answer_request(request_id, answer)`; request remains `SEARCHING` until explicit finalization.
8. Requester must receive `REQUEST_ANSWERED` through Realtime.
9. Requester calls `my_request_answers(request_id)` and sees the answer without responder identity.
10. Requester calls `finalize_request(request_id)`.
11. Requester must receive `REQUEST_FINALIZED` through Realtime.
12. Test cleanup removes the Realtime channel and disables responder presence.

## Acceptance

PASS requires all steps above to complete using two independent authenticated clients against the same project.

A fake adapter, simulator, manually injected RPC result, or SQL-only privileged query does not count as live E2E PASS.

## Current environment note

The current agent sandbox cannot directly resolve the Supabase hostname from its network namespace, so this harness has been committed for browser execution but has **not** been falsely marked as live-PASS from the sandbox.
