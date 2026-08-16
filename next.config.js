/* Stamp public/health.json at build time.
 *
 * SOS is statically exported for web and Capacitor. The health file identifies
 * the exact deployed build and truthfully states the currently enabled service
 * model. It does not claim that a Hero is assigned before acceptance.
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
        authority: 'Supabase cxdqkjvtpilvouwtbgdy public.sos_*',
        service: 'roadside-dispatch-marketplace',
        fulfillment_mode: 'operator-offer-and-hero-acceptance',
        status: 'manifest-only',
        live_health_endpoint: 'https://cxdqkjvtpilvouwtbgdy.supabase.co/functions/v1/health',
        schema_version: 4,
        note: 'This static file is deployment metadata only. Use live_health_endpoint for runtime health.',
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
  turbopack: {
    root: __dirname,
  },
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
};
module.exports = nextConfig;
