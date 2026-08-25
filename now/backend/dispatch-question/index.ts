import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_RADIUS_M = 2000;
const MIN_RADIUS_M = 300;
const MAX_RECIPIENTS = 25;
const PRESENCE_FRESHNESS_MS = 5 * 60 * 1000;

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6_371_000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function isValidCoordinate(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

async function authenticate(
  request: Request,
  supabaseUrl: string,
  anonKey: string,
) {
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  if (!token) return null;

  const client = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return Response.json({ error: "Server is not configured" }, { status: 500, headers: corsHeaders });
    }

    const user = await authenticate(request, supabaseUrl, anonKey);
    if (!user) {
      return Response.json({ error: "Authentication required" }, { status: 401, headers: corsHeaders });
    }

    const body = await request.json() as {
      questionId?: string;
      lat?: number;
      lng?: number;
      radiusM?: number;
    };

    const { questionId, lat, lng } = body;
    const radiusM = Math.min(Math.max(Number(body.radiusM ?? 1000), MIN_RADIUS_M), MAX_RADIUS_M);

    if (!questionId || !isValidCoordinate(lat, -90, 90) || !isValidCoordinate(lng, -180, 180)) {
      return Response.json(
        { error: "questionId, valid lat and valid lng are required" },
        { status: 400, headers: corsHeaders },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: question, error: questionError } = await supabase
      .from("questions")
      .select("id,status,expires_at")
      .eq("id", questionId)
      .eq("user_id", user.id)
      .single();

    if (questionError || !question) {
      return Response.json({ error: "Question not found" }, { status: 404, headers: corsHeaders });
    }

    if (question.status !== "waiting" || new Date(question.expires_at).getTime() <= Date.now()) {
      return Response.json(
        { questionId, recipientCount: 0, reason: "question_inactive" },
        { headers: corsHeaders },
      );
    }

    const freshnessCutoff = new Date(Date.now() - PRESENCE_FRESHNESS_MS).toISOString();
    const { data: presenceRows, error: presenceError } = await supabase
      .from("presence")
      .select("user_id,lat,lng,updated_at")
      .eq("available", true)
      .gte("updated_at", freshnessCutoff)
      .neq("user_id", user.id)
      .limit(200);

    if (presenceError) {
      return Response.json({ error: "Unable to find nearby users" }, { status: 500, headers: corsHeaders });
    }

    const candidates = (presenceRows ?? [])
      .map((row) => distanceMeters(lat, lng, row.lat, row.lng))
      .filter((distanceM) => distanceM <= radiusM)
      .sort((a, b) => a - b)
      .slice(0, MAX_RECIPIENTS);

    // Do not return user IDs or coordinates to the caller.
    // The real notification dispatcher should enqueue server-side delivery records here.
    return Response.json(
      {
        questionId,
        radiusM,
        recipientCount: candidates.length,
        expiresAt: question.expires_at,
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Invalid request" }, { status: 400, headers: corsHeaders });
  }
});
