-- Security draft for the standalone «Сейчас» Supabase project.
-- Apply only to the new project after schema.sql is installed.

alter table places enable row level security;
alter table questions enable row level security;
alter table answers enable row level security;
alter table presence enable row level security;

-- Places are public read data; writes must go through trusted backend/admin paths.
drop policy if exists "places_read_public" on places;
create policy "places_read_public"
  on places for select
  using (true);

-- Questions can be read only while active or for the owner once auth is added.
-- Until authenticated ownership is implemented, keep INSERT/UPDATE/DELETE behind Edge Functions.
drop policy if exists "questions_read_active" on questions;
create policy "questions_read_active"
  on questions for select
  using (status = 'waiting' and expires_at > now());

-- Answers are visible only through active questions. Client writes are disabled here;
-- the Edge Function will validate and insert answers with a service role.
drop policy if exists "answers_read_active" on answers;
create policy "answers_read_active"
  on answers for select
  using (
    exists (
      select 1 from questions q
      where q.id = answers.question_id
        and q.status = 'waiting'
        and q.expires_at > now()
    )
  );

-- Presence must never be publicly readable because it contains location data.
-- Nearby matching happens server-side in dispatch-question.
drop policy if exists "presence_no_public_read" on presence;
create policy "presence_no_public_read"
  on presence for select
  using (false);

-- No public INSERT/UPDATE/DELETE policies are created for sensitive tables.
-- This is intentional: authenticated writes will be added after the auth model is fixed.
