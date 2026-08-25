# Сейчас — request/answer flow acceptance

Цель: проверить клиентский orchestrator без подключения реальной Supabase-базы.

## 1. Create request

- valid text + coordinates -> `create.createRequest()` called once;
- returned status must be `SEARCHING`;
- returned `queued_count` must be 0..8;
- invalid text/coordinates is rejected by the concrete request adapter before RPC.

## 2. Answer request

- valid request id + answer -> `answer.answerRequest()` called once;
- returned status must remain `SEARCHING` while the MVP aggregates confirmations;
- empty request id is rejected by `RequestAnswerFlow`;
- snapshot is not implicitly changed by the client orchestrator.

## 3. Refresh authoritative state

- `refreshRequest()` trims the request id;
- empty id is rejected;
- state is read from `snapshot.getMyRequest()` rather than inferred from realtime payloads.

## 4. Privacy

The orchestrator passes only request id, question/answer content and the requester's own coordinates to their respective adapters. It does not expose another user's exact location.

## 5. No implicit writes

`refreshRequest()` is read-only. Realtime notifications may trigger a later refresh, but an incoming event is not treated as the authoritative request state.
