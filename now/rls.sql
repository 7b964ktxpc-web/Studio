-- Security draft for the future dedicated Supabase project.
-- Review with the chosen auth model before applying.

alter table questions enable row level security;
alter table answers enable row level security;
alter table presence enable row level security;
alter table places enable row level security;

-- Questions: requester may read/create/cancel their own rows once requester_id is added.
-- Nearby users should not query all questions directly; the Edge Function should select
-- eligible questions and return only the minimum payload needed to answer.

-- Answers: users may create an answer only through the Edge Function, which validates
-- proximity and rate limits. Do not expose a broad client INSERT policy.

-- Presence: never expose raw rows to clients. Use server-side proximity selection.

-- Places: public read is acceptable for non-sensitive place metadata; writes stay server-side.
