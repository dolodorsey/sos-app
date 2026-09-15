import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.0";

const URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const allowedOrigins = new Set([
  "https://thesuperherosonstandby.com",
  "https://www.thesuperherosonstandby.com",
  "https://superherosonstandby.com",
  "https://www.superherosonstandby.com",
]);

const headers = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://thesuperherosonstandby.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  "Vary": "Origin",
});

const json = (body: unknown, status: number, origin: string | null) =>
  new Response(JSON.stringify(body, null, 2), { status, headers: headers(origin) });

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: headers(origin) });
  if (req.method !== "GET") return json({ app: "sos", error: "method_not_allowed" }, 405, origin);

  const authorization = req.headers.get("authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return json({ app: "sos", error: "authentication_required" }, 401, origin);
  }

  const caller = createClient(URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data: isOperator, error: operatorError } = await caller.rpc("marketplace_operator_check");
  if (operatorError || isOperator !== true) {
    return json({ app: "sos", error: "operator_access_required" }, 403, origin);
  }

  const started = Date.now();
  const db = createClient(URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const queryProblems: string[] = [];
  const founderExceptions: string[] = [];
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60_000).toISOString();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60_000).toISOString();

  const count = async (table: string, build: (q: any) => any = (q) => q): Promise<number | null> => {
    try {
      const { count: value, error } = await build(db.from(table).select("*", { count: "exact", head: true }));
      if (error) throw error;
      return value ?? 0;
    } catch {
      queryProblems.push(`${table}_unreadable`);
      return null;
    }
  };

  const one = async (table: string): Promise<Record<string, unknown> | null> => {
    try {
      const { data, error } = await db.from(table).select("*").limit(1).maybeSingle();
      if (error) throw error;
      return (data || null) as Record<string, unknown> | null;
    } catch {
      queryProblems.push(`${table}_unreadable`);
      return null;
    }
  };

  const oldestPendingCrm = async (): Promise<{ created_at: string; attempts: number } | null> => {
    try {
      const { data, error } = await db
        .from("sos_crm_outbox")
        .select("created_at,attempts")
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ? { created_at: String(data.created_at), attempts: Number(data.attempts || 0) } : null;
    } catch {
      queryProblems.push("sos_crm_oldest_pending_unreadable");
      return null;
    }
  };

  const [
    funnel,
    recruitingHealth,
    crmPending,
    crmStale4h,
    crmPendingZeroAttempts,
    crmProcessed24h,
    oldestCrm,
    applications,
    applications24h,
    realHeroes,
    verifiedHeroes,
    liveHeroes,
    missions,
    missions24h,
    completedMissions,
    outreachEvents,
    outreachEvents4h,
  ] = await Promise.all([
    one("sos_provider_activation_funnel_scorecard"),
    one("sos_recruiting_pipeline_health"),
    count("sos_crm_outbox", (q) => q.eq("status", "pending")),
    count("sos_crm_outbox", (q) => q.eq("status", "pending").lt("created_at", fourHoursAgo)),
    count("sos_crm_outbox", (q) => q.eq("status", "pending").eq("attempts", 0)),
    count("sos_crm_outbox", (q) => q.eq("status", "processed").gte("processed_at", oneDayAgo)),
    oldestPendingCrm(),
    count("sos_provider_applications"),
    count("sos_provider_applications", (q) => q.gte("created_at", oneDayAgo)),
    count("sos_heroes", (q) => q.eq("is_demo", false)),
    count("sos_heroes", (q) => q.eq("is_demo", false).eq("verification_status", "verified")),
    count("sos_heroes", (q) => q.eq("is_demo", false).eq("verification_status", "verified").eq("on_duty", true)),
    count("sos_missions"),
    count("sos_missions", (q) => q.gte("created_at", oneDayAgo)),
    count("sos_missions", (q) => q.eq("status", "completed")),
    count("sos_recruiting_outreach_events"),
    count("sos_recruiting_outreach_events", (q) => q.gte("occurred_at", fourHoursAgo)),
  ]);

  const prospects = Number(funnel?.prospects || recruitingHealth?.total_candidates || 0);
  const contacted = Number(funnel?.contacted || 0);
  const qualified = Number(recruitingHealth?.qualified_candidates || 0);
  const activationReady = Number(funnel?.activation_ready || 0);

  if (prospects > 0 && contacted === 0) founderExceptions.push("prospects_exist_but_zero_contacted");
  if (qualified > 0 && Number(outreachEvents || 0) === 0) founderExceptions.push("qualified_candidates_but_zero_outreach_execution");
  if (Number(applications || 0) === 0) founderExceptions.push("zero_provider_applications");
  if (Number(realHeroes || 0) === 0) founderExceptions.push("zero_real_hero_supply");
  if (Number(verifiedHeroes || 0) === 0) founderExceptions.push("zero_verified_hero_supply");
  if (Number(liveHeroes || 0) === 0) founderExceptions.push("zero_live_hero_supply");
  if (Number(missions || 0) === 0) founderExceptions.push("zero_lifetime_missions");
  if (Number(crmStale4h || 0) > 0) founderExceptions.push("stale_crm_backlog_over_4h");
  if (Number(crmPendingZeroAttempts || 0) > 0) founderExceptions.push("crm_backlog_zero_attempts");

  const founderStatus = queryProblems.length || founderExceptions.length ? "red" : "green";

  return json({
    app: "sos",
    visibility: "operator_only",
    founder_status: founderStatus,
    founder_exceptions: founderExceptions,
    query_problems: queryProblems,
    recruiting: {
      prospects,
      qualified_candidates: qualified,
      contacted,
      outreach_events_total: outreachEvents,
      outreach_events_last_4h: outreachEvents4h,
      provider_applications: applications,
      provider_applications_24h: applications24h,
      activation_ready: activationReady,
    },
    supply: {
      real_heroes: realHeroes,
      verified_heroes: verifiedHeroes,
      live_heroes: liveHeroes,
    },
    demand: {
      missions_total: missions,
      missions_24h: missions24h,
      completed_missions: completedMissions,
    },
    crm: {
      pending: crmPending,
      stale_over_4h: crmStale4h,
      pending_zero_attempts: crmPendingZeroAttempts,
      processed_24h: crmProcessed24h,
      oldest_pending_created_at: oldestCrm?.created_at || null,
      oldest_pending_attempts: oldestCrm?.attempts ?? null,
    },
    latency_ms: Date.now() - started,
    checked_at: new Date().toISOString(),
  }, queryProblems.length ? 503 : 200, origin);
});
