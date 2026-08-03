import { createClient } from "npm:@supabase/supabase-js@2.97.0";

const ALLOWED_ORIGINS = new Set([
  "https://thesuperherosonstandby.com",
  "https://www.thesuperherosonstandby.com",
  "https://superherosonstandby.com",
  "https://www.superherosonstandby.com",
  "capacitor://localhost",
  "http://localhost",
  "https://localhost",
]);
const ALLOWED_ROLES = new Set(["admin", "operations", "dispatcher"]);
const MAX_BODY_BYTES = 4096;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cors(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin)
      ? origin
      : "https://thesuperherosonstandby.com",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function respond(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json; charset=utf-8" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return respond(req, { error: "Method not allowed" }, 405);

  const origin = req.headers.get("Origin") ?? "";
  if (origin && !ALLOWED_ORIGINS.has(origin)) return respond(req, { error: "Origin not allowed" }, 403);

  const length = Number(req.headers.get("Content-Length") || "0");
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) return respond(req, { error: "Request is too large" }, 413);

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !serviceRole) {
    console.error("dispatch-mission missing Supabase runtime configuration");
    return respond(req, { error: "Dispatch controls are temporarily unavailable" }, 503);
  }

  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return respond(req, { error: "Missing Authorization bearer token" }, 401);

  const userClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return respond(req, { error: "Invalid or expired session" }, 401);

  const role = String(user.app_metadata?.sos_role || "").toLowerCase();
  if (!ALLOWED_ROLES.has(role)) {
    console.warn("dispatch-mission unauthorized operator", { authUserId: user.id, role });
    return respond(req, { error: "S.O.S. operations access required" }, 403);
  }

  let input: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return respond(req, { error: "Request is too large" }, 413);
    input = JSON.parse(raw || "{}");
  } catch {
    return respond(req, { error: "Invalid JSON" }, 400);
  }

  const missionId = String(input.mission_id || "");
  const offerLimit = Number(input.offer_limit ?? 3);
  const radiusMiles = Number(input.radius_miles ?? 15);
  const expiresSeconds = Number(input.expires_seconds ?? 120);

  if (!UUID.test(missionId)) return respond(req, { error: "Valid mission_id required" }, 400);
  if (!Number.isInteger(offerLimit) || offerLimit < 1 || offerLimit > 5) return respond(req, { error: "offer_limit must be 1-5" }, 400);
  if (!Number.isFinite(radiusMiles) || radiusMiles <= 0 || radiusMiles > 50) return respond(req, { error: "radius_miles must be greater than 0 and no more than 50" }, 400);
  if (!Number.isInteger(expiresSeconds) || expiresSeconds < 30 || expiresSeconds > 600) return respond(req, { error: "expires_seconds must be 30-600" }, 400);

  const admin = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.rpc("sos_dispatch_mission_offers", {
    p_mission_id: missionId,
    p_operator_auth_id: user.id,
    p_offer_limit: offerLimit,
    p_radius_miles: radiusMiles,
    p_expires_seconds: expiresSeconds,
  });

  if (error) {
    console.error("dispatch-mission RPC failed", {
      authUserId: user.id,
      missionId,
      code: error.code,
      message: error.message,
    });
    const status = error.code === "P0002" ? 404 : error.code === "42501" ? 403 : 409;
    return respond(req, { error: error.message }, status);
  }

  return respond(req, {
    ...data,
    assignment_confirmed: false,
    message: data?.offer_count > 0
      ? "Offers were sent. Assignment is not confirmed until one approved Hero accepts."
      : "No verified on-duty Hero was available in the selected radius.",
  });
});
