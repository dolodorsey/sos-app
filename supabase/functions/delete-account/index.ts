// SOS — Account deletion (Apple App Store Guideline 5.1.1(v))
// Deletes the authenticated user's data and their auth account.
// service_role key is injected by Supabase at runtime and is NOT in the bundle.
//
// Deploy:  supabase functions deploy delete-account --project-ref cxdqkjvtpilvouwtbgdy

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) {
    return new Response(JSON.stringify({ error: "Missing Authorization bearer token" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // 1) Verify caller.
  const userClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: "Invalid or expired session" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(url, serviceRole, { auth: { persistSession: false } });
  const purged: string[] = [];
  const skipped: string[] = [];
  const tryDelete = async (label: string, fn: () => Promise<{ error: unknown }>) => {
    try { const { error } = await fn(); if (error) skipped.push(`${label}(${(error as any).message})`); else purged.push(label); }
    catch (e) { skipped.push(`${label}(${(e as Error).message})`); }
  };

  // 2) Resolve the SOS-internal user id (sos_users.auth_id -> id), purge
  //    missions (as citizen and as hero), then the profile row. All best-effort.
  const { data: sosUser } = await admin.from("sos_users").select("id").eq("auth_id", user.id).maybeSingle();
  const internalId = sosUser?.id;
  if (internalId) {
    await tryDelete("sos_missions.citizen", () => admin.from("sos_missions").delete().eq("citizen_id", internalId));
    await tryDelete("sos_missions.hero", () => admin.from("sos_missions").delete().eq("hero_id", internalId));
    await tryDelete("sos_users", () => admin.from("sos_users").delete().eq("id", internalId));
  }
  // bookings table keyed directly on auth id (older schema)
  await tryDelete("bookings", () => admin.from("bookings").delete().eq("customer_id", user.id));

  // 3) Delete the auth account.
  const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
  if (delErr) {
    return new Response(JSON.stringify({ error: `Account data removed but auth deletion failed: ${delErr.message}`, purged, skipped }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, deleted: user.id, purged, skipped }), {
    status: 200, headers: { ...cors, "Content-Type": "application/json" },
  });
});
