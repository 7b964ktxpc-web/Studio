-- Сейчас / backend migration 007
-- Draft only. Apply only to the NEW «Сейчас» Supabase project.
-- Hardens the initial RLS baseline before production use.

-- Remove broad client read access to exact request rows. Clients must use
-- server-side/public-safe functions for nearby discovery.
drop policy if exists requests_select_public_searching on public.requests;
drop policy if exists requests_update_own on public.requests;
drop policy if exists requests_insert_own on public.requests;

create policy requests_insert_own
  on public.requests for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and status = 'SEARCHING'
    and expires_at > now()
    and radius_m between 50 and 250
  );

create policy requests_update_own
  on public.requests for update
  to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

-- Do not allow client-side direct SELECT of request coordinates.
-- Server functions / RPCs return only a privacy-safe projection.

-- Presence may only be inserted/updated for the current authenticated user.
-- Client reads remain limited to their own presence row.

-- Answers cannot be inserted against expired/cancelled requests.
drop policy if exists answers_insert_own on public.answers;
create policy answers_insert_own
  on public.answers for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1
      from public.requests r
      where r.id = answers.request_id
        and r.status = 'SEARCHING'
        and r.expires_at > now()
        and r.author_id <> auth.uid()
    )
  );

-- Explicitly prevent clients from modifying or deleting notification delivery state.
-- There are intentionally no INSERT/UPDATE/DELETE client policies on notification_events.

-- Privacy-safe request projection for the owning user.
create or replace function public.my_request(p_request_id uuid)
returns table(
  id uuid,
  text text,
  status text,
  created_at timestamptz,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.text, r.status, r.created_at, r.expires_at
  from public.requests r
  where r.id = p_request_id
    and r.author_id = auth.uid();
$$;

grant execute on function public.my_request(uuid) to authenticated;

-- Public-safe projection for a request that a nearby eligible user may answer.
-- No exact coordinates or author_id are returned.
create or replace function public.nearby_request_for_answer(p_request_id uuid)
returns table(
  id uuid,
  text text,
  status text,
  created_at timestamptz,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.text, r.status, r.created_at, r.expires_at
  from public.requests r
  where r.id = p_request_id
    and r.status = 'SEARCHING'
    and r.expires_at > now()
    and exists (
      select 1
      from public.nearby_recipients(r.id, 1) nr
      where nr.user_id = auth.uid()
    );
$$;

grant execute on function public.nearby_request_for_answer(uuid) to authenticated;

-- Keep function execution controlled by Supabase roles; no anonymous access.
revoke execute on function public.my_request(uuid) from anon;
revoke execute on function public.nearby_request_for_answer(uuid) from anon;
