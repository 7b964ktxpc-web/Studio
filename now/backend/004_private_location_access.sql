-- Сейчас / backend migration 004
-- Draft only. Apply only to the NEW «Сейчас» Supabase project.

-- The base requests table must not expose exact request coordinates to clients.
-- Client flows use RPCs below for the minimum data needed by each role.

revoke select on table public.requests from authenticated;
revoke select on table public.presence from authenticated;

create or replace function public.my_requests()
returns table(
  id uuid,
  text text,
  status text,
  created_at timestamptz,
  expires_at timestamptz
)
language sql
security invoker
set search_path = public
as $$
  select r.id, r.text, r.status, r.created_at, r.expires_at
  from public.requests r
  where r.author_id = auth.uid()
  order by r.created_at desc
  limit 50;
$$;

create or replace function public.request_for_nearby_answer(
  p_request_id uuid
)
returns table(
  id uuid,
  text text,
  status text,
  created_at timestamptz,
  expires_at timestamptz,
  distance_m integer
)
language sql
security invoker
set search_path = public
as $$
  select
    r.id,
    r.text,
    r.status,
    r.created_at,
    r.expires_at,
    round(st_distance(p.location, r.location))::integer as distance_m
  from public.requests r
  join public.presence p
    on p.user_id = auth.uid()
  where r.id = p_request_id
    and r.status = 'SEARCHING'
    and r.expires_at > now()
    and p.available = true
    and p.last_seen_at >= now() - interval '5 minutes'
    and (p.accuracy_m is null or p.accuracy_m <= 50)
    and st_dwithin(p.location, r.location, 250)
    and r.author_id is distinct from auth.uid();
$$;

-- Answer insertion is kept in RLS, but exact coordinates remain inaccessible.
