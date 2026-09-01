import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const migrationsDir = path.resolve('supabase/migrations');
const hardeningFiles = fs.readdirSync(migrationsDir)
  .filter((name) => name.endsWith('_sos_revoke_client_crm_grants.sql'));

assert.equal(hardeningFiles.length, 1, 'expected exactly one S.O.S. CRM privilege-hardening migration');

const sql = fs.readFileSync(path.join(migrationsDir, hardeningFiles[0]), 'utf8').toLowerCase();

const onboardingSql = fs.readFileSync(
  path.join(migrationsDir, '20260901064100_sos_crm_onboarding_bridge.sql'),
  'utf8',
).toLowerCase();

test('S.O.S. CRM control-plane tables revoke all browser-role privileges', () => {
  assert.match(
    sql,
    /revoke\s+all\s+privileges\s+on\s+table\s+public\.sos_crm_links\s+from\s+anon\s*,\s*authenticated\s*;/,
  );
  assert.match(
    sql,
    /revoke\s+all\s+privileges\s+on\s+table\s+public\.sos_crm_outbox\s+from\s+anon\s*,\s*authenticated\s*;/,
  );
  assert.doesNotMatch(sql, /grant\s+.+\s+to\s+(anon|authenticated)/);
});

test('S.O.S. CRM hardening remains brand-isolated and non-destructive', () => {
  assert.doesNotMatch(sql, /\boc_/);
  assert.doesNotMatch(sql, /\b(drop\s+table|truncate\s+table|delete\s+from|insert\s+into|update\s+public\.)/);
  assert.match(sql, /alter\s+table\s+public\.sos_crm_links\s+enable\s+row\s+level\s+security/);
  assert.match(sql, /alter\s+table\s+public\.sos_crm_outbox\s+enable\s+row\s+level\s+security/);
});

test('S.O.S. CRM writes stay behind the protected signup trigger path', () => {
  assert.match(onboardingSql, /security\s+definer/);
  assert.match(onboardingSql, /revoke\s+all\s+on\s+function\s+public\.sos_queue_crm_on_signup\(\)\s+from\s+public\s*,\s*anon\s*,\s*authenticated/);
  assert.match(onboardingSql, /create\s+trigger\s+sos_crm_on_auth_user_created/);
});
