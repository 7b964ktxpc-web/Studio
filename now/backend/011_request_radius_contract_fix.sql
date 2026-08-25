-- «Сейчас» / backend migration 011
-- Draft only. Apply only to the NEW «Сейчас» Supabase project.
-- Removes the ambiguous client-provided radius. Requests always use the
-- product's staged matching policy: 50 -> 100 -> 150 -> 250 m.

DROP FUNCTION IF EXISTS public.create_request(text, double precision, double precision, integer);

CREATE OR REPLACE FUNCTION public.create_request(
  p_text text,
  p_latitude double precision,
  p_longitude double precision
)
RETURNS TABLE(
  request_id uuid,
  request_status text,
  expires_at timestamptz,
  queued_count integer
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_request_id uuid;
  v_expires_at timestamptz;
  v_queued_count integer := 0;
  v_candidate record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING errcode = '28000', message = 'Authentication required';
  END IF;

  IF p_text IS NULL OR char_length(trim(p_text)) < 1 OR char_length(p_text) > 160 THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'Invalid request text';
  END IF;

  IF NOT (p_latitude BETWEEN -90 AND 90 AND p_longitude BETWEEN -180 AND 180) THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'Invalid coordinates';
  END IF;

  INSERT INTO public.requests (
    author_id,
    text,
    location,
    radius_m,
    status,
    expires_at
  )
  VALUES (
    v_user_id,
    trim(p_text),
    ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography,
    250,
    'SEARCHING',
    now() + interval '10 minutes'
  )
  RETURNING id, expires_at INTO v_request_id, v_expires_at;

  FOR v_candidate IN
    SELECT user_id
    FROM public.nearby_recipients(v_request_id, 8)
  LOOP
    IF public.queue_nearby_notification(v_candidate.user_id, v_request_id) IS NOT NULL THEN
      v_queued_count := v_queued_count + 1;
    END IF;
  END LOOP;

  RETURN QUERY
    SELECT v_request_id, 'SEARCHING'::text, v_expires_at, v_queued_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_request(text, double precision, double precision) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_request(text, double precision, double precision) FROM anon;
