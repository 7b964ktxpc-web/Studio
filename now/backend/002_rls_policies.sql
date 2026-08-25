-- Сейчас / backend migration 002
-- Draft only. Apply only to the NEW «Сейчас» Supabase project.

-- RLS policy baseline.
-- Exact coordinates are never readable through client-facing policies.

create policy requests_insert_own
  on public.requests for insert
  to authenticated
  with check (author_id = auth.uid());

create policy requests_select_public_searching
  on public.requests for select
  to authenticated
  using (status = 'SEARCHING' and expires_at > now());

create policy requests_update_own
  on public.requests for update
  to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

create policy presence_insert_own
  on public.presence for insert
  to authenticated
  with check (user_id = auth.uid());

create policy presence_update_own
  on public.presence for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy presence_select_own
  on public.presence for select
  to authenticated
  using (user_id = auth.uid());

create policy answers_insert_own
  on public.answers for insert
  to authenticated
  with check (author_id = auth.uid());

create policy answers_select_request_participant
  on public.answers for select
  to authenticated
  using (
    author_id = auth.uid()
    or exists (
      select 1 from public.requests r
      where r.id = answers.request_id
        and r.author_id = auth.uid()
    )
  );

create policy notification_events_select_own
  on public.notification_events for select
  to authenticated
  using (user_id = auth.uid());

-- Clients do not receive direct read/write access to notification delivery state.
-- Server-side workers may use the service role.
