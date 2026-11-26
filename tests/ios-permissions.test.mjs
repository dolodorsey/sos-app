import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

const plist = readFileSync(new URL('../ios/App/App/Info.plist', import.meta.url), 'utf8');
const apply = readFileSync(new URL('../src/app/hero/apply/page.jsx', import.meta.url), 'utf8');

test('iOS app explains camera and photo access the Hero application uses', () => {
  // The Hero application has a camera selfie and photo uploads. Without these strings
  // iOS ends the app when the camera opens, and App Review rejects the build.
  assert.match(apply, /capture=/);
  assert.match(plist, /<key>NSCameraUsageDescription<\/key>\s*<string>[^<]{20,}<\/string>/);
  assert.match(plist, /<key>NSPhotoLibraryUsageDescription<\/key>\s*<string>[^<]{20,}<\/string>/);
  assert.match(plist, /<key>NSLocationWhenInUseUsageDescription<\/key>/);
});

test('small icons and public logo files carry the approved brand art', () => {
  // favicon.ico/png are regenerated from the approved crest; the public SVG logo
  // files once carried the conventional-plural artwork and must stay replaced.
  for (const f of ['favicon.ico', 'favicon.png', 'sos-logo-512.svg', 'sos-logo-192.svg', 'sos-icon-512.svg', 'sos-icon-192.svg']) {
    const st = statSync(new URL(`../public/${f}`, import.meta.url));
    if (st.size < 500) throw new Error(`${f} looks empty`);
  }
  for (const f of ['sos-logo-512.svg', 'sos-logo-192.svg', 'sos-icon-512.svg', 'sos-icon-192.svg']) {
    const svg = readFileSync(new URL(`../public/${f}`, import.meta.url), 'utf8');
    if (!svg.includes('data:image/png;base64,')) throw new Error(`${f} is not the wrapped approved artwork`);
  }
});
