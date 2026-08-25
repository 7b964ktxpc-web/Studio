# «Сейчас» — main UI integration checklist

Цель: подключить готовые presence/realtime/notification модули к основному экрану без переписывания существующего HTML целиком.

## Realtime bridge

`main-ui-realtime-bridge.js` — новый opt-in seam для существующего `now/index.html`.

- использует реальные main UI selectors: `#askBtn`, `#question`, `#geo`;
- без injected adapters полностью выключен и не меняет demo flow;
- при injected adapters требует точность геолокации `≤50 м`;
- использует только authoritative `request_id`, возвращённый create-request adapter;
- подключает существующий generation-safe Realtime lifecycle;
- не создаёт Supabase client и не выполняет backend writes самостоятельно;
- блокирует duplicate create clicks во время handoff.

Acceptance: `MAIN_UI_REALTIME_BRIDGE_ACCEPTANCE.md`.

E2E: `e2e-main-ui-realtime-bridge.html`.

## Presence block

Добавить в экран «Спросить» компактную карточку:

- `🟢 Я рядом` — пользователь участвует в nearby matching;
- `🟡 Уточняем место` — геопозиция ещё не соответствует требованию точности;
- `⏸ Временно недоступно` — режим приостановлен;
- `Не беспокоить` — режим выключен.

Показывать рядом:

- текущую точность;
- последний heartbeat;
- `50 м` основной радиус;
- `250 м` абсолютный максимум.

## Behaviour

1. Режим выключен по умолчанию.
2. Нажатие «Я рядом» запускает `createPresenceService()`.
3. `ENABLED` начинает heartbeat.
4. `LOW_ACCURACY` не участвует в matching.
5. `pause/stop` сразу вызывают `available=false` через backend adapter.
6. Ошибку геолокации показывать пользователю без ложного статуса `ENABLED`.

## Nearby incoming request

Добавить в `askScreen` блок входящего запроса, который появляется только из validated Realtime/Web Push события.

Карточка должна содержать:

- короткий текст вопроса;
- расстояние в метрах без точных координат;
- кнопку «Ответить»;
- кнопку «Не знаю»;
- таймер до истечения запроса.

## Answer flow

`answer.created` не считается подтверждением само по себе.

После события:

1. добавить notification в notification center;
2. вызвать authoritative refresh запроса;
3. показать актуальный ответ/статус;
4. убрать карточку ответа после `ANSWERED` или `EXPIRED`.

## Safety

Нельзя:

- показывать чужие точные координаты;
- показывать пользователя на карте как точную точку;
- отправлять push дальше 250 м;
- считать Realtime payload источником истины;
- включать nearby matching без явного opt-in.

## Acceptance scenarios

### A — user is at work

Request point is 700 m away.

Expected: **0 push**.

### B — user is 40 m away

Expected: user is eligible for Stage 1 matching.

### C — user is 120 m away

Expected: eligible only after Stage 1 and Stage 2 do not provide enough recipients.

### D — user is 260 m away

Expected: **never eligible for automatic push**.

### E — stale presence

`last_seen_at > 5 minutes`.

Expected: excluded from matching.

### F — low accuracy

`accuracy_m > 50`.

Expected: excluded from matching.
