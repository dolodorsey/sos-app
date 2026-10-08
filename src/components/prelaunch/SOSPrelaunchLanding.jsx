'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { loadSOSCatalog, trackPrelaunch } from '@/lib/sosPrelaunch';

const JOIN_HREF = '/become-a-hero/';

const SECTIONS = [
  ['welcome', 'Welcome'],
  ['delivers', 'What we deliver'],
  ['services', 'Services'],
  ['requests', 'How it works'],
  ['tracking', 'Tracking'],
  ['network', 'SUPERHEROS'],
  ['why', 'Why join'],
  ['areas', 'Atlanta areas'],
  ['register', 'Early registration'],
  ['updates', 'Updates'],
];

const DELIVERS = [
  { title: 'Roadside help', body: 'Towing, jump starts, lockouts, flat tires, fuel and battery help — requested from your phone.', icon: 'tow' },
  { title: 'Mobile maintenance', body: 'Oil changes, brakes, diagnostics and small repairs done where the car is parked.', icon: 'wrench' },
  { title: 'Care and convenience', body: 'Washes, detailing, wiper blades, accessory installs and errands for your vehicle.', icon: 'wash' },
  { title: 'Progress you can see', body: 'Each request shows its status from matching to arrival to completion.', icon: 'pin' },
  { title: 'Real support', body: 'Help with a request stays attached to that request, inside the app.', icon: 'chat' },
];

const REQUEST_STEPS = [
  { title: 'Choose a service', body: 'Pick from the S.O.S. catalog — roadside, maintenance, detailing, fleet and more.' },
  { title: 'Add your vehicle', body: 'Make, model and anything the provider should know before arriving.' },
  { title: 'Set the location', body: 'Confirm where the vehicle is. Location is only used for the request you make.' },
  { title: 'Describe the issue', body: 'A short note and optional photos so the right person shows up with the right tools.' },
  { title: 'Review the price', body: 'You see the price or a quote request before anything is booked. Some services need an on-site quote.' },
  { title: 'Send the request', body: 'Available after public launch. Today, requests are closed while we build provider coverage.' },
];

const TRACKING_STATES = [
  { id: 'received', title: 'Request received', body: 'S.O.S. confirms the details of your request.' },
  { id: 'matching', title: 'Matching', body: 'The request is offered to verified providers who cover that service and area.' },
  { id: 'assigned', title: 'Provider assigned', body: 'A provider accepts. Nothing is assigned until someone actually accepts.' },
  { id: 'en_route', title: 'On the way', body: 'You can follow progress as the provider heads to you.' },
  { id: 'on_site', title: 'On site', body: 'The provider arrives and confirms the work before starting.' },
  { id: 'complete', title: 'Complete', body: 'Work is finished, you get a receipt and can rate the experience.' },
];

const VERIFICATION_PATH = [
  'Register early interest',
  'Contact confirmed by S.O.S.',
  'Services and zones screened',
  'Invited to the full application',
  'ID, license and insurance submitted',
  'Background and verification checks',
  'Test mission',
  'Activated at launch',
];

const WHY = [
  { title: 'Get in before launch', body: 'Early registrants are first in line for screening in the zones and services they choose.' },
  { title: 'Work you choose', body: 'Pick the services you actually offer and the parts of Atlanta you want to cover.' },
  { title: 'Know the job before you say yes', body: 'In the planned app, each request shows the service, location and payout before you accept or decline.' },
  { title: 'Keep your business', body: 'S.O.S. is a channel for requests. Independent providers and companies keep running their own operation.' },
  { title: 'No cost to register', body: 'Registering interest is free. There is nothing to buy and no documents to upload today.' },
];

const FAQ = [
  ['Can I request roadside help through S.O.S. today?', 'Not yet. S.O.S. is pre-launch and is not accepting service requests. For an emergency, call 911. For roadside help today, contact your insurer or a local provider directly.'],
  ['Is registering an application or a job offer?', 'No. Early registration tells us what you do and where. It is not an application, approval or a guarantee of work. Screening and the full application come later, by invitation.'],
  ['What do I need to register?', 'Your name, how to reach you, your city and ZIP, the services you offer and the Atlanta areas you cover. No license, insurance, ID, banking or background check at this stage.'],
  ['When will S.O.S. launch?', 'When there are enough verified providers for each service and zone. We are not announcing a date until coverage is real.'],
  ['Will you contact me?', 'Only if you opt in, and only through the channel you chose. You can opt out any time. Registering does not trigger an automatic message.'],
  ['Is S.O.S. an emergency service?', 'No. S.O.S. is a roadside and mobile vehicle-service network. It does not replace police, fire, EMS or 911.'],
];

