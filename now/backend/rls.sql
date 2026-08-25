-- Security draft for the standalone «Сейчас» Supabase project.
-- Apply only after now/backend/schema.sql has been installed.

alter table places enable row level security;
alter table questions enable row level security;
alter table answers enable row level security;
alter table presence enable row level security;

drop policy if exists "places_read_public" on places;
create policy "places_read_public"
  on places for select
  using (true);

-- Raw questions contain owner and coordinates. They are not exposed directly to clients.
drop policy if exists "questions_owner_only" on questions;
create policy "questions_owner_only"
  on questions for select
  using (auth.uid() = user_id);

drop policy if exists "answers_owner_only" on answers;
create policy "answers_owner_only"
  on answers for select
  using (
    exists (
      select 1
      from questions q
      where q.id = answers.question_id
        and q.user_id = auth.uid()
    )
  );

-- Clients never read or write raw presence. Nearby matching happens server-side.
drop policy if exists "presence_no_public_read" on presence;
create policy "presence_no_public_read"
  on presence for select
  using (false);

drop policy if exists "presence_no_public_write" on presence;
create policy "presence_no_public_write"
  on presence for all
  using (false)
  with check (false);

-- Questions/answers mutations are owned by trusted Edge Functions.
-- This avoids exposing coordinates, ownership or write paths through the public API.
