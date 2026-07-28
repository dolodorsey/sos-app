import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Real health endpoint.
 *
 * Previously this path 404'd, so any monitor pointed at it either saw a hard
 * failure or (on the SPA apps) a 200 of index.html — which is why a production
 * outage went unnoticed. This returns actual JSON with actual checks.
 */
export async function GET() {
  const startedAt = Date.now();
  const checks: Record<string, string> = {};

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    checks.database = 'unconfigured';
  } else {
    try {
      const res = await fetch(`${url}/rest/v1/`, {
        headers: { apikey: key },
        signal: AbortSignal.timeout(4000),
      });
      checks.database = res.ok || res.status === 401 ? 'reachable' : `http_${res.status}`;
    } catch {
      checks.database = 'unreachable';
    }
  }

  const healthy = checks.database === 'reachable';

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      app: 'SOS',
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? 'local',
      environment: process.env.VERCEL_ENV ?? 'development',
      checks,
      latency_ms: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 },
  );
}
