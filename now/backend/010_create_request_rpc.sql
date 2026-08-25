-- «Сейчас» / backend migration 010
-- Draft only. Apply only to the NEW «Сейчас» Supabase project.
-- Creates requests server-side and queues nearby notification events atomically.

create or replace function public.create_request(
  p_text text,
  p_latitude double precision,
  p_longitude double precision,
  p_radius_m integer default 50
)
returns table(
  request_id uuid,
  request_status text,
  expires_at timestamptz,
  queued_count integer
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid;
  v_request_id uuid;
  v_expires_at timestamptz;
  v_queued_count integer := 0;
  v_candidate record;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;

  if p_text is null or char_length(trim(p_text)) < 1 or char_length(p_text) > 160 then
    raise exception using errcode = '22023', message = 'Invalid request text';
  end if;

  if not (p_latitude between -90 and 90 and p_longitude between -180 and 180) then
    raise exception using errcode = '22023', message = 'Invalid coordinates';
  end if;

  if p_radius_m not in (50, 100, 150, 250) then
    raise exception using errcode = '22023', message = 'Invalid radius';
  end if;

  insert into public.requests (
    author_id,
    text,
    location,
    radius_m,
    status,
    expires_at
  )
  values (
    v_user_id,
    trim(p_text),
    st_setsrid(st_makepoint(p_longitude, p_latitude), 4326)::geography,
    p_radius_m,
    'SEARCHING',
    now() + interval '10 minutes'
  )
  returning id, expires_at into v_request_id, v_expires_at;

  for v_candidate in
    select user_id
    from public.nearby_recipients(v_request_id, 8)
  loop
    if public.queue_nearby_notification(v_candidate.user_id, v_request_id) is not null then
      v_queued_count := v_queued_count + 1;
    end if;
  end loop;

  return query
    select v_request_id, 'SEARCHING'::text, v_expires_at, v_queued_count;
end;
$$;

grant execute on function public.create_request(text, double precision, double precision, integer) to authenticated;
revoke execute on function public.create_request(text, double precision, double precision, integer) from anon;
