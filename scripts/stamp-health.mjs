#!/usr/bin/env node
/**
 * Writes public/health.json at build time.
 *
 * SOS is `output: 'export'` — a fully static build that also ships inside the
 * Capacitor iOS/Android app. There is no server at runtime, so a health route
 * that performs live checks cannot exist here (that is why the /api/health
 * route handler failed the build: `force-dynamic` is illegal with `output: export`).
 *
 * What a static site CAN answer honestly is "which build is live right now".
 * That is the check that actually matters: a stale or failed deploy is invisible
 * otherwise, because the CDN keeps serving the previous build with a 200.
 *
 * Liveness of Supabase belongs in an uptime monitor that hits Supabase directly,
 * not in a file served from a CDN.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '..', 'public', 'health.json');

const payload = {
  app: 'sos-app',
  brand: 'S.O.S.',
  service: 'real-time-roadside-assistance',
  status: 'ok',
  schema_version: 2,
  commit: process.env.VERCEL_GIT_COMMIT_SHA ?? 'local',
  branch: process.env.VERCEL_GIT_COMMIT_REF ?? 'local',
  environment: process.env.VERCEL_ENV ?? 'development',
  built_at: new Date().toISOString(),
};

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(payload, null, 2) + '\n');
console.log(`health.json stamped: ${payload.commit.slice(0, 7)} @ ${payload.built_at}`);
