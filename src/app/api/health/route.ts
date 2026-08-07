import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
        cache: 'no-store',
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
