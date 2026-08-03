// S.O.S. — Account deletion (Apple App Store Guideline 5.1.1(v))
// Personal data is erased transactionally in Postgres before the Auth identity
// is deleted. Financial and safety records remain only as anonymized tombstones.

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

function corsHeaders(req: Request) {
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

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json; charset=utf-8" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !serviceRole) {
    console.error("delete-account missing required Supabase runtime configuration");
    return json(req, { error: "Account deletion is temporarily unavailable" }, 503);
  }

  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return json(req, { error: "Missing Authorization bearer token" }, 401);

  const userClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json(req, { error: "Invalid or expired session" }, 401);

  const admin = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: erasure, error: erasureError } = await admin.rpc(
    "sos_anonymize_account",
    { p_auth_id: user.id },
  );
  if (erasureError) {
    console.error("delete-account anonymization failed", {
      authUserId: user.id,
      code: erasureError.code,
      message: erasureError.message,
    });
    return json(req, { error: "Account data could not be erased safely" }, 500);
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error("delete-account auth deletion failed", {
      authUserId: user.id,
      message: deleteError.message,
    });
    return json(req, {
      error: "Personal data was anonymized, but the sign-in identity could not be removed",
      profile_anonymized: true,
    }, 500);
  }

  return json(req, {
    ok: true,
    account_deleted: true,
    profile_anonymized: Boolean(erasure?.profile_anonymized ?? erasure?.found),
  });
});
