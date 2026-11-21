'use client';
import './sos-home.css';

import { useEffect, useState } from 'react';
import { OFFICIAL_INSTAGRAM, PRESS_CONTACT } from '@/content/sosHome';

// Public front door for thesuperherosonstandby.com (web only).
// The packaged iOS/Android app never shows this page: the root layout sends
// native shells to /app/ before paint, and the effect below is a backstop.

const SERVICES = [
  { key: 'tow', name: 'Towing', desc: 'A tow to the shop, home or wherever you choose.' },
  { key: 'fuel', name: 'Fuel delivery', desc: 'Enough fuel brought to you to get back on the road.' },
  { key: 'jump', name: 'Jump-start', desc: 'A battery boost where your car sits.' },
  { key: 'tire', name: 'Flat-tire change', desc: 'Your spare put on so you can roll again.' },
  { key: 'lockout', name: 'Lockout', desc: 'Back into your car without damaging it.' },
];

const ZONES = ['Downtown', 'Midtown', 'Buckhead', 'East Atlanta', 'South Atlanta', 'West Atlanta'];

const LAUNCH_CRM = 'https://dzlmtvodpyhetvektfuo.supabase.co/functions/v1/app-launch-crm?brand=sos';
const AUTH_PARAMS = /(access_token|refresh_token|token_hash|type=recovery|type=signup|error_description|[?&]code=)/;

function NotifyForm() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    setBusy(true);
    setMessage('Sending…');
    const body = Object.fromEntries(new FormData(form));
    body.brand_key = 'sos';
    body.program_key = 'customer_marketing';
    body.city = 'Atlanta';
    body.email_consent = form.elements.email_consent.checked;
    const query = new URL(window.location.href).searchParams;
    body.utm_source = query.get('utm_source') || 'homepage';
    body.utm_campaign = query.get('utm_campaign') || 'atl-launch-press-20261121';
    try {
      const response = await fetch(LAUNCH_CRM, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        throw new Error(result.error === 'rate_limited' ? 'Please try again in a few minutes.' : 'That didn’t go through. Please try again.');
      }
      setDone(true);
      setMessage('You’re on the list. We’ll email you the day S.O.S. launches in the App Store.');
      form.reset();
    } catch (error) {
      setMessage(error.message || 'Connection failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="sh-form" onSubmit={submit}>
      <div className="sh-form-row">
        <label>
          <span>Name</span>
          <input name="full_name" autoComplete="name" maxLength={120} required />
        </label>
        <label>
          <span>Email</span>
          <input name="email" type="email" autoComplete="email" maxLength={254} required />
        </label>
        <label className="sh-zip">
          <span>ZIP code</span>
          <input name="postal_code" autoComplete="postal-code" inputMode="numeric" maxLength={10} />
        </label>
      </div>
      <label hidden aria-hidden="true" style={{ display: 'none' }}>
        Website<input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <label className="sh-consent">
        <input type="checkbox" name="email_consent" required />
        <span>Email me when S.O.S. launches. I can unsubscribe at any time. No texts, and nothing from other brands.</span>
      </label>
      <button type="submit" className="sh-btn sh-btn-red" disabled={busy || done}>
        {busy ? 'Sending…' : done ? 'You’re on the list' : 'Get notified at launch'}
      </button>
      <p className="sh-form-status" role="status" aria-live="polite">{message}</p>
    </form>
  );
}

