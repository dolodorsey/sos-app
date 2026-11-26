import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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
