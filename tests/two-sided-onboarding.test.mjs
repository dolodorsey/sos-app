import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const m1 = read('supabase/migrations/20261109060000_sos_hero_standby_onboarding.sql');
const m2 = read('supabase/migrations/20261109060100_sos_ops_marketplace_and_nearest_dispatch.sql');
const edge = read('supabase/functions/submit-sos-hero-application/index.ts');
const apply = read('src/app/hero/apply/page.jsx');
const ops = read('src/app/ops/marketplace/page.jsx');

test('phase 1: simple signup + secured login = active standby Hero, never dispatchable', () => {
  assert.match(edge, /status:'standby_pending'/);
  assert.match(edge, /if\(!ZONES\.has\(zone\)\)/);
  assert.match(m1, /if a\.status in \('standby_pending','standby'\) then\s+v_activation := private\.sos_activate_standby_hero\(a\.id\);/);
  assert.match(m1, /'pending', false, false, null\)/, 'standby heroes are created pending + off duty');
  assert.match(m1, /'dispatch_eligible',false/);
  assert.doesNotMatch(apply, /requiredDocs\.map\(\(\[type,label,hint\]\)=><label[^]*STEP 2 · ACTIVATE/, 'no documents before standby');
  assert.match(apply, /No documents today/);
});

test('phase 2: full packet goes out automatically N days before customer go-live', () => {
  assert.match(m1, /current_date >= m\.target_launch_date - m\.packet_lead_days/);
  assert.match(m1, /packet_lead_days integer not null default 14/);
  assert.match(m1, /cron\.schedule\('sos-hero-onboarding-packets', '0 13 \* \* \*'/);
  for (const doc of ['drivers_license', 'insurance', 'vehicle_registration', 'headshot']) assert.match(m1, new RegExp(`\\('${doc}',`));
  for (const consent of ['background_check_disclosure', 'background_check_authorization', 'independent_contractor_agreement']) assert.match(m1, new RegExp(consent));
});

test('signed consents are a permanent legal record and drafts never go out', () => {
  assert.match(m1, /before update or delete on public\.sos_hero_consents/);
  assert.match(m1, /approved_for_use boolean not null default false/);
  assert.match(m1, /blocked_legal_documents_not_approved/);
  assert.match(m2, /Remove the DRAFT marker once the attorney-approved text is in/);
  assert.match(m1, /Sign with your full legal name as it appears on your application/);
});

test('approval requires the packet and a clear background check', () => {
  assert.match(m2, /Record a clear background check before approval/);
  assert.match(m2, /The onboarding packet is not complete yet/);
  assert.match(m2, /document_type in \('drivers_license','insurance'\)/);
});

test('Uber-style dispatch: nearest qualified Heroes get the offer first', () => {
  assert.match(m2, /'order by 5 asc,9 desc'/);
  assert.match(m2, /'order by ranked\.distance_miles asc,ranked\.match_score desc'/);
  assert.match(m1, /private\.sos_service_ids/, 'service names map to dispatch ids');
});

test('management console covers both sides', () => {
  for (const rpc of ['sos_ops_launch_overview', 'sos_ops_marketplace_live', 'sos_ops_set_market_go_live', 'sos_ops_send_onboarding_packets', 'sos_ops_review_onboarding_packet', 'sos_ops_publish_consent_document']) {
    assert.match(ops, new RegExp(`'${rpc}'`));
    assert.match(m1 + m2, new RegExp(`function public\\.${rpc}\\(`));
  }
  assert.match(ops, /marketplace_operator_check/);
});
