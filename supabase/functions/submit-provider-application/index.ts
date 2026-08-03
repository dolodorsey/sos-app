import { createClient } from "npm:@supabase/supabase-js@2.97.0";

const ALLOWED_ORIGINS = new Set([
  "https://thesuperherosonstandby.com",
  "https://www.thesuperherosonstandby.com",
  "https://superherosonstandby.com",
  "https://www.superherosonstandby.com",
  "http://localhost:3000",
  "http://localhost:3001",
]);

const ALLOWED_SERVICES = new Set([
  "Towing",
  "Flat Tire Help",
  "Jump Start",
  "Fuel Delivery",
  "Vehicle Lockout",
  "Mobile Maintenance",
  "Car Wash / Detailing",
  "Fleet Services",
]);

const MAX_BODY_BYTES = 16_384;

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

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return respond(req, { error: "Method not allowed" }, 405);

  const origin = req.headers.get("Origin") ?? "";
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return respond(req, { error: "Origin not allowed" }, 403);
  }

  const length = Number(req.headers.get("Content-Length") || "0");
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
    return respond(req, { error: "Request is too large" }, 413);
  }

  let input: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
      return respond(req, { error: "Request is too large" }, 413);
    }
    input = JSON.parse(raw || "{}");
  } catch {
    return respond(req, { error: "Invalid JSON" }, 400);
  }

  // Honeypot for automated submissions. Return a generic accepted response so
  // bots do not learn that they were rejected.
  if (text(input.website, 200)) {
    return respond(req, { accepted: true }, 202);
  }

  const fullName = text(input.full_name, 120);
  const email = text(input.email, 254).toLowerCase();
  const phone = text(input.phone, 30).replace(/\D/g, "");
  const companyName = text(input.company_name, 160) || null;
  const serviceArea = text(input.service_area, 160);
  const licenseNumber = text(input.license_number, 120) || null;
  const notes = text(input.notes, 2000) || null;
  const yearsExperience = input.years_experience === null || input.years_experience === ""
    ? null
    : Number(input.years_experience);
  const insured = input.insured === true;
  const serviceTypes = Array.isArray(input.service_types)
    ? [...new Set(input.service_types.filter((value): value is string =>
        typeof value === "string" && ALLOWED_SERVICES.has(value)
      ))].slice(0, 8)
    : [];

  if (fullName.length < 2) return respond(req, { error: "Enter your full name" }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return respond(req, { error: "Enter a valid email" }, 400);
  if (phone.length < 10 || phone.length > 15) return respond(req, { error: "Enter a valid phone number" }, 400);
  if (serviceArea.length < 2) return respond(req, { error: "Enter your service area" }, 400);
  if (serviceTypes.length < 1) return respond(req, { error: "Select at least one service" }, 400);
  if (yearsExperience !== null && (!Number.isInteger(yearsExperience) || yearsExperience < 0 || yearsExperience > 80)) {
    return respond(req, { error: "Enter valid years of experience" }, 400);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRole) {
    console.error("submit-provider-application missing Supabase runtime configuration");
    return respond(req, { error: "Provider application is temporarily unavailable" }, 503);
  }

  const admin = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin.rpc("sos_submit_provider_application", {
    p_full_name: fullName,
    p_email: email,
    p_phone: phone,
    p_company_name: companyName,
    p_service_types: serviceTypes,
    p_service_area: serviceArea,
    p_years_experience: yearsExperience,
    p_license_number: licenseNumber,
    p_insured: insured,
    p_notes: notes,
  });

  if (error) {
    console.error("provider application RPC failed", {
      code: error.code,
      message: error.message,
    });
    return respond(req, { error: "Application could not be submitted" }, 500);
  }

  return respond(req, {
    accepted: true,
    duplicate: Boolean(data?.duplicate),
  }, data?.duplicate ? 200 : 201);
});
