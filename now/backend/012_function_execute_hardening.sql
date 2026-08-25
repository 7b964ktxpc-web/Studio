-- Сейчас / backend migration 012
-- Draft only. Apply only to the NEW «Сейчас» Supabase project.
-- Remove accidental PUBLIC execution from privileged/derived functions.

-- SECURITY DEFINER proximity discovery must never be callable by anon.
revoke execute on function public.nearby_recipients(uuid, integer) from public;
revoke execute on function public.nearby_recipients(uuid, integer) from anon;
grant execute on function public.nearby_recipients(uuid, integer) to authenticated;

-- Answer-count is derived data and must never be exposed anonymously.
revoke execute on function public.answer_count(uuid) from public;
revoke execute on function public.answer_count(uuid) from anon;
grant execute on function public.answer_count(uuid) to authenticated;

-- Keep the request/answer lifecycle RPCs explicitly authenticated-only.
revoke execute on function public.answer_request(uuid, text) from public;
grant execute on function public.answer_request(uuid, text) to authenticated;

revoke execute on function public.finalize_request(uuid) from public;
grant execute on function public.finalize_request(uuid) to authenticated;

-- The privacy-safe projections are also explicitly authenticated-only.
revoke execute on function public.my_request(uuid) from public;
grant execute on function public.my_request(uuid) to authenticated;

revoke execute on function public.nearby_request_for_answer(uuid) from public;
grant execute on function public.nearby_request_for_answer(uuid) to authenticated;
