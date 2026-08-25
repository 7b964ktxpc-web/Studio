-- Сейчас / backend migration 014
-- Draft only. Apply only to the NEW «Сейчас» Supabase project.
-- The create_request RPC is SECURITY INVOKER, so authenticated request authors
-- need a narrowly-scoped dispatcher that cannot be used for somebody else's request.

CREATE OR REPLACE FUNCTION public.dispatch_nearby_request(
  p_request_id uuid,
  p_limit integer default 8
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  candidate record;
  queued integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING errcode = '28000', message = 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.requests r
    WHERE r.id = p_request_id
      AND r.author_id = auth.uid()
      AND r.status = 'SEARCHING'
      AND r.expires_at > now()
  ) THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'Request is not owned by current user or is not active';
  END IF;

  FOR candidate IN
    SELECT * FROM public.nearby_recipients(p_request_id, p_limit)
  LOOP
    INSERT INTO public.notification_events (user_id, request_id, kind)
    VALUES (candidate.user_id, p_request_id, 'NEW_NEARBY_REQUEST')
    ON CONFLICT (user_id, request_id, kind) WHERE request_id IS NOT NULL DO NOTHING;

    IF found THEN
      queued := queued + 1;
    END IF;
  END LOOP;

  RETURN queued;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.dispatch_nearby_request(uuid, integer) FROM public;
REVOKE EXECUTE ON FUNCTION public.dispatch_nearby_request(uuid, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.dispatch_nearby_request(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_nearby_request(uuid, integer) TO service_role;

-- Worker-only queue functions stay unavailable to browser roles.
REVOKE EXECUTE ON FUNCTION public.claim_notification_events(integer) FROM public;
REVOKE EXECUTE ON FUNCTION public.claim_notification_events(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_notification_events(integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_notification_events(integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.mark_notification_delivered(uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.mark_notification_delivered(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_notification_delivered(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.mark_notification_delivered(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.release_notification_event(uuid, text, integer) FROM public;
REVOKE EXECUTE ON FUNCTION public.release_notification_event(uuid, text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.release_notification_event(uuid, text, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.release_notification_event(uuid, text, integer) TO service_role;
