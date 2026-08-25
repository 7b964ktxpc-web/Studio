-- Сейчас / backend migration 004
-- Draft only. Apply only to the NEW «Сейчас» Supabase project.

-- Atomic answer flow: validate an active request, prevent duplicate answers,
-- insert answer, mark request answered, and create the request author's event.
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
    select 1 from public.answers
    where request_id = p_request_id
      and author_id = auth.uid()
  ) then
    raise exception using errcode = '23505', message = 'Already answered';
  end if;

  insert into public.answers (request_id, author_id, answer)
  values (p_request_id, auth.uid(), trim(p_answer))
  returning id into v_answer_id;

  update public.requests
     set status = 'ANSWERED'
   where id = p_request_id;

  if v_request.author_id is not null then
    insert into public.notification_events (user_id, request_id, kind)
    values (v_request.author_id, p_request_id, 'REQUEST_ANSWERED')
    on conflict (user_id, request_id, kind) where request_id is not null do nothing;
  end if;

  return query select v_answer_id, p_request_id, 'ANSWERED'::text;
end;
$$;

-- Expire old requests in one transaction-friendly operation.
create or replace function public.expire_stale_requests()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  update public.requests
     set status = 'EXPIRED'
   where status = 'SEARCHING'
     and expires_at <= now();
  get diagnostics affected = row_count;
  return affected;
end;
$$;

-- Create a deduplicated event for a selected nearby recipient.
create or replace function public.queue_nearby_notification(
  p_user_id uuid,
  p_request_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  event_id uuid;
begin
  if p_user_id is null or p_request_id is null then
    return null;
  end if;

  insert into public.notification_events (user_id, request_id, kind)
  values (p_user_id, p_request_id, 'NEW_NEARBY_REQUEST')
  on conflict (user_id, request_id, kind) where request_id is not null do nothing
  returning id into event_id;

  return event_id;
end;
$$;
