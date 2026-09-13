import "jsr:@supabase/functions-js/edge-runtime.d.ts";
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

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.has(origin)
      ? origin
      : "https://thesuperherosonstandby.com",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Cache-Control": "public, max-age=30, s-maxage=30",
    "Vary": "Origin",
  };
}

function json(body: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json; charset=utf-8" },
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405, origin);
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ error: "Origin not allowed" }, 403, origin);

  const url = Deno.env.get("SUPABASE_URL") || "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !serviceRole) return json({ error: "S.O.S. coverage status unavailable" }, 503, origin);

  const admin = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin.rpc("sos_public_service_coverage");
  if (error) {
    console.error("S.O.S. public coverage snapshot failed", { message: error.message });
    return json({ error: "S.O.S. coverage status unavailable" }, 503, origin);
  }

  const rows = Array.isArray(data) ? data : [];
  const services = rows.map((row: any) => ({
    service_id: String(row?.service_id || ""),
    service_name: String(row?.service_name || ""),
    has_verified_supply: Boolean(row?.has_verified_supply),
  }));
  const covered = rows.filter((row: any) => Boolean(row?.has_verified_supply));

  return json({
    generated_at: new Date().toISOString(),
    app: "sos",
    scope: "sos_only",
    sos: {
      services_total: services.length,
      services_with_verified_supply: covered.length,
      verified_supply_count: covered.reduce(
        (sum: number, row: any) => sum + Number(row?.verified_supply_count || 0),
        0,
      ),
      has_verified_supply: covered.length > 0,
      services,
    },
  }, 200, origin);
});
