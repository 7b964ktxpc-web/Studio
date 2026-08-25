-- «Сейчас» / backend migration 018
-- Draft only. Apply only to the NEW «Сейчас» Supabase project.

-- Nearby delivery is idempotent: one NEW_NEARBY_REQUEST per user/request.
-- Answer notifications are events, not a deduplicated state marker; every
-- accepted answer must be able to produce a new REQUEST_ANSWERED event.
drop index if exists public.notification_events_dedupe_idx;

create unique index notification_events_nearby_dedupe_idx
  on public.notification_events(user_id, request_id, kind)
  where request_id is not null and kind = 'NEW_NEARBY_REQUEST';

create or replace function public.dispatch_nearby_request(
  p_request_id uuid,
  p_limit integer default 8
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate record;
  queued integer := 0;
begin
  if p_request_id is null then
    return 0;
  end if;

  for candidate in
    select * from public.nearby_recipients(p_request_id, p_limit)
  loop
    insert into public.notification_events (user_id, request_id, kind)
    values (candidate.user_id, p_request_id, 'NEW_NEARBY_REQUEST')
    on conflict (user_id, request_id, kind)
      where request_id is not null and kind = 'NEW_NEARBY_REQUEST'
      do nothing;

    if found then
      queued := queued + 1;
    end if;
  end loop;

  return queued;
end;
$$;

create or replace function public.answer_request(
  p_request_id uuid,
  p_answer text
)
returns table(
  answer_id uuid,
  request_id uuid,
  request_status text
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_request public.requests;
  v_answer_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;

  if p_answer is null or char_length(trim(p_answer)) < 1 or char_length(p_answer) > 240 then
    raise exception using errcode = '22023', message = 'Invalid answer';
  end if;

  select * into v_request
  from public.requests
  where id = p_request_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Request not found';
  end if;

  if v_request.status <> 'SEARCHING' or v_request.expires_at <= now() then
    raise exception using errcode = 'P0001', message = 'Request expired';
  end if;

  if v_request.author_id = auth.uid() then
    raise exception using errcode = '42501', message = 'Requester cannot answer own request';
  end if;

  if exists (
    select 1
    from public.answers
    where request_id = p_request_id
      and author_id = auth.uid()
  ) then
    raise exception using errcode = '23505', message = 'Already answered';
  end if;

  insert into public.answers (request_id, author_id, answer)
  values (p_request_id, auth.uid(), trim(p_answer))
  returning id into v_answer_id;

  insert into public.notification_events (user_id, request_id, kind)
  values (v_request.author_id, p_request_id, 'REQUEST_ANSWERED');

  return query
    select v_answer_id, p_request_id, 'SEARCHING'::text;
end;
$$;
