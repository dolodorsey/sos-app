// Shared pre-launch configuration for the public S.O.S. landing, the provider
// early-registration flow, the internal-access gate and the recruitment command.
// All requests go through the existing client-safe S.O.S. client (src/lib/sosSupabaseClient.js),
// so no key material is duplicated here. Service-role keys never reach the browser.
import { sosSupabase } from './sosSupabaseClient';

export const SOS_INTEREST_FUNCTION = 'sos-provider-early-interest';

// Legal versions the registrant accepts. Bump when /terms or /privacy change.
export const SOS_TERMS_VERSION = 'sos-terms-2026-08-09';
export const SOS_PRIVACY_VERSION = 'sos-privacy-2026-08-09';

export const EMAIL_OPT_IN_TEXT = 'Email me about S.O.S. provider onboarding and launch updates. I can unsubscribe at any time.';
export const SMS_OPT_IN_TEXT = 'Text me about S.O.S. provider onboarding and launch updates. Message frequency varies. Message and data rates may apply. Reply STOP to opt out. Consent is not a condition of registering.';

export const PROVIDER_TYPES = [
  { id: 'individual', label: 'Independent provider', hint: 'You do the work yourself' },
  { id: 'company', label: 'Service company', hint: 'A shop or business with staff' },
  { id: 'fleet', label: 'Fleet operator', hint: 'Multiple trucks or service vehicles' },
];

export const AVAILABILITY = [
  { id: 'weekdays', label: 'Weekdays' },
  { id: 'weekends', label: 'Weekends' },
  { id: 'evenings', label: 'Evenings' },
  { id: 'overnight', label: 'Overnight' },
  { id: 'on_call', label: 'On call' },
];

async function rows(query) {
  const { data, error } = await query;
  if (error) throw new Error(error.message || 'Catalog request failed');
  return data || [];
}

// Canonical taxonomy straight from sos_categories / sos_subcategories / sos_service_zones.
// Only names and ids — no prices, ETAs or supply counts are shown publicly.
export async function loadSOSCatalog() {
  const [categories, subcategories, zones] = await Promise.all([
    rows(sosSupabase.from('sos_categories').select('id,name,description,sort_order').eq('is_active', true).order('sort_order')),
    rows(sosSupabase.from('sos_subcategories').select('id,category_id,name,description,sort_order').eq('is_active', true).order('sort_order').order('name')),
    rows(sosSupabase.from('sos_service_zones').select('id,zone_name,city,state_code,zone_type').eq('is_active', true).order('zone_name')),
  ]);
  const grouped = categories.map((category) => ({
    ...category,
    subcategories: subcategories.filter((sub) => sub.category_id === category.id),
  }));
  return { categories: grouped, subcategoryCount: subcategories.length, zones };
}

// RPC as a specific signed-in user (their access token), or as the public client when no token.
export async function sosRpc(name, body = {}, accessToken = null) {
  let query = sosSupabase.rpc(name, body);
  if (accessToken) query = query.setHeader('Authorization', `Bearer ${accessToken}`);
  const { data, error, status } = await query;
  if (error) { const e = new Error(error.message || `Request failed (${status})`); e.status = status; e.code = error.code; throw e; }
  return data;
}

// Password sign-in / token refresh. Returns a GoTrue-shaped session object compatible with
// the operational app's localStorage format ({access_token, refresh_token, expires_at, user}).
export async function sosPasswordSignIn(email, password) {
  const { data, error } = await sosSupabase.auth.signInWithPassword({ email, password });
  if (error || !data?.session) throw new Error(error?.message || 'Sign-in failed. Check the email and password.');
  return data.session;
}
export async function sosRefreshSession(refreshToken) {
  const { data, error } = await sosSupabase.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data?.session) return null;
  return data.session;
}

export function sosSignOutLocal() {
  sosSupabase.auth.signOut({ scope: 'local' }).catch(() => {});
}

// Submit early interest. Resolves to {ok, status, data}; never throws on HTTP errors.
export async function submitProviderInterest(payload) {
  const { data, error } = await sosSupabase.functions.invoke(SOS_INTEREST_FUNCTION, { body: payload });
  if (!error) return { ok: true, status: 200, data };
  const response = error.context;
  if (response && typeof response.status === 'number') {
    const body = await response.json().catch(() => ({}));
    return { ok: false, status: response.status, data: body };
  }
  return { ok: false, status: 0, data: {} };
}

// Privacy-safe analytics: event names and section ids only. Never names, emails or phones.
// The KHG collector accepts page_view | cta_click | form_submission | application, and the
// global click tracker (KHGTrackingHost) already records every click. So only non-click
// events are forwarded, as an accepted type with the specific event in metadata.
const REMOTE_EVENTS = {
  section_view: 'page_view',
  registration_view: 'page_view',
  gate_block: 'page_view',
  validation_error: 'form_submission',
  registration_error: 'form_submission',
  registration_complete: 'application',
};

export function trackPrelaunch(event, detail = {}) {
  try {
    const safe = { prelaunch_event: event };
    for (const [key, value] of Object.entries(detail)) {
      if (['section', 'cta', 'step', 'count', 'platform', 'result'].includes(key)) safe[key] = String(value).slice(0, 80);
    }
    if (typeof window === 'undefined') return;
    (window.dataLayer = window.dataLayer || []).push({ event: `sos_prelaunch_${event}`, ...safe });
    const remote = REMOTE_EVENTS[event];
    if (remote && typeof window.khgTrack === 'function') {
      if (event === 'registration_complete') safe.conversion_type = 'provider_early_interest';
      window.khgTrack(remote, safe);
    }
  } catch {}
}

export function newIdempotencyKey() {
  try { return crypto.randomUUID(); } catch {}
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
