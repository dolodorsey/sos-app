import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('S.O.S. provider PWA contract is installable and truthful', async () => {
  const [manifestRaw, sw, layout, prompt] = await Promise.all([
    readFile(new URL('../public/manifest.json', import.meta.url), 'utf8'),
    readFile(new URL('../public/sw.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/layout.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/SOSInstallAppPrompt.jsx', import.meta.url), 'utf8'),
  ]);

  const manifest = JSON.parse(manifestRaw);
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.scope, '/');
  assert.match(manifest.description, /not 911/i);
  assert.ok(manifest.icons.some(icon => icon.sizes === '192x192'));
  assert.ok(manifest.icons.some(icon => icon.sizes === '512x512'));
  assert.doesNotMatch(manifest.description, /dispatched in minutes/i);

  assert.match(sw, /addEventListener\('fetch'/);
  assert.doesNotMatch(sw, /caches\.put|cache\.add|cache\.match/);
  assert.match(layout, /SOSInstallAppPrompt/);
  assert.match(prompt, /serviceWorker\.register\('\/sw\.js'/);
  assert.match(prompt, /service-provider|SERVICE PROVIDERS/i);
  assert.match(prompt, /not an emergency service/i);
});
