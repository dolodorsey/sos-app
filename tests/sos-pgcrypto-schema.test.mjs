import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('S.O.S. receipt hashing and share-token crypto resolve from the pgcrypto extension schema', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260918015600_sos_pgcrypto_schema_qualification.sql', import.meta.url), 'utf8');
  assert.match(sql,/sos_hero_bind_application/);
  assert.match(sql,/extensions\.digest\(coalesce\(p_tracking_token/);
  assert.match(sql,/sos_create_mission_share/);
  assert.match(sql,/extensions\.gen_random_bytes\(24\)/);
  assert.match(sql,/extensions\.digest\(v_token/);
  assert.doesNotMatch(sql,/[^.]\bdigest\(coalesce\(p_tracking_token/);
});

test('Hero bind remains same-email and same-receipt gated', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260918015600_sos_pgcrypto_schema_qualification.sql', import.meta.url), 'utf8');
  assert.match(sql,/status_token_hash is distinct from token_hash/);
  assert.match(sql,/Sign in with the same email used on the application/);
  assert.match(sql,/already bound to another account/);
});
