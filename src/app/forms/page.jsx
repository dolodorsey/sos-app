'use client';

import { useEffect } from 'react';

export default function FormsRecoveryPage() {
  useEffect(() => {
    const timer = window.setTimeout(() => window.location.replace('/'), 900);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main style={{ minHeight: '100vh', background: '#080c14', color: '#fff', display: 'grid', placeItems: 'center', padding: 24, fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' }}>
      <section style={{ width: 'min(560px, 100%)', padding: 32, border: '1px solid rgba(255,255,255,.12)', borderRadius: 24, background: '#0d1320', textAlign: 'center' }}>
        <div style={{ color: '#FF6B35', fontSize: 12, fontWeight: 800, letterSpacing: '.18em' }}>S.O.S. — SUPERHEROES ON STANDBY</div>
        <h1 style={{ margin: '12px 0', fontSize: 36, letterSpacing: '-.04em' }}>Opening the roadside app</h1>
        <p style={{ margin: '0 0 22px', color: 'rgba(255,255,255,.68)', lineHeight: 1.6 }}>
          S.O.S. is an active roadside-assistance application, not a general forms directory.
        </p>
        <a href="/" style={{ display: 'inline-flex', padding: '14px 22px', borderRadius: 14, background: '#FF6B35', color: '#fff', textDecoration: 'none', fontWeight: 800 }}>
          Open S.O.S. now
        </a>
      </section>
    </main>
  );
}
