-- Сейчас / backend migration 008
-- Draft only. Apply only to the NEW «Сейчас» Supabase project.
-- Enforces staged 50/100/150/250m matching instead of selecting everyone within 250m.

create or replace function public.nearby_recipients(
  p_request_id uuid,
  p_limit integer default 8
)
returns table(user_id uuid, distance_m integer)
language sql
stable
security definer
set search_path = public
as $$
  with req as (
    select id, location, author_id
    from public.requests
    where id = p_request_id
      and status = 'SEARCHING'
      and expires_at > now()
  ),
  candidates as (
    select
      p.user_id,
      round(st_distance(p.location, r.location))::integer as distance_m,
      case
        when st_distance(p.location, r.location) <= 50 then 1
        when st_distance(p.location, r.location) <= 100 then 2
        when st_distance(p.location, r.location) <= 150 then 3
        else 4
      end as stage
    from public.presence p
    cross join req r
    where p.available = true
      and p.last_seen_at >= now() - interval '5 minutes'
      and (p.accuracy_m is null or p.accuracy_m <= 50)
      and p.user_id <> coalesce(r.author_id, '00000000-0000-0000-0000-000000000000'::uuid)
      and st_dwithin(p.location, r.location, 250)
  ),
  stage_counts as (
    select stage, count(*) as candidate_count
    from candidates
    group by stage
  ),
  chosen_stage as (
    select min(stage) as stage
    from stage_counts
    where candidate_count >= greatest(1, least(p_limit, 8))
  ),
  effective_stage as (
    select coalesce(
      (select stage from chosen_stage),
      coalesce((select max(stage) from stage_counts), 1)
    ) as stage
  )
  select c.user_id, c.distance_m
  from candidates c
  cross join effective_stage e
  where c.stage <= e.stage
  order by c.distance_m asc
  limit greatest(1, least(p_limit, 8));
$$;

-- Return a privacy-safe nearby request only if the authenticated user is an
-- eligible candidate somewhere in the staged radius. Do not require them to
-- be the single closest candidate.
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
      from public.presence p
      where p.user_id = auth.uid()
        and p.available = true
        and p.last_seen_at >= now() - interval '5 minutes'
        and (p.accuracy_m is null or p.accuracy_m <= 50)
        and st_dwithin(p.location, r.location, 250)
    );
$$;

grant execute on function public.nearby_recipients(uuid, integer) to authenticated;
grant execute on function public.nearby_request_for_answer(uuid) to authenticated;
