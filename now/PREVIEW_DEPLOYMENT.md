# «Сейчас» — preview deployment contract

Этот документ описывает безопасное подключение `now-mvp` к отдельному preview hosting target. Он не меняет `STO-NSK` и не предполагает production traffic.

## Target

Preview должен публиковать статические файлы из `now/` и открывать:

- `index.html` — baseline demo;
- `index-integrated.html` — integration UI;
- browser E2E harnesses под `/e2e-*.html` для ручного/CI запуска.

Нельзя публиковать `backend/` как клиентские assets: server-only worker source и service-role logic не должны попадать в browser bundle.

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
4. No preview asset references `STO-NSK` credentials or URL.
5. No server-only file is exposed through the static site.
6. Separate `now-mvp` Supabase URL/key are used for integration.
7. Realtime/nearby flows remain opt-in until adapters are present.
8. Web Push remains opt-in until a real public VAPID key is configured.
9. Notification worker is deployed separately as an Edge Function; it is not served by the static host.
10. Preview does not auto-run mutation-heavy E2E against the database on page load.

## Current state

The repository does not yet contain a vendor-specific preview config. Do not invent a Vercel/Netlify configuration until the target is selected.

The separate `now-mvp` Supabase project currently has no Edge Functions deployed. Notification worker deployment is therefore still blocked on an isolated secret configuration and runtime verification.

## Security note

The integration project advisory currently reports `public.spatial_ref_sys` with RLS disabled. Do not automatically enable RLS on this PostGIS system table without confirming the required policies; enabling RLS with no policies could block legitimate extension access.
