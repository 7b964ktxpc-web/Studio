import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_DISTANCE_M = 2000;
const PRESENCE_FRESHNESS_MS = 5 * 60 * 1000;
const ALLOWED_ANSWERS = new Set([
  "Да, вижу", "Нет, не вижу", "Нет очереди", "Очередь небольшая", "Очередь большая",
  "Не знаю", "Работает", "Не работает", "Есть", "Нет",
]);

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const r = 6_371_000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
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

    const body = await request.json() as { questionId?: string; answer?: string };
    if (!body.questionId || !body.answer || !ALLOWED_ANSWERS.has(body.answer)) {
      return Response.json({ error: "Valid questionId and answer are required" }, { status: 400, headers: corsHeaders });
    }

    const service = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: question, error: questionError } = await service
      .from("questions")
      .select("id,user_id,status,expires_at,lat,lng,radius_m")
      .eq("id", body.questionId)
      .single();

    if (questionError || !question) return Response.json({ error: "Question not found" }, { status: 404, headers: corsHeaders });
    if (question.user_id === data.user.id) return Response.json({ error: "Cannot answer your own question" }, { status: 403, headers: corsHeaders });
    if (question.status !== "waiting" || new Date(question.expires_at).getTime() <= Date.now()) {
      return Response.json({ error: "Question is no longer active" }, { status: 410, headers: corsHeaders });
    }

    const { data: presence, error: presenceError } = await service
      .from("presence")
      .select("user_id,lat,lng,updated_at,available")
      .eq("user_id", data.user.id)
      .eq("available", true)
      .single();

    if (presenceError || !presence) return Response.json({ error: "Active location is required" }, { status: 403, headers: corsHeaders });
    if (Date.now() - new Date(presence.updated_at).getTime() > PRESENCE_FRESHNESS_MS) {
      return Response.json({ error: "Location is stale" }, { status: 403, headers: corsHeaders });
    }

    const distanceM = distanceMeters(question.lat, question.lng, presence.lat, presence.lng);
    const allowedRadius = Math.min(Math.max(Number(question.radius_m ?? 1000), 300), MAX_DISTANCE_M);
    if (distanceM > allowedRadius) {
      return Response.json({ error: "You are outside the question radius" }, { status: 403, headers: corsHeaders });
    }

    const { data: existing } = await service
      .from("answers")
      .select("id")
      .eq("question_id", body.questionId)
      .eq("user_id", data.user.id)
      .maybeSingle();
    if (existing) return Response.json({ error: "Already answered" }, { status: 409, headers: corsHeaders });

    const { data: answer, error: insertError } = await service
      .from("answers")
      .insert({ question_id: body.questionId, user_id: data.user.id, answer: body.answer })
      .select("id,question_id,answer,created_at")
      .single();

    if (insertError || !answer) return Response.json({ error: "Unable to save answer" }, { status: 500, headers: corsHeaders });

    return Response.json({ ok: true, answer }, { headers: corsHeaders });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Invalid request" }, { status: 400, headers: corsHeaders });
  }
});
