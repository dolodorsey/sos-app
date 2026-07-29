'use client';
import React,{useEffect,useRef,useState}from'react';

/* ═══════════════════════════════════════════════════════════
   S.O.S — SUPERHEROES ON STANDBY
   Landing / Front Door — "Rescue Noir"
   Signature interaction: the dispatch beacon (radar sweep)
   ═══════════════════════════════════════════════════════════ */

const APP='/app/';
const HERO_APPLY='/become-a-hero/';
const DOWNLOAD='/download/';

const QUICK=[
  {name:'Flat Tire',emoji:'\u{1F6DE}',price:55,eta:'5-10 min',desc:'Spare install or patch'},
  {name:'Jump Start',emoji:'\u{1F50B}',price:45,eta:'5-10 min',desc:'Battery boost on site'},
  {name:'Lockout',emoji:'\u{1F511}',price:50,eta:'5-10 min',desc:'Non-destructive unlock'},
  {name:'Towing',emoji:'\u{1F69B}',price:75,eta:'5-10 min',desc:'Secure tow, your call'},
  {name:'Fuel',emoji:'⛽',price:55,eta:'5-10 min',desc:'Gas, diesel or EV'},
  {name:'Battery',emoji:'\u{1F50B}',price:95,eta:'10-20 min',desc:'Delivered & installed'},
];

const CATS=[
  {n:'Emergency Roadside',c:'#FF6B35',k:8,d:'Tow, tire, jump, battery, fuel, lockout, winch-out, tire concierge.'},
  {n:'Mobile Maintenance',c:'#14b8a6',k:6,d:'Oil, fluids, OBD diagnostics, bulbs, belts, brake pads — at your curb.'},
  {n:'Glass & Body',c:'#3B82F6',k:4,d:'Windshield repair & replacement, paintless dent removal, scratch buff.'},
  {n:'Car Wash & Detailing',c:'#8b5cf6',k:5,d:'Express wash, interior deep clean, full detail, ceramic, sanitization.'},
  {n:'Convenience Add-Ons',c:'#f59e0b',k:5,d:'Errand runs, accessory installs, safety kits, wipers, key & fob support.'},
  {n:'Fleet Services',c:'#06b6d4',k:4,d:'Priority fleet response, bulk fuel, multi-vehicle wash, DOT inspections.'},
  {n:'Seasonal & Specialty',c:'#f43f5e',k:4,d:'Winter and summer prep, seasonal tire swaps, post-storm cleanup.'},
  {n:'Premium Concierge',c:'#D4A853',k:4,d:'Valet fuel + wash, pickup/return mechanic, rim upgrades, VIP priority.'},
];

const STEPS=[
  {n:'01',t:'Tap',d:'Open SOS, pick what went wrong. Price and ETA are on screen before you confirm. No hold music, no call center, no surprise invoice.'},
  {n:'02',t:'Track',d:'Your GPS goes out to verified Heroes nearby. You watch your Hero move toward you in real time — the same way you track a ride.'},
  {n:'03',t:'Done',d:'Hero arrives, handles it, you pay in app at the price you already agreed to. Every mission logged to your history.'},
];

const STATS=[
  {k:'40+',v:'Services on demand'},
  {k:'8',v:'Service categories'},
  {k:'~8 min',v:'Target dispatch window'},
  {k:'24/7',v:'Standby, every night'},
];

/* ── grain overlay ── */
const GRAIN="url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='0.42'/%3E%3C/svg%3E\")";

function useReveal(){
  useEffect(()=>{
    const els=document.querySelectorAll('[data-rv]');
    if(!('IntersectionObserver'in window)){els.forEach(e=>e.classList.add('rv-in'));return;}
    const io=new IntersectionObserver(entries=>{
      entries.forEach(en=>{if(en.isIntersecting){en.target.classList.add('rv-in');io.unobserve(en.target);}});
    },{threshold:0.12,rootMargin:'0px 0px -8% 0px'});
    els.forEach(e=>io.observe(e));
    return()=>io.disconnect();
  },[]);
}

