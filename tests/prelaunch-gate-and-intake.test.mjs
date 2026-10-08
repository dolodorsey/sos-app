import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

// Contract tests for the S.O.S. pre-launch release (GitHub issue #103).
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const walk = (dir) => fs.readdirSync(new URL(`../${dir}`, import.meta.url), { withFileTypes: true })
  .flatMap((d) => d.isDirectory() ? walk(`${dir}/${d.name}`) : [`${dir}/${d.name}`])

const landing = read('src/components/prelaunch/SOSPrelaunchLanding.jsx')
const flow = read('src/components/prelaunch/SOSProviderEarlyRegistration.jsx')
const gate = read('src/components/prelaunch/SOSPrelaunchGate.jsx')
const gateSql = read('supabase/migrations/20261008030000_sos_prelaunch_marketplace_gate.sql')
const intakeSql = read('supabase/migrations/20261008031000_sos_provider_early_interest_intake.sql')
const opsSql = read('supabase/migrations/20261008032000_sos_ops_recruitment_command.sql')
const edge = read('supabase/functions/sos-provider-early-interest/index.ts')

test('public / is the pre-launch landing on web and native', () => {
  assert.match(read('src/app/page.jsx'), /SOSPrelaunchLanding/)
  const layout = read('src/app/layout.jsx')
  assert.doesNotMatch(layout, /location\.replace\('\/app\/'\)/, 'native shell must not force / -> /app/')
  assert.match(layout, /sos-prelaunch\.css/)
})

test('landing renders all ten sections in order on one page', () => {
  const ids = ['welcome', 'delivers', 'services', 'requests', 'tracking', 'network', 'why', 'areas', 'register', 'updates']
  let last = -1
  for (const id of ids) {
    const at = landing.indexOf(`<section id="${id}"`)
    assert.ok(at > last, `section ${id} must exist after the previous section`)
    last = at
  }
})

