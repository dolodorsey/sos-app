'use client';

import { useEffect, useState } from 'react';

const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;
const providerRoutes = ['/hero', '/provider', '/become-a-provider', '/launch-updates'];
const get = key => { try { return localStorage.getItem(key); } catch { return null; } };
const set = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || Boolean(navigator.standalone);

function track(type, metadata = {}) {
  try { void window.khgTrack?.(type, { app:'sos', launch_lane:'service_providers', ...metadata }); } catch {}
}

export default function SOSInstallAppPrompt() {
  const [promptEvent, setPromptEvent] = useState(null);
  const [show, setShow] = useState(false);
  const [steps, setSteps] = useState(false);
  const [apple, setApple] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const native = Boolean(window.Capacitor?.isNativePlatform?.());
    if (native || isStandalone()) { setInstalled(true); return; }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope:'/' }).catch(error => {
        console.warn('[S.O.S. PWA] service worker registration failed', error);
      });
    }

    const path = window.location.pathname.toLowerCase();
    const providerIntent = providerRoutes.some(prefix => path === prefix || path.startsWith(prefix + '/'));
    if (!providerIntent) return;

    const isApple = isIOS();
    setApple(isApple);
    const dismissed = Number(get('sos:pwa-dismissed') || 0);
    const eligible = !dismissed || Date.now() - dismissed > DISMISS_MS;

    const beforeInstall = event => {
      event.preventDefault();
      setPromptEvent(event);
      if (eligible) window.setTimeout(() => setShow(true), 1600);
    };
    const installedHandler = () => {
      setInstalled(true);
      setShow(false);
      track('app_install', { platform:isApple ? 'ios' : 'web', variant:'sos_provider_pwa' });
    };

    addEventListener('beforeinstallprompt', beforeInstall);
    addEventListener('appinstalled', installedHandler);

    let timer = 0;
    if (eligible && isApple) timer = window.setTimeout(() => setShow(true), 4200);

    return () => {
      removeEventListener('beforeinstallprompt', beforeInstall);
      removeEventListener('appinstalled', installedHandler);
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (installed || !show) return null;

  const close = () => {
    set('sos:pwa-dismissed', String(Date.now()));
    setShow(false);
    track('cta_click', { cta:'provider_pwa_prompt_dismiss' });
  };

  const install = async () => {
    track('app_install_click', { platform:apple ? 'ios' : 'web', variant:promptEvent ? 'native_prompt' : 'instructions' });
    if (promptEvent) {
      const result = await promptEvent.prompt();
      setPromptEvent(null);
      if (result.outcome === 'accepted') setShow(false);
      return;
    }
    setSteps(true);
  };

  return <div className="sos-pwa-install" role="dialog" aria-modal="true" aria-label="Install S.O.S.">
    <section>
      <button className="sos-pwa-x" onClick={close} aria-label="Close">×</button>
      <div className="sos-pwa-phone" aria-hidden="true"><i/><b>SOS</b><small>ON STANDBY</small></div>
      {!steps ? <div className="sos-pwa-copy">
        <p className="sos-pwa-kicker">ATLANTA SERVICE PROVIDERS</p>
        <h2>PUT<br/><em>S.O.S.</em><br/>ON YOUR PHONE.</h2>
        <p>Keep provider onboarding, verification and S.O.S. access one tap away. Installing the web app does not approve a Hero or promise jobs, earnings or service assignments.</p>
        <div className="sos-pwa-chips"><span>APPLY</span><b>•</b><span>VERIFY</span><b>•</b><span>STAY READY</span></div>
        <button className="sos-pwa-go" onClick={install}><span>{promptEvent ? 'INSTALL S.O.S.' : 'ADD S.O.S.'}</span><strong>↗</strong></button>
        <button className="sos-pwa-later" onClick={close}>Continue in browser</button>
      </div> : <div className="sos-pwa-copy">
        <p className="sos-pwa-kicker">{apple ? 'IPHONE / HOME SCREEN' : 'INSTALL / HOME SCREEN'}</p>
        <h2>THREE TAPS.<br/><em>STAY READY.</em></h2>
        <ol>
          <li><b>01</b><div><strong>{apple ? 'Tap Share' : 'Open browser menu'}</strong><small>{apple ? 'Use Safari’s Share button.' : 'Open the browser install menu.'}</small></div></li>
          <li><b>02</b><div><strong>Add to Home Screen</strong><small>Select Add to Home Screen / Install App.</small></div></li>
          <li><b>03</b><div><strong>Tap Add</strong><small>S.O.S. lands beside your other apps.</small></div></li>
        </ol>
        <button className="sos-pwa-go" onClick={close}>GOT IT</button>
      </div>}
      <p className="sos-pwa-safety">S.O.S. is not an emergency service. For an emergency, call 911.</p>
      <style jsx>{`
        .sos-pwa-install{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:end center;padding:16px;background:linear-gradient(180deg,#02060922,#020609e8);backdrop-filter:blur(12px);animation:sosPwaIn .3s ease both}
        .sos-pwa-install section{position:relative;width:min(700px,100%);min-height:480px;overflow:hidden;border:1px solid #ff6b3566;border-radius:30px;padding:31px 23px 50px;background:radial-gradient(circle at 86% 6%,#ff6b3540,transparent 31%),radial-gradient(circle at 72% 22%,#4479a826,transparent 38%),linear-gradient(145deg,#101a29,#020609 72%);box-shadow:0 35px 105px #000d;color:#f7f8fa;isolation:isolate}
        .sos-pwa-install section:after{content:'';position:absolute;inset:0;z-index:-1;opacity:.08;background:repeating-linear-gradient(116deg,transparent 0 16px,#fff2 17px,transparent 18px)}
        .sos-pwa-x{position:absolute;right:14px;top:14px;z-index:5;width:39px;height:39px;border-radius:50%;border:1px solid #fff2;background:#fff1;color:#fff;font-size:25px}
        .sos-pwa-phone{position:absolute;right:48px;top:58px;width:112px;height:222px;border:4px solid #fff;border-radius:29px;background:linear-gradient(160deg,#18283f,#020609);transform:rotate(7deg);box-shadow:0 28px 65px #000b;display:flex;flex-direction:column;align-items:center;justify-content:center}
        .sos-pwa-phone i{position:absolute;top:7px;width:43px;height:10px;border-radius:12px;background:#000}.sos-pwa-phone b{width:64px;height:64px;border-radius:20px;background:linear-gradient(145deg,#ff8a4c,#ff6b35 58%,#a93417);display:grid;place-items:center;color:#fff;font:900 18px/1 Arial;box-shadow:0 0 0 3px #fff2,0 15px 35px #ff6b354d}.sos-pwa-phone small{margin-top:13px;color:#fff;font:900 7px/1 Arial;letter-spacing:.16em}
        .sos-pwa-copy{position:relative;z-index:2;max-width:480px;padding-right:105px}.sos-pwa-kicker{margin:0 0 11px!important;color:#ffbd63!important;font:900 10px/1 Arial!important;letter-spacing:.16em!important}.sos-pwa-copy h2{margin:0;font:900 clamp(34px,9vw,57px)/.83 'Barlow Condensed',Arial,sans-serif;letter-spacing:-.045em}.sos-pwa-copy h2 em{font-style:normal;background:linear-gradient(90deg,#ffbd63,#ff6b35);-webkit-background-clip:text;color:transparent}.sos-pwa-copy>p:not(.sos-pwa-kicker){max-width:430px;margin:18px 0 15px;color:#c8d0da;font:500 14px/1.55 'DM Sans',Arial}
        .sos-pwa-chips{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:18px;color:#aeb9c6;font:900 9px/1 Arial;letter-spacing:.11em}.sos-pwa-chips b{color:#ff6b35}.sos-pwa-go{width:100%;min-height:55px;border:0;border-radius:15px;background:linear-gradient(100deg,#ffbd63,#ff6b35 68%,#d34b20);color:#130805;display:flex;align-items:center;justify-content:space-between;padding:0 18px;font:900 13px/1 Arial;letter-spacing:.06em;box-shadow:0 16px 42px #ff6b3540}.sos-pwa-go strong{font-size:22px}.sos-pwa-later{width:100%;border:0;background:transparent;color:#96a3b2;padding:13px 0 0;font:700 11px/1 Arial}
        .sos-pwa-copy ol{list-style:none;margin:20px 0;padding:0;display:grid;gap:9px}.sos-pwa-copy li{display:flex;gap:12px;align-items:center;padding:12px;border:1px solid #fff2;border-radius:13px;background:#fff1}.sos-pwa-copy li>b{color:#ffbd63;font:900 11px/1 Arial}.sos-pwa-copy li strong,.sos-pwa-copy li small{display:block}.sos-pwa-copy li strong{font:800 13px/1.2 Arial}.sos-pwa-copy li small{margin-top:3px;color:#9ca9b7;font:500 11px/1.35 Arial}
        .sos-pwa-safety{position:absolute;left:23px;bottom:16px;margin:0;color:#8995a4;font:600 10px/1.3 'DM Sans',Arial;letter-spacing:.02em}
        @keyframes sosPwaIn{from{opacity:0;transform:translateY(13px)}to{opacity:1;transform:none}}@media(min-width:720px){.sos-pwa-install{place-items:center}.sos-pwa-install section{padding:43px 37px 54px}.sos-pwa-copy{padding-right:155px}.sos-pwa-phone{right:76px;top:75px}.sos-pwa-safety{left:37px}}@media(max-width:430px){.sos-pwa-install section{padding:28px 18px 52px;border-radius:25px}.sos-pwa-copy{padding-right:45px}.sos-pwa-copy h2{font-size:36px}.sos-pwa-phone{right:-7px;opacity:.58}.sos-pwa-safety{left:18px}}@media(prefers-reduced-motion:reduce){.sos-pwa-install{animation:none}}
      `}</style>
    </section>
  </div>;
}
