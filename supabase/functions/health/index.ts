import { createClient } from "npm:@supabase/supabase-js@2.112.0";

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, max-age=0",
  "Access-Control-Allow-Origin": "*",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "GET") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });

  const startedAt = Date.now();
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRole) {
    return new Response(JSON.stringify({ status: "degraded", app: "SOS", checks: { database: "unconfigured" }, timestamp: new Date().toISOString() }), { status: 503, headers });
  }

  const admin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
  const [catalog, zones] = await Promise.all([
    admin.from("sos_subcategories").select("id", { count: "exact", head: true }).eq("is_active", true),
    admin.from("sos_service_zones").select("id", { count: "exact", head: true }),
  ]);

  const databaseOk = !catalog.error && !zones.error;
  const status = databaseOk ? "ok" : "degraded";
  return new Response(JSON.stringify({
    status,
    app: "SOS",
    checks: {
      database: databaseOk ? "reachable" : "unreachable",
      active_services: catalog.count ?? null,
      service_zones: zones.count ?? null,
      edge_runtime: "reachable",
    },
    latency_ms: Date.now() - startedAt,
    timestamp: new Date().toISOString(),
  }), { status: databaseOk ? 200 : 503, headers });
});
