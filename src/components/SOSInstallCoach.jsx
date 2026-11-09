'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

// Step-by-step "add S.O.S. to your Home Screen" coach.
// The card moves to where the next tap happens and points at it with an
// animated arrow. Browser buttons live outside the page, so we place the
// pointer at the edge of the screen where that browser puts the button.
// iOS 26 Safari (default "Compact" tabs) hides Share inside the ••• menu.

const Icon = ({ name }) => {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  if (name === 'more') return <svg {...common}><circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/></svg>;
  if (name === 'share') return <svg {...common}><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>;
  if (name === 'add') return <svg {...common}><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8.5v7M8.5 12h7"/></svg>;
  if (name === 'menu') return <svg {...common}><circle cx="12" cy="5" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="19" r="1.4" fill="currentColor"/></svg>;
  if (name === 'toggle') return <svg {...common}><rect x="2" y="7" width="20" height="10" rx="5"/><circle cx="17" cy="12" r="3" fill="currentColor"/></svg>;
  if (name === 'safari') return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/></svg>;
  return <svg {...common}><path d="M5 12l5 5L20 7"/></svg>;
};

// target: where the arrow points. place: where the card sits.
const FLOWS = {
  ios_safari_26: [
    { icon: 'more', title: 'Tap the ••• button', body: 'Bottom right, next to the address bar.', target: 'bottom-right', place: 'bottom' },
    { icon: 'share', title: 'Tap Share', body: 'It’s in the menu that just opened.', target: 'bottom-right-menu', place: 'top' },
    { icon: 'add', title: 'Tap “Add to Home Screen”', body: 'Scroll down the share sheet. If you don’t see it, tap “View More”.', target: 'sheet', place: 'top' },
    { icon: 'toggle', title: 'Keep “Open as Web App” on, then tap Add', body: 'Add is in the top right corner.', target: 'top-right', place: 'middle' },
  ],
  ios_safari_classic: [
    { icon: 'share', title: 'Tap the Share button', body: 'Middle of the toolbar at the bottom of Safari.', target: 'bottom-center', place: 'bottom' },
    { icon: 'add', title: 'Tap “Add to Home Screen”', body: 'Scroll down the share sheet to find it.', target: 'sheet', place: 'top' },
    { icon: 'check', title: 'Tap Add', body: 'Top right corner. S.O.S. lands on your Home Screen.', target: 'top-right', place: 'middle' },
  ],
  ipad_safari: [
    { icon: 'share', title: 'Tap the Share button', body: 'Top right of Safari, next to the address bar.', target: 'top-right', place: 'top' },
    { icon: 'add', title: 'Tap “Add to Home Screen”', body: 'Scroll down the share menu to find it.', target: 'top-right', place: 'middle' },
    { icon: 'check', title: 'Tap Add', body: 'S.O.S. lands on your Home Screen.', target: 'top-right', place: 'middle' },
  ],
  ios_chrome: [
    { icon: 'share', title: 'Tap the Share button', body: 'Top right, inside the address bar.', target: 'top-right', place: 'top' },
    { icon: 'add', title: 'Tap “Add to Home Screen”', body: 'Scroll down the share sheet. If you don’t see it, tap “More”.', target: 'sheet', place: 'top' },
    { icon: 'check', title: 'Tap Add', body: 'Top right corner. S.O.S. lands on your Home Screen.', target: 'top-right', place: 'middle' },
  ],
  ios_other: [
    { icon: 'safari', title: 'Open this page in Safari', body: 'This browser can’t add web apps. Copy the link, then paste it into Safari.', target: 'none', place: 'middle', copy: true },
  ],
  android: [
    { icon: 'menu', title: 'Tap the ⋮ menu', body: 'Top right corner of Chrome.', target: 'top-right', place: 'top' },
    { icon: 'add', title: 'Tap “Install app” or “Add to Home screen”', body: 'It’s in the menu that just opened.', target: 'top-right-menu', place: 'middle' },
    { icon: 'check', title: 'Tap Install', body: 'S.O.S. lands with your other apps.', target: 'none', place: 'middle' },
  ],
};

