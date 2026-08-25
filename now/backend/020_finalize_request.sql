-- «Сейчас» / backend migration 020
-- Draft only. Apply only to the NEW «Сейчас» Supabase project.

-- Keep the existing boolean return contract, but emit an explicit terminal
-- Realtime event when the requester finalizes an active request.
create or replace function public.finalize_request(
  p_request_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  changed boolean := false;
  request_owner uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;

  select author_id into request_owner
  from public.requests
  where id = p_request_id;

  if request_owner is null then
    return false;
  end if;

  if request_owner <> auth.uid() then
    raise exception using errcode = '42501', message = 'Only requester can finalize request';
  end if;

  update public.requests
     set status = 'ANSWERED'
   where id = p_request_id
     and author_id = auth.uid()
     and status = 'SEARCHING'
     and expires_at > now();

  changed := found;

  if changed then
    insert into public.notification_events (user_id, request_id, kind)
    values (auth.uid(), p_request_id, 'REQUEST_FINALIZED');
  end if;

  return changed;
end;
$$;

grant execute on function public.finalize_request(uuid) to authenticated;
revoke execute on function public.finalize_request(uuid) from anon;