export default function SOSHome() {
  useEffect(() => {
    try {
      const w = window;
      if (w.Capacitor && typeof w.Capacitor.isNativePlatform === 'function' && w.Capacitor.isNativePlatform()) {
        w.location.replace('/app/');
        return;
      }
      // Sign-in, confirmation and recovery links that land on the root belong to the app.
      if (AUTH_PARAMS.test(w.location.hash) || AUTH_PARAMS.test(w.location.search)) {
        w.location.replace('/app/' + w.location.search + w.location.hash);
      }
    } catch (e) {}
  }, []);

  const igHandle = OFFICIAL_INSTAGRAM.replace(/^@/, '');

  return (
    <div className="sos-home">
      <header className="sh-nav">
        <a href="/" className="sh-brand" aria-label="S.O.S. — Superheros On Standby home">
          <img src="/brand/sos-logo.webp" alt="" width="56" height="51" />
          <span>
            <strong>S.O.S.</strong>
            <small>SUPERHEROS ON STANDBY</small>
          </span>
        </a>
        <nav className="sh-links" aria-label="Main">
          <a href="#services">Services</a>
          <a href="#notify">Get notified</a>
          <a href="#press">Press</a>
          <a href="/hero/apply/" className="sh-link-hero">Become a SUPERHERO</a>
        </nav>
      </header>

      <main>
        <section className="sh-hero">
          <div className="sh-hero-copy">
            <p className="sh-kicker">Atlanta roadside help</p>
            <h1>
              <span>SUPERHEROS</span>
              <span className="sh-red">ON STANDBY</span>
            </h1>
            <p className="sh-lede">
              S.O.S. connects Atlanta drivers with local roadside SUPERHEROS for towing, fuel delivery,
              jump-starts, flat-tire changes and lockouts.
            </p>
            <p className="sh-status">
              <span className="sh-dot" aria-hidden="true" />
              Coming soon to the App Store. Get notified at launch.
            </p>
            <div className="sh-ctas">
              <a href="#notify" className="sh-btn sh-btn-red">Get notified at launch</a>
              <a href="/hero/apply/" className="sh-btn sh-btn-ghost">Become a SUPERHERO</a>
            </div>
            <p className="sh-signin">
              Already have an S.O.S. account? <a href="/app/">Sign in on the web</a>
            </p>
          </div>
          <div className="sh-hero-mark" aria-hidden="true">
            <img src="/brand/sos-logo.webp" alt="" width="640" height="582" />
          </div>
        </section>

        <section id="services" className="sh-section">
          <p className="sh-kicker">Launch services</p>
          <h2>Five ways a SUPERHERO gets you moving</h2>
          <ul className="sh-services">
            {SERVICES.map((s, i) => (
              <li key={s.key} className="sh-service">
                <span className="sh-num">{String(i + 1).padStart(2, '0')}</span>
                <h3>{s.name}</h3>
                <p>{s.desc}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="area" className="sh-section sh-area">
          <div>
            <p className="sh-kicker">Service area</p>
            <h2>Launching in Atlanta</h2>
            <p className="sh-body">
              S.O.S. starts in Atlanta, with local SUPERHEROS signing up across the city.
            </p>
          </div>
          <ul className="sh-zones">
            {ZONES.map((z) => <li key={z}>{z}</li>)}
          </ul>
        </section>

        <section id="notify" className="sh-section sh-notify">
          <div>
            <p className="sh-kicker">Launch list</p>
            <h2>Get notified at launch</h2>
            <p className="sh-body">
              The S.O.S. iPhone app is coming soon to the App Store. Leave your email and we’ll tell you the day it goes live.
            </p>
          </div>
          <NotifyForm />
        </section>

        <section id="hero" className="sh-section sh-recruit">
          <div>
            <p className="sh-kicker">Earn with S.O.S.</p>
            <h2>Become a SUPERHERO</h2>
            <p className="sh-body">
              Tow operators, locksmiths and drivers who can handle fuel, jump-starts or a tire change: apply to help
              Atlanta drivers on your own schedule. Applying isn’t approval: every SUPERHERO verifies their ID before taking a job.
            </p>
          </div>
          <a href="/hero/apply/" className="sh-btn sh-btn-red">Become a SUPERHERO</a>
        </section>

        <section id="press" className="sh-section sh-press">
          <div>
            <p className="sh-kicker">Press</p>
            <h2>Covering S.O.S.?</h2>
            <p className="sh-body">
              The spelling SUPERHEROS is intentional. Please keep it in your coverage. Facts, naming guidance and
              logos are in the <a href="/press/">newsroom</a> and <a href="/media-kit/">media kit</a>.
            </p>
          </div>
          <div className="sh-press-card">
            <h3>Media contact</h3>
            {PRESS_CONTACT ? (
              <ul>
                {PRESS_CONTACT.name && <li><strong>{PRESS_CONTACT.name}</strong>{PRESS_CONTACT.title ? `, ${PRESS_CONTACT.title}` : ''}</li>}
                {PRESS_CONTACT.email && <li><a href={`mailto:${PRESS_CONTACT.email}`}>{PRESS_CONTACT.email}</a></li>}
                {PRESS_CONTACT.phone && <li><a href={`tel:${PRESS_CONTACT.phone.replace(/[^0-9+]/g, '')}`}>{PRESS_CONTACT.phone}</a></li>}
              </ul>
            ) : (
              <p>Media requests: see the <a href="/press/">newsroom</a>.</p>
            )}
            <p className="sh-ig">
              Instagram: <a href={`https://www.instagram.com/${igHandle}/`} rel="noopener">{OFFICIAL_INSTAGRAM}</a>
            </p>
          </div>
        </section>
      </main>

      <footer className="sh-footer">
        <p><strong>S.O.S. is not an emergency service.</strong> If you’re in danger or there’s been a crash, call 911.</p>
        <nav aria-label="Legal and support">
          <a href="/privacy/">Privacy</a>
          <a href="/terms/">Terms</a>
          <a href="/support/">Support</a>
          <a href="/press/">Press</a>
          <a href="/superheros/">What is a SUPERHERO?</a>
        </nav>
        <p className="sh-legal">© 2026 S.O.S. — Superheros On Standby · Atlanta, GA</p>
      </footer>
    </div>
  );
}
