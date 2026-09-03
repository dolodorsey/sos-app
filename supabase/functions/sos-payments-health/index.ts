import { createClient } from "npm:@supabase/supabase-js@2.112.0";

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, max-age=0",
  "Access-Control-Allow-Origin": "*",
};

async function readRuntimeSecret(name: string): Promise<string | null> {
  const direct = Deno.env.get(name)?.trim();
  if (direct) return direct;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return null;

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin.rpc("sos_get_runtime_secret", {
    secret_name: name,
  });

  if (error || typeof data !== "string" || !data.trim()) return null;
  return data.trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers,
    });
  }

  const startedAt = Date.now();
  const [stripeSecretKey, sosWebhookSecret] = await Promise.all([
    readRuntimeSecret("STRIPE_SECRET_KEY"),
    readRuntimeSecret("sos_stripe_webhook_secret"),
  ]);

  let stripeApi: "reachable" | "unreachable" | "unconfigured" = "unconfigured";
  let stripeHttpStatus: number | null = null;
  let stripeLatencyMs: number | null = null;

  if (stripeSecretKey) {
    const stripeStartedAt = Date.now();
    try {
      const stripeResponse = await fetch("https://api.stripe.com/v1/balance", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
        },
        signal: AbortSignal.timeout(5000),
      });
      stripeLatencyMs = Date.now() - stripeStartedAt;
      stripeHttpStatus = stripeResponse.status;
      stripeApi = stripeResponse.ok ? "reachable" : "unreachable";
    } catch {
      stripeLatencyMs = Date.now() - stripeStartedAt;
      stripeApi = "unreachable";
    }
  }

  const ready = Boolean(stripeSecretKey && sosWebhookSecret && stripeApi === "reachable");

  return new Response(JSON.stringify({
    status: ready ? "ok" : "degraded",
    app: "SOS",
    scope: "sos_only",
    checks: {
      stripe_server_key: stripeSecretKey ? "configured" : "missing",
      sos_webhook_signing_secret: sosWebhookSecret ? "configured" : "missing",
      stripe_api: stripeApi,
      stripe_http_status: stripeHttpStatus,
      stripe_latency_ms: stripeLatencyMs,
    },
    latency_ms: Date.now() - startedAt,
    timestamp: new Date().toISOString(),
  }), {
    status: ready ? 200 : 503,
    headers,
  });
});
