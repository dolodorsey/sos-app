'use client';

import { useCallback, useEffect, useState } from 'react';
import { sosPasswordSignIn, sosRefreshSession, sosRpc, sosSignOutLocal, trackPrelaunch } from '@/lib/sosPrelaunch';

// Pre-launch access gate for the preserved operational surfaces (/app, /hero, /ops, …).
//
// This is the UX layer. The enforcement layer is server-side: database triggers
// (private.sos_prelaunch_guard) reject missions, offers, payments, memberships,
// on-duty presence and un-invited full applications for anyone who is not an active
// marketplace operator or an explicitly granted QA tester — regardless of what this
// component renders. Access is resolved by the server from the verified JWT subject
// via public.sos_prelaunch_access_status(); no query param, localStorage flag or
// client-editable profile metadata can grant it. Any error fails closed.

const SESSION_KEYS = { app: 'sos_session', ops: 'sos_ops_session' };

const readSession = (key) => {
  try {
    const s = JSON.parse(localStorage.getItem(key) || 'null');
    return s?.access_token ? s : null;
  } catch { return null; }
};

const toStored = (session) => ({
  access_token: session.access_token, refresh_token: session.refresh_token, expires_at: session.expires_at,
  expires_in: session.expires_in, token_type: session.token_type, user: session.user,
});

async function refresh(session) {
  if (!session?.refresh_token) return null;
  const next = await sosRefreshSession(session.refresh_token);
  return next ? toStored(next) : null;
}

export default function SOSPrelaunchGate({ area = 'app', children }) {
  const storageKey = area === 'ops' ? SESSION_KEYS.ops : SESSION_KEYS.app;
  const [state, setState] = useState({ phase: 'checking' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const evaluate = useCallback(async () => {
    try {
      const publicState = await sosRpc('sos_prelaunch_public_state');
      if (publicState?.prelaunch === false) { setState({ phase: 'open' }); return; }
    } catch { /* fail closed: treat as pre-launch */ }

    let session = readSession(storageKey) || readSession(SESSION_KEYS.app) || readSession(SESSION_KEYS.ops);
    if (!session) { setState({ phase: 'locked' }); return; }
    if (session.expires_at && Date.now() / 1000 > Number(session.expires_at) - 30) {
      session = await refresh(session).catch(() => null);
      if (!session) { setState({ phase: 'locked' }); return; }
      try { localStorage.setItem(storageKey, JSON.stringify(session)); } catch {}
    }
    try {
      const access = await sosRpc('sos_prelaunch_access_status', {}, session.access_token);
      if (access?.allowed === true) {
        try { localStorage.setItem(storageKey, JSON.stringify(session)); } catch {}
        setState({ phase: 'allowed', role: access.access_role });
        return;
      }
      setState({ phase: 'denied', email: session.user?.email || '' });
    } catch (e) {
      setState(e.status === 401 ? { phase: 'locked' } : { phase: 'denied', email: session.user?.email || '' });
    }
  }, [storageKey]);

  useEffect(() => { evaluate(); }, [evaluate]);
  useEffect(() => { if (state.phase === 'locked' || state.phase === 'denied') trackPrelaunch('gate_block', { section: area }); }, [state.phase, area]);

  const signIn = async (event) => {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const data = toStored(await sosPasswordSignIn(email.trim().toLowerCase(), password));
      localStorage.setItem(storageKey, JSON.stringify(data));
      setPassword('');
      await evaluate();
    } catch (e) {
      setError(e.message);
    } finally { setBusy(false); }
  };

  const signOut = () => {
    try { localStorage.removeItem(SESSION_KEYS.app); localStorage.removeItem(SESSION_KEYS.ops); } catch {}
    sosSignOutLocal();
    setState({ phase: 'locked' });
  };

  if (state.phase === 'open' || state.phase === 'allowed') return children;

  return (
    <div className="pl-gate" data-prelaunch-gate={state.phase}>
      <main className="pl-gate-card" aria-live="polite">
        <img src="/brand/prelaunch/sos-shield-360.webp" alt="S.O.S. — Superheros On Standby" width="180" height="94" />
        {state.phase === 'checking' ? (
          <><h1>Checking access</h1><p>One moment.</p></>
        ) : (
          <>
            <h1>S.O.S. isn’t open yet</h1>
            <p>S.O.S. is pre-launch and is not accepting service requests, dispatching providers or taking payments. We’re recruiting verified providers first. In an emergency, call 911.</p>
            <div className="pl-actions">
              <a className="pl-btn pl-btn-primary" href="/become-a-hero/">Join as a provider</a>
              <a className="pl-btn pl-btn-ghost" href="/">See what we’re building</a>
            </div>
            {state.phase === 'denied' && (
              <div className="pl-alert" role="status">
                You’re signed in{state.email ? ` as ${state.email}` : ''}, but this account doesn’t have pre-launch access. <button type="button" className="pl-link-btn" onClick={signOut}>Sign out</button>
              </div>
            )}
            <details className="pl-gate-internal" open={Boolean(error)}>
              <summary>S.O.S. team and approved testers</summary>
              <form onSubmit={signIn} aria-label="Internal sign-in">
                <label className="pl-field" htmlFor="gate-email"><span>Email</span>
                  <input id="gate-email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </label>
                <label className="pl-field" htmlFor="gate-password"><span>Password</span>
                  <input id="gate-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                </label>
                {error && <div className="pl-alert" role="alert">{error}</div>}
                <div className="pl-actions"><button className="pl-btn pl-btn-ghost" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button></div>
              </form>
              <p className="pl-gate-code">Access is granted by S.O.S. operations per account. Signing in does not grant access by itself.</p>
            </details>
          </>
        )}
      </main>
    </div>
  );
}
