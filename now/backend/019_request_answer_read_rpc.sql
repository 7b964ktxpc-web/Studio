-- «Сейчас» / backend migration 019
-- Draft only. Apply only to the NEW «Сейчас» Supabase project.

-- Requesters may read their own request answers through a minimal RPC.
-- Do not expose responder identity or any coordinates.
create or replace function public.my_request_answers(p_request_id uuid)
returns table(
  answer_id uuid,
  answer text,
  created_at timestamptz
)
language sql
security invoker
set search_path = public
as $$
  select a.id, a.answer, a.created_at
  from public.answers a
  join public.requests r on r.id = a.request_id
  where a.request_id = p_request_id
    and r.author_id = auth.uid()
  order by a.created_at asc;
$$;

grant execute on function public.my_request_answers(uuid) to authenticated;
