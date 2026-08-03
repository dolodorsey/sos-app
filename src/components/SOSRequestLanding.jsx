'use client';

import React from 'react';

const SERVICES = [
  ['Flat tire help', 'Spare installation or roadside tire support'],
  ['Jump start', 'Battery boost and basic battery assessment'],
  ['Vehicle lockout', 'Non-destructive entry when service is available'],
  ['Towing request', 'Pickup and destination details reviewed before assignment'],
  ['Fuel delivery', 'Fuel type and quantity confirmed before service'],
  ['Mobile maintenance', 'Scheduled diagnostics and minor maintenance requests'],
];

const STEPS = [
  ['01', 'Submit the request', 'Choose the service, share your location, and review the estimated starting price.'],
  ['02', 'Wait for confirmation', 'The request remains pending until an approved Hero or the operations team confirms assignment and timing.'],
  ['03', 'Track the real status', 'Only verified status changes appear. S.O.S. does not show an invented responder, countdown, or GPS position.'],
];

export default function SOSRequestLanding() {
  return (
    <main className="sos-safe">
      <style>{CSS}</style>

      <header className="topbar">
        <a className="brand" href="/" aria-label="S.O.S. home">
          <strong>S.O.S.</strong>
          <span>SUPERHEROES ON STANDBY</span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#services">Services</a>
          <a href="#process">How it works</a>
          <a href="/become-a-hero/">Become a Hero</a>
        </nav>
        <a className="button small" href="/app/">Request Help</a>
      </header>

      <section className="emergency" role="note">
        <strong>Life-threatening emergency?</strong>
        <span>S.O.S. is not 911 and does not replace emergency services.</span>
        <a href="tel:911">Call 911</a>
      </section>

      <section className="hero">
        <div className="signal" aria-hidden="true">
          <span className="ring one" />
          <span className="ring two" />
          <span className="ring three" />
          <span className="core">SOS</span>
        </div>

        <div className="hero-copy">
          <div className="eyebrow"><i /> ATLANTA ROADSIDE REQUEST INTAKE</div>
          <h1>Request roadside help.<br /><em>See the real status.</em></h1>
          <p>
            Submit the service you need, your location, and the vehicle situation. Your request is logged securely and remains <strong>pending assignment</strong> until an approved Hero or the operations team confirms it.
          </p>
          <div className="actions">
            <a className="button primary" href="/app/">Submit a Roadside Request</a>
            <a className="button ghost" href="/become-a-hero/">Apply as a Hero</a>
          </div>
          <div className="truth-row">
            <span>Upfront starting estimate</span>
            <span>Verified assignment status</span>
            <span>No fake countdowns</span>
          </div>
        </div>
      </section>

      <section className="status-panel" aria-label="Current service model">
        <div>
          <small>CURRENT SERVICE MODEL</small>
          <h2>Request intake is open.</h2>
        </div>
        <p>
          Submitting a request does not mean a Hero has accepted it. Assignment, arrival timing, final price, and payment are confirmed after an operator or approved provider reviews the request.
        </p>
      </section>

      <section className="services" id="services">
        <div className="section-head">
          <small>REQUEST CATEGORIES</small>
          <h2>Start with what went wrong.</h2>
          <p>Final availability and timing are confirmed after assignment.</p>
        </div>
        <div className="service-grid">
          {SERVICES.map(([title, description], index) => (
            <a className="service" href="/app/" key={title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div><h3>{title}</h3><p>{description}</p></div>
              <b aria-hidden="true">↗</b>
            </a>
          ))}
        </div>
      </section>

      <section className="process" id="process">
        <div className="section-head light">
          <small>HOW IT WORKS</small>
          <h2>Three honest stages.</h2>
          <p>The interface reflects the database state instead of simulating fulfillment.</p>
        </div>
        <div className="steps">
          {STEPS.map(([number, title, description]) => (
            <article key={number}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="hero-network">
        <div>
          <small>PROVIDER NETWORK</small>
          <h2>Have the equipment and experience?</h2>
          <p>Hero access is granted only after a provider application and approval. Creating a customer account does not create or verify a Hero account.</p>
        </div>
        <a className="button green" href="/become-a-hero/">Apply to Join the Network</a>
      </section>

      <section className="close">
        <small>NEED ROADSIDE SUPPORT?</small>
        <h2>Log the request. Keep other safe options open until assignment is confirmed.</h2>
        <div className="actions center">
          <a className="button primary" href="/app/">Open S.O.S.</a>
          <a className="button ghost" href="tel:911">Emergency: Call 911</a>
        </div>
      </section>

      <footer>
        <div className="brand foot"><strong>S.O.S.</strong><span>SUPERHEROES ON STANDBY</span></div>
        <div><a href="/legal/">Safety &amp; Legal</a><a href="/privacy/">Privacy</a><a href="/become-a-hero/">Provider Application</a></div>
        <p>© 2026 The Kollective Hospitality Group. S.O.S. is not an emergency service.</p>
      </footer>
    </main>
  );
}

const CSS = `
:root{--ink:#070b12;--panel:#0d1420;--panel2:#111c2b;--orange:#ff6b35;--cream:#f5f0e8;--muted:#9ba7b6;--green:#32d583}
*{box-sizing:border-box}.sos-safe{min-height:100vh;background:var(--ink);color:var(--cream);font-family:'DM Sans',Arial,sans-serif;overflow:hidden}.topbar{height:82px;display:flex;align-items:center;justify-content:space-between;padding:0 clamp(22px,5vw,76px);border-bottom:1px solid rgba(255,255,255,.09);position:relative;z-index:4;background:rgba(7,11,18,.94)}.brand{display:flex;flex-direction:column;color:inherit;text-decoration:none;line-height:1}.brand strong{font-size:26px;letter-spacing:-1px}.brand span{font-size:8px;letter-spacing:2.3px;color:var(--orange);margin-top:5px;font-weight:700}.topbar nav{display:flex;gap:30px}.topbar nav a,footer a{color:#c7d0dc;text-decoration:none;font-size:13px}.topbar nav a:hover,footer a:hover{color:#fff}.button{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;border-radius:999px;font-size:13px;font-weight:800;letter-spacing:.35px;min-height:52px;padding:0 24px;border:1px solid rgba(255,255,255,.18);color:white;transition:.2s ease}.button:hover{transform:translateY(-2px);border-color:rgba(255,255,255,.4)}.button.small{min-height:42px;background:var(--orange);border-color:var(--orange);padding:0 20px}.button.primary{background:var(--orange);border-color:var(--orange);box-shadow:0 16px 44px rgba(255,107,53,.22)}.button.ghost{background:rgba(255,255,255,.03)}.button.green{background:var(--green);border-color:var(--green);color:#06120c}.emergency{display:flex;gap:15px;align-items:center;justify-content:center;padding:10px 24px;background:#2a1111;border-bottom:1px solid rgba(255,107,53,.28);font-size:12px;color:#e8c5bd}.emergency strong{color:white}.emergency a{color:white;font-weight:800}.hero{min-height:720px;display:grid;grid-template-columns:1.15fr .85fr;align-items:center;position:relative;padding:80px clamp(24px,8vw,130px);background:radial-gradient(circle at 74% 48%,rgba(255,107,53,.15),transparent 29%),linear-gradient(145deg,#070b12 15%,#101a28)}.hero-copy{max-width:780px;position:relative;z-index:2}.eyebrow,.section-head small,.hero-network small,.close small,.status-panel small{font-size:10px;letter-spacing:2.5px;font-weight:800;color:var(--orange)}.eyebrow{display:flex;align-items:center;gap:10px}.eyebrow i{width:7px;height:7px;border-radius:50%;background:var(--green);box-shadow:0 0 0 7px rgba(50,213,131,.1)}h1{font-family:'Barlow Condensed',Arial,sans-serif;font-size:clamp(62px,8vw,118px);line-height:.84;letter-spacing:-3px;margin:28px 0;text-transform:uppercase}h1 em{font-style:normal;color:transparent;-webkit-text-stroke:1px rgba(245,240,232,.55)}.hero-copy>p{max-width:680px;font-size:17px;line-height:1.75;color:#bac4d1}.hero-copy p strong{color:white}.actions{display:flex;gap:12px;margin-top:32px;flex-wrap:wrap}.truth-row{display:flex;gap:24px;flex-wrap:wrap;margin-top:30px;color:#9eabb9;font-size:11px}.truth-row span:before{content:'✓';color:var(--green);margin-right:8px;font-weight:900}.signal{width:min(35vw,440px);aspect-ratio:1;border-radius:50%;position:relative;justify-self:center;display:grid;place-items:center}.ring{position:absolute;border-radius:50%;border:1px solid rgba(255,107,53,.24);animation:pulse 3.3s infinite}.ring.one{inset:5%}.ring.two{inset:20%;animation-delay:.45s}.ring.three{inset:35%;animation-delay:.9s}.core{width:112px;height:112px;border-radius:50%;display:grid;place-items:center;background:var(--orange);font-family:'Barlow Condensed',sans-serif;font-size:38px;font-weight:900;box-shadow:0 0 70px rgba(255,107,53,.45)}@keyframes pulse{50%{transform:scale(1.035);opacity:.45}}.status-panel{margin:-55px clamp(24px,8vw,130px) 0;position:relative;z-index:3;background:#f1ece4;color:#111820;padding:34px 40px;border-radius:20px;display:grid;grid-template-columns:.7fr 1.3fr;gap:50px;box-shadow:0 32px 80px rgba(0,0,0,.32)}.status-panel h2{font-size:30px;margin:8px 0 0}.status-panel p{line-height:1.7;color:#46515e;margin:0}.services{padding:130px clamp(24px,8vw,130px)}.section-head{max-width:650px;margin-bottom:50px}.section-head h2,.hero-network h2,.close h2{font-family:'Barlow Condensed',sans-serif;font-size:clamp(46px,5vw,72px);line-height:.95;text-transform:uppercase;margin:14px 0 16px}.section-head p,.hero-network p{color:var(--muted);line-height:1.7}.service-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));border-top:1px solid rgba(255,255,255,.12)}.service{color:inherit;text-decoration:none;display:grid;grid-template-columns:48px 1fr 26px;gap:14px;align-items:center;padding:28px 18px;border-bottom:1px solid rgba(255,255,255,.12);transition:.2s}.service:nth-child(odd){border-right:1px solid rgba(255,255,255,.12)}.service:hover{background:rgba(255,255,255,.035)}.service>span{color:var(--orange);font-size:11px;font-weight:800}.service h3{margin:0 0 7px;font-size:18px}.service p{margin:0;color:var(--muted);font-size:13px;line-height:1.5}.service b{color:var(--orange)}.process{padding:110px clamp(24px,8vw,130px);background:#eae5dd;color:#131a22}.section-head.light p{color:#5e6873}.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:#c8c2b9}.steps article{background:#f5f0e8;padding:38px;min-height:260px}.steps article>span{font-size:11px;color:#d95c30;font-weight:900}.steps h3{font-size:24px;margin:54px 0 14px}.steps p{line-height:1.7;color:#5b6570;font-size:14px}.hero-network{display:flex;align-items:center;justify-content:space-between;gap:50px;padding:100px clamp(24px,8vw,130px);background:radial-gradient(circle at 85% 50%,rgba(50,213,131,.14),transparent 30%),#08120e}.hero-network>div{max-width:780px}.hero-network h2{font-size:clamp(42px,5vw,68px)}.close{text-align:center;padding:130px 24px;background:radial-gradient(circle at 50% 100%,rgba(255,107,53,.16),transparent 38%),#070b12}.close h2{max-width:950px;margin:18px auto 34px;font-size:clamp(46px,6vw,82px)}.actions.center{justify-content:center}footer{padding:42px clamp(24px,8vw,130px);border-top:1px solid rgba(255,255,255,.09);display:grid;grid-template-columns:1fr auto;align-items:center;gap:24px}footer>div:nth-child(2){display:flex;gap:22px}footer p{grid-column:1/-1;color:#6f7c8d;font-size:11px;margin:0}.foot strong{font-size:23px}
@media(max-width:900px){.topbar nav{display:none}.hero{grid-template-columns:1fr;padding-top:70px;min-height:auto}.signal{grid-row:1;width:260px;margin-bottom:50px}.hero-copy{grid-row:2}.status-panel{grid-template-columns:1fr;gap:14px;margin-top:0}.service-grid{grid-template-columns:1fr}.service:nth-child(odd){border-right:0}.steps{grid-template-columns:1fr}.hero-network{align-items:flex-start;flex-direction:column}footer{grid-template-columns:1fr}footer>div:nth-child(2){flex-wrap:wrap}}@media(max-width:560px){.topbar{height:70px;padding:0 18px}.brand strong{font-size:22px}.button.small{padding:0 14px;font-size:11px}.emergency{align-items:flex-start;flex-wrap:wrap;justify-content:flex-start}.hero{padding:48px 20px 70px}.signal{width:210px;margin-bottom:38px}h1{font-size:62px;letter-spacing:-2px}.hero-copy>p{font-size:15px}.actions .button{width:100%}.truth-row{gap:12px;flex-direction:column}.status-panel{margin:0 16px;padding:28px 24px}.services,.process,.hero-network{padding:84px 20px}.service{grid-template-columns:36px 1fr 18px;padding:24px 4px}.steps article{padding:30px;min-height:230px}.close{padding:90px 20px}footer{padding:34px 20px}.foot{display:none}}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;animation:none!important;transition:none!important}}
`;