function Icon({ name }) {
  const paths = {
    tow: <><path d="M4 28h23v9H4zM27 18h9l7 10v9H27zM31 18v-6h8M39 12l-8 11" /><circle cx="12" cy="38" r="4" /><circle cx="36" cy="38" r="4" /></>,
    wrench: <path d="M32 7a10 10 0 00-9 14L8 36l4 4 15-15a10 10 0 0014-12l-7 7-6-6z" />,
    wash: <><path d="M10 29l4-10h20l4 10v9H10zM14 29h20M15 38v4M33 38v4" /><circle cx="17" cy="33" r="2" /><circle cx="31" cy="33" r="2" /><path d="M15 7v6M24 5v8M33 7v6" /></>,
    pin: <><path d="M24 43s14-13 14-24a14 14 0 00-28 0c0 11 14 24 14 24z" /><circle cx="24" cy="19" r="5" /></>,
    chat: <path d="M7 10h34v22H20l-9 7v-7H7z" />,
  };
  return <svg viewBox="0 0 48 48" aria-hidden="true" className="pl-icon">{paths[name]}</svg>;
}

function useSectionTracking() {
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const seen = new Set();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const id = entry.target.id;
        if (entry.isIntersecting && !seen.has(id)) {
          seen.add(id);
          trackPrelaunch('section_view', { section: id });
        }
      });
    }, { threshold: 0.35 });
    SECTIONS.forEach(([id]) => { const el = document.getElementById(id); if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, []);
}

// Homescreen animation: founder-supplied S.O.S. dispatch animation (SOS_ANI), cropped to the
// holographic city and route arcs. The crop deliberately excludes the source art's baked-in
// misspelled wordmark, its fabricated stats column and the generator watermark; the brand mark
// is overlaid as the clean shield plus live SUPERHEROS text. Muted, inline, pausable; honors
// prefers-reduced-motion (poster only) and pauses while off-screen.
function HeroAnimation() {
  const videoRef = useRef(null);
  const [paused, setPaused] = useState(false);
  const userPaused = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    video.muted = true;
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { userPaused.current = true; setPaused(true); return undefined; }
    const play = () => video.play().catch(() => setPaused(true));
    if (typeof IntersectionObserver === 'undefined') { play(); return undefined; }
    const observer = new IntersectionObserver(([entry]) => {
      if (userPaused.current) return;
      if (entry.isIntersecting) play(); else video.pause();
    }, { threshold: 0.15 });
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  const toggle = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) { userPaused.current = false; video.play().then(() => setPaused(false)).catch(() => {}); }
    else { userPaused.current = true; video.pause(); setPaused(true); }
  };

  return (
    <div className="pl-signal pl-stage">
      <div className="pl-stage-screen">
        <video ref={videoRef} className="pl-stage-video" muted loop playsInline preload="metadata"
          poster="/brand/prelaunch/sos-dispatch-poster.webp" width="440" height="720" aria-hidden="true" tabIndex={-1}>
          <source src="/brand/prelaunch/sos-dispatch-loop.webm" type="video/webm" />
          <source src="/brand/prelaunch/sos-dispatch-loop.mp4" type="video/mp4" />
        </video>
        <span className="pl-stage-tag">Animation · illustrative</span>
        <button type="button" className="pl-stage-toggle" onClick={toggle} aria-label={paused ? 'Play background animation' : 'Pause background animation'}>
          {paused
            ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
            : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z" /></svg>}
        </button>
      </div>
      <div className="pl-stage-mark" aria-hidden="true">
        <img src="/brand/prelaunch/sos-shield-720.webp" alt="" width="720" height="374" fetchPriority="high" />
        <span className="pl-signal-wordmark">SUPERHEROS<small>On Standby</small></span>
      </div>
    </div>
  );
}

function JoinLink({ cta, className = 'pl-btn pl-btn-primary', children = 'Join as a provider' }) {
  return <a href={JOIN_HREF} className={className} data-khg-cta={`prelaunch_join_${cta}`} onClick={() => trackPrelaunch('cta_click', { cta })}>{children}</a>;
}

