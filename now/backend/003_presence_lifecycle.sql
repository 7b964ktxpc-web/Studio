-- Сейчас / backend migration 003
-- Draft only. Apply only to the NEW «Сейчас» Supabase project.

-- Presence lifecycle: a device is considered nearby only while it explicitly opts in
-- and has sent a fresh heartbeat. Server-side matching already enforces the 5-minute TTL.

create or replace function public.upsert_my_presence(
  p_lat double precision,
  p_lng double precision,
  p_accuracy_m double precision,
  p_available boolean
)
returns public.presence
language plpgsql
security invoker
set search_path = public
as $$
declare
  result public.presence;
begin
  if p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    raise exception using errcode = '22023', message = 'Invalid coordinates';
  end if;

  if p_accuracy_m is not null and p_accuracy_m < 0 then
    raise exception using errcode = '22023', message = 'Invalid accuracy';
  end if;

  insert into public.presence (user_id, location, accuracy_m, available, last_seen_at)
  values (
    auth.uid(),
    st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
    p_accuracy_m,
    coalesce(p_available, false),
    now()
  )
  on conflict (user_id) do update
  set location = excluded.location,
      accuracy_m = excluded.accuracy_m,
      available = excluded.available,
      last_seen_at = now()
  returning * into result;

  return result;
end;
$$;

create or replace function public.disable_my_presence()
returns void
language sql
security invoker
set search_path = public
as $$
  update public.presence
     set available = false,
         last_seen_at = now()
   where user_id = auth.uid();
$$;

-- Defensive cleanup helper for scheduled jobs.
create or replace function public.expire_stale_presence()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  update public.presence
     set available = false
   where available = true
     and last_seen_at < now() - interval '5 minutes';
  get diagnostics affected = row_count;
  return affected;
end;
$$;
