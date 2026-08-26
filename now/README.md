# Сейчас — MVP

«Сейчас» — мобильный сервис локальной информации для Новосибирска: человек задаёт простой вопрос про конкретное место, а приложение ищет людей, которые находятся действительно рядом, и получает короткий ответ.

## Главный принцип

Не строим каталог и не рассылаем городскую ленту.

**Нужен ответ прямо сейчас → спросили только тех, кто действительно рядом.**

### Proximity policy

- основной радиус push: **50 м**;
- расширение: **100 → 150 → 250 м** только при нехватке подходящих получателей;
- автоматические push дальше **250 м запрещены**;
- карта может показывать более дальние события, но это не означает push;
- matching считается от **точки запроса**, а не от автора;
- presence учитывается только при свежести до **5 минут**;
- для nearby matching точность геолокации должна быть **≤ 50 м**.

### Regression safety

- работаем только в ветке `now-mvp`;
- `STO-NSK` не подключаем и не изменяем;
- `now/index.html` остаётся baseline, основной новый flow тестируется через browser seams и deterministic E2E;
- production Supabase не используется для разработки MVP.

## Уже подготовлено

### Клиент
- mobile-first MVP интерфейс;
- свободный вопрос и быстрые сценарии;
- карта и «Сейчас рядом»;
- демо потока ответа;
- PWA manifest + Service Worker + offline cache;
- Web Push client adapter;
- Supabase push persistence adapter (`upsert_push_subscription` / `disable_push_subscription`);
- notification center с дедупликацией;
- безопасная проверка Realtime events;
- Supabase Realtime subscription adapter;
- presence controller;
- presence UI states;
- Supabase presence backend adapter;
- единый presence service;
- отдельный мобильный экран «Я рядом»;
- authoritative request snapshot adapter;
- Realtime → authoritative request binding;
- reconnect snapshot recovery;
- active request Realtime lifecycle controller with stale-callback protection;
- opt-in main UI Realtime bridge + self-loading bootstrap;
- синхронный capture hook до async bootstrap;
- защиты от duplicate-load, preloaded dependencies и late adapter races;
- opt-in main UI answer bridge;
- authoritative terminal snapshot guard для answer controls;
- answer Realtime controller;
- nearby-answer coordinator;
- nearby event source contract;
- Supabase `create_request` adapter contract + page bridge;
- Supabase `answer_request` adapter contract + page bridge;
- deterministic E2E harnesses для create, answer, accuracy, switching и двухпользовательского request_id flow;
- live authenticated two-user Supabase E2E harness;
- live lifecycle E2E harness для duplicate-answer/finalization/reconnect;
- deterministic Web Push persistence E2E.

### Backend design
- PostGIS схема для `requests`, `presence`, `answers`, `notification_events`;
- staged proximity matching 50/100/150/250 м;
- RLS baseline;
- защита точных координат;
- request lifecycle `SEARCHING → ANSWERED / EXPIRED / CANCELLED`;
- durable notification queue и retry contract;
- Web Push subscriptions;
- Realtime + notification flow;
- draft RPC `public.create_request(text, latitude, longitude)`;
- draft RPC `public.answer_request(request_id, answer)`;
- draft RPC `public.finalize_request(request_id)`.

Все SQL-файлы в `now/backend/` являются **draft migrations**. Их нельзя применять к `STO-NSK` или к другой существующей базе.

## Отдельная integration environment

Для «Сейчас» уже существует отдельный Supabase-проект `now-mvp`, отдельно от `sto-nsk`. Он используется только как integration environment.

Фактически проверено в `now-mvp`:

- проект активен и здоров;
- RLS включён на `requests`, `presence`, `answers`, `notification_events`, `push_subscriptions`;
- `notification_events` подключён к публикации `supabase_realtime`;
- `pgcrypto` установлен в схеме `extensions`;
- ключевые RPC присутствуют с финальными сигнатурами;
- browser-facing `create_request` и `answer_request` остаются `SECURITY INVOKER`;
- privileged dispatch/read RPC имеют явные role grants и ownership checks;
- worker-only notification queue RPC доступны только `service_role`;
- push subscription writes доступны только `authenticated` и защищены RLS.

Supabase advisors в integration environment показывают ожидаемые предупреждения вокруг PostGIS в `public` и некоторых `SECURITY DEFINER` RPC. Эти предупреждения не маскируем изменением permissions вслепую: часть функций (`dispatch_nearby_request`, `my_request`, `nearby_request_for_answer`) намеренно является privileged API с проверками `auth.uid()` внутри.

## Draft migration order

Полный порядок и sequencing notes находятся в `now/backend/BACKEND_DRAFT_APPLY_ORDER.md`.

Важное замечание: два файла `004_*.sql` — намеренная часть draft order и должны применяться оба до `005_notification_queue.sql`.

## Текущий интеграционный статус

Browser seams для create и answer уже соответствуют зафиксированным draft RPC и проходят deterministic rehearsal. Реальный Supabase client намеренно не создаётся в production UI.

Добавлен `e2e-live-two-user-supabase-flow.html` и acceptance-документ `LIVE_TWO_USER_SUPABASE_E2E.md`. Harness рассчитан на запуск в браузере против отдельного `now-mvp` project с Anonymous Sign-Ins. Он не считается PASS, пока не прошёл полный authenticated flow на реальном endpoint.

Добавлен `e2e-live-two-user-lifecycle.html` для duplicate-answer, single-shot finalization и reconnect после terminal state. Этот harness также не считается PASS без реального браузерного запуска.

Web Push persistence теперь имеет отдельный `supabase-push-adapter.js` и deterministic `e2e-supabase-push-adapter.html`. Реальные browser permissions и VAPID delivery остаются отдельным opt-in шагом: public VAPID key не угадывается и permission не запрашивается автоматически.

Notification queue имеет отдельный `backend/supabase-notification-queue.ts` и deterministic `e2e-supabase-notification-queue.html`. Server-only Edge Function source `backend/notification-worker/index.ts` теперь связывает этот queue adapter с `processNotificationBatch()` и Web Push. Function source требует только environment secrets, не хранит service-role/VAPID credentials в репозитории и пока **не деплоен**.

Preview routing теперь также source-controlled: root `vercel.json` публикует `now/index.html`, `now/index-integrated.html` и E2E через короткие root paths, а `now/backend/*` блокируется `404`. Отдельный Vercel project `now-mvp-preview` уже существует, но его последняя deployment была создана до routing commit; её `/index-integrated.html` пока возвращает `404` до следующего preview deployment.

## Следующий этап

1. Выполнить новый preview deployment `now-mvp` с текущим `vercel.json` и проверить `/`, `/index-integrated.html`, `/e2e-*.html` и недоступность `/now/backend/*`.
2. Запустить live two-user harness в отдельном `now-mvp` environment.
3. Запустить lifecycle harness: duplicate-answer → finalize → reconnect/terminal regression.
4. Провести реальный двухпользовательский E2E: **создал запрос → nearby user получил realtime/push → ответил → автор получил authoritative answer event**.
5. Задеплоить notification worker только в отдельный `now-mvp` integration environment с отдельными service-role/VAPID/worker-secret values и провести queue → PushAdapter → delivered/retry E2E.
6. После зелёного E2E закрепить preview hosting и только затем обсуждать production release.

## Принцип MVP

Первая версия решает только одну задачу:

> **«Что там происходит прямо сейчас?»**