export function detectInstallFlow() {
  if (typeof navigator === 'undefined') return 'android';
  const ua = navigator.userAgent || '';
  const iPad = /ipad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const iOS = iPad || /iphone|ipod/i.test(ua);
  if (iOS) {
    if (/CriOS/i.test(ua)) return 'ios_chrome';
    if (/FxiOS|EdgiOS|OPiOS|GSA\/|FBAN|FBAV|Instagram|Line\//i.test(ua)) return 'ios_other';
    if (iPad) return 'ipad_safari';
    const version = Number((ua.match(/Version\/(\d+)/) || [])[1] || 0);
    return version >= 26 ? 'ios_safari_26' : 'ios_safari_classic';
  }
  return 'android';
}

export default function SOSInstallCoach({ flow, onClose, onDone }) {
  const steps = FLOWS[flow] || FLOWS.android;
  const [index, setIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const step = steps[index];
  const last = index === steps.length - 1;
  const advanced = useRef(-1);

  // When the browser's own menu / share sheet takes focus, move ahead to the next tap.
  useEffect(() => {
    const onBlur = () => {
      if (advanced.current === index || last) return;
      advanced.current = index;
      setIndex(current => Math.min(current + 1, steps.length - 1));
    };
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, [index, last, steps.length]);

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(location.origin + location.pathname); setCopied(true); } catch { setCopied(false); }
  };

  const dots = useMemo(() => steps.map((_, i) => <i key={i} className={i === index ? 'on' : i < index ? 'done' : ''}/>), [steps, index]);

  return <div className={`sos-coach place-${step.place} target-${step.target}`} role="dialog" aria-modal="false" aria-label="Add S.O.S. to your Home Screen">
    <style jsx>{`
      .sos-coach{position:fixed;inset:0;z-index:2147483001;pointer-events:none;background:linear-gradient(180deg,rgba(2,6,9,.18),rgba(2,6,9,.55));font-family:'DM Sans',Arial,sans-serif}
      .card{pointer-events:auto;position:absolute;left:14px;right:14px;max-width:420px;margin:0 auto;padding:18px 18px 14px;border-radius:22px;
        background:linear-gradient(150deg,#121d2c,#05080d);border:1.5px solid rgba(255,59,66,.55);box-shadow:0 22px 60px rgba(0,0,0,.6),0 0 0 6px rgba(227,0,11,.08);color:#f7f8fa;
        transition:top .45s cubic-bezier(.2,.8,.2,1),bottom .45s cubic-bezier(.2,.8,.2,1),transform .45s cubic-bezier(.2,.8,.2,1)}
      .place-bottom .card{bottom:calc(92px + env(safe-area-inset-bottom));top:auto}
      .place-top .card{top:calc(18px + env(safe-area-inset-top));bottom:auto}
      .place-middle .card{top:34%;bottom:auto}
      .head{display:flex;align-items:center;gap:12px}
      .badge{flex:0 0 46px;height:46px;border-radius:14px;display:grid;place-items:center;background:rgba(227,0,11,.16);color:#ff6a70;border:1px solid rgba(255,59,66,.35)}
      .kicker{font:900 10px/1 Arial;letter-spacing:.16em;color:#ff6a70}
      h3{margin:5px 0 0;font:800 21px/1.05 'Barlow Condensed',Arial,sans-serif;text-transform:uppercase;letter-spacing:-.01em}
      p{margin:10px 0 12px;font-size:13px;line-height:1.45;color:rgba(235,241,248,.72)}
      .row{display:flex;align-items:center;justify-content:space-between;gap:10px}
      .dots{display:flex;gap:6px}.dots i{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.18)}.dots i.on{background:#ff3b42;width:22px;border-radius:6px}.dots i.done{background:#34d399}
      .btns{display:flex;gap:8px}
      button{min-height:40px;border-radius:12px;padding:0 14px;font:800 12px/1 Arial;cursor:pointer}
      .ghost{border:1px solid rgba(255,255,255,.18);background:transparent;color:#dce3ec}
      .go{border:0;background:linear-gradient(100deg,#ff6a70,#e3000b);color:#fff}
      .x{position:absolute;right:10px;top:10px;min-height:0;width:30px;height:30px;padding:0;border-radius:50%;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#fff;font-size:18px;line-height:1}
      .arrow{position:absolute;pointer-events:none;color:#ff3b42;filter:drop-shadow(0 0 10px rgba(227,0,11,.8));transition:all .45s cubic-bezier(.2,.8,.2,1)}
      .arrow svg{display:block;width:64px;height:64px}
      .target-bottom-right .arrow{right:22px;bottom:calc(14px + env(safe-area-inset-bottom));animation:bounceDown 1s ease-in-out infinite}
      .target-bottom-right-menu .arrow{right:40px;bottom:calc(150px + env(safe-area-inset-bottom));animation:bounceDown 1s ease-in-out infinite}
      .target-bottom-center .arrow{left:calc(50% - 32px);bottom:calc(14px + env(safe-area-inset-bottom));animation:bounceDown 1s ease-in-out infinite}
      .target-sheet .arrow{left:calc(50% - 32px);top:calc(50% - 10px);animation:bounceDown 1s ease-in-out infinite}
      .target-top-right .arrow{right:16px;top:calc(8px + env(safe-area-inset-top));transform:rotate(180deg);animation:bounceUp 1s ease-in-out infinite}
      .target-top-right-menu .arrow{right:60px;top:calc(120px + env(safe-area-inset-top));transform:rotate(180deg);animation:bounceUp 1s ease-in-out infinite}
      .target-none .arrow{display:none}
      .place-top.target-top-right .card{top:calc(86px + env(safe-area-inset-top))}
      @keyframes bounceDown{0%,100%{translate:0 0}50%{translate:0 10px}}
      @keyframes bounceUp{0%,100%{translate:0 0}50%{translate:0 -10px}}
      @media (prefers-reduced-motion: reduce){.arrow{animation:none!important}.card{transition:none}}
    `}</style>
    <div className="arrow" aria-hidden="true"><svg viewBox="0 0 64 64"><path d="M32 6v40" stroke="currentColor" strokeWidth="7" strokeLinecap="round"/><path d="M14 30l18 20 18-20" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
    <div className="card">
      <button className="x" onClick={onClose} aria-label="Close install guide">×</button>
      <div className="head"><span className="badge"><Icon name={step.icon}/></span><div><span className="kicker">STEP {index + 1} OF {steps.length}</span><h3>{step.title}</h3></div></div>
      <p>{step.body}</p>
      {step.copy && <div className="btns" style={{ marginBottom: 12 }}><button className="go" onClick={copyLink}>{copied ? 'Link copied ✓' : 'Copy link'}</button></div>}
      <div className="row">
        <div className="dots" aria-hidden="true">{dots}</div>
        <div className="btns">
          {index > 0 && <button className="ghost" onClick={() => setIndex(index - 1)}>Back</button>}
          {last ? <button className="go" onClick={onDone}>Done</button> : <button className="go" onClick={() => setIndex(index + 1)}>Next</button>}
        </div>
      </div>
    </div>
  </div>;
}
