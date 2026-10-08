'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AVAILABILITY, EMAIL_OPT_IN_TEXT, PROVIDER_TYPES, SMS_OPT_IN_TEXT, SOS_PRIVACY_VERSION,
  SOS_TERMS_VERSION, loadSOSCatalog, newIdempotencyKey, submitProviderInterest, trackPrelaunch,
} from '@/lib/sosPrelaunch';

const DRAFT_KEY = 'sos_provider_interest_draft_v1';
const RECEIPT_KEY = 'sos_provider_interest_receipt_v1';
const STEP_NAMES = ['Introduction', 'Your information', 'Services and area', 'Receipt'];
const US_STATES = 'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ');

const emptyForm = () => ({
  full_name: '', company_name: '', provider_type: '', email: '', phone: '', city: '', state_code: 'GA', zip_code: '',
  terms_accepted: false, email_opt_in: false, sms_opt_in: false,
  subcategory_ids: [], zone_ids: [], service_radius_miles: '', years_experience: '', equipment_notes: '', availability: [],
});

const digits = (v) => String(v || '').replace(/\D/g, '');
const validPhone = (v) => { const d = digits(v); return d.length === 10 || (d.length === 11 && d[0] === '1'); };
const validEmail = (v) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(String(v || '').trim());

function validateInfo(form) {
  const e = {};
  if (form.full_name.trim().length < 2) e.full_name = 'Enter your full name.';
  if (!form.provider_type) e.provider_type = 'Choose how you work.';
  if (['company', 'fleet'].includes(form.provider_type) && !form.company_name.trim()) e.company_name = 'Enter the business name.';
  const hasEmail = form.email.trim() !== '';
  const hasPhone = form.phone.trim() !== '';
  if (!hasEmail && !hasPhone) e.contact = 'Add an email or a mobile number so S.O.S. can follow up.';
  if (hasEmail && !validEmail(form.email)) e.email = 'Enter a valid email address.';
  if (hasPhone && !validPhone(form.phone)) e.phone = 'Enter a 10-digit US phone number.';
  if (form.city.trim().length < 2) e.city = 'Enter your city.';
  if (!/^[A-Z]{2}$/.test(form.state_code)) e.state_code = 'Choose a state.';
  if (!/^\d{5}$/.test(form.zip_code.trim())) e.zip_code = 'Enter a 5-digit ZIP code.';
  if (!form.terms_accepted) e.terms_accepted = 'Accept the Terms and Privacy Policy to continue.';
  return e;
}

function validateServices(form) {
  const e = {};
  if (form.subcategory_ids.length === 0) e.subcategory_ids = 'Choose at least one service you offer.';
  if (form.zone_ids.length === 0) e.zone_ids = 'Choose at least one Atlanta area you can cover.';
  if (form.service_radius_miles !== '' && !(Number(form.service_radius_miles) >= 1 && Number(form.service_radius_miles) <= 150)) e.service_radius_miles = 'Use 1–150 miles.';
  if (form.years_experience !== '' && !(Number(form.years_experience) >= 0 && Number(form.years_experience) <= 80)) e.years_experience = 'Use 0–80 years.';
  return e;
}

const FIELD_STEP = { full_name: 1, provider_type: 1, company_name: 1, email: 1, phone: 1, contact: 1, city: 1, state_code: 1, zip_code: 1, terms_accepted: 1, email_opt_in: 1, sms_opt_in: 1, consent_version: 1, subcategory_ids: 2, zone_ids: 2, service_radius_miles: 2, years_experience: 2 };

function Field({ id, label, optional, error, hint, children }) {
  return (
    <label className="pl-field" htmlFor={id}>
      <span>{label}{optional && <em> (optional)</em>}</span>
      {children}
      {hint && !error && <small className="pl-field-hint">{hint}</small>}
      {error && <small className="pl-field-error" id={`${id}-error`}>{error}</small>}
    </label>
  );
}

