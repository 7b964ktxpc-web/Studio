-- «Сейчас» / backend migration 024
-- Draft only. Apply only to the NEW «Сейчас» Supabase project.
-- Keep request coordinates private. Browser reads use controlled RPCs only.

CREATE OR REPLACE FUNCTION public.my_request_answers(
  p_request_id uuid
)
RETURNS TABLE(
  answer_id uuid,
  answer text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT a.id, a.answer, a.created_at
  FROM public.answers AS a
  JOIN public.requests AS r
    ON r.id = a.request_id
  WHERE a.request_id = p_request_id
    AND r.author_id = auth.uid()
  ORDER BY a.created_at ASC;
$$;

REVOKE EXECUTE ON FUNCTION public.my_request_answers(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.my_request_answers(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_request_answers(uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.nearby_request_for_answer(uuid);
CREATE OR REPLACE FUNCTION public.nearby_request_for_answer(
  p_request_id uuid
)
RETURNS TABLE(
  id uuid,
  text text,
  status text,
  created_at timestamptz,
  expires_at timestamptz,
  distance_m integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT
    r.id,
    r.text,
    r.status,
    r.created_at,
    r.expires_at,
    round(st_distance(p.location, r.location))::integer AS distance_m
  FROM public.requests AS r
  JOIN public.presence AS p
    ON p.user_id = auth.uid()
  WHERE r.id = p_request_id
    AND r.status = 'SEARCHING'
    AND r.expires_at > now()
    AND p.available = true
    AND p.last_seen_at >= now() - interval '5 minutes'
    AND (p.accuracy_m IS NULL OR p.accuracy_m <= 50)
    AND st_dwithin(p.location, r.location, 250)
    AND r.author_id IS DISTINCT FROM auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.nearby_request_for_answer(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.nearby_request_for_answer(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nearby_request_for_answer(uuid) TO authenticated;
