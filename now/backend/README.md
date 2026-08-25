# Backend contract — «Сейчас»

Этот каталог готовит backend для отдельного Supabase-проекта «Сейчас». Старую базу STO-NSK не использовать.

## Dispatch flow

`POST /functions/v1/dispatch-question`

Request:

```json
{
  "questionId": "uuid",
  "lat": 55.0302,
  "lng": 82.9204,
  "radiusM": 1000
}
```

Response:

```json
{
  "questionId": "uuid",
  "radiusM": 1000,
  "recipientCount": 3,
  "recipients": [
    { "userId": "uuid", "distanceM": 240 }
  ],
  "expiresAt": "2026-08-25T10:00:00Z"
}
```

## Rules

- Matching is server-side; exact presence coordinates are never returned to the client.
- Only fresh presence (last 5 minutes) participates in matching.
- Radius is clamped to 300–2000 m.
- A request is limited to 25 recipients.
- A question expires after 10 minutes.
- The function uses the Supabase service role only on the server.
- Public RLS must not expose the `presence` table.

## Next backend step

After the standalone Supabase project exists:

1. Apply `schema.sql`.
2. Apply `backend/rls.sql`.
3. Deploy `backend/dispatch-question/index.ts` as an Edge Function.
4. Add authenticated presence heartbeats.
5. Add answer creation and Realtime subscriptions.
6. Add rate limiting and abuse controls before opening the service publicly.