export default function SOSLanding(){
  const[scrolled,setScrolled]=useState(false);
  const[open,setOpen]=useState(0);
  const beacon=useRef(null);
  useReveal();

  // Native app (Capacitor) should never see the marketing page
  useEffect(()=>{
    try{
      const w=window;
      if(w.Capacitor&&typeof w.Capacitor.isNativePlatform==='function'&&w.Capacitor.isNativePlatform()){
        w.location.replace(APP);
      }
    }catch(e){}
  },[]);

  useEffect(()=>{
    const on=()=>setScrolled(window.scrollY>60);
    on();window.addEventListener('scroll',on,{passive:true});
    return()=>window.removeEventListener('scroll',on);
  },[]);

  // beacon parallax — the one dominant interaction
  useEffect(()=>{
    if(window.matchMedia&&window.matchMedia('(pointer: coarse)').matches)return;
    let raf=0,tx=0,ty=0,cx=0,cy=0;
    const move=e=>{
      tx=(e.clientX/window.innerWidth-0.5)*28;
      ty=(e.clientY/window.innerHeight-0.5)*28;
      if(!raf)raf=requestAnimationFrame(loop);
    };
    const loop=()=>{
      cx+=(tx-cx)*0.06;cy+=(ty-cy)*0.06;
      if(beacon.current)beacon.current.style.transform=`translate3d(${cx}px,${cy}px,0)`;
      raf=Math.abs(tx-cx)>0.1||Math.abs(ty-cy)>0.1?requestAnimationFrame(loop):0;
    };
    window.addEventListener('mousemove',move,{passive:true});
    return()=>{window.removeEventListener('mousemove',move);if(raf)cancelAnimationFrame(raf);};
  },[]);

  return(
  <div className="sos">
    <style dangerouslySetInnerHTML={{__html:CSS}}/>
    <div className="grain" aria-hidden="true"/>

    {/* ── STICKY HEADER ── */}
    <header className={'hdr'+(scrolled?' hdr-on':'')}>
      <a href="/" className="mark" aria-label="SOS home">
        <span className="mark-s">S.O.S</span>
        <span className="mark-sub">SUPERHEROES ON STANDBY</span>
      </a>
      <nav className="hdr-nav">
        <a href="#services">Services</a>
        <a href="#how">How it works</a>
        <a href={HERO_APPLY}>Become a Hero</a>
      </nav>
      <a href={APP} className="btn btn-sm">Get Help</a>
    </header>

    {/* ═══ 01 · HERO ═══ */}
    <section className="hero">
      <div className="beacon-wrap" ref={beacon} aria-hidden="true">
        <div className="beacon">
          <span className="ring r1"/><span className="ring r2"/><span className="ring r3"/>
          <span className="sweep"/>
          <span className="core"/>
        </div>
      </div>
      <div className="hero-inner">
        <div className="eyebrow" data-rv style={{'--d':'0s'}}>
          <span className="dot"/> ATLANTA &amp; METRO &nbsp;·&nbsp; DISPATCHING 24/7
        </div>
        <h1 className="h1" data-rv style={{'--d':'.06s'}}>
          <span className="l1">SUPERHEROES</span>
          <span className="l2">ON STANDBY</span>
        </h1>
        <p className="lede" data-rv style={{'--d':'.14s'}}>
          Flat on the shoulder of 285. Dead battery in a deck at midnight. Keys locked in with the engine running.
          Verified Heroes dispatched to your GPS in minutes — price and ETA on screen before you confirm.
        </p>
        <div className="cta-row" data-rv style={{'--d':'.2s'}}>
          <a href={APP} className="btn btn-lg">
            <span className="pulse-dot"/> GET HELP NOW
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h13M12 5l7 7-7 7"/></svg>
          </a>
          <a href={HERO_APPLY} className="btn btn-ghost btn-lg">BECOME A HERO</a>
        </div>
        <div className="live" data-rv style={{'--d':'.26s'}}>
          <span className="live-dot"/> Heroes on standby now
          <span className="sep"/> Upfront pricing
          <span className="sep"/> Live mission tracking
        </div>
      </div>
      <div className="scroll-cue" aria-hidden="true"><span/>SCROLL</div>
    </section>

    {/* ═══ 02 · QUICK HELP RAIL ═══ */}
    <section className="rail-sec">
      <div className="sec-label" data-rv>WHAT WENT WRONG?</div>
      <div className="rail">
        {QUICK.map((q,i)=>(
          <a key={q.name} href={APP} className="q" data-rv style={{'--d':(i*0.05)+'s'}}>
            <div className="q-emoji" aria-hidden="true">{q.emoji}</div>
            <div className="q-name">{q.name}</div>
            <div className="q-desc">{q.desc}</div>
            <div className="q-meta"><span className="q-price">${q.price}</span><span className="q-eta">{q.eta}</span></div>
            <div className="q-go">REQUEST →</div>
          </a>
        ))}
      </div>
    </section>

    {/* ═══ 03 · THESIS ═══ */}
    <section className="thesis">
      <div className="th-grid">
        <div className="th-left" data-rv>
          <div className="sec-label">WHY SOS EXISTS</div>
          <h2 className="h2">
            Roadside assistance was built for<br/>
            <em>insurance companies.</em><br/>
            Not for the person on the shoulder.
          </h2>
        </div>
        <div className="th-right">
          <p data-rv style={{'--d':'.06s'}}>
            You call a 1-800 number. You sit on hold. Someone reads a script, quotes you nothing,
            and tells you a truck will be there in ninety minutes — maybe. You wait in the dark
            next to traffic with no name, no ETA you can trust, and no idea what it will cost.
          </p>
          <p data-rv style={{'--d':'.12s'}}>
            S.O.S. flips it. One button. Your location goes out to verified Heroes already near you.
            You see the price before you confirm and you watch them come to you on the map.
            Forty-plus services across eight categories — because the thing that stops your night
            isn't always a tow.
          </p>
          <div className="th-marks" data-rv style={{'--d':'.18s'}}>
            <div><strong>Verified Heroes</strong><span>Background-checked, rated, tracked</span></div>
            <div><strong>Upfront price</strong><span>Quoted before you confirm</span></div>
            <div><strong>Live tracking</strong><span>Watch your Hero approach</span></div>
          </div>
        </div>
      </div>
    </section>

    {/* ═══ 04 · SERVICE MATRIX ═══ */}
    <section className="services" id="services">
      <div className="sec-head" data-rv>
        <div className="sec-label">THE FULL BOARD</div>
        <h2 className="h2">Eight categories.<br/>Forty-plus services.</h2>
        <p className="sec-sub">Every one dispatched to wherever you're standing.</p>
      </div>
      <div className="cat-list">
        {CATS.map((c,i)=>(
          <button key={c.n} className={'cat'+(open===i?' cat-on':'')} onClick={()=>setOpen(open===i?-1:i)} data-rv style={{'--d':(i*0.04)+'s','--c':c.c}}>
            <span className="cat-idx">{String(i+1).padStart(2,'0')}</span>
            <span className="cat-name">{c.n}</span>
            <span className="cat-k">{c.k} services</span>
            <span className="cat-plus" aria-hidden="true"/>
            <span className="cat-body"><span className="cat-desc">{c.d}</span></span>
          </button>
        ))}
      </div>
      <a href={APP} className="btn btn-lg cat-cta" data-rv>OPEN THE FULL SERVICE BOARD →</a>
    </section>

    {/* ═══ 05 · HOW IT WORKS ═══ */}
    <section className="how" id="how">
      <div className="sec-head" data-rv>
        <div className="sec-label">HOW IT WORKS</div>
        <h2 className="h2">Three taps between<br/>stranded and handled.</h2>
      </div>
      <div className="steps">
        {STEPS.map((s,i)=>(
          <div key={s.n} className="step" data-rv style={{'--d':(i*0.08)+'s'}}>
            <div className="step-n">{s.n}</div>
            <div className="step-t">{s.t}</div>
            <p className="step-d">{s.d}</p>
          </div>
        ))}
      </div>
    </section>

    {/* ═══ 06 · PROOF BAND ═══ */}
    <section className="stats">
      {STATS.map((s,i)=>(
        <div key={s.k} className="stat" data-rv style={{'--d':(i*0.06)+'s'}}>
          <div className="stat-k">{s.k}</div>
          <div className="stat-v">{s.v}</div>
        </div>
      ))}
    </section>

    {/* ═══ 07 · BECOME A HERO ═══ */}
    <section className="heroes">
      <div className="heroes-inner">
        <div className="sec-label green" data-rv>DRIVE FOR SOS</div>
        <h2 className="h2" data-rv style={{'--d':'.06s'}}>
          You have the truck.<br/>We bring the missions.
        </h2>
        <p className="heroes-p" data-rv style={{'--d':'.12s'}}>
          Tow operators, mobile mechanics, detailers, tire techs — SOS routes paying missions to you
          based on where you already are. Set your own standby hours. Get dispatched, get rated, get paid.
          Apply once, get verified, start taking missions.
        </p>
        <div className="cta-row" data-rv style={{'--d':'.18s'}}>
          <a href={HERO_APPLY} className="btn btn-lg btn-green">APPLY AS A HERO</a>
          <a href="/hero/" className="btn btn-ghost btn-lg">HERO PORTAL LOGIN</a>
        </div>
      </div>
    </section>

    {/* ═══ 08 · CLOSE ═══ */}
    <section className="close">
      <div className="close-mark" data-rv>S.O.S</div>
      <h2 className="close-h" data-rv style={{'--d':'.06s'}}>Help is one button away.</h2>
      <div className="cta-row center" data-rv style={{'--d':'.12s'}}>
        <a href={APP} className="btn btn-lg"><span className="pulse-dot"/> GET HELP NOW</a>
        <a href={DOWNLOAD} className="btn btn-ghost btn-lg">GET THE APP</a>
      </div>
      <p className="not911" data-rv style={{'--d':'.18s'}}>
        S.O.S. is a roadside assistance service — <strong>it is not a substitute for 911</strong>.
        If there are injuries, fire, or immediate danger, call 911 first.
      </p>
    </section>

    <footer className="ftr">
      <div className="ftr-cols">
        <div>
          <div className="ftr-mark">S.O.S</div>
          <div className="ftr-sub">SUPERHEROES ON STANDBY</div>
        </div>
        <div>
          <span className="ftr-h">Get Help</span>
          <a href={APP}>Request roadside help</a>
          <a href="/track/">Track a mission</a>
          <a href="/support/">Support</a>
        </div>
        <div>
          <span className="ftr-h">Heroes</span>
          <a href={HERO_APPLY}>Apply as a Hero</a>
          <a href="/hero/">Hero portal</a>
          <a href="/connect/">Partner with us</a>
        </div>
        <div>
          <span className="ftr-h">Company</span>
          <a href={DOWNLOAD}>Download the app</a>
          <a href="/privacy/">Privacy</a>
          <a href="/legal/">Not a 911 service</a>
        </div>
      </div>
      <div className="ftr-btm">
        <span>© {new Date().getFullYear()} S.O.S — Superheroes On Standby. A Kollective Hospitality Group company.</span>
        <span>Not an emergency service. For emergencies dial 911.</span>
      </div>
    </footer>
  </div>);
}

