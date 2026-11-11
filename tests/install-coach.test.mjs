import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const coach = readFileSync(new URL('../src/components/SOSInstallCoach.jsx', import.meta.url), 'utf8');
const prompt = readFileSync(new URL('../src/components/SOSInstallAppPrompt.jsx', import.meta.url), 'utf8');

test('install coach has a pointed, step-by-step flow per browser', () => {
  for (const flow of ['ios_safari_26', 'ios_safari_classic', 'ipad_safari', 'ios_chrome', 'ios_other', 'android']) assert.match(coach, new RegExp(`${flow}:`));
  assert.match(coach, /Tap the ••• button/);
  assert.match(coach, /Open as Web App/);
  assert.match(coach, /View More/);
  assert.match(coach, /version >= 26 \? 'ios_safari_26' : 'ios_safari_classic'/);
});

test('card moves and points at each tap target', () => {
  assert.match(coach, /className=\{`sos-coach place-\$\{step\.place\} target-\$\{step\.target\}`\}/);
  assert.match(coach, /transition:top \.45s/);
  for (const target of ['bottom-right', 'bottom-center', 'top-right', 'sheet']) assert.match(coach, new RegExp(`\\.target-${target} \\.arrow`));
  assert.match(coach, /addEventListener\('blur'/);
});

test('install prompt uses native install when available, otherwise the coach', () => {
  assert.match(prompt, /if \(promptEvent\) \{/);
  assert.match(prompt, /setCoach\(flow\)/);
  assert.match(prompt, /<SOSInstallCoach flow=\{coach\}/);
});

test('install guide runs for customers as well as providers, never on internal tools', () => {
  assert.match(prompt, /const audienceFor = path => routeMatch\(path, excludedRoutes\) \? null : routeMatch\(path, providerRoutes\) \? 'provider' : 'customer'/);
  assert.match(prompt, /excludedRoutes = \['\/ops', '\/admin'\]/);
  assert.match(prompt, /ATLANTA ROADSIDE HELP/);
  assert.match(prompt, /if \(!show && !provider && signedIn\(\)\) return null;/);
});

test('no fluff: coverage banner only appears when coverage cannot be checked; no browse-all launcher', () => {
  const cov = readFileSync(new URL('../src/components/SOSCustomerCoverageStatusHost.jsx', import.meta.url), 'utf8');
  const sub = readFileSync(new URL('../src/components/SOSSubcategoryRestoreHost.jsx', import.meta.url), 'utf8');
  assert.match(cov, /if\(!loaded\)return null;/);
  assert.match(cov, /covered===0&&rows\.length===0&&inSlot\(/);
  assert.doesNotMatch(sub, /Browse all \{services\.length\} services/);
});
