-- Сейчас / backend migration 005
-- Draft only. Apply only to the NEW «Сейчас» Supabase project.

-- Turn notification_events into a small durable delivery queue.
alter table public.notification_events
  add column if not exists attempts integer not null default 0 check (attempts >= 0),
  add column if not exists available_at timestamptz not null default now(),
  add column if not exists locked_at timestamptz null,
  add column if not exists last_error text null;

create index if not exists notification_events_pending_idx
  on public.notification_events(available_at, created_at)
  where delivered_at is null;

-- Select and queue nearby recipients for a request in one transaction-safe operation.
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
    on conflict (user_id, request_id, kind) where request_id is not null do nothing;

    if found then
      queued := queued + 1;
    end if;
  end loop;

  return queued;
end;
$$;

-- Claim a small batch. Only server-side workers should call this function.
create or replace function public.claim_notification_events(
  p_batch_size integer default 20
)
returns table(
  id uuid,
  user_id uuid,
  request_id uuid,
  kind text,
  attempts integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with picked as (
    select e.id
    from public.notification_events e
    where e.delivered_at is null
      and e.available_at <= now()
      and (e.locked_at is null or e.locked_at < now() - interval '2 minutes')
    order by e.created_at asc
    for update skip locked
    limit greatest(1, least(p_batch_size, 100))
  )
  update public.notification_events e
     set locked_at = now(),
         attempts = e.attempts + 1
    from picked
   where e.id = picked.id
  returning e.id, e.user_id, e.request_id, e.kind, e.attempts;
end;
$$;

create or replace function public.mark_notification_delivered(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notification_events
     set delivered_at = now(),
         locked_at = null,
         last_error = null
   where id = p_id
     and delivered_at is null;
  return found;
end;
$$;

create or replace function public.release_notification_event(
  p_id uuid,
  p_error text,
  p_retry_seconds integer default 30
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notification_events
     set locked_at = null,
         last_error = left(coalesce(p_error, 'delivery failed'), 1000),
         available_at = now() + make_interval(secs => greatest(5, least(p_retry_seconds, 3600)))
   where id = p_id
     and delivered_at is null;
  return found;
end;
$$;
