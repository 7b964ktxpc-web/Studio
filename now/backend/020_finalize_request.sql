-- «Сейчас» / backend migration 020
-- Draft only. Apply only to the NEW «Сейчас» Supabase project.

-- The requester may explicitly finish an active request after reviewing the
-- collected confirmations. Only the owner can finalize, and only SEARCHING
-- requests may transition to ANSWERED.
create or replace function public.finalize_request(
  p_request_id uuid
)
returns table(
  request_id uuid,
  request_status text
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_request public.requests;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;

  select * into v_request
  from public.requests
  where id = p_request_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Request not found';
  end if;

  if v_request.author_id <> auth.uid() then
    raise exception using errcode = '42501', message = 'Only requester can finalize request';
  end if;

  if v_request.status <> 'SEARCHING' then
    return query select v_request.id, v_request.status;
    return;
  end if;

  update public.requests
     set status = 'ANSWERED'
   where id = p_request_id
   returning id, status into request_id, request_status;

  insert into public.notification_events (user_id, request_id, kind)
  values (v_request.author_id, p_request_id, 'REQUEST_FINALIZED');

  return next;
end;
$$;

grant execute on function public.finalize_request(uuid) to authenticated;
revoke execute on function public.finalize_request(uuid) from anon;
