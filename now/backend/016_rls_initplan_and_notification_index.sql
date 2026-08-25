-- Сейчас / backend migration 016
-- Draft only. Apply only to the NEW «Сейчас» Supabase project.
-- Performance hardening: evaluate auth.uid() once per statement and index the
-- notification request lookup used by realtime/event flow.

create index if not exists notification_events_request_idx
  on public.notification_events(request_id, created_at desc)
  where request_id is not null;

-- presence policies
DROP POLICY IF EXISTS presence_insert_own ON public.presence;
CREATE POLICY presence_insert_own
  ON public.presence FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS presence_update_own ON public.presence;
CREATE POLICY presence_update_own
  ON public.presence FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS presence_select_own ON public.presence;
CREATE POLICY presence_select_own
  ON public.presence FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

-- answers policies
DROP POLICY IF EXISTS answers_insert_own ON public.answers;
CREATE POLICY answers_insert_own
  ON public.answers FOR INSERT TO authenticated
  WITH CHECK ((author_id = (select auth.uid())) AND EXISTS (
    SELECT 1 FROM public.requests r
    WHERE r.id = answers.request_id
      AND r.status = 'SEARCHING'
      AND r.expires_at > now()
      AND r.author_id <> (select auth.uid())
  ));

DROP POLICY IF EXISTS answers_select_request_participant ON public.answers;
CREATE POLICY answers_select_request_participant
  ON public.answers FOR SELECT TO authenticated
  USING (
    author_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.requests r
      WHERE r.id = answers.request_id
        AND r.author_id = (select auth.uid())
    )
  );

-- notification events
DROP POLICY IF EXISTS notification_events_select_own ON public.notification_events;
CREATE POLICY notification_events_select_own
  ON public.notification_events FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

-- push subscriptions
DROP POLICY IF EXISTS push_subscriptions_select_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_select_own
  ON public.push_subscriptions FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS push_subscriptions_insert_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_insert_own
  ON public.push_subscriptions FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS push_subscriptions_update_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_update_own
  ON public.push_subscriptions FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS push_subscriptions_delete_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_delete_own
  ON public.push_subscriptions FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

-- requests policies still used by direct authenticated writes.
DROP POLICY IF EXISTS requests_insert_own ON public.requests;
CREATE POLICY requests_insert_own
  ON public.requests FOR INSERT TO authenticated
  WITH CHECK (
    author_id = (select auth.uid())
    AND status = 'SEARCHING'
    AND expires_at > now()
    AND radius_m BETWEEN 50 AND 250
  );

DROP POLICY IF EXISTS requests_update_own ON public.requests;
CREATE POLICY requests_update_own
  ON public.requests FOR UPDATE TO authenticated
  USING (author_id = (select auth.uid()))
  WITH CHECK (author_id = (select auth.uid()));
