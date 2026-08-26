-- «Сейчас» / backend migration 021
-- Draft only. Apply only to the NEW «Сейчас» Supabase project.
-- Do not run against STO-NSK or any unrelated database.

-- Authoritative requester-owned snapshot used by the Realtime -> refresh seam.
-- No coordinates and no responder identity are returned.
create or replace function public.my_request(p_request_id uuid)
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
  select
    r.id,
    r.text,
    r.status,
    r.created_at,
    r.expires_at
  from public.requests r
  where r.id = p_request_id
    and r.author_id = auth.uid();
$$;

grant execute on function public.my_request(uuid) to authenticated;
revoke execute on function public.my_request(uuid) from anon;
