import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url).pathname;

test('Hero sign-up shows the brand intro, and the intro always gets out of the way', () => {
  const page = fs.readFileSync(root + 'src/app/hero/apply/page.jsx', 'utf8');
  assert.match(page, /<SOSHeroIntro\/>/);
  const c = fs.readFileSync(root + 'src/components/SOSHeroIntro.jsx', 'utf8');
  assert.match(c, /onEnded=\{close\}/, 'closes when the video ends');
  assert.match(c, /onError=\{close\}/, 'closes if the video fails');
  assert.match(c, /setTimeout\(close, PLAY_CAP_MS\)/, 'hard cap once playing');
  assert.match(c, /setTimeout\(close, TAP_WAIT_MS\)/, 'an untouched Play screen closes itself');
  assert.match(c, /p\.catch\(\(\) => setMode/, 'autoplay refused shows the Play button instead of disappearing');
  assert.doesNotMatch(c, /p\.catch\(\(\) => close\(\)\)/, 'blocked autoplay must not hide the intro');
  assert.match(c, /REPLAY_AFTER_MS/, 'plays on every arrival, not once per tab');
  assert.match(c, /prefers-reduced-motion[\s\S]*'tap'/, 'Reduce Motion gets the Play button, not nothing');
  assert.match(c, />\s*Skip\s*</);
  assert.ok(fs.statSync(root + 'public/brand/intro/sos-hero-intro.mp4').size < 3_000_000, 'intro video stays phone-friendly');
});

test('homepage plays the services-at-launch intro on the website only', () => {
  const home = fs.readFileSync(new URL('../src/app/page.jsx', import.meta.url), 'utf8')
  const intro = fs.readFileSync(new URL('../src/components/SOSHeroIntro.jsx', import.meta.url), 'utf8')
  assert.match(home, /sos-services-intro\.mp4/)
  assert.match(home, /seenKey="sos_services_intro_seen_at"/, 'own replay timer, separate from the Hero sign-up intro')
  assert.match(home, /webOnly/)
  assert.match(home, /<SOSHome \/>/, 'the public homepage underneath; the packaged app is sent to /app/ by the root layout')
  assert.match(intro, /webOnly && window\.Capacitor\?\.isNativePlatform\?\.\(\)/)
  assert.ok(fs.statSync(new URL('../public/brand/intro/sos-services-intro.mp4', import.meta.url)).size < 4_000_000)
})
