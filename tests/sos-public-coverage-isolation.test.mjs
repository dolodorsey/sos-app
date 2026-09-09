import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const coverageFunction = readFileSync(new URL('../supabase/functions/sos-public-coverage/index.ts', import.meta.url), 'utf8');
const coverageHost = readFileSync(new URL('../src/components/SOSCustomerCoverageStatusHost.jsx', import.meta.url), 'utf8');
const truthHost = readFileSync(new URL('../src/components/SOSCustomerTruthHost.jsx', import.meta.url), 'utf8');
const config = readFileSync(new URL('../supabase/config.toml', import.meta.url), 'utf8');

const exactCoverageUrl = /cxdqkjvtpilvouwtbgdy\.supabase\.co\/functions\/v1\/sos-public-coverage/;

test('S.O.S. customer coverage reads only the dedicated S.O.S. public coverage endpoint', () => {
  assert.match(coverageHost, exactCoverageUrl);
  assert.match(truthHost, exactCoverageUrl);
  assert.doesNotMatch(coverageHost, /marketplace-public-coverage|oncallallday|khgoncall|\boc_/i);
  assert.doesNotMatch(truthHost, /marketplace-public-coverage|oncallallday|khgoncall|\boc_/i);
});

test('S.O.S. public coverage function cannot query or expose sibling marketplace coverage', () => {
  assert.match(coverageFunction, /admin\.rpc\("sos_public_service_coverage"\)/);
  assert.match(coverageFunction, /app:\s*"sos"/);
  assert.match(coverageFunction, /scope:\s*"sos_only"/);
  assert.match(coverageFunction, /thesuperherosonstandby\.com/);
  assert.doesNotMatch(coverageFunction, /oc_public_service_coverage|on_call|oncallallday|khgoncall|\boc_/i);
});

test('S.O.S. public coverage auth contract is source controlled as public read-only infrastructure', () => {
  assert.match(config, /\[functions\.sos-public-coverage\]\s*\nverify_jwt\s*=\s*false/);
  assert.match(coverageFunction, /req\.method !== "GET"/);
  assert.doesNotMatch(coverageFunction, /\.insert\(|\.update\(|\.delete\(|\.upsert\(/);
});
