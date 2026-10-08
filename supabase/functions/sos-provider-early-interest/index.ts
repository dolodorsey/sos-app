import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.0";

// S.O.S. provider EARLY INTEREST intake (issue #103).
// Public, unauthenticated, anti-abuse protected. Persists through the transactional
// service-role function public.sos_register_provider_interest and returns a receipt
// only after the database commit. Never sends email/SMS. Never creates a Hero,
// an application, or any dispatchable state.

const ALLOWED = new Set([
  "https://thesuperherosonstandby.com",
  "https://www.thesuperherosonstandby.com",
  "https://superherosonstandby.com",
  "https://www.superherosonstandby.com",
  "capacitor://localhost",
  "https://localhost",
  "http://localhost:3000",
]);
const PREVIEW = /^https:\/\/sos-app-website-[a-z0-9-]+-dr-dorseys-projects\.vercel\.app$/;
const allowedOrigin = (origin: string) => ALLOWED.has(origin) || PREVIEW.test(origin);
const MAX_BODY_BYTES = 16384;
const MIN_FILL_MS = 2500;

const FIELD_MESSAGES: Record<string, string> = {
  full_name: "Enter your full name.",
  provider_type: "Choose how you work.",
  company_name: "Enter the business name.",
  email: "Enter a valid email address.",
  phone: "Enter a 10-digit US phone number.",
  contact: "Add an email or a mobile number.",
  city: "Enter your city.",
  state_code: "Choose a state.",
  zip_code: "Enter a 5-digit ZIP code.",
  terms_accepted: "Accept the Terms and Privacy Policy to continue.",
  consent_version: "Reload the page and try again.",
  sms_opt_in: "Add a mobile number to opt in to text messages.",
  email_opt_in: "Add an email to opt in to email.",
  subcategory_ids: "Choose at least one valid service.",
  zone_ids: "Choose at least one valid Atlanta area.",
  service_radius_miles: "Use 1–150 miles.",
  years_experience: "Use 0–80 years.",
  idempotency_key: "Reload the page and try again.",
  source: "Your request could not be verified. Try again.",
};

const cors = (origin: string) => ({
  "Access-Control-Allow-Origin": allowedOrigin(origin) ? origin : "https://thesuperherosonstandby.com",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});
const json = (origin: string, body: unknown, status = 200) =>
  Response.json(body, { status, headers: { ...cors(origin), "Cache-Control": "no-store" } });
const sha256 = async (value: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))))
    .map((b) => b.toString(16).padStart(2, "0")).join("");

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin") || "";
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json(origin, { error: "Method not allowed" }, 405);
  if (!origin || !allowedOrigin(origin)) return json(origin, { error: "Origin not allowed" }, 403);

  const declared = Number(req.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return json(origin, { error: "Registration is too large." }, 413);

  const url = Deno.env.get("SUPABASE_URL") || "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !service) return json(origin, { error: "Registration is temporarily unavailable." }, 503);

  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return json(origin, { error: "Registration is too large." }, 413);
    body = JSON.parse(raw || "{}");
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("bad");
  } catch {
    return json(origin, { error: "Registration must be valid JSON." }, 400);
  }

  // Bot protection: hidden honeypot must be empty, and the form must not be completed implausibly fast.
  if (String(body.website ?? "").trim() !== "") return json(origin, { error: "Registration could not be accepted." }, 400);
  const startedAt = Number(body.started_at || 0);
  if (!Number.isFinite(startedAt) || startedAt <= 0 || Date.now() - startedAt < MIN_FILL_MS) {
    return json(origin, { error: "Please review your answers and submit again." }, 400);
  }

  const source = (req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "unknown").split(",")[0].trim();
  const ipHash = await sha256(`sos-provider-interest:${source}`);
  const userAgent = (req.headers.get("user-agent") || "").slice(0, 300);

  const payload = { ...body };
  delete payload.website;
  delete payload.started_at;

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin.rpc("sos_register_provider_interest", { p_payload: payload, p_ip_hash: ipHash, p_user_agent: userAgent });

  if (error) {
    const message = String(error.message || "");
    if (error.code === "22023" && message.startsWith("VALIDATION:")) {
      const field = message.slice("VALIDATION:".length).trim();
      return json(origin, { error: FIELD_MESSAGES[field] || "Check your answers and try again.", field }, 422);
    }
    if (error.code === "22P02") return json(origin, { error: "One of the answers has an invalid format. Check your answers and try again." }, 422);
    if (error.code === "54000" || message === "RATE_LIMITED") return json(origin, { error: "Too many registrations from this network. Try again later." }, 429);
    console.error("sos-provider-early-interest", error.code, message.slice(0, 200));
    return json(origin, { error: "Registration was not saved. Try again." }, 500);
  }
  if (!data?.ok || !data?.receipt_number) {
    console.error("sos-provider-early-interest", "no receipt returned");
    return json(origin, { error: "Registration was not saved. Try again." }, 500);
  }
  return json(origin, data, data.replayed ? 200 : 201);
});