const CSS=`
.sos{
  --bg:#080c14; --bg2:#0b1120; --card:#0d1320; --card2:#111827;
  --acc:#FF6B35; --acc-dk:#E55A2B; --gold:#FFB347; --green:#10B981;
  --tx:#ffffff; --sub:rgba(255,255,255,.72); --mut:rgba(255,255,255,.46); --bd:rgba(255,255,255,.10);
  --ff:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  --fd:'Barlow Condensed','DM Sans',sans-serif;
  --e:cubic-bezier(.16,1,.3,1);
  background:var(--bg); color:var(--tx); font-family:var(--ff);
  min-height:100vh; overflow-x:hidden; position:relative;
  -webkit-font-smoothing:antialiased;
}
.sos *{box-sizing:border-box}
.sos a{color:inherit;text-decoration:none}
.grain{position:fixed;inset:0;background-image:${GRAIN};opacity:.05;pointer-events:none;z-index:9;mix-blend-mode:overlay}

[data-rv]{opacity:0;transform:translateY(38px);transition:opacity .8s var(--e) var(--d,0s),transform .8s var(--e) var(--d,0s)}
[data-rv].rv-in{opacity:1;transform:none}
@media (prefers-reduced-motion:reduce){[data-rv]{opacity:1;transform:none;transition:none}}

/* ── buttons ── */
.btn{display:inline-flex;align-items:center;gap:10px;font-family:var(--ff);font-weight:700;
  background:linear-gradient(135deg,var(--acc),var(--acc-dk));color:#fff;border:none;cursor:pointer;
  padding:14px 24px;border-radius:14px;font-size:14px;letter-spacing:.02em;
  transition:transform .18s var(--e),box-shadow .18s var(--e),filter .18s var(--e);
  box-shadow:0 8px 30px -12px rgba(255,107,53,.7)}
.btn:hover{transform:translateY(-2px);box-shadow:0 16px 40px -12px rgba(255,107,53,.85);filter:brightness(1.06)}
.btn-lg{padding:19px 34px;font-size:15px;border-radius:16px}
.btn-sm{padding:11px 20px;font-size:13px;border-radius:12px}
.btn-ghost{background:transparent;border:1px solid var(--bd);box-shadow:none;color:var(--sub)}
.btn-ghost:hover{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.28);color:#fff;box-shadow:none}
.btn-green{background:linear-gradient(135deg,var(--green),#059669);box-shadow:0 8px 30px -12px rgba(16,185,129,.7)}
.btn-green:hover{box-shadow:0 16px 40px -12px rgba(16,185,129,.85)}
.pulse-dot{width:8px;height:8px;border-radius:50%;background:#fff;box-shadow:0 0 0 0 rgba(255,255,255,.7);animation:pd 1.9s infinite}
@keyframes pd{0%{box-shadow:0 0 0 0 rgba(255,255,255,.65)}70%{box-shadow:0 0 0 11px rgba(255,255,255,0)}100%{box-shadow:0 0 0 0 rgba(255,255,255,0)}}

/* ── header ── */
.hdr{position:fixed;top:0;left:0;right:0;z-index:60;display:flex;align-items:center;justify-content:space-between;
  gap:24px;padding:18px clamp(20px,5vw,64px);transition:background .4s var(--e),border-color .4s var(--e),padding .4s var(--e);
  border-bottom:1px solid transparent}
.hdr-on{background:rgba(8,12,20,.82);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);
  border-bottom-color:var(--bd);padding-top:12px;padding-bottom:12px}
.mark{display:flex;flex-direction:column;line-height:1}
.mark-s{font-family:var(--fd);font-weight:800;font-size:22px;letter-spacing:.06em}
.mark-sub{font-size:7.5px;letter-spacing:.34em;color:var(--acc);font-weight:700;margin-top:3px}
.hdr-nav{display:flex;gap:32px;font-size:13px;color:var(--mut);font-weight:500}
.hdr-nav a{transition:color .2s}
.hdr-nav a:hover{color:#fff}
@media(max-width:900px){.hdr-nav{display:none}}

/* ── hero ── */
.hero{position:relative;min-height:100svh;display:flex;align-items:center;
  padding:124px clamp(20px,5vw,64px) 96px;overflow:hidden;
  background:
    radial-gradient(120% 80% at 78% 40%,rgba(255,107,53,.16),transparent 60%),
    radial-gradient(90% 70% at 10% 90%,rgba(59,130,246,.10),transparent 62%),
    linear-gradient(180deg,#070a11 0%,var(--bg) 55%,#070a11 100%)}
.hero-inner{position:relative;z-index:3;max-width:min(880px,62vw)}
@media(max-width:1080px){.hero-inner{max-width:100%}}
.eyebrow{display:inline-flex;align-items:center;gap:10px;font-size:10.5px;letter-spacing:.32em;font-weight:700;
  color:var(--mut);border:1px solid var(--bd);border-radius:999px;padding:9px 18px;margin-bottom:26px;background:rgba(255,255,255,.02)}
.dot{width:6px;height:6px;border-radius:50%;background:var(--acc);animation:pd2 2s infinite}
@keyframes pd2{0%,100%{opacity:1}50%{opacity:.25}}
.h1{margin:0;font-family:var(--fd);font-weight:800;line-height:.86;letter-spacing:-.015em;text-transform:uppercase}
.h1 .l1,.h1 .l2{display:block;font-size:clamp(48px,9.4vw,138px)}
.h1 .l2{color:transparent;-webkit-text-stroke:1.6px var(--acc);text-stroke:1.6px var(--acc);padding-left:.06em}
@supports not ((-webkit-text-stroke:1px red)){.h1 .l2{color:var(--acc)}}
.lede{max-width:610px;margin:26px 0 0;font-size:clamp(14.5px,1.4vw,17.5px);line-height:1.6;color:var(--sub)}
.cta-row{display:flex;flex-wrap:wrap;gap:14px;margin-top:32px}
.cta-row.center{justify-content:center}
.live{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-top:28px;font-size:11.5px;letter-spacing:.16em;
  text-transform:uppercase;color:var(--mut);font-weight:600}
.live-dot{width:7px;height:7px;border-radius:50%;background:var(--green);box-shadow:0 0 12px var(--green)}
.sep{width:4px;height:4px;border-radius:50%;background:rgba(255,255,255,.22)}

/* beacon */
.beacon-wrap{position:absolute;top:50%;right:-6vw;transform:translateY(-50%);z-index:1;pointer-events:none;
  width:min(760px,62vw);aspect-ratio:1;display:grid;place-items:center;opacity:.9}
@media(max-width:1080px){.beacon-wrap{right:-32vw;opacity:.4;width:110vw}}
.beacon{position:relative;width:100%;height:100%;display:grid;place-items:center}
.ring{position:absolute;border-radius:50%;border:1px solid rgba(255,107,53,.34);width:26%;height:26%;
  animation:rp 4.6s var(--e) infinite}
.ring.r2{animation-delay:1.53s}
.ring.r3{animation-delay:3.06s}
@keyframes rp{0%{transform:scale(1);opacity:0}12%{opacity:.85}100%{transform:scale(3.85);opacity:0}}
.core{width:16px;height:16px;border-radius:50%;background:var(--acc);box-shadow:0 0 44px 10px rgba(255,107,53,.6)}
.sweep{position:absolute;width:52%;height:52%;border-radius:50%;
  background:conic-gradient(from 0deg,rgba(255,107,53,.30),rgba(255,107,53,0) 34%);
  animation:sw 5.5s linear infinite;filter:blur(2px)}
@keyframes sw{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.ring,.sweep,.pulse-dot,.dot{animation:none}}

.scroll-cue{position:absolute;bottom:34px;left:clamp(20px,5vw,64px);display:flex;align-items:center;gap:12px;
  font-size:9.5px;letter-spacing:.36em;color:rgba(255,255,255,.32);font-weight:700;z-index:3}
.scroll-cue span{display:block;width:46px;height:1px;background:linear-gradient(90deg,var(--acc),transparent)}

/* ── section shells ── */
.sec-label{font-size:10px;letter-spacing:.38em;font-weight:800;color:var(--acc);margin-bottom:20px}
.sec-label.green{color:var(--green)}
.h2{font-family:var(--fd);font-weight:700;text-transform:uppercase;line-height:1;letter-spacing:-.005em;
  font-size:clamp(31px,4.4vw,60px);margin:0}
.h2 em{font-style:normal;color:var(--acc)}
.sec-head{max-width:820px;margin-bottom:56px}
.sec-sub{margin:22px 0 0;font-size:16px;color:var(--mut);line-height:1.6;max-width:520px}

/* ── quick rail ── */
.rail-sec{padding:clamp(64px,7vw,96px) clamp(20px,5vw,64px);background:var(--bg)}
.rail{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:14px}
@media(max-width:1180px){.rail{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:720px){.rail{grid-template-columns:repeat(2,minmax(0,1fr))}}
.q{position:relative;display:flex;flex-direction:column;padding:26px 22px 22px;border-radius:20px;
  background:linear-gradient(180deg,var(--card),#0a0f1a);border:1px solid var(--bd);overflow:hidden;
  transition:transform .35s var(--e),border-color .35s var(--e),background .35s var(--e)}
.q:before{content:'';position:absolute;inset:0;background:radial-gradient(90% 70% at 50% 0%,rgba(255,107,53,.16),transparent 65%);
  opacity:0;transition:opacity .35s var(--e)}
.q:hover{transform:translateY(-6px);border-color:rgba(255,107,53,.45)}
.q:hover:before{opacity:1}
.q-emoji{font-size:26px;margin-bottom:16px;position:relative}
.q-name{font-family:var(--fd);font-size:25px;font-weight:700;text-transform:uppercase;letter-spacing:.01em;position:relative}
.q-desc{font-size:12.5px;color:var(--mut);margin-top:6px;line-height:1.5;position:relative;flex:1}
.q-meta{display:flex;align-items:baseline;gap:10px;margin-top:20px;position:relative}
.q-price{font-family:var(--fd);font-size:30px;font-weight:800;color:var(--acc);line-height:1}
.q-eta{font-size:11px;letter-spacing:.14em;color:var(--mut);text-transform:uppercase;font-weight:600}
.q-go{margin-top:14px;font-size:10.5px;letter-spacing:.26em;font-weight:800;color:rgba(255,255,255,.34);position:relative;
  transition:color .3s var(--e)}
.q:hover .q-go{color:var(--acc)}

/* ── thesis ── */
.thesis{padding:clamp(72px,8vw,120px) clamp(20px,5vw,64px);background:linear-gradient(180deg,var(--bg),#070a11)}
.th-left .h2{font-size:clamp(29px,3.9vw,54px)}
.th-grid{display:grid;grid-template-columns:minmax(0,7fr) minmax(0,5fr);gap:clamp(32px,6vw,90px);align-items:start}
@media(max-width:980px){.th-grid{grid-template-columns:1fr}}
.th-right p{margin:0 0 22px;font-size:16px;line-height:1.72;color:var(--sub)}
.th-marks{display:flex;flex-direction:column;gap:16px;margin-top:34px;padding-top:28px;border-top:1px solid var(--bd)}
.th-marks div{display:flex;flex-direction:column;gap:3px}
.th-marks strong{font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#fff;font-weight:700}
.th-marks span{font-size:13px;color:var(--mut)}

/* ── services ── */
.services{padding:clamp(80px,10vw,150px) clamp(20px,5vw,64px);background:#070a11}
.cat-list{display:flex;flex-direction:column;border-top:1px solid var(--bd)}
.cat{position:relative;display:grid;grid-template-columns:auto 1fr auto auto;align-items:center;
  column-gap:clamp(14px,3vw,36px);row-gap:0;
  width:100%;text-align:left;background:transparent;border:none;border-bottom:1px solid var(--bd);color:inherit;
  padding:clamp(18px,2.2vw,26px) 4px;cursor:pointer;font-family:var(--ff);transition:padding-left .4s var(--e)}
.cat:hover{padding-left:14px}
.cat:before{content:'';position:absolute;left:0;top:0;bottom:0;width:2px;background:var(--c);transform:scaleY(0);
  transform-origin:bottom;transition:transform .45s var(--e)}
.cat:hover:before,.cat-on:before{transform:scaleY(1)}
.cat-idx{font-family:var(--fd);font-size:12px;font-weight:700;color:rgba(255,255,255,.3);letter-spacing:.1em}
.cat-name{font-family:var(--fd);font-size:clamp(22px,2.9vw,38px);font-weight:700;text-transform:uppercase;
  letter-spacing:-.005em;transition:color .3s var(--e)}
.cat:hover .cat-name,.cat-on .cat-name{color:var(--c)}
.cat-k{font-size:10.5px;letter-spacing:.24em;text-transform:uppercase;color:var(--mut);font-weight:700;white-space:nowrap}
@media(max-width:760px){.cat-k{display:none}}
.cat-plus{position:relative;width:16px;height:16px;flex:none}
.cat-plus:before,.cat-plus:after{content:'';position:absolute;background:rgba(255,255,255,.5);transition:transform .4s var(--e),background .3s}
.cat-plus:before{left:0;top:7.5px;width:16px;height:1.5px}
.cat-plus:after{left:7.5px;top:0;width:1.5px;height:16px}
.cat-on .cat-plus:after{transform:rotate(90deg)}
.cat-on .cat-plus:before,.cat-on .cat-plus:after{background:var(--c)}
.cat-body{grid-column:2/-1;display:grid;grid-template-rows:0fr;transition:grid-template-rows .5s var(--e),opacity .4s var(--e);opacity:0}
.cat-on .cat-body{grid-template-rows:1fr;opacity:1}
.cat-desc{overflow:hidden;font-size:15px;line-height:1.65;color:var(--sub);max-width:640px;display:block}
.cat-on .cat-desc{padding-top:16px}
.cat-cta{margin-top:56px}

/* ── how ── */
.how{padding:clamp(80px,10vw,150px) clamp(20px,5vw,64px);background:linear-gradient(180deg,#070a11,var(--bg))}
.steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:clamp(24px,4vw,56px)}
.step{position:relative;padding-top:28px;border-top:2px solid var(--acc)}
.step-n{font-family:var(--fd);font-size:13px;font-weight:800;letter-spacing:.2em;color:var(--acc)}
.step-t{font-family:var(--fd);font-size:clamp(30px,4vw,52px);font-weight:700;text-transform:uppercase;margin:10px 0 14px;line-height:1}
.step-d{margin:0;font-size:15px;line-height:1.7;color:var(--mut)}

/* ── stats ── */
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1px;background:var(--bd);
  border-top:1px solid var(--bd);border-bottom:1px solid var(--bd)}
.stat{background:var(--bg);padding:clamp(36px,5vw,64px) clamp(20px,3vw,40px);text-align:center}
.stat-k{font-family:var(--fd);font-size:clamp(38px,5.5vw,72px);font-weight:800;line-height:1;
  background:linear-gradient(135deg,#fff 20%,var(--acc));-webkit-background-clip:text;background-clip:text;color:transparent}
.stat-v{margin-top:12px;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--mut);font-weight:600}

/* ── heroes ── */
.heroes{padding:clamp(90px,11vw,160px) clamp(20px,5vw,64px);
  background:radial-gradient(90% 100% at 20% 0%,rgba(16,185,129,.13),transparent 62%),var(--bg)}
.heroes-inner{max-width:820px}
.heroes-p{margin:26px 0 0;font-size:16.5px;line-height:1.7;color:var(--sub);max-width:660px}

/* ── close ── */
.close{padding:clamp(90px,12vw,170px) clamp(20px,5vw,64px);text-align:center;
  background:radial-gradient(80% 90% at 50% 100%,rgba(255,107,53,.20),transparent 65%),#070a11}
.close-mark{font-family:var(--fd);font-weight:800;font-size:clamp(72px,17vw,240px);line-height:.85;letter-spacing:.02em;
  color:transparent;-webkit-text-stroke:1.4px rgba(255,255,255,.26);text-stroke:1.4px rgba(255,255,255,.26)}
.close-h{font-family:var(--fd);font-weight:700;text-transform:uppercase;font-size:clamp(30px,5vw,66px);margin:22px 0 40px;line-height:1}
.not911{margin:46px auto 0;max-width:620px;font-size:12.5px;line-height:1.7;color:var(--mut)}
.not911 strong{color:#fff}

/* ── footer ── */
.ftr{padding:clamp(56px,7vw,90px) clamp(20px,5vw,64px) 36px;background:#050810;border-top:1px solid var(--bd)}
.ftr-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:40px}
.ftr-cols>div{display:flex;flex-direction:column;gap:11px}
.ftr-mark{font-family:var(--fd);font-weight:800;font-size:28px;letter-spacing:.06em}
.ftr-sub{font-size:8px;letter-spacing:.32em;color:var(--acc);font-weight:700}
.ftr-h{font-size:10px;letter-spacing:.26em;text-transform:uppercase;color:rgba(255,255,255,.4);font-weight:800;margin-bottom:4px}
.ftr-cols a{font-size:14px;color:var(--sub);transition:color .2s}
.ftr-cols a:hover{color:var(--acc)}
.ftr-btm{display:flex;flex-wrap:wrap;justify-content:space-between;gap:14px;margin-top:56px;padding-top:26px;
  border-top:1px solid var(--bd);font-size:11.5px;color:rgba(255,255,255,.32)}

/* ── mobile pass ── */
@media(max-width:560px){
  .eyebrow{font-size:9px;letter-spacing:.2em;padding:8px 14px;margin-bottom:22px}
  .live{gap:9px;font-size:9.5px;letter-spacing:.12em}
  .hero{padding-top:112px;padding-bottom:72px;min-height:92svh}
  .btn-lg{padding:17px 26px;font-size:14px;width:100%;justify-content:center}
  .cta-row{gap:11px}
  .h1 .l2{-webkit-text-stroke-width:1.1px}
  .rail{grid-template-columns:repeat(2,1fr);gap:10px}
  .q{padding:20px 16px 18px;border-radius:16px}
  .q-name{font-size:21px}
  .q-price{font-size:25px}
  .q-emoji{font-size:22px;margin-bottom:12px}
  .steps{gap:34px}
  .th-marks{gap:14px}
  .close-mark{-webkit-text-stroke-width:1px}
  .ftr-btm{flex-direction:column;gap:8px}
  .scroll-cue{display:none}
}
`;