test('landing CTAs lead to early registration, never into the operational app', () => {
  assert.match(landing, /const JOIN_HREF = '\/become-a-hero\/'/)
  assert.doesNotMatch(landing, /href=["'`]\/app/)
  assert.doesNotMatch(landing, /\/hero\/apply/)
  assert.doesNotMatch(landing, /get help now/i)
  assert.match(landing, /Pre-launch: not accepting service requests/)
  assert.match(landing, /S\.O\.S\. is not 911/)
})

test('landing claims stay truthful: live taxonomy, previews labeled, no fabricated supply', () => {
  assert.match(landing, /loadSOSCatalog/)
  assert.doesNotMatch(landing, /40\+/)
  assert.match(landing, /Product preview/)
  assert.match(landing, /Preview \/ illustrative/)
  assert.match(landing, /No providers are active on S\.O\.S\. yet/)
  assert.match(landing, /not active dispatch areas/)
  for (const banned of [/24\/7/, /guaranteed (income|earnings|work)/i, /\$\d/, /\d+\s*min(ute)?s? (ETA|away)/i, /South Atlanta/]) {
    assert.doesNotMatch(landing, banned)
  }
})

test('early registration asks for no credentials, documents, banking or passwords', () => {
  for (const banned of [/type="password"/, /type="file"/, /license_number|licenseNumber/, /\bssn\b|social security/i, /\bEIN\b/, /insurance_document|routing|bank account/i]) {
    assert.doesNotMatch(flow, banned)
  }
  assert.match(flow, /submitProviderInterest/)
  assert.match(flow, /idempotency_key/)
  assert.match(flow, /not an application, an approval or a guarantee of work/)
  assert.match(flow, /email_opt_in/)
  assert.match(flow, /sms_opt_in/)
})

test('operational routes are wrapped by the server-checked pre-launch gate', () => {
  for (const route of ['src/app/app/page.jsx', 'src/app/hero/page.jsx', 'src/app/ops/page.jsx', 'src/app/ops/heroes/page.jsx',
    'src/app/track/page.jsx', 'src/app/request-roadside-help/page.jsx', 'src/app/login/page.jsx', 'src/app/download/page.tsx', 'src/app/ops/recruitment/page.jsx']) {
    assert.match(read(route), /<SOSPrelaunchGate area=/, `${route} must be gated`)
  }
  assert.match(read('src/app/hero/apply/page.jsx'), /SOSInviteOnlyNotice/)
})

test('gate grants access only from the server-resolved JWT subject', () => {
  assert.match(gate, /sos_prelaunch_access_status/)
  assert.match(gate, /fail closed/i)
  assert.doesNotMatch(gate, /user_metadata/)
  assert.doesNotMatch(gate, /searchParams|URLSearchParams/)
})

test('database gate blocks every marketplace mutation path with 42501', () => {
  for (const table of ['sos_missions', 'sos_payments', 'sos_subscriptions', 'sos_mission_offers', 'sos_heroes', 'sos_hero_shift_sessions', 'sos_hero_applications']) {
    assert.match(gateSql, new RegExp(`create trigger sos_prelaunch_guard before insert[^;]*on public\\.${table}`), `${table} guard`)
  }
  assert.match(gateSql, /errcode = '42501'/)
  assert.match(gateSql, /private\.is_marketplace_operator/)
  assert.match(gateSql, /private\.sos_prelaunch_access/)
  assert.doesNotMatch(gateSql, /user_metadata|raw_user_meta_data/)
})

test('new S.O.S. SQL never references ON CALL tables', () => {
  for (const sql of [gateSql, intakeSql, opsSql]) assert.doesNotMatch(sql, /\boc_[a-z]/)
})

test('intake is service-role only, idempotent, deduplicating and never activates providers', () => {
  assert.match(intakeSql, /auth\.jwt\(\)->>'role','\) <> 'service_role'|auth\.jwt\(\)->>'role',''\) <> 'service_role'/)
  assert.match(intakeSql, /idempotency_key uuid not null unique/)
  assert.match(intakeSql, /'replayed', true/)
  assert.match(intakeSql, /c\.is_demo = v_is_test/)
  assert.match(intakeSql, /'prospect', 'not_queued'/)
  assert.doesNotMatch(intakeSql, /insert into public\.sos_heroes/)
  assert.doesNotMatch(intakeSql, /insert into public\.sos_hero_applications/)
  assert.match(intakeSql, /coverage_status, confidence, source_system[\s\S]*'source_claimed', 0\.25/)
  assert.match(intakeSql, /on conflict \(candidate_id, zone_id\) do nothing/)
  assert.match(intakeSql, /append-only/)
  for (const table of ['sos_provider_early_interest', 'sos_provider_interest_receipts', 'sos_candidate_service_interests', 'sos_provider_early_interest_events']) {
    assert.match(intakeSql, new RegExp(`alter table public\\.${table} enable row level security`))
  }
  assert.match(intakeSql, /revoke all on public\.sos_service_label_map[\s\S]*from public, anon, authenticated/)
})

test('recruitment command is operator-only and separates truth buckets', () => {
  const fns = opsSql.match(/create or replace function public\.\w+/g) || []
  assert.ok(fns.length >= 4)
  const bodies = opsSql.split(/create or replace function /).slice(1)
  for (const body of bodies) assert.match(body, /if not private\.is_marketplace_operator\(auth\.uid\(\)\) then/)
  assert.match(opsSql, /h\.is_demo = false and h\.verification_status = 'verified'/)
  assert.match(opsSql, /c\.is_demo = false and coalesce\(e\.is_test, false\) = false/)
  assert.match(opsSql, /No message was sent/)
})

test('intake edge function has bot protection and makes no outbound sends', () => {
  assert.match(edge, /MAX_BODY_BYTES = 16384/)
  assert.match(edge, /MIN_FILL_MS/)
  assert.match(edge, /body\.website/)
  assert.match(edge, /sos_register_provider_interest/)
  assert.doesNotMatch(edge, /\bfetch\(/)
  assert.doesNotMatch(edge, /twilio|sendgrid|resend|gmail|leadconnector|smtp/i)
  assert.match(read('supabase/config.toml'), /\[functions\.sos-provider-early-interest\]\s*verify_jwt = false/)
})

test('new pre-launch code adds no key literals; it reuses the existing client', () => {
  const lib = read('src/lib/sosPrelaunch.js')
  assert.match(lib, /from '\.\/sosSupabaseClient'/)
  for (const f of ['src/lib/sosPrelaunch.js', ...walk('src/components/prelaunch')]) {
    assert.doesNotMatch(read(f), /sb_publishable_|eyJhbGci/, f)
  }
})

test('brand spelling is SUPERHEROS everywhere in product source', () => {
  const offenders = walk('src').filter((f) => /\.(jsx?|tsx?|css)$/.test(f)).filter((f) => {
    const src = read(f).replace(/fictional superheroes/gi, '')
    if (f.endsWith(path.join('app', 'brand', 'page.jsx'))) return false // documents the forbidden spelling on purpose
    return /SUPERHEROES|Superheroes On Standby/i.test(src)
  })
  assert.deepEqual(offenders, [])
})
