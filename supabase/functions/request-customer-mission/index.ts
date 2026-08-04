import { createClient } from "npm:@supabase/supabase-js@2.112.0";

const ALLOWED_ORIGINS = new Set([
  "https://thesuperherosonstandby.com",
  "https://www.thesuperherosonstandby.com",
  "https://superherosonstandby.com",
  "https://www.superherosonstandby.com",
  "capacitor://localhost",
  "http://localhost",
  "https://localhost",
]);

function cors(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://thesuperherosonstandby.com",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json; charset=utf-8" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  const origin = req.headers.get("Origin") ?? "";
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json(req, { error: "Origin not allowed" }, 403);

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !serviceRole) return json(req, { error: "Dispatch is temporarily unavailable" }, 503);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json(req, { error: "Authentication required" }, 401);

  const userClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json(req, { error: "Invalid or expired session" }, 401);

  let input: Record<string, unknown>;
  try { input = await req.json(); }
  catch { return json(req, { error: "Invalid request" }, 400); }

  let serviceId = String(input.service_id || "").trim();
  const serviceName = String(input.service_name || "").trim();
  const address = String(input.pickup_address || "").trim();
  const notes = input.notes == null ? null : String(input.notes).slice(0, 2000);
  const requestType = String(input.request_type || "now");
  const lat = Number(input.pickup_lat);
  const lng = Number(input.pickup_lng);

  if (!serviceId && serviceName) {
    const { data: matches } = await userClient.from("sos_subcategories").select("id,name").ilike("name", serviceName).eq("is_active", true).limit(1);
    serviceId = String(matches?.[0]?.id || "");
  }

  if (!serviceId) return json(req, { error: "Selected service is not available in the live catalog" }, 400);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return json(req, { error: "Valid pickup latitude required" }, 400);
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) return json(req, { error: "Valid pickup longitude required" }, 400);
  if (address.length < 3) return json(req, { error: "Pickup address required" }, 400);

  const { data: mission, error: missionError } = await userClient.rpc("sos_request_customer_mission", {
    p_subcategory_id: serviceId,
    p_pickup_lat: lat,
    p_pickup_lng: lng,
    p_pickup_address: address,
    p_request_type: requestType,
    p_notes: notes,
  });

  if (missionError || !mission?.id) {
    console.error("customer mission creation failed", { userId: userData.user.id, code: missionError?.code, message: missionError?.message });
    return json(req, { error: missionError?.message || "Mission could not be created" }, missionError?.code === "42501" ? 403 : 400);
  }

  const admin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: dispatch, error: dispatchError } = await admin.rpc("sos_auto_dispatch_customer_mission", {
    p_mission_id: mission.id,
    p_requester_auth_id: userData.user.id,
    p_offer_limit: 3,
    p_radius_miles: 15,
    p_expires_seconds: 120,
  });

  if (dispatchError) {
    console.error("automatic customer dispatch failed", { userId: userData.user.id, missionId: mission.id, code: dispatchError.code, message: dispatchError.message });
    return json(req, {
      mission,
      dispatch: { result: "dispatch_pending", offer_count: 0, assignment_confirmed: false },
      warning: "Your request was saved, but automatic matching needs operator attention.",
    }, 202);
  }

  return json(req, {
    mission,
    dispatch,
    message: dispatch?.offer_count > 0
      ? "Verified nearby Heroes were notified. Assignment is confirmed only after one accepts."
      : "Your request is active. No verified on-duty Hero is available in the current radius yet.",
  }, 201);
});
