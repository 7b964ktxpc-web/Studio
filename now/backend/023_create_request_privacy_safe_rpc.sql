-- Сейчас / backend migration 023
-- Draft only. Apply only to the NEW «Сейчас» Supabase project.
-- requests SELECT is intentionally revoked from browser roles because exact
-- coordinates are private. create_request therefore runs as a tightly scoped
-- SECURITY DEFINER RPC and returns only its contract projection.

DROP FUNCTION IF EXISTS public.create_request(text, double precision, double precision);

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
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_request_id uuid;
  v_expires_at timestamptz;
  v_queued_count integer := 0;
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

  INSERT INTO public.requests AS req (
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
  RETURNING req.id, req.expires_at INTO v_request_id, v_expires_at;

  v_queued_count := public.dispatch_nearby_request(v_request_id, 8);

  RETURN QUERY
    SELECT v_request_id, 'SEARCHING'::text, v_expires_at, v_queued_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_request(text, double precision, double precision) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_request(text, double precision, double precision) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_request(text, double precision, double precision) TO authenticated;
