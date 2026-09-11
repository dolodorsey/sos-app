'use client';

import React, { useCallback, useEffect, useState } from 'react';

const SOS_HEALTH_URL = 'https://cxdqkjvtpilvouwtbgdy.supabase.co/functions/v1/sos-health';
const HEALTH_TIMEOUT_MS = 5000;
const RECHECK_INTERVAL_MS = 60000;

async function readBackendHealth() {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

  try {
    const response = await fetch(`${SOS_HEALTH_URL}?surface=customer-app&ts=${Date.now()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!response.ok) return false;

    const payload = await response.json().catch(() => null);
    return payload?.software_status === 'ok' && payload?.software_ready === true;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

const shellStyle = {
  minHeight: '100dvh',
  display: 'grid',
  placeItems: 'center',
  padding: '32px 20px',
  background: 'radial-gradient(circle at top, #1f2a38 0, #0c1118 42%, #05070a 100%)',
  color: '#fff',
};

const panelStyle = {
  width: 'min(620px, 100%)',
  border: '1px solid rgba(255, 139, 72, 0.28)',
  borderRadius: 28,
  padding: 'clamp(24px, 5vw, 42px)',
  background: 'rgba(8, 12, 18, 0.92)',
  boxShadow: '0 28px 90px rgba(0,0,0,.42)',
};

export default function SOSBackendAvailabilityGate({ children }) {
  const [status, setStatus] = useState('checking');

  const check = useCallback(async () => {
    setStatus('checking');
    const ready = await readBackendHealth();
    setStatus(ready ? 'ready' : 'offline');
  }, []);

  useEffect(() => {
    void check();
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void check();
    }, RECHECK_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [check]);

  if (status === 'ready') return children;

  if (status === 'checking') {
    return (
      <main style={shellStyle} aria-live="polite">
        <section style={panelStyle}>
          <div style={{ fontWeight: 950, letterSpacing: '.18em', color: '#ff8b48', fontSize: 12 }}>S.O.S. SERVICE CHECK</div>
          <h1 style={{ margin: '14px 0 10px', fontSize: 'clamp(30px, 7vw, 52px)', lineHeight: .94 }}>Verifying dispatch availability.</h1>
          <p style={{ margin: 0, color: '#b9c2cf', lineHeight: 1.6 }}>A roadside request will only open after the dedicated S.O.S. backend confirms it is ready.</p>
        </section>
      </main>
    );
  }

  return (
    <main style={shellStyle} aria-live="assertive">
      <section style={panelStyle}>
        <div style={{ fontWeight: 950, letterSpacing: '.18em', color: '#ff8b48', fontSize: 12 }}>SERVICE REQUESTS TEMPORARILY PAUSED</div>
        <h1 style={{ margin: '14px 0 14px', fontSize: 'clamp(34px, 8vw, 58px)', lineHeight: .93 }}>S.O.S. is not accepting new roadside requests right now.</h1>
        <p style={{ margin: '0 0 14px', color: '#d7dde6', lineHeight: 1.65 }}>The dedicated S.O.S. dispatch backend has not confirmed a healthy operating state. We will not collect a request, promise matching, or imply that a Hero is being dispatched while that system is unavailable.</p>
        <p style={{ margin: '0 0 24px', color: '#aeb8c6', lineHeight: 1.65 }}>For immediate roadside assistance, use a trusted local roadside provider or your vehicle or insurance roadside plan. S.O.S. is not 911. For a life-threatening emergency, call 911.</p>
        <button
          type="button"
          onClick={() => void check()}
          style={{ border: 0, borderRadius: 999, padding: '14px 20px', fontWeight: 900, cursor: 'pointer', background: '#ff8b48', color: '#0a0d11' }}
        >
          Retry service status
        </button>
      </section>
    </main>
  );
}