export default function SOSProviderEarlyRegistration() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [idem, setIdem] = useState('');
  const [startedAt, setStartedAt] = useState(0);
  const [errors, setErrors] = useState({});
  const [catalog, setCatalog] = useState(null);
  const [catalogError, setCatalogError] = useState('');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [hydrated, setHydrated] = useState(false);
  const honeypot = useRef(null);
  const headingRef = useRef(null);

  useEffect(() => {
    try {
      const savedReceipt = JSON.parse(sessionStorage.getItem(RECEIPT_KEY) || 'null');
      if (savedReceipt?.receipt_number) { setReceipt(savedReceipt); setStep(3); }
      const draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null');
      if (draft && !savedReceipt) {
        setForm({ ...emptyForm(), ...draft.form });
        setIdem(draft.idem || '');
        setStartedAt(draft.startedAt || 0);
        setStep(Math.min(Math.max(Number(draft.step) || 0, 0), 2));
      }
    } catch {}
    setHydrated(true);
    trackPrelaunch('registration_view');
  }, []);

  useEffect(() => {
    loadSOSCatalog().then(setCatalog).catch(() => setCatalogError('Services and areas could not load. Check your connection and try again.'));
  }, []);

  useEffect(() => {
    if (!hydrated || step === 3) return;
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ form, idem, startedAt, step })); } catch {}
  }, [form, idem, startedAt, step, hydrated]);

  useEffect(() => { headingRef.current?.focus({ preventScroll: true }); window.scrollTo({ top: 0 }); }, [step]);

  const set = (key, value) => {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === 'email' && !String(value).trim()) next.email_opt_in = false;
      if (key === 'phone' && !String(value).trim()) next.sms_opt_in = false;
      return next;
    });
    setErrors((e) => ({ ...e, [key]: undefined, contact: key === 'email' || key === 'phone' ? undefined : e.contact }));
  };
  const toggle = (key, value) => {
    setForm((f) => ({ ...f, [key]: f[key].includes(value) ? f[key].filter((x) => x !== value) : [...f[key], value] }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const start = () => {
    if (!idem) setIdem(newIdempotencyKey());
    if (!startedAt) setStartedAt(Date.now());
    setStep(1);
    trackPrelaunch('registration_start');
  };

  const nextFromInfo = () => {
    const e = validateInfo(form);
    setErrors(e);
    if (Object.keys(e).length) { trackPrelaunch('validation_error', { step: 2 }); return; }
    setStep(2);
    trackPrelaunch('registration_step', { step: 3 });
  };

  const filteredCategories = useMemo(() => {
    if (!catalog) return [];
    const q = query.trim().toLowerCase();
    return catalog.categories
      .map((c) => ({ ...c, subcategories: q ? c.subcategories.filter((s) => s.name.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)) : c.subcategories }))
      .filter((c) => c.subcategories.length > 0);
  }, [catalog, query]);

  const toggleCategory = (category) => {
    const ids = category.subcategories.map((s) => s.id);
    const allOn = ids.every((id) => form.subcategory_ids.includes(id));
    setForm((f) => ({ ...f, subcategory_ids: allOn ? f.subcategory_ids.filter((id) => !ids.includes(id)) : Array.from(new Set([...f.subcategory_ids, ...ids])) }));
    setErrors((e) => ({ ...e, subcategory_ids: undefined }));
  };

  const submit = async () => {
    const e = validateServices(form);
    setErrors(e);
    if (Object.keys(e).length) { trackPrelaunch('validation_error', { step: 3 }); return; }
    setBusy(true);
    setSubmitError('');
    const key = idem || newIdempotencyKey();
    if (!idem) setIdem(key);
    let attribution = {};
    try {
      const q = new URLSearchParams(window.location.search);
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].forEach((k) => { if (q.get(k)) attribution[k] = q.get(k); });
      if (document.referrer) attribution.referrer_domain = new URL(document.referrer).hostname;
      attribution.platform = window.Capacitor?.isNativePlatform?.() ? 'capacitor' : 'web';
    } catch {}
    const payload = {
      idempotency_key: key,
      started_at: startedAt || Date.now(),
      website: honeypot.current?.value || '',
      full_name: form.full_name.trim(),
      company_name: form.company_name.trim(),
      provider_type: form.provider_type,
      email: form.email.trim(),
      phone: form.phone.trim(),
      city: form.city.trim(),
      state_code: form.state_code,
      zip_code: form.zip_code.trim(),
      subcategory_ids: form.subcategory_ids,
      zone_ids: form.zone_ids,
      service_radius_miles: form.service_radius_miles === '' ? null : Number(form.service_radius_miles),
      years_experience: form.years_experience === '' ? null : Number(form.years_experience),
      equipment_notes: form.equipment_notes.trim(),
      availability: form.availability,
      terms_accepted: form.terms_accepted,
      terms_version: SOS_TERMS_VERSION,
      privacy_version: SOS_PRIVACY_VERSION,
      email_opt_in: form.email_opt_in,
      sms_opt_in: form.sms_opt_in,
      email_opt_in_text: form.email_opt_in ? EMAIL_OPT_IN_TEXT : '',
      sms_opt_in_text: form.sms_opt_in ? SMS_OPT_IN_TEXT : '',
      attribution,
    };
    try {
      const result = await submitProviderInterest(payload);
      const data = result.data || {};
      const response = { ok: result.ok, status: result.status };
      if (result.status === 0) throw new Error('network');
      if (response.ok && data?.ok && data.receipt_number) {
        const saved = { receipt_number: data.receipt_number, received_at: data.received_at, services: data.services || [], zones: data.zones || [], provider_type: data.provider_type, email_opt_in: data.email_opt_in, sms_opt_in: data.sms_opt_in };
        try { sessionStorage.setItem(RECEIPT_KEY, JSON.stringify(saved)); sessionStorage.removeItem(DRAFT_KEY); } catch {}
        setReceipt(saved);
        setStep(3);
        trackPrelaunch('registration_complete', { count: saved.services.length });
        return;
      }
      if (response.status === 422 && data?.field) {
        const field = data.field;
        setErrors((x) => ({ ...x, [field]: data.error || 'Check this field.' }));
        if (FIELD_STEP[field] === 1) setStep(1);
        setSubmitError(data.error || 'Some details need attention.');
      } else if (response.status === 429) {
        setSubmitError('Too many registrations from this network right now. Wait a few minutes, then try again — your answers are saved.');
      } else {
        setSubmitError(data?.error || 'Registration was not saved. Your answers are kept on this device — try again.');
      }
      trackPrelaunch('registration_error', { result: response.status });
    } catch {
      setSubmitError('Registration was not saved because the connection failed. Your answers are kept on this device — try again.');
      trackPrelaunch('registration_error', { result: 'network' });
    } finally {
      setBusy(false);
    }
  };

  const startOver = () => {
    try { sessionStorage.removeItem(RECEIPT_KEY); sessionStorage.removeItem(DRAFT_KEY); } catch {}
    setReceipt(null); setForm(emptyForm()); setIdem(''); setStartedAt(0); setErrors({}); setSubmitError(''); setStep(0);
  };

  const progress = step === 3 ? 100 : [8, 40, 75][step];
  const zoneNames = catalog?.zones || [];
  const total = catalog?.subcategoryCount;

  return (
    <div className="pl-flow">
      <header className="pl-header">
        <a href="/" className="pl-brand" aria-label="S.O.S. — Superheros On Standby home">
          <img src="/brand/prelaunch/sos-mark-180.png" alt="" width="40" height="38" />
          <span><strong>S.O.S.</strong><small>Provider early registration</small></span>
        </a>
        <a href="/" className="pl-btn pl-btn-ghost pl-btn-small">Back to S.O.S.</a>
      </header>

      <main className="pl-flow-main" id="main">
        <div className="pl-progress" aria-label={`Step ${step + 1} of 4: ${STEP_NAMES[step]}`}>
          <div className="pl-progress-bar" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
          <ol className="pl-progress-steps">
            {STEP_NAMES.map((name, i) => <li key={name} className={i === step ? 'is-current' : ''} aria-current={i === step ? 'step' : undefined}>{name}</li>)}
          </ol>
        </div>

        {/* Screen A — Introduction */}
        {step === 0 && (
          <section aria-labelledby="flow-title">
            <h1 id="flow-title" className="pl-flow-title" tabIndex={-1} ref={headingRef}>Join the SUPERHEROS network</h1>
            <p className="pl-flow-lede">Tell S.O.S. what you do and where you work. We’re building verified coverage across Atlanta before we open to the public, and early registrants are first in line for screening.</p>
            <ul className="pl-facts">
              <li>About 60–90 seconds. No password, no documents, no fees.</li>
              <li>This registers interest only. It is not an application, an approval or a promise of work.</li>
              <li>If your services and areas are a fit, S.O.S. may invite you to the full application later. Credentials are only requested then.</li>
              <li>S.O.S. only contacts you if you opt in, on the channel you choose.</li>
            </ul>
          </section>
        )}

        {/* Screen B — Your information */}
        {step === 1 && (
          <section aria-labelledby="flow-title">
            <h1 id="flow-title" className="pl-flow-title" tabIndex={-1} ref={headingRef}>Your information</h1>
            <p className="pl-flow-lede">So S.O.S. knows who you are and how to reach you.</p>
            <form noValidate onSubmit={(e) => { e.preventDefault(); nextFromInfo(); }} aria-label="Provider information" data-khg-cta="provider_interest_info">
              <fieldset className="pl-fieldset">
                <legend className="pl-legend">How do you work?</legend>
                <div className="pl-choices pl-choices-3" role="radiogroup" aria-invalid={Boolean(errors.provider_type)}>
                  {PROVIDER_TYPES.map((t) => (
                    <label key={t.id} className="pl-choice">
                      <input type="radio" name="provider_type" value={t.id} checked={form.provider_type === t.id} onChange={() => set('provider_type', t.id)} />
                      <strong>{t.label}</strong><small>{t.hint}</small>
                    </label>
                  ))}
                </div>
                {errors.provider_type && <small className="pl-field-error">{errors.provider_type}</small>}
              </fieldset>

              <Field id="full_name" label="Full name" error={errors.full_name}>
                <input id="full_name" autoComplete="name" value={form.full_name} onChange={(e) => set('full_name', e.target.value)} aria-invalid={Boolean(errors.full_name)} maxLength={120} />
              </Field>
              <Field id="company_name" label="Business name" optional={!['company', 'fleet'].includes(form.provider_type)} error={errors.company_name}>
                <input id="company_name" autoComplete="organization" value={form.company_name} onChange={(e) => set('company_name', e.target.value)} aria-invalid={Boolean(errors.company_name)} maxLength={160} />
              </Field>

              <fieldset className="pl-fieldset">
                <legend className="pl-legend">Contact</legend>
                <p className="pl-field-hint" style={{ margin: 0 }}>Add at least one. S.O.S. will confirm it before any next step.</p>
                <div className="pl-row pl-row-2">
                  <Field id="email" label="Email" error={errors.email}>
                    <input id="email" type="email" inputMode="email" autoComplete="email" value={form.email} onChange={(e) => set('email', e.target.value)} aria-invalid={Boolean(errors.email || errors.contact)} maxLength={254} />
                  </Field>
                  <Field id="phone" label="Mobile phone" error={errors.phone}>
                    <input id="phone" type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} aria-invalid={Boolean(errors.phone || errors.contact)} maxLength={20} placeholder="(404) 555-0123" />
                  </Field>
                </div>
                {errors.contact && <small className="pl-field-error">{errors.contact}</small>}
              </fieldset>

              <div className="pl-row pl-row-3">
                <Field id="city" label="City" error={errors.city}>
                  <input id="city" autoComplete="address-level2" value={form.city} onChange={(e) => set('city', e.target.value)} aria-invalid={Boolean(errors.city)} maxLength={100} />
                </Field>
                <Field id="state_code" label="State" error={errors.state_code}>
                  <select id="state_code" autoComplete="address-level1" value={form.state_code} onChange={(e) => set('state_code', e.target.value)} aria-invalid={Boolean(errors.state_code)}>
                    {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
                <Field id="zip_code" label="ZIP code" error={errors.zip_code}>
                  <input id="zip_code" inputMode="numeric" autoComplete="postal-code" value={form.zip_code} onChange={(e) => set('zip_code', e.target.value.replace(/\D/g, '').slice(0, 5))} aria-invalid={Boolean(errors.zip_code)} />
                </Field>
              </div>

              <fieldset className="pl-fieldset">
                <legend className="pl-legend">Consent</legend>
                <label className="pl-consent">
                  <input type="checkbox" checked={form.terms_accepted} onChange={(e) => set('terms_accepted', e.target.checked)} aria-invalid={Boolean(errors.terms_accepted)} />
                  <span>I agree to the S.O.S. <a href="/terms/" target="_blank" rel="noreferrer">Terms</a> and <a href="/privacy/" target="_blank" rel="noreferrer">Privacy Policy</a>, and I understand this registers interest only — it is not an application, approval or offer of work.</span>
                </label>
                {errors.terms_accepted && <small className="pl-field-error">{errors.terms_accepted}</small>}
                <label className="pl-consent">
                  <input type="checkbox" checked={form.email_opt_in} disabled={!form.email.trim()} onChange={(e) => set('email_opt_in', e.target.checked)} />
                  <span>{EMAIL_OPT_IN_TEXT}{!form.email.trim() && ' (add an email to choose this)'}</span>
                </label>
                <label className="pl-consent">
                  <input type="checkbox" checked={form.sms_opt_in} disabled={!form.phone.trim()} onChange={(e) => set('sms_opt_in', e.target.checked)} />
                  <span>{SMS_OPT_IN_TEXT}{!form.phone.trim() && ' (add a mobile number to choose this)'}</span>
                </label>
              </fieldset>
              <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
            </form>
          </section>
        )}

        {/* Screen C — Services & area */}
        {step === 2 && (
          <section aria-labelledby="flow-title">
            <h1 id="flow-title" className="pl-flow-title" tabIndex={-1} ref={headingRef}>Your services and area</h1>
            <p className="pl-flow-lede">Select every service you can do and every Atlanta area you can cover. You can pick as many as apply.</p>
            {catalogError && <div className="pl-alert" role="alert">{catalogError}</div>}
            <form noValidate onSubmit={(e) => { e.preventDefault(); submit(); }} aria-label="Services and areas" data-khg-cta="provider_interest_services">
              <div className="pl-hp" aria-hidden="true">
                <label>Website<input ref={honeypot} name="website" tabIndex={-1} autoComplete="off" defaultValue="" /></label>
              </div>

              <fieldset className="pl-fieldset">
                <legend className="pl-legend">Services{total ? ` (${total} available)` : ''}</legend>
                <div className="pl-service-tools">
                  <input className="pl-search" type="search" placeholder="Search services" aria-label="Search services" value={query} onChange={(e) => setQuery(e.target.value)} />
                  <span className="pl-selected-count" aria-live="polite">{form.subcategory_ids.length} selected</span>
                </div>
                {errors.subcategory_ids && <small className="pl-field-error" role="alert">{errors.subcategory_ids}</small>}
                {!catalog && !catalogError && <div className="pl-skeleton" aria-busy="true" aria-label="Loading services" />}
                {catalog && filteredCategories.length === 0 && <p className="pl-field-hint">No services match “{query}”. Clear the search to see all of them.</p>}
                {filteredCategories.map((category) => {
                  const all = category.subcategories.every((s) => form.subcategory_ids.includes(s.id));
                  return (
                    <div key={category.id} className="pl-svc-group" role="group" aria-labelledby={`grp-${category.id}`}>
                      <div className="pl-svc-head">
                        <h3 id={`grp-${category.id}`}>{category.name}</h3>
                        <button type="button" className="pl-link-btn" onClick={() => toggleCategory(category)}>{all ? 'Clear all' : 'Select all'}</button>
                      </div>
                      <div className="pl-chips">
                        {category.subcategories.map((sub) => (
                          <label key={sub.id} className="pl-chip">
                            <input type="checkbox" checked={form.subcategory_ids.includes(sub.id)} onChange={() => toggle('subcategory_ids', sub.id)} />
                            {sub.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </fieldset>

              <fieldset className="pl-fieldset">
                <legend className="pl-legend">Atlanta areas you cover</legend>
                <p className="pl-field-hint" style={{ margin: '0 0 12px' }}>These are planned S.O.S. zones. Your selection is recorded as self-reported until S.O.S. verifies it.</p>
                {errors.zone_ids && <small className="pl-field-error" role="alert">{errors.zone_ids}</small>}
                <div className="pl-zone-grid">
                  {zoneNames.map((zone) => (
                    <label key={zone.id} className="pl-chip">
                      <input type="checkbox" checked={form.zone_ids.includes(zone.id)} onChange={() => toggle('zone_ids', zone.id)} />
                      {zone.zone_name}
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="pl-fieldset">
                <legend className="pl-legend">A little more <span style={{ fontWeight: 400, fontFamily: 'var(--pl-body)', textTransform: 'none', fontSize: 15, color: 'var(--pl-asphalt)' }}>(optional)</span></legend>
                <div className="pl-row pl-row-2">
                  <Field id="service_radius_miles" label="Service radius in miles" optional error={errors.service_radius_miles}>
                    <input id="service_radius_miles" inputMode="numeric" value={form.service_radius_miles} onChange={(e) => set('service_radius_miles', e.target.value.replace(/\D/g, '').slice(0, 3))} />
                  </Field>
                  <Field id="years_experience" label="Years of experience" optional error={errors.years_experience}>
                    <input id="years_experience" inputMode="numeric" value={form.years_experience} onChange={(e) => set('years_experience', e.target.value.replace(/\D/g, '').slice(0, 2))} />
                  </Field>
                </div>
                <Field id="equipment_notes" label="Vehicles and equipment" optional hint="For example: rollback tow truck, jump pack, mobile tire machine.">
                  <textarea id="equipment_notes" value={form.equipment_notes} onChange={(e) => set('equipment_notes', e.target.value)} maxLength={1000} />
                </Field>
                <p className="pl-field-hint" style={{ margin: '16px 0 8px' }}>When are you usually available?</p>
                <div className="pl-chips">
                  {AVAILABILITY.map((a) => (
                    <label key={a.id} className="pl-chip">
                      <input type="checkbox" checked={form.availability.includes(a.id)} onChange={() => toggle('availability', a.id)} />
                      {a.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="pl-review" aria-label="Review">
                <div className="pl-review-row"><span>Name</span><span>{form.full_name || '—'}</span></div>
                <div className="pl-review-row"><span>Contact</span><span>{[form.email, form.phone].filter(Boolean).join(' / ') || '—'}</span></div>
                <div className="pl-review-row"><span>Location</span><span>{form.city}, {form.state_code} {form.zip_code}</span></div>
                <button type="button" className="pl-link-btn" style={{ justifySelf: 'start' }} onClick={() => setStep(1)}>Edit your information</button>
              </div>
              {submitError && <div className="pl-alert" role="alert">{submitError}</div>}
              <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
            </form>
          </section>
        )}

        {/* Screen D — Receipt */}
        {step === 3 && receipt && (
          <section aria-labelledby="flow-title">
            <h1 id="flow-title" className="pl-flow-title" tabIndex={-1} ref={headingRef}>Interest received</h1>
            <p className="pl-flow-lede">Thanks for raising your hand. Your registration is saved with S.O.S.</p>
            <div className="pl-receipt">
              <p className="pl-receipt-label">Registration receipt</p>
              <p className="pl-receipt-number">{receipt.receipt_number}</p>
              <p className="pl-field-hint" style={{ margin: 0 }}>Received {receipt.received_at ? new Date(receipt.received_at).toLocaleString() : ''}. Keep this number if you contact S.O.S.</p>
              <dl>
                <div><dt>Services you selected ({receipt.services.length})</dt><dd>{receipt.services.join(', ')}</dd></div>
                <div><dt>Areas you selected ({receipt.zones.length})</dt><dd>{receipt.zones.join(', ')}</dd></div>
                <div><dt>Contact preferences</dt><dd>{receipt.email_opt_in || receipt.sms_opt_in ? `You opted in to ${[receipt.email_opt_in && 'email', receipt.sms_opt_in && 'text messages'].filter(Boolean).join(' and ')}.` : 'You did not opt in to email or text updates.'}</dd></div>
              </dl>
            </div>
            <p className="pl-footnote">This is interest only — not an application, an approval or a guarantee of work. S.O.S. has not sent you a message; this page is your confirmation.</p>
            <h2 className="pl-h3" style={{ marginTop: 34 }}>What happens next</h2>
            <ol className="pl-next">
              <li>S.O.S. reviews coverage needs for the services and areas you chose.</li>
              <li>If there’s a fit, S.O.S. confirms your contact details — only on a channel you agreed to.</li>
              <li>Screened providers may be invited to the full application, where ID, license, insurance and background checks happen.</li>
              <li>Nobody is activated until verification and a test mission are complete and S.O.S. opens in that zone.</li>
            </ol>
            <h2 className="pl-h3" style={{ marginTop: 34 }}>Need to change something?</h2>
            <p className="pl-sub" style={{ marginTop: 0 }}>Register again with the same email or phone. S.O.S. matches it to your existing record instead of creating a duplicate, and adds any new services or areas.</p>
            <div className="pl-actions">
              <button type="button" className="pl-btn pl-btn-ghost" onClick={startOver}>Update my registration</button>
              <a className="pl-btn pl-btn-primary" href="/">Back to S.O.S.</a>
            </div>
          </section>
        )}
      </main>

      {step < 3 && (
        <nav className="pl-flow-nav" aria-label="Registration steps">
          <div className="pl-flow-nav-inner">
            {step > 0 && <button type="button" className="pl-btn pl-btn-ghost" onClick={() => setStep(step - 1)} disabled={busy}>Back</button>}
            {step === 0 && <button type="button" className="pl-btn pl-btn-primary" onClick={start}>Start registration</button>}
            {step === 1 && <button type="button" className="pl-btn pl-btn-primary" onClick={nextFromInfo}>Continue to services</button>}
            {step === 2 && <button type="button" className="pl-btn pl-btn-primary" onClick={submit} disabled={busy || !catalog}>{busy ? 'Saving your registration…' : 'Register interest'}</button>}
          </div>
        </nav>
      )}
    </div>
  );
}
