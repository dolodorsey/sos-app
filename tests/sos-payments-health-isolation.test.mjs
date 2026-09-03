import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const functionPath = 'supabase/functions/sos-payments-health/index.ts';
const source = fs.readFileSync(functionPath, 'utf8');
const config = fs.readFileSync('supabase/config.toml', 'utf8');

test('S.O.S. payment health checks only the S.O.S. signing-secret contract', () => {
  assert.match(source, /readRuntimeSecret\("STRIPE_SECRET_KEY"\)/);
  assert.match(source, /readRuntimeSecret\("sos_stripe_webhook_secret"\)/);
  assert.doesNotMatch(source, /Deno\.env\.get\(["']STRIPE_WEBHOOK_SECRET["']\)/);
  assert.doesNotMatch(source, /\bon_call\b/i);
  assert.doesNotMatch(source, /\boc_/i);
});

test('S.O.S. payment health performs read-only Stripe connectivity without exposing balance data', () => {
  assert.match(source, /https:\/\/api\.stripe\.com\/v1\/balance/);
  assert.match(source, /method:\s*["']GET["']/);
  assert.doesNotMatch(source, /stripeResponse\.json\(/);
  assert.doesNotMatch(source, /stripeResponse\.text\(/);
  assert.match(source, /scope:\s*["']sos_only["']/);
});

test('S.O.S. payment health is explicitly configured as a public non-secret status endpoint', () => {
  assert.match(config, /\[functions\.sos-payments-health\][\s\S]*?verify_jwt\s*=\s*false/);
  assert.match(source, /"Cache-Control":\s*"no-store, max-age=0"/);
  assert.match(source, /status:\s*ready \? 200 : 503/);
});
