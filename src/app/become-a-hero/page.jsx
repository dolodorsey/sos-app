'use client';

import { useMemo, useState } from 'react';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const PROVIDER_INTAKE_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const SERVICES = [
  'Towing',
  'Flat Tire Help',
  'Jump Start',
  'Fuel Delivery',
  'Vehicle Lockout',
  'Mobile Maintenance',
  'Car Wash / Detailing',
  'Fleet Services',
];

const initialForm = {
  full_name: '',
  email: '',
  phone: '',
  company_name: '',
  service_area: '',
  years_experience: '',
  license_number: '',
  insured: false,
  notes: '',
};

export default function BecomeAHeroPage() {
  const [form, setForm] = useState(initialForm);
  const [serviceTypes, setServiceTypes] = useState([]);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');

  const canSubmit = useMemo(() => {
    return (
      PROVIDER_INTAKE_CONFIGURED &&
      form.full_name.trim().length >= 2 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) &&
      form.phone.replace(/\D/g, '').length >= 10 &&
      form.service_area.trim().length >= 2 &&
      serviceTypes.length > 0 &&
      status !== 'submitting'
    );
  }, [form, serviceTypes, status]);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const toggleService = (service) => {
    setServiceTypes((current) =>
      current.includes(service)
        ? current.filter((item) => item !== service)
        : [...current, service]
    );
  };

  const submit = async (event) => {
    event.preventDefault();

    if (!PROVIDER_INTAKE_CONFIGURED) {
      setStatus('error');
      setMessage('Provider applications are temporarily unavailable while the secure intake connection is being verified.');
      return;
    }

    if (!canSubmit) return;

    setStatus('submitting');
    setMessage('');

    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/sos_provider_applications`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          ...form,
          years_experience: form.years_experience === '' ? null : Number(form.years_experience),
          service_types: serviceTypes,
          status: 'new',
          source: 'sos-app',
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.message || 'Your application could not be submitted.');
      }

      setStatus('success');
      setMessage('Application received. The S.O.S. provider team will review your service area, credentials and coverage.');
      setForm(initialForm);
      setServiceTypes([]);
    } catch (error) {
      setStatus('error');
      setMessage(error.message || 'Your application could not be submitted.');
    }
  };

  return (
    <main className="hero-page">
      <section className="hero-shell">
        <a className="back-link" href="/">← Back to S.O.S.</a>
        <div className="eyebrow">S.O.S. PROVIDER NETWORK</div>
        <h1>Become a Hero</h1>
        <p className="intro">
          Apply to receive nearby roadside and vehicle-service missions. This application does not activate a provider account or guarantee work.
        </p>

        {!PROVIDER_INTAKE_CONFIGURED && (
          <div className="configuration-message" role="status">
            Provider intake is temporarily paused while the secure database connection is verified. The roadside-assistance app remains available.
          </div>
        )}

        {status === 'success' ? (
          <div className="success-card">
            <div className="success-icon">✓</div>
            <h2>Application submitted</h2>
            <p>{message}</p>
            <a className="primary-link" href="/">Open the S.O.S. app</a>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <div className="grid two">
              <label>
                Full name
                <input value={form.full_name} onChange={(e) => update('full_name', e.target.value)} autoComplete="name" required />
              </label>
              <label>
                Company name <span>optional</span>
                <input value={form.company_name} onChange={(e) => update('company_name', e.target.value)} autoComplete="organization" />
              </label>
              <label>
                Email
                <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} autoComplete="email" required />
              </label>
              <label>
                Mobile phone
                <input type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} autoComplete="tel" required />
              </label>
              <label>
                Primary service area
                <input value={form.service_area} onChange={(e) => update('service_area', e.target.value)} placeholder="City, state or counties" required />
              </label>
              <label>
                Years of experience
                <input type="number" min="0" max="80" value={form.years_experience} onChange={(e) => update('years_experience', e.target.value)} />
              </label>
              <label>
                License or certification number <span>optional</span>
                <input value={form.license_number} onChange={(e) => update('license_number', e.target.value)} />
              </label>
              <label className="checkbox insured">
                <input type="checkbox" checked={form.insured} onChange={(e) => update('insured', e.target.checked)} />
                <span>I currently carry business or provider insurance.</span>
              </label>
            </div>

            <fieldset>
              <legend>Services you can provide</legend>
              <div className="service-grid">
                {SERVICES.map((service) => (
                  <label className={`service ${serviceTypes.includes(service) ? 'selected' : ''}`} key={service}>
                    <input type="checkbox" checked={serviceTypes.includes(service)} onChange={() => toggleService(service)} />
                    <span>{service}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label>
              Equipment, credentials or additional notes <span>optional</span>
              <textarea rows="5" maxLength="2000" value={form.notes} onChange={(e) => update('notes', e.target.value)} />
            </label>

            {status === 'error' && <div className="error-message">{message}</div>}

            <button type="submit" disabled={!canSubmit}>
              {status === 'submitting' ? 'Submitting…' : 'Submit provider application'}
            </button>

            <p className="disclaimer">
              S.O.S. is not 911 and does not provide police, fire or emergency medical response. Providers are independently reviewed before activation.
            </p>
          </form>
        )}
      </section>

      <style jsx>{`
        :global(body) { margin: 0; background: #080c14; }
        * { box-sizing: border-box; }
        .hero-page { min-height: 100vh; padding: 40px 20px 80px; background: radial-gradient(circle at top right, rgba(16,185,129,.15), transparent 38%), #080c14; color: white; font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif; }
        .hero-shell { width: min(880px, 100%); margin: 0 auto; }
        .back-link { color: rgba(255,255,255,.72); text-decoration: none; font-size: 14px; }
        .eyebrow { margin-top: 42px; color: #10b981; letter-spacing: .18em; font-size: 12px; font-weight: 800; }
        h1 { margin: 8px 0 12px; font-size: clamp(40px, 8vw, 72px); line-height: .95; letter-spacing: -.05em; }
        .intro { max-width: 690px; margin: 0 0 20px; color: rgba(255,255,255,.72); line-height: 1.65; }
        .configuration-message { margin: 0 0 20px; padding: 14px 16px; border: 1px solid rgba(245,158,11,.35); border-radius: 14px; background: rgba(245,158,11,.10); color: #fcd34d; line-height: 1.5; }
        form, .success-card { padding: clamp(22px, 5vw, 40px); border: 1px solid rgba(255,255,255,.12); border-radius: 24px; background: rgba(13,19,32,.94); box-shadow: 0 24px 80px rgba(0,0,0,.32); }
        .grid.two { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 18px; }
        label, legend { display: block; font-size: 13px; font-weight: 750; color: rgba(255,255,255,.9); }
        label span { color: rgba(255,255,255,.45); font-weight: 500; }
        input, textarea { width: 100%; margin-top: 8px; border: 1px solid rgba(255,255,255,.14); border-radius: 12px; background: #111827; color: white; padding: 13px 14px; font: inherit; outline: none; }
        input:focus, textarea:focus { border-color: #10b981; box-shadow: 0 0 0 3px rgba(16,185,129,.12); }
        fieldset { margin: 28px 0; padding: 0; border: 0; }
        legend { margin-bottom: 12px; }
        .service-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 10px; }
        .service { display: flex; align-items: center; gap: 10px; padding: 14px; border: 1px solid rgba(255,255,255,.12); border-radius: 12px; background: #111827; cursor: pointer; }
        .service.selected { border-color: #10b981; background: rgba(16,185,129,.10); }
        .service input, .checkbox input { width: auto; margin: 0; accent-color: #10b981; }
        .insured { display: flex; align-items: center; gap: 10px; min-height: 70px; padding-top: 24px; }
        button, .primary-link { display: inline-flex; align-items: center; justify-content: center; width: 100%; margin-top: 24px; padding: 16px 20px; border: 0; border-radius: 14px; background: linear-gradient(135deg,#10b981,#059669); color: white; font-size: 16px; font-weight: 850; text-decoration: none; cursor: pointer; }
        button:disabled { opacity: .42; cursor: not-allowed; }
        .error-message { margin-top: 16px; padding: 12px 14px; border: 1px solid rgba(239,68,68,.35); border-radius: 12px; background: rgba(239,68,68,.12); color: #fca5a5; }
        .disclaimer { margin: 18px 0 0; color: rgba(255,255,255,.5); font-size: 11px; line-height: 1.6; text-align: center; }
        .success-card { text-align: center; }
        .success-card h2 { font-size: 28px; }
        .success-card p { color: rgba(255,255,255,.68); line-height: 1.6; }
        .success-icon { display: grid; place-items: center; width: 64px; height: 64px; margin: 0 auto; border-radius: 50%; background: rgba(16,185,129,.14); color: #34d399; font-size: 34px; }
        @media (max-width: 680px) { .grid.two, .service-grid { grid-template-columns: 1fr; } .insured { min-height: auto; padding-top: 4px; } }
      `}</style>
    </main>
  );
}
