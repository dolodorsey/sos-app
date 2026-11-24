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
  assert.match(c, /setTimeout\(close, MAX_MS\)/, 'hard cap so the form is never blocked');
  assert.match(c, /catch\(\(\) => close\(\)\)/, 'closes if autoplay is refused');
  assert.match(c, /sessionStorage/, 'once per visit');
  assert.match(c, /prefers-reduced-motion/);
  assert.match(c, />\s*Skip\s*</);
  assert.ok(fs.statSync(root + 'public/brand/intro/sos-hero-intro.mp4').size < 3_000_000, 'intro video stays phone-friendly');
});
