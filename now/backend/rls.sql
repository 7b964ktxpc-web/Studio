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

-- A user may read their own questions; active questions may be read by authenticated clients
-- only when the UI needs to render an active request. Sensitive coordinates remain server-side.
drop policy if exists "questions_read_owner_or_active" on questions;
create policy "questions_read_owner_or_active"
  on questions for select
  using (
    auth.uid() = user_id
    or (auth.role() = 'authenticated' and status = 'waiting' and expires_at > now())
  );

drop policy if exists "answers_read_owner_or_active" on answers;
create policy "answers_read_owner_or_active"
  on answers for select
  using (
    exists (
      select 1
      from questions q
      where q.id = answers.question_id
        and (
          q.user_id = auth.uid()
          or (auth.role() = 'authenticated' and q.status = 'waiting' and q.expires_at > now())
        )
    )
  );

-- Clients never read or write raw presence. All nearby matching happens server-side.
drop policy if exists "presence_no_public_read" on presence;
create policy "presence_no_public_read"
  on presence for select
  using (false);

drop policy if exists "presence_no_public_write" on presence;
create policy "presence_no_public_write"
  on presence for all
  using (false)
  with check (false);

-- No direct client INSERT/UPDATE/DELETE policies are created for questions/answers.
-- Trusted Edge Functions own those mutations and enforce authentication, ownership,
-- freshness and anti-abuse rules.
