# Сейчас — API contract v0.1

## Question
`POST /questions`

```json
{
  "text": "Есть очередь в МФЦ?",
  "lat": 55.0415,
  "lng": 82.9346,
  "radius_m": 1000
}
```

Response:

```json
{
  "id": "uuid",
  "status": "waiting",
  "expires_at": "2026-08-25T10:00:00Z"
}
```

## Nearby presence

A user may publish only an approximate presence point for routing a question. Exact coordinates must never be exposed to another user.

```json
{
  "lat": 55.0418,
  "lng": 82.9342,
  "available": true
}
```

## Answer
`POST /questions/:id/answers`

```json
{
  "answer": "Очередь небольшая"
}
```

The response is broadcast to the question owner via Realtime.

## Status rules

- `waiting` — no answer yet;
- `answered` — at least one valid answer;
- `expired` — 10-minute lifetime ended;
- `cancelled` — owner cancelled the request.

## Anti-spam rules

- one active question per user per 60 seconds;
- maximum 5 questions per hour for a new account;
- maximum 3 answer notifications per nearby person per 15 minutes;
- questions expire automatically after 10 minutes;
- `Не знаю` is a valid answer and must not reduce reputation;
- exact responder coordinates are never returned to the requester.

## Realtime events

Channel: `question:{question_id}`

Event types:

- `answer.created`
- `question.expired`
- `question.cancelled`

Payloads contain the answer and freshness metadata, never precise responder location.
