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
- opt-in main UI Realtime bridge for `index.html`;
- self-loading main UI Realtime bridge;
- synchronous main UI button capture before async bootstrap;
- preloaded-dependency-safe main UI Realtime bridge;
- deterministic main UI Realtime bridge E2E harness;
- regression gate for geolocation accuracy `> 50 m`;
- regression gate for duplicate bridge script loads;
- regression gate for late adapter injection racing the legacy inline handler;
- regression gate for dependencies already loaded before bridge bootstrap;
- opt-in main UI answer bridge;
- deterministic main UI answer bridge E2E harness;
- regression gate for one-answer submission and terminal `REQUEST_EXPIRED` / `ALREADY_ANSWERED` handling;
- authoritative terminal snapshot guard for answer controls;
- opt-in main UI answer Realtime controller;
- deterministic answer Realtime controller E2E harness.

### Backend design
- PostGIS схема для `requests`, `presence`, `answers`, `notification_events`;
- staged proximity matching 50/100/150/250 м;
- RLS baseline;
- защита точных координат;
- request lifecycle `SEARCHING → ANSWERED / EXPIRED / CANCELLED`;
- durable notification queue и retry contract;
- Web Push subscriptions;
- Realtime + notification flow.

Все SQL-файлы в `now/backend/` пока являются **draft migrations**. Их нельзя применять к старой или любой другой базе.

## Важное ограничение

Для нового проекта используется только отдельная Supabase-база. Старую инфраструктуру STO-NSK не подключаем.

## Следующий этап

1. Подключить `main-ui-realtime-bridge.js` к `index.html` одним `<script src="/now/main-ui-realtime-bridge.js"></script>`, сохранив текущий inline demo flow при отсутствии adapters.
2. Подключить create-request adapter: геолокация → `requests`.
3. Связать nearby Realtime event с `main-ui-answer-realtime-controller.js`, затем `main-ui-answer-bridge.js` и реальный answer adapter.
4. Связать `notification_events` с Web Push delivery worker.
5. Создать отдельный Supabase-проект и применить draft migrations после проверки.
6. Провести end-to-end тест: **спросил → рядом получили push → ответили → автор получил ответ**.
7. Проверить production UI lifecycle на reconnect/terminal/switch сценариях.

## Принцип MVP

Первая версия решает только одну задачу:

> **«Что там происходит прямо сейчас?»**
