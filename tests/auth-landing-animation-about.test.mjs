import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../src/components/SOSCustomerMobilityApp.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/components/sos-launch.css', import.meta.url), 'utf8');
const auth = app.slice(app.indexOf('if(!session)return'), app.indexOf('</div>;', app.indexOf('if(!session)return')));

test('sign in / sign up landing shows the S.O.S. animation instead of the still image', () => {
  assert.match(app, /AUTH_MOTION='https:\/\/woqlhjodiedyqfvzweoe\.supabase\.co\/storage\/v1\/object\/public\/animations\/sos-ani2\.mp4'/);
  assert.match(auth, /<video className="sos2-auth-motion" src=\{AUTH_MOTION\} autoPlay muted loop playsInline/);
  assert.doesNotMatch(auth, /sos2-road-lines|sos2-signal/);
  assert.match(css, /prefers-reduced-motion: reduce\) \{ \.sos2-auth-motion \{ display: none; \} \}/);
});

test('about-the-app section sits below the sign in / sign up form', () => {
  assert.ok(auth.indexOf('</form>') < auth.indexOf('sos2-auth-about'), 'about section comes after the form');
  assert.match(auth, /ABOUT S\.O\.S\./);
  assert.match(auth, /Superheros On Standby/);
  assert.match(auth, /closest available Heroes/);
  assert.match(auth, /LAUNCH_SERVICES\.map/);
  assert.match(auth, /href="\/hero\/apply"/);
  assert.doesNotMatch(auth, /stars|review/i, 'no testimonials or ratings on the landing screen');
});

test('Services tab leads with the five main services above the categories', () => {
  const services = app.slice(app.indexOf("tab==='services'&&"), app.indexOf("tab==='missions'&&"));
  assert.match(services, /sos2-main-services/);
  assert.match(services, /MAIN SERVICES · LIVE IN/);
  assert.ok(services.indexOf('sos2-main-services') < services.indexOf('sos2-services-categories'));
  assert.match(services, /quick\.map\(service=>/);
});