export default function SOSPrelaunchLanding() {
  const [catalog, setCatalog] = useState(null);
  const [catalogError, setCatalogError] = useState('');
  const [openCategory, setOpenCategory] = useState(null);
  const [requestStep, setRequestStep] = useState(0);
  const [trackIndex, setTrackIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showSticky, setShowSticky] = useState(false);
  const heroRef = useRef(null);
  const registerRef = useRef(null);

  useSectionTracking();

  const fetchCatalog = () => {
    setCatalogError('');
    loadSOSCatalog().then(setCatalog).catch(() => setCatalogError('The service catalog could not load. Check your connection and try again.'));
  };
  useEffect(fetchCatalog, []);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const state = { hero: true, register: false };
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.target === heroRef.current) state.hero = entry.isIntersecting;
        if (entry.target === registerRef.current) state.register = entry.isIntersecting;
      });
      setShowSticky(!state.hero && !state.register);
    }, { threshold: 0.05 });
    if (heroRef.current) observer.observe(heroRef.current);
    if (registerRef.current) observer.observe(registerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!playing) return undefined;
    if (trackIndex >= TRACKING_STATES.length - 1) { setPlaying(false); return undefined; }
    const t = setTimeout(() => setTrackIndex((i) => i + 1), 1300);
    return () => clearTimeout(t);
  }, [playing, trackIndex]);

  const serviceCount = catalog?.subcategoryCount;
  const zoneCount = catalog?.zones?.length;
  const serviceLabel = serviceCount ? `${serviceCount} services` : 'the services';
  const zoneTypeLabel = { metro: 'Intown', suburban: 'Suburban', highway_corridor: 'Airport corridor', rural: 'Rural' };

  const sampleService = useMemo(() => catalog?.categories?.[0]?.subcategories?.[0]?.name || 'Flat Tire Help', [catalog]);

  return (
    <div className="pl-root">
      <a className="pl-skip" href="#main">Skip to content</a>

      <header className="pl-header">
        <a href="#welcome" className="pl-brand" aria-label="S.O.S. — Superheros On Standby, back to top">
          <img src="/brand/prelaunch/sos-shield-200.png" alt="" width="64" height="33" />
          <span><strong>S.O.S.</strong><small>Superheros On Standby</small></span>
        </a>
        <nav className="pl-nav" aria-label="Page sections">
          <a href="#services">Services</a>
          <a href="#requests">How it works</a>
          <a href="#network">SUPERHEROS</a>
          <a href="#areas">Atlanta areas</a>
        </nav>
        <JoinLink cta="header" className="pl-btn pl-btn-primary pl-btn-small" />
      </header>

      <main id="main">
        {/* 1. Welcome */}
        <section id="welcome" className="pl-hero" ref={heroRef} aria-labelledby="welcome-title">
          <div className="pl-hero-bg" aria-hidden="true" />
          <div className="pl-hero-copy">
            <p className="pl-status"><span className="pl-status-dot" aria-hidden="true" />Pre-launch: not accepting service requests</p>
            <h1 id="welcome-title" className="pl-display">Real help.<br />Real people.<br />Coming to Atlanta.</h1>
            <p className="pl-lede">S.O.S. — Superheros On Standby is building a network of verified roadside and mobile vehicle-service providers. Before we open to the public, we are recruiting the people who will do the work.</p>
            <div className="pl-actions">
              <JoinLink cta="hero" />
              <a href="#delivers" className="pl-btn pl-btn-ghost" onClick={() => trackPrelaunch('cta_click', { cta: 'explore' })}>Explore what we’re building</a>
            </div>
            <p className="pl-not911">S.O.S. is not 911. In an emergency, call 911.</p>
          </div>
          <HeroAnimation />
          <p className="pl-wordmark" aria-hidden="true">SUPERHEROS ON STANDBY</p>
        </section>

        {/* 2. What S.O.S. will deliver */}
        <section id="delivers" className="pl-section" aria-labelledby="delivers-title">
          <div className="pl-section-head">
            <h2 id="delivers-title" className="pl-h2">What S.O.S. will deliver</h2>
            <p className="pl-sub">One app for getting a vehicle moving again — and for keeping it running. These are the planned launch capabilities.</p>
          </div>
          <ul className="pl-deliver-grid">
            {DELIVERS.map((item, index) => (
              <li key={item.title} className={`pl-deliver pl-deliver-${index}`}>
                <Icon name={item.icon} />
                <h3>{item.title}</h3>
                <p>{item.body}</p>
                <span className="pl-tag">Planned</span>
              </li>
            ))}
          </ul>
        </section>

        {/* 3. Explore all services */}
        <section id="services" className="pl-section pl-section-panel" aria-labelledby="services-title">
          <div className="pl-section-head">
            <h2 id="services-title" className="pl-h2">Explore all {serviceLabel}</h2>
            <p className="pl-sub">{catalog ? `${catalog.categories.length} categories, straight from the S.O.S. service catalog.` : 'Loading the S.O.S. service catalog.'} Open a category to see every service in it.</p>
          </div>
          {catalogError && <div className="pl-error" role="alert">{catalogError} <button type="button" className="pl-link-btn" onClick={fetchCatalog}>Try again</button></div>}
          {!catalog && !catalogError && <div className="pl-skeleton" aria-busy="true" aria-label="Loading services" />}
          {catalog && (
            <div className="pl-cat-grid">
              {catalog.categories.map((category) => {
                const open = openCategory === category.id;
                return (
                  <div key={category.id} className={`pl-cat ${open ? 'is-open' : ''}`}>
                    <button type="button" className="pl-cat-toggle" aria-expanded={open} aria-controls={`cat-${category.id}`}
                      onClick={() => { setOpenCategory(open ? null : category.id); if (!open) trackPrelaunch('category_open', { section: category.id }); }}>
                      <span className="pl-cat-name">{category.name}</span>
                      <span className="pl-cat-count">{category.subcategories.length}</span>
                      <span className="pl-chevron" aria-hidden="true" />
                    </button>
                    <ul id={`cat-${category.id}`} className="pl-sub-list" hidden={!open}>
                      {category.subcategories.map((sub) => <li key={sub.id}>{sub.name}</li>)}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
          <p className="pl-footnote">Service availability, pricing and arrival times will depend on verified provider coverage at launch.</p>
        </section>

        {/* 4. How requests will work */}
        <section id="requests" className="pl-section" aria-labelledby="requests-title">
          <div className="pl-section-head">
            <h2 id="requests-title" className="pl-h2">How a request will work</h2>
            <p className="pl-sub">Tap through the steps. This is a preview of the planned app — nothing here sends a request, charges a card or uses your location.</p>
          </div>
          <div className="pl-split">
            <ol className="pl-steps" aria-label="Request steps">
              {REQUEST_STEPS.map((step, index) => (
                <li key={step.title}>
                  <button type="button" className={`pl-step ${requestStep === index ? 'is-active' : ''}`} aria-current={requestStep === index ? 'step' : undefined}
                    onClick={() => { setRequestStep(index); trackPrelaunch('preview_step', { step: index + 1 }); }}>
                    <span className="pl-step-n">{index + 1}</span>
                    <span><strong>{step.title}</strong><small>{step.body}</small></span>
                  </button>
                </li>
              ))}
            </ol>
            <figure className="pl-phone" aria-label="Product preview">
              <span className="pl-preview-badge">Product preview</span>
              <div className="pl-phone-screen" aria-live="polite">
                <p className="pl-phone-kicker">Step {requestStep + 1} of {REQUEST_STEPS.length}</p>
                <p className="pl-phone-title">{REQUEST_STEPS[requestStep].title}</p>
                {requestStep === 0 && <div className="pl-mock-list">{(catalog?.categories?.[0]?.subcategories || []).slice(0, 4).map((s) => <span key={s.id} className="pl-mock-row">{s.name}</span>)}{!catalog && <span className="pl-mock-row">Roadside services</span>}</div>}
                {requestStep === 1 && <div className="pl-mock-list"><span className="pl-mock-field">Year · Make · Model</span><span className="pl-mock-field">Color and plate (optional)</span></div>}
                {requestStep === 2 && <div className="pl-mock-map" aria-hidden="true"><span className="pl-mock-pin" /></div>}
                {requestStep === 3 && <div className="pl-mock-list"><span className="pl-mock-field pl-mock-tall">“Rear tire is flat, spare is in the trunk.”</span><span className="pl-mock-field">Add photos</span></div>}
                {requestStep === 4 && <div className="pl-mock-list"><span className="pl-mock-row">{sampleService}</span><span className="pl-mock-field">Price shown here before you confirm</span></div>}
                {requestStep === 5 && <div className="pl-mock-list"><span className="pl-mock-closed">Requests open after public launch</span></div>}
              </div>
              <figcaption>Illustration only. Screens will change before launch.</figcaption>
            </figure>
          </div>
        </section>

        {/* 5. Matching & tracking preview */}
        <section id="tracking" className="pl-section pl-section-panel" aria-labelledby="tracking-title">
          <div className="pl-section-head">
            <h2 id="tracking-title" className="pl-h2">Matching and tracking</h2>
            <p className="pl-sub">After launch, every request moves through the same statuses. This preview is illustrative — there are no live providers or live tracking yet.</p>
          </div>
          <div className="pl-track">
            <ol className="pl-track-rail" aria-label="Request statuses">
              {TRACKING_STATES.map((state, index) => (
                <li key={state.id} className={index < trackIndex ? 'is-done' : index === trackIndex ? 'is-current' : ''}>
                  <button type="button" onClick={() => { setPlaying(false); setTrackIndex(index); }} aria-current={index === trackIndex ? 'step' : undefined}>
                    <span className="pl-track-dot" aria-hidden="true" />
                    <span className="pl-track-label">{state.title}</span>
                  </button>
                </li>
              ))}
            </ol>
            <div className="pl-track-detail" aria-live="polite">
              <p className="pl-track-now">{TRACKING_STATES[trackIndex].title}</p>
              <p>{TRACKING_STATES[trackIndex].body}</p>
              <div className="pl-actions">
                <button type="button" className="pl-btn pl-btn-ghost pl-btn-small" onClick={() => { setTrackIndex(0); setPlaying(true); trackPrelaunch('tracking_play'); }}>
                  {playing ? 'Playing preview' : 'Play the preview'}
                </button>
              </div>
              <span className="pl-preview-badge pl-preview-inline">Preview / illustrative</span>
            </div>
          </div>
        </section>

        {/* 6. Meet the SUPERHEROS network */}
        <section id="network" className="pl-section pl-network" aria-labelledby="network-title">
          <div className="pl-network-bg" aria-hidden="true" />
          <div className="pl-section-head">
            <h2 id="network-title" className="pl-h2">Meet the SUPERHEROS network</h2>
            <p className="pl-sub">SUPERHEROS is how S.O.S. names the real people who show up when help is needed — tow operators, mechanics, roadside techs, detailers and fleet crews. The spelling is deliberate: these are real people, not fictional superheroes.</p>
          </div>
          <div className="pl-split pl-split-wide">
            <div className="pl-truth">
              <h3>Where the network stands today</h3>
              <p>No providers are active on S.O.S. yet. Nobody is on duty and no requests are being dispatched. We are recruiting now, service by service and zone by zone.</p>
              <h3>The standard</h3>
              <p>Before anyone takes a request through S.O.S., they will be identity-checked, licensed and insured for the work, background-checked and tested on a real mission.</p>
            </div>
            <ol className="pl-path" aria-label="Path from registration to activation">
              {VERIFICATION_PATH.map((step, index) => (
                <li key={step} className={index === 0 ? 'is-now' : ''}>
                  <span className="pl-path-n">{index + 1}</span>
                  <span>{step}{index === 0 && <em> — you can do this today</em>}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 7. Why become a provider */}
        <section id="why" className="pl-section" aria-labelledby="why-title">
          <div className="pl-section-head">
            <h2 id="why-title" className="pl-h2">Why become an S.O.S. provider</h2>
            <p className="pl-sub">Straight answers, no promises we can’t back up. We don’t guarantee jobs, approval or earnings.</p>
          </div>
          <ul className="pl-why">
            {WHY.map((item) => <li key={item.title}><h3>{item.title}</h3><p>{item.body}</p></li>)}
          </ul>
          <div className="pl-actions"><JoinLink cta="why" /></div>
        </section>

        {/* 8. Atlanta launch areas */}
        <section id="areas" className="pl-section pl-section-panel" aria-labelledby="areas-title">
          <div className="pl-section-head">
            <h2 id="areas-title" className="pl-h2">Atlanta launch areas</h2>
            <p className="pl-sub">{zoneCount ? `${zoneCount} planned` : 'Planned'} recruitment and service zones. These are not active dispatch areas — each one opens only when its provider coverage is verified.</p>
          </div>
          {catalogError && <div className="pl-error" role="alert">Launch areas could not load. <button type="button" className="pl-link-btn" onClick={fetchCatalog}>Try again</button></div>}
          {!catalog && !catalogError && <div className="pl-skeleton" aria-busy="true" aria-label="Loading launch areas" />}
          {catalog && (
            <ul className="pl-zones">
              {catalog.zones.map((zone) => (
                <li key={zone.id}>
                  <strong>{zone.zone_name}</strong>
                  <small>{zoneTypeLabel[zone.zone_type] || 'Planned zone'} · Recruiting</small>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 9. Early provider registration */}
        <section id="register" className="pl-section" ref={registerRef} aria-labelledby="register-title">
          <div className="pl-section-head">
            <h2 id="register-title" className="pl-h2">Become an early S.O.S. provider</h2>
            <p className="pl-sub">It takes about a minute. Tell us what you do and where — the detailed credential steps come later, only if you are invited.</p>
          </div>
          <div className="pl-compare">
            <div className="pl-compare-col is-now">
              <h3>What we ask now</h3>
              <ul>
                <li>Your name and business name, if you have one</li>
                <li>An email or phone number</li>
                <li>City, state and ZIP</li>
                <li>The services you offer and the Atlanta areas you cover</li>
              </ul>
            </div>
            <div className="pl-compare-col">
              <h3>What waits until you’re invited</h3>
              <ul>
                <li>Driver license and insurance documents</li>
                <li>Government ID</li>
                <li>Background check consent</li>
                <li>Payout and banking setup</li>
              </ul>
            </div>
          </div>
          <div className="pl-actions"><JoinLink cta="register_section">Start early registration</JoinLink></div>
          <p className="pl-footnote">Registration is free. It is not an application, approval or a promise of work.</p>
        </section>

        {/* 10. Final CTA + launch updates */}
        <section id="updates" className="pl-final" aria-labelledby="updates-title">
          <div className="pl-final-bg" aria-hidden="true" />
          <div className="pl-final-inner">
            <h2 id="updates-title" className="pl-display pl-final-title">Help us build Atlanta’s network.</h2>
            <p className="pl-lede">If you tow, fix, jump, unlock, fuel, wash or service vehicles, register now and help decide where S.O.S. opens first.</p>
            <div className="pl-actions">
              <JoinLink cta="final" />
              <a href="/launch-updates/" className="pl-btn pl-btn-ghost" onClick={() => trackPrelaunch('cta_click', { cta: 'launch_updates' })}>Not a provider? Get launch updates</a>
            </div>
          </div>
          <div className="pl-faq">
            <h2 className="pl-h3">Questions</h2>
            {FAQ.map(([q, a]) => (
              <details key={q} onToggle={(e) => { if (e.currentTarget.open) trackPrelaunch('faq_open', { section: q.slice(0, 40) }); }}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="pl-footer">
        <div className="pl-footer-brand">
          <img src="/brand/prelaunch/sos-shield-200.png" alt="" width="60" height="31" loading="lazy" />
          <span><strong>S.O.S. — Superheros On Standby</strong><small>SUPERHEROS is the intentional S.O.S. spelling.</small></span>
        </div>
        <nav aria-label="Legal and support">
          <a href="/privacy/">Privacy</a>
          <a href="/terms/">Terms</a>
          <a href="/legal/">Safety · Not 911</a>
          <a href="/support/">Contact and support</a>
          <a href="/superheros/">About SUPERHEROS</a>
        </nav>
        <p className="pl-footer-note">S.O.S. is a roadside and mobile vehicle-service network, not an emergency service. In an emergency, call 911. © {new Date().getFullYear()} S.O.S. — A Kollective Hospitality Group company.</p>
      </footer>

      <div className={`pl-sticky ${showSticky ? 'is-visible' : ''}`} aria-hidden={!showSticky} inert={showSticky ? undefined : true}>
        <span>Pre-launch · recruiting providers</span>
        <JoinLink cta="sticky" className="pl-btn pl-btn-primary pl-btn-small" />
      </div>
    </div>
  );
}
