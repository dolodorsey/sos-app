import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const gate = readFileSync(new URL('../src/components/SOSBackendAvailabilityGate.jsx', import.meta.url), 'utf8');
const page = readFileSync(new URL('../src/app/app/page.jsx', import.meta.url), 'utf8');

test('S.O.S. customer app fails closed against its dedicated backend health', () => {
  assert.match(gate, /cxdqkjvtpilvouwtbgdy\.supabase\.co\/functions\/v1\/sos-health/);
  assert.match(gate, /software_status === 'ok'/);
  assert.match(gate, /software_ready === true/);
  assert.match(gate, /HEALTH_TIMEOUT_MS = 5000/);
  assert.match(gate, /SERVICE REQUESTS TEMPORARILY PAUSED/);
  assert.match(gate, /will not collect a request, promise matching, or imply that a Hero is being dispatched/i);
  assert.doesNotMatch(gate, /dzlmtvodpyhetvektfuo|\boc_|ON CALL/i);
});

test('customer operations are mounted behind the S.O.S. backend availability gate', () => {
  const open = page.indexOf('<SOSBackendAvailabilityGate>');
  const customerShell = page.indexOf('<SOSCustomerRealtimeShell/>');
  const close = page.indexOf('</SOSBackendAvailabilityGate>');

  assert.ok(open >= 0, 'availability gate must be mounted');
  assert.ok(customerShell > open, 'customer runtime must be inside the availability gate');
  assert.ok(close > customerShell, 'availability gate must close after customer runtime');
});
