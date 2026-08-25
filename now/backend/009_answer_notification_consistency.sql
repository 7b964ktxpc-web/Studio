-- «Сейчас» / backend migration 009
-- Draft only. Apply only to the NEW «Сейчас» Supabase project.
-- Keep question open after an individual answer: MVP aggregates multiple confirmations.

-- Replace the earlier lifecycle behaviour that closed a request after the first answer.
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

  -- Keep SEARCHING while the request can accept more confirmations.
  -- A separate aggregation step can later mark it ANSWERED.
  if v_request.author_id is not null then
    insert into public.notification_events (user_id, request_id, kind)
    values (v_request.author_id, p_request_id, 'REQUEST_ANSWERED')
    on conflict (user_id, request_id, kind) where request_id is not null do nothing;
  end if;

  return query
    select v_answer_id, p_request_id, 'SEARCHING'::text;
end;
$$;

-- Make the intent explicit for future server-side aggregation.
create or replace function public.answer_count(p_request_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.answers
  where request_id = p_request_id;
$$;

grant execute on function public.answer_count(uuid) to authenticated;

-- A request may be finalized explicitly after aggregation. This avoids
-- coupling "first answer" to request completion.
create or replace function public.finalize_request(p_request_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  changed boolean := false;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;

  update public.requests
     set status = 'ANSWERED'
   where id = p_request_id
     and author_id = auth.uid()
     and status = 'SEARCHING'
     and expires_at > now();

  changed := found;
  return changed;
end;
$$;
