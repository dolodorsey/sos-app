/* Stamp public/health.json at build time.
 *
 * Vercel invokes `next build` directly, so npm lifecycle hooks (prebuild) and
 * chained npm scripts never run. next.config.js IS evaluated by `next build`
 * on every deploy path, so the stamp lives here.
 *
 * SOS is `output: 'export'` — the same build ships inside the Capacitor app, so
 * there is no runtime server and a live-checking health route cannot exist
 * (that is why /api/health with force-dynamic broke the build). What a static
 * site can answer honestly is WHICH BUILD IS LIVE — the check that catches a
 * stale or failed deploy hiding behind a CDN 200.
 */
const { writeFileSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');

try {
  const dir = join(__dirname, 'public');
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'health.json'),
    JSON.stringify(
      {
        app: 'sos-app',
        brand: 'S.O.S.',
        service: 'real-time-roadside-assistance',
        status: 'ok',
        schema_version: 2,
        commit: process.env.VERCEL_GIT_COMMIT_SHA || 'local',
        branch: process.env.VERCEL_GIT_COMMIT_REF || 'local',
        environment: process.env.VERCEL_ENV || 'development',
        built_at: new Date().toISOString(),
      },
      null,
      2
    ) + '\n'
  );
} catch (e) {
  console.warn('health.json stamp skipped:', e.message);
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  distDir: 'out',
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
};
module.exports = nextConfig;
