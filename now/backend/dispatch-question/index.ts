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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
  }

  try {
    const body = await request.json() as {
      questionId?: string;
      lat?: number;
      lng?: number;
      radiusM?: number;
    };

    const { questionId, lat, lng } = body;
    const radiusM = Math.min(Math.max(Number(body.radiusM ?? 1000), MIN_RADIUS_M), MAX_RADIUS_M);

    if (!questionId || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return Response.json(
        { error: "questionId, lat and lng are required" },
        { status: 400, headers: corsHeaders },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return Response.json(
        { error: "Server is not configured" },
        { status: 500, headers: corsHeaders },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: question, error: questionError } = await supabase
      .from("questions")
      .select("id,status,expires_at")
      .eq("id", questionId)
      .single();

    if (questionError || !question) {
      return Response.json({ error: "Question not found" }, { status: 404, headers: corsHeaders });
    }

    if (question.status !== "waiting" || new Date(question.expires_at).getTime() <= Date.now()) {
      return Response.json(
        { questionId, recipients: [], reason: "question_inactive" },
        { headers: corsHeaders },
      );
    }

    const freshnessCutoff = new Date(Date.now() - PRESENCE_FRESHNESS_MS).toISOString();
    const { data: presenceRows, error: presenceError } = await supabase
      .from("presence")
      .select("id,user_id,lat,lng,updated_at,available")
      .eq("available", true)
      .gte("updated_at", freshnessCutoff)
      .neq("user_id", null)
      .limit(200);

    if (presenceError) {
      return Response.json({ error: "Unable to find nearby users" }, { status: 500, headers: corsHeaders });
    }

    const recipients = (presenceRows ?? [])
      .map((row) => ({ ...row, distanceM: distanceMeters(lat, lng, row.lat, row.lng) }))
      .filter((row) => row.distanceM <= radiusM)
      .sort((a, b) => a.distanceM - b.distanceM)
      .slice(0, MAX_RECIPIENTS)
      .map((row) => ({ userId: row.user_id, distanceM: row.distanceM }));

    return Response.json(
      {
        questionId,
        radiusM,
        recipientCount: recipients.length,
        recipients,
        expiresAt: question.expires_at,
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Invalid request" }, { status: 400, headers: corsHeaders });
  }
});
