-- Сейчас / backend migration 015
-- Draft only. Apply only to the NEW «Сейчас» Supabase project.
-- Closes advisor findings without changing the product contract.

-- Functions that are only maintenance/server concerns must not be callable from browser roles.
REVOKE EXECUTE ON FUNCTION public.expire_stale_presence() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.expire_stale_presence() FROM anon;
REVOKE EXECUTE ON FUNCTION public.expire_stale_presence() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stale_presence() TO service_role;

REVOKE EXECUTE ON FUNCTION public.expire_stale_requests() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.expire_stale_requests() FROM anon;
REVOKE EXECUTE ON FUNCTION public.expire_stale_requests() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stale_requests() TO service_role;

REVOKE EXECUTE ON FUNCTION public.queue_nearby_notification(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.queue_nearby_notification(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.queue_nearby_notification(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.queue_nearby_notification(uuid, uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.answer_count(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.answer_count(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.answer_count(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.answer_count(uuid) TO service_role;

-- Nearby matching is an internal primitive; callers use create_request / nearby_request_for_answer.
REVOKE EXECUTE ON FUNCTION public.nearby_recipients(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.nearby_recipients(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.nearby_recipients(uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.nearby_recipients(uuid, integer) TO service_role;

-- Push subscription writes can safely obey RLS directly, so avoid SECURITY DEFINER warnings.
CREATE OR REPLACE FUNCTION public.upsert_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  IF length(trim(coalesce(p_endpoint,''))) < 10
     OR length(trim(coalesce(p_p256dh,''))) < 10
     OR length(trim(coalesce(p_auth,''))) < 10 THEN
    RETURN false;
  END IF;
  INSERT INTO public.push_subscriptions(user_id,endpoint,p256dh,auth,user_agent,updated_at)
  VALUES(auth.uid(),trim(p_endpoint),trim(p_p256dh),trim(p_auth),p_user_agent,now())
  ON CONFLICT(user_id,endpoint) DO UPDATE SET
    p256dh=excluded.p256dh,
    auth=excluded.auth,
    user_agent=excluded.user_agent,
    updated_at=now();
  RETURN true;
END;
$$;
GRANT EXECUTE ON FUNCTION public.upsert_push_subscription(text,text,text,text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.upsert_push_subscription(text,text,text,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.upsert_push_subscription(text,text,text,text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.disable_push_subscription(p_endpoint text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR length(trim(coalesce(p_endpoint,''))) < 10 THEN RETURN false; END IF;
  DELETE FROM public.push_subscriptions
  WHERE user_id=auth.uid() AND endpoint=trim(p_endpoint);
  RETURN FOUND;
END;
$$;
GRANT EXECUTE ON FUNCTION public.disable_push_subscription(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.disable_push_subscription(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.disable_push_subscription(text) FROM PUBLIC;

-- RLS policies: evaluate auth.uid() once per statement instead of once per row.
DROP POLICY IF EXISTS presence_insert_own ON public.presence;
CREATE POLICY presence_insert_own
  ON public.presence FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS presence_update_own ON public.presence;
CREATE POLICY presence_update_own
  ON public.presence FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS presence_select_own ON public.presence;
CREATE POLICY presence_select_own
  ON public.presence FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS requests_insert_own ON public.requests;
CREATE POLICY requests_insert_own
  ON public.requests FOR INSERT TO authenticated
  WITH CHECK (author_id = (SELECT auth.uid())
    AND status='SEARCHING' AND expires_at>now() AND radius_m BETWEEN 50 AND 250);
DROP POLICY IF EXISTS requests_update_own ON public.requests;
CREATE POLICY requests_update_own
  ON public.requests FOR UPDATE TO authenticated
  USING (author_id = (SELECT auth.uid()))
  WITH CHECK (author_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS answers_insert_own ON public.answers;
CREATE POLICY answers_insert_own
  ON public.answers FOR INSERT TO authenticated
  WITH CHECK (author_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.requests r
      WHERE r.id=answers.request_id
        AND r.status='SEARCHING'
        AND r.expires_at>now()
        AND r.author_id <> (SELECT auth.uid())
    ));
DROP POLICY IF EXISTS answers_select_request_participant ON public.answers;
CREATE POLICY answers_select_request_participant
  ON public.answers FOR SELECT TO authenticated
  USING (
    author_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.requests r
      WHERE r.id=answers.request_id
        AND r.author_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS notification_events_select_own ON public.notification_events;
CREATE POLICY notification_events_select_own
  ON public.notification_events FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS push_subscriptions_select_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_select_own
  ON public.push_subscriptions FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS push_subscriptions_insert_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_insert_own
  ON public.push_subscriptions FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS push_subscriptions_update_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_update_own
  ON public.push_subscriptions FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS push_subscriptions_delete_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_delete_own
  ON public.push_subscriptions FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE INDEX IF NOT EXISTS notification_events_request_id_idx
  ON public.notification_events(request_id);
