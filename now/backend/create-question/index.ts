import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MIN_RADIUS_M = 300;
const MAX_RADIUS_M = 2000;
const MAX_ACTIVE_QUESTIONS = 3;

function coordinate(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !serviceRoleKey || !anonKey) return Response.json({ error: "Server is not configured" }, { status: 500, headers: corsHeaders });

    const authorization = request.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return Response.json({ error: "Authentication required" }, { status: 401, headers: corsHeaders });
    const token = authorization.slice("Bearer ".length).trim();

    const authClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data, error: authError } = await authClient.auth.getUser(token);
    if (authError || !data.user) return Response.json({ error: "Authentication required" }, { status: 401, headers: corsHeaders });

    const body = await request.json() as {
      text?: string;
      lat?: number;
      lng?: number;
      radiusM?: number;
      placeId?: string | null;
    };

    const text = body.text?.trim() ?? "";
    if (text.length < 2 || text.length > 160 || !coordinate(body.lat, -90, 90) || !coordinate(body.lng, -180, 180)) {
      return Response.json({ error: "Valid text, lat and lng are required" }, { status: 400, headers: corsHeaders });
    }

    const radiusM = Math.min(Math.max(Number(body.radiusM ?? 1000), MIN_RADIUS_M), MAX_RADIUS_M);
    const service = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const freshness = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count, error: countError } = await service
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", data.user.id)
      .eq("status", "waiting")
      .gt("expires_at", new Date().toISOString())
      .gte("created_at", freshness);

    if (countError) return Response.json({ error: "Unable to check active questions" }, { status: 500, headers: corsHeaders });
    if ((count ?? 0) >= MAX_ACTIVE_QUESTIONS) {
      return Response.json({ error: "Too many active questions" }, { status: 429, headers: corsHeaders });
    }

    const { data: presence } = await service
      .from("presence")
      .select("user_id")
      .eq("user_id", data.user.id)
      .maybeSingle();

    if (!presence) {
      return Response.json({ error: "Active location is required before asking nearby users" }, { status: 403, headers: corsHeaders });
    }

    const { data: question, error: insertError } = await service
      .from("questions")
      .insert({
        user_id: data.user.id,
        place_id: body.placeId ?? null,
        text,
        lat: body.lat,
        lng: body.lng,
        radius_m: radiusM,
      })
      .select("id,status,expires_at,radius_m")
      .single();

    if (insertError || !question) return Response.json({ error: "Unable to create question" }, { status: 500, headers: corsHeaders });

    return Response.json({ question }, { headers: corsHeaders });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Invalid request" }, { status: 400, headers: corsHeaders });
  }
});
