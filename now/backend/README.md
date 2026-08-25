# Backend contract — Сейчас

The backend is prepared for a standalone Supabase project. It must never use the old STO-NSK database.

## Functions

- `create-question` — authenticated creation of a nearby question; validates coordinates/text, requires fresh presence, and limits active questions per user.
- `heartbeat-presence` — authenticated location heartbeat. Stores only the latest coarse presence row server-side; clients cannot read the table directly.
- `dispatch-question` — authenticated server-side matching of a waiting question to fresh nearby presence rows. It never returns recipient user IDs or coordinates.
- `answer-question` — authenticated one-tap answer. The responder must have fresh presence, be inside the question radius, cannot answer their own question, and cannot answer twice.

## Privacy rules

Raw presence, question ownership and exact coordinates are server-side data. Client reads should go through Edge Functions that return only the minimum data required by the UI.

## Question lifecycle

`waiting` → multiple fresh answers → aggregation/Realtime → `answered` or `expired`.

A first answer does **not** close the question, because the product needs multiple confirmations to calculate a trustworthy local signal.

## Current state

These functions are source-controlled only. No Supabase project has been created for «Сейчас» yet, so nothing here is deployed to production. The existing `sto-nsk` Supabase project is intentionally untouched.
