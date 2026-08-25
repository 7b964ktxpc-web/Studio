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

## Уже подготовлено

### Клиент
- mobile-first MVP интерфейс;
- свободный вопрос и быстрые сценарии;
- карта и «Сейчас рядом»;
- демо потока ответа;
- PWA manifest + Service Worker + offline cache;
- Web Push client adapter;
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
- deterministic E2E harnesses для create, answer, accuracy, switching и двухпользовательского request_id flow.

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
- draft RPC `public.answer_request(request_id, answer)`.

Все SQL-файлы в `now/backend/` пока являются **draft migrations**. Их нельзя применять к старой или любой другой базе.

## Важное ограничение

Для нового проекта используется только отдельная Supabase-база. Старую инфраструктуру STO-NSK не подключаем.

## Текущий интеграционный статус

Browser seams для create и answer уже соответствуют зафиксированным draft RPC и проходят deterministic rehearsal. Реальный Supabase client намеренно не создаётся кодом проекта: он должен быть injected только в отдельном новом Supabase environment.

`now/index.html` остаётся baseline и не переводился насильно на новый flow. Интеграционная проверка проводится через `index-integrated.html` и отдельные E2E harnesses.

## Следующий этап

1. Создать отдельный **новый Supabase project** для «Сейчас».
2. Применить draft migrations только туда после проверки порядка миграций и RLS.
3. Inject authenticated Supabase client в integration environment.
4. Провести реальный двухпользовательский E2E: **создал запрос → nearby user получил realtime/push → ответил → автор получил authoritative answer event**.
5. Проверить reconnect/expiry/duplicate-answer/terminal lifecycle в реальном браузере.
6. После этого привязать `now-mvp` к отдельному preview hosting target и только затем переходить к production release.

## Принцип MVP

Первая версия решает только одну задачу:

> **«Что там происходит прямо сейчас?»**
