import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Hero status receipts give an actionable next step for every active stage', async () => {
  const edge = await readFile(new URL('../supabase/functions/submit-sos-hero-application/index.ts', import.meta.url), 'utf8');
  assert.match(edge,/documents_required/);
  assert.match(edge,/upload Government ID, driver license, and current insurance/i);
  assert.match(edge,/required credentials are received/i);
  assert.match(edge,/Operations is reviewing your application/i);
  assert.match(edge,/provide the information requested/i);
  assert.match(edge,/continue Hero activation/i);
  assert.doesNotMatch(edge,/No action is required while S\.O\.S\. operations reviews your application/);
});
