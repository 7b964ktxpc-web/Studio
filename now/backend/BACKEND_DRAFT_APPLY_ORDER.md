# Сейчас — draft backend apply order

This directory is a **draft schema package** for a NEW «Сейчас» Supabase project only. Never apply these files to `STO-NSK` or any unrelated database.

## Required order

1. `001_initial.sql`
2. `002_rls_policies.sql`
3. `003_presence_lifecycle.sql`
4. `004_private_location_access.sql`
5. `004_request_lifecycle.sql`
6. `005_notification_queue.sql`
7. `006_web_push.sql`
8. `007_rls_hardening.sql`
9. `008_matching_stage_hardening.sql`
10. `009_answer_notification_consistency.sql`
11. `010_create_request_rpc.sql`
12. `011_request_radius_contract_fix.sql`
13. `012_function_execute_hardening.sql`
14. `013_create_request_queue_contract_fix.sql`
15. `014_dispatch_request_auth_contract.sql`
16. `015_advisor_hardening.sql`
17. `016_rls_initplan_and_notification_index.sql`

## Important sequencing notes

- The two `004_*.sql` files are separate draft files. Apply both before `005`.
- `011` intentionally replaces the four-argument `create_request` introduced by `010` with the final three-argument browser contract: `create_request(text, latitude, longitude)`.
- `013` intentionally replaces the `010/011` queue call path so `create_request` uses the actual `dispatch_nearby_request(uuid, integer)` queue function defined by `005`.
- `012` removes accidental default `PUBLIC` execution from privileged/derived functions.
- `014` narrows authenticated dispatch to the request owner and keeps worker-only notification claim/delivery functions unavailable to browser roles.
- `015` hardens remaining privileged RPC permissions; PostGIS extension-owned service objects may still appear in Supabase advisors.
- `016` replaces per-row `auth.uid()` policy evaluation with statement-scoped evaluation and adds the `notification_events(request_id, created_at)` covering index used by the realtime/event flow.

## Before applying

- Create a dedicated Supabase project for «Сейчас».
- Enable the intended Auth method before exercising authenticated RPCs. The preview browser bootstrap uses Supabase Anonymous Sign-Ins so the browser receives an `authenticated` session without collecting PII.
- Apply the complete sequence to that NEW project only.
- Run Supabase security/performance advisors after the schema is applied.
- Verify `create_request`, `nearby_recipients`, `nearby_request_for_answer`, `answer_request`, and notification queue functions with authenticated test users before connecting production traffic.

## Browser contract after apply

`create_request(text, latitude, longitude)` returns an authoritative `request_id`.

`answer_request(request_id, answer)` returns the authoritative `request_id` and keeps the request in `SEARCHING` until explicit aggregation/finalization.

The staged matching policy remains `50 → 100 → 150 → 250 m`, with `250 m` as the absolute maximum.
