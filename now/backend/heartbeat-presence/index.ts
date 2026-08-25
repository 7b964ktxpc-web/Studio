import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

    const body = await request.json() as { lat?: number; lng?: number; available?: boolean };
    if (!coordinate(body.lat, -90, 90) || !coordinate(body.lng, -180, 180)) {
      return Response.json({ error: "Valid lat and lng are required" }, { status: 400, headers: corsHeaders });
    }

    const service = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { error } = await service.from("presence").upsert({
      user_id: data.user.id,
      lat: body.lat,
      lng: body.lng,
      available: body.available !== false,
      updated_at: new Date().toISOString(),
    });

    if (error) return Response.json({ error: "Unable to update presence" }, { status: 500, headers: corsHeaders });
    return Response.json({ ok: true, expiresAfterSeconds: 300 }, { headers: corsHeaders });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Invalid request" }, { status: 400, headers: corsHeaders });
  }
});
