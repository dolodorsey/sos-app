import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Regression guard for the in-app Privacy / Terms / Not 911 / Support sheet.
// Field report (iPhone, Nov 2026): tapping Privacy on the home screen opened a
// sheet that was half off-screen with no reachable close button, and the tap
// also submitted the sign-in form.
const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const host = read('src/components/SOSUIUpgradeHost.jsx');
const v3 = read('src/components/sos-ui-v3.css');
const frame = read('src/components/sos-app-frame.css');

const rule = (css, selector) => {
  const at = css.indexOf(`${selector}{`) >= 0 ? css.indexOf(`${selector}{`) : css.indexOf(`${selector} {`);
  assert.ok(at >= 0, `missing rule ${selector}`);
  return css.slice(at, css.indexOf('}', at));
};

test('legal sheet is not centred with a transform that the app frame breaks', () => {
  const base = rule(v3, '.sos3-legal');
  assert.doesNotMatch(base, /translateX\(-50%\)/);
  assert.match(base, /transform:none/);
  assert.match(base, /bottom:0/);
  const override = rule(frame, 'body:has(.sos-app-frame) .sos3-legal');
  assert.match(override, /transform:\s*none\s*!important/);
  assert.match(override, /left:\s*0\s*!important/);
});

test('legal sheet sits above floating CTAs and respects the iPhone safe area', () => {
  const z = Number(rule(v3, '.sos3-legal').match(/z-index:(\d+)/)[1]);
  assert.ok(z > 5200, `z-index ${z} must clear floating buttons (max 5200)`);
  assert.match(rule(v3, '.sos3-legal>header'), /env\(safe-area-inset-top\)/);
  assert.match(v3, /html\.sos-legal-open \[aria-label="Get the S\.O\.S\. app"\]/, 'install pill must hide while the sheet is open');
});

test('legal buttons never submit the surrounding sign-in form', () => {
  assert.equal((host.match(/<button onClick/g) || []).length, 0, 'every <button> needs type="button"');
  assert.match(host, /aria-label="Close and return to S\.O\.S\."/);
});

test('legal sheet renders icons as SVG, closes on Escape, links the full documents', () => {
  assert.match(host, /sos3-legal-icon" aria-hidden="true" dangerouslySetInnerHTML/);
  assert.match(host, /event\.key==='Escape'/);
  for (const href of ['/privacy/', '/terms/', '/legal/']) assert.ok(host.includes(`href:'${href}'`), href);
});

test('automatic install prompt does not open over an open legal sheet', () => {
  const prompt = read('src/components/SOSInstallAppPrompt.jsx');
  assert.match(prompt, /classList\.contains\('sos-legal-open'\)/);
  assert.doesNotMatch(prompt, /setTimeout\(\(\) => setShow\(true\), (1600|4200)\)/);
});
