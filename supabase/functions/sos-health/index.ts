import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.0";

const URL = Deno.env.get("SUPABASE_URL") || "";
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const started = Date.now();
  const db = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const checks: Record<string, unknown> = {};
  const softwareProblems: string[] = [];
  const activationBlockers: string[] = [];

  const count = async (table: string, build: (q: any) => any = (q) => q): Promise<number | null> => {
    try {
      const { count: c, error } = await build(db.from(table).select("*", { count: "exact", head: true }));
      if (error) throw error;
      return c ?? 0;
    } catch (_e) { return null; }
  };

  const secret = async (name: string): Promise<string> => {
    if (Deno.env.get(name)) return "runtime_env";
    try {
      const { data, error } = await db.rpc("sos_get_runtime_secret", { secret_name: name });
      if (!error && data) return "vault";
    } catch (_e) { /* fall through */ }
    return "missing";
  };

  const fifteenMinAgo = new Date(Date.now() - 15 * 60_000).toISOString();
  const [activeServices, activeZones, verifiedHeroes, liveHeroes, openMissions, pendingPayments,
         stripeSource, webhookSource, vapidPublicSource, vapidPrivateSource,
         pushSubscriptions, pushDeliveries] = await Promise.all([
    count("sos_subcategories", (q) => q.eq("is_active", true)),
    count("sos_service_zones", (q) => q.eq("is_active", true)),
    count("sos_heroes", (q) => q.eq("verification_status", "verified").eq("is_demo", false)),
    count("sos_heroes", (q) => q.eq("verification_status", "verified").eq("is_demo", false)
      .eq("on_duty", true).gte("last_gps_at", fifteenMinAgo)),
    count("sos_missions", (q) => q.in("status", ["requested", "matching"])),
    count("sos_payments", (q) => q.in("payment_status", ["pending", "requires_action"])),
    secret("STRIPE_SECRET_KEY"),
    secret("STRIPE_WEBHOOK_SECRET"),
    secret("MARKETPLACE_VAPID_PUBLIC_KEY"),
    secret("MARKETPLACE_VAPID_PRIVATE_KEY"),
    count("marketplace_push_subscriptions"),
    count("marketplace_push_deliveries"),
  ]);

  const pushReady=vapidPublicSource!=="missing"&&vapidPrivateSource!=="missing"&&pushSubscriptions!==null&&pushDeliveries!==null;
  checks.catalog = { active_services: activeServices, active_zones: activeZones };
  checks.supply = { verified_heroes: verifiedHeroes, live_heroes: liveHeroes, demo_excluded: true };
  checks.demand = { open_missions: openMissions };
  checks.payments = {
    stripe_server_credential: stripeSource !== "missing",
    webhook_signature_secret: webhookSource !== "missing",
    credential_sources: { stripe: stripeSource, webhook: webhookSource },
    payments_table_reachable: pendingPayments !== null,
    pending_payments: pendingPayments,
  };
  checks.push = {
    ready: pushReady,
    vapid_public_key: vapidPublicSource!=="missing",
    vapid_private_key: vapidPrivateSource!=="missing",
    subscription_table_reachable: pushSubscriptions!==null,
    delivery_table_reachable: pushDeliveries!==null,
    subscriptions: pushSubscriptions,
    delivery_rows: pushDeliveries,
  };

  if (activeServices === null || activeZones === null) softwareProblems.push("catalog_unreadable");
  if (!activeServices) softwareProblems.push("no_active_services");
  if (!activeZones) softwareProblems.push("no_active_zones");
  if (verifiedHeroes === null || liveHeroes === null) softwareProblems.push("supply_unreadable");
  if (pendingPayments === null) softwareProblems.push("payments_unreadable");
  if (stripeSource === "missing") softwareProblems.push("stripe_secret_missing");
  if (webhookSource === "missing") softwareProblems.push("stripe_webhook_secret_missing");
  if (vapidPublicSource === "missing") softwareProblems.push("push_public_key_missing");
  if (vapidPrivateSource === "missing") softwareProblems.push("push_private_key_missing");
  if (pushSubscriptions === null || pushDeliveries === null) softwareProblems.push("push_tables_unreadable");

  if (verifiedHeroes === 0) activationBlockers.push("no_verified_heroes");
  if (liveHeroes === 0) activationBlockers.push("no_live_heroes");

  const fatal = softwareProblems.some((p) => p.endsWith("_unreadable"));
  const softwareStatus = fatal ? "unhealthy" : softwareProblems.length ? "degraded" : "ok";
  const activationStatus = activationBlockers.length ? "blocked" : "ready";

  return new Response(JSON.stringify({
    app: "sos",
    status: softwareStatus,
    software_status: softwareStatus,
    activation_status: activationStatus,
    software_ready: softwareStatus === "ok",
    market_activation_ready: activationStatus === "ready",
    software_problems: softwareProblems,
    activation_blockers: activationBlockers,
    problems: softwareProblems,
    checks,
    latency_ms: Date.now() - started,
    checked_at: new Date().toISOString(),
  }, null, 2), { status: fatal ? 503 : 200, headers: cors });
});
