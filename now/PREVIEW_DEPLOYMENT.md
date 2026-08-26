# «Сейчас» — preview deployment contract

Этот документ описывает безопасное подключение `now-mvp` к отдельному preview hosting target. Он не меняет `STO-NSK` и не предполагает production traffic.

## Target

Preview публикует статические файлы из `now/` через root-level `vercel.json` и открывает:

- `/index.html` → `now/index.html` — baseline demo;
- `/index-integrated.html` → `now/index-integrated.html` — integration UI;
- `/e2e-*.html` → соответствующий harness из `now/`.

`now/backend/*` явно возвращает `404` и не должен попадать в browser surface.

## Runtime boundaries

Client-visible:

- Supabase project URL для отдельного `now-mvp` проекта;
- Supabase publishable key;
- optional VAPID public key.

Server-only:

- `SUPABASE_SERVICE_ROLE_KEY`;
- `VAPID_PRIVATE_KEY`;
- `VAPID_SUBJECT`;
- `NOTIFICATION_WORKER_SECRET`.

Service-role/VAPID private values must never be placed in static files, HTML, browser JavaScript or GitHub source.

## Preview acceptance

1. `/index.html` loads without errors and remains the regression baseline.
2. `/index-integrated.html` loads without errors.
3. Existing deterministic E2E pages remain directly addressable.
4. `/now/backend/*` returns `404`.
5. No preview asset references `STO-NSK` credentials or URL.
6. Separate `now-mvp` Supabase URL/key are used for integration.
7. Realtime/nearby flows remain opt-in until adapters are present.
8. Web Push remains opt-in until a real public VAPID key is configured.
9. Notification worker is deployed separately as an Edge Function; it is not served by the static host.
10. Preview does not auto-run mutation-heavy E2E against the database on page load.

## Vercel project

A separate Vercel project `now-mvp-preview` already exists in team `GIN`.

The repository now contains the root `vercel.json` routing contract required for this project. The latest known deployment predates that routing commit, so the next deployment must be a **preview-only** deployment of `now-mvp` and then smoke-tested at:

- `https://now-mvp-preview.vercel.app/`
- `https://now-mvp-preview.vercel.app/index-integrated.html`
- `https://now-mvp-preview.vercel.app/e2e-*.html`

## Current state

The preview project exists, but its last known deployment returned `404` for `/index-integrated.html` because the repository was not yet rooted/routed to `now/`. The root `vercel.json` now closes that configuration gap.

The separate `now-mvp` Supabase project currently has no Edge Functions deployed. Notification worker deployment is therefore still blocked on an isolated secret configuration and runtime verification.

## Security note

The integration project advisory currently reports `public.spatial_ref_sys` with RLS disabled. Do not automatically enable RLS on this PostGIS system table without confirming the required policies; enabling RLS with no policies could block legitimate extension access.
