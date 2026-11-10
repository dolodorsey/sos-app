import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  LAUNCH_SERVICES, SHIELD_ENABLED, isLaunchService, launchServiceId, inLaunchMarket,
} from '../src/lib/sosLaunch.js';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Atlanta launch offers exactly tow, gas, jump, flat tire and lockout', () => {
  assert.deepEqual(LAUNCH_SERVICES.map(service => service.id), ['tow', 'fuel', 'jump', 'flat', 'lockout']);
  for (const name of ['Towing', 'Fuel Delivery', 'Jump Start', 'Flat Tire Help', 'Lockout']) assert.ok(isLaunchService(name), name);
  for (const name of ['Battery Replace', 'Winch Out & Recovery', 'Oil Change', 'Full Detail', 'VIP Roadside Priority']) assert.equal(isLaunchService(name), false, name);
  assert.equal(isLaunchService({ id: 'battery', name: 'Battery Replace', is_bookable: false }), false);
  assert.equal(isLaunchService({ id: 'tow', name: 'Towing', is_bookable: true }), true);
});

test('launch prices stay at the approved pay-per-service rates', () => {
  assert.deepEqual(Object.fromEntries(LAUNCH_SERVICES.map(s => [s.id, s.price])), { tow: 75, fuel: 55, jump: 45, flat: 55, lockout: 50 });
  assert.equal(launchServiceId('Flat Tire'), 'flat');
  assert.equal(launchServiceId('Fuel Delivery'), 'fuel');
});

test('Shield memberships are off for v1', () => {
  assert.equal(SHIELD_ENABLED, false);
  assert.match(read('src/components/SOSMembershipHost.jsx'), /SHIELD_ENABLED&&open/);
  assert.match(read('src/components/SOSCustomerMobilityApp.jsx'), /SHIELD_ENABLED\?<section className="sos2-membership"/);
});

test('dispatch is limited to metro Atlanta', () => {
  assert.ok(inLaunchMarket(33.749, -84.388), 'Downtown Atlanta');
  assert.ok(inLaunchMarket(34.075, -84.294), 'Alpharetta');
  assert.ok(inLaunchMarket(33.774, -84.296), 'Decatur');
  assert.equal(inLaunchMarket(32.836, -83.632), false, 'Macon');
  assert.equal(inLaunchMarket(33.474, -82.010), false, 'Augusta');
  assert.equal(inLaunchMarket(NaN, -84.3), false);
});

test('unavailable services stay visible but cannot be requested', () => {
  const app = read('src/components/SOSCustomerMobilityApp.jsx');
  assert.match(app, /sos2-unavailable/);
  assert.match(app, /if\(!isLaunchService\(selected\)\)\{setRequestError/);
  assert.match(app, /inLaunchMarket\(current\.lat,current\.lng\)/);
  const legacy = read('src/components/SOSApp.jsx');
  assert.match(legacy, /if\(!isLaunchService\(svc\.name\)\)/);
  assert.match(legacy, /requestCustomerMission\(/);
});

test('database migration enforces the same launch scope', () => {
  const sql = read('supabase/migrations/20261103080000_sos_atlanta_core_launch_scope.sql');
  assert.match(sql, /id in \('tow','fuel','jump','flat','lockout'\)/);
  assert.match(sql, /before insert on public\.sos_missions/);
  assert.match(sql, /sos_market_for_point/);
});
