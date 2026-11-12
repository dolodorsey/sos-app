'use client';

import { useEffect, useState } from 'react';
import SOSInstallCoach, { detectInstallFlow } from './SOSInstallCoach';


function forceInstall(){try{return new URLSearchParams(location.search).get('install')==='1'}catch{return false}}
function InstallQr(){
  const [qr,setQr]=useState('');
  useEffect(()=>{if(typeof window==='undefined'||window.innerWidth<760)return;try{const u=new URL(location.href);u.hash='';u.search='';u.searchParams.set('install','1');setQr('https://wfkohcwxxsrhcxhepfql.supabase.co/functions/v1/app-install-qr?url='+encodeURIComponent(u.toString()))}catch{}},[]);
  if(!qr)return null;
  return <aside aria-label="Scan to install app" style={{position:'fixed',right:22,bottom:22,zIndex:2147483002,width:188,padding:12,borderRadius:20,background:'rgba(7,8,11,.97)',border:'1px solid rgba(255,255,255,.16)',boxShadow:'0 24px 70px rgba(0,0,0,.48)',color:'#fff',fontFamily:'Arial,sans-serif'}}>
    <img src={qr} alt="QR code to install this app" width="164" height="164" style={{display:'block',width:'100%',height:'auto',borderRadius:12,background:'#fff',padding:6}}/>
    <strong style={{display:'block',marginTop:10,fontSize:10,letterSpacing:'.14em'}}>PROVIDERS — SCAN TO GET S.O.S.</strong>
    <small style={{display:'block',marginTop:5,color:'rgba(255,255,255,.62)',fontSize:9,lineHeight:1.45}}>iPhone: ••• → Share → Add to Home Screen → Add. Android: ⋮ → Install app.</small>
  </aside>
}

const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;
const providerRoutes = ['/hero', '/provider', '/become-a-provider', '/launch-updates'];
// Internal tools never get the install prompt.
const excludedRoutes = ['/ops', '/admin'];
const routeMatch = (path, prefixes) => prefixes.some(prefix => path === prefix || path.startsWith(prefix + '/'));
const audienceFor = path => routeMatch(path, excludedRoutes) ? null : routeMatch(path, providerRoutes) ? 'provider' : 'customer';
const signedIn = () => { try { return Boolean(JSON.parse(localStorage.getItem('sos_session'))?.access_token); } catch { return false; } };
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
  const [, setSteps] = useState(false);
  const [apple, setApple] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [coach, setCoach] = useState(null);

  useEffect(() => {
    const native = Boolean(window.Capacitor?.isNativePlatform?.());
    if (native || isStandalone()) { setInstalled(true); return; }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope:'/' }).catch(error => {
        console.warn('[S.O.S. PWA] service worker registration failed', error);
      });
    }

    const path = window.location.pathname.toLowerCase();
    if (!audienceFor(path)) return;

    const isApple = isIOS();
    setApple(isApple);
    const dismissed = Number(get('sos:pwa-dismissed') || 0);
    const eligible = forceInstall() || !dismissed || Date.now() - dismissed > DISMISS_MS;

    // Automatic prompts never open on top of an in-app legal sheet (Privacy/Terms/Not 911/Support).
    const autoShow = () => { if (!document.documentElement.classList.contains('sos-legal-open')) setShow(true); };
    const beforeInstall = event => {
      event.preventDefault();
      setPromptEvent(event);
      if (eligible) window.setTimeout(autoShow, 1600);
    };
    const installedHandler = () => {
      setInstalled(true);
      setShow(false);
      track('app_install', { platform:isApple ? 'ios' : 'web', variant:`sos_${audienceFor(path)}_pwa` });
    };

    addEventListener('beforeinstallprompt', beforeInstall);
    addEventListener('appinstalled', installedHandler);

    let timer = 0;
    if (forceInstall()) timer = window.setTimeout(() => setShow(true), 120);
    else if (eligible && isApple) timer = window.setTimeout(autoShow, 4200);

    return () => {
      removeEventListener('beforeinstallprompt', beforeInstall);
      removeEventListener('appinstalled', installedHandler);
      if (timer) clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!show) return;
    const onKey = event => { if (event.key === 'Escape') { set('sos:pwa-dismissed', String(Date.now())); setShow(false); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [show]);

  if (installed) return null;
  const pathNow=typeof window!=='undefined'?window.location.pathname.toLowerCase():'';
  const audience=audienceFor(pathNow);
  if (!audience) return null;
  const provider=audience==='provider';
  if (coach) return <SOSInstallCoach flow={coach} onClose={()=>{setCoach(null);track('cta_click',{cta:'install_coach_close'})}} onDone={()=>{setCoach(null);set('sos:pwa-dismissed',String(Date.now()));track('cta_click',{cta:'install_coach_done',flow:coach})}}/>;
  if (!show && !provider && signedIn()) return null;
  if (!show) return <button aria-label={provider?'Get S.O.S. provider app':'Get the S.O.S. app'} onClick={()=>{setSteps(false);setShow(true);track('cta_click',{cta:`${audience}_persistent_get_app`})}} style={{position:'fixed',right:16,bottom:'calc(16px + env(safe-area-inset-bottom))',zIndex:2147482500,display:'flex',alignItems:'center',gap:9,border:'1px solid rgba(227,0,11,.55)',borderRadius:999,padding:'7px 15px 7px 7px',background:'rgba(10,16,24,.92)',backdropFilter:'blur(10px)',WebkitBackdropFilter:'blur(10px)',color:'#ffffff',font:"800 11.5px/1 'DM Sans',system-ui,sans-serif",letterSpacing:'.04em',boxShadow:'0 12px 32px rgba(0,0,0,.45)',cursor:'pointer'}}><img src="/sos-app-icon-192.png" alt="" width="26" height="26" style={{width:26,height:26,borderRadius:7}}/><span>SERVICE PROVIDERS · GET S.O.S.</span></button>;

  const close = () => {
    set('sos:pwa-dismissed', String(Date.now()));
    setShow(false);
    track('cta_click', { cta:`${audience}_pwa_prompt_dismiss` });
  };

  const install = async () => {
    track('app_install_click', { platform:apple ? 'ios' : 'web', variant:promptEvent ? 'native_prompt' : 'instructions' });
    if (promptEvent) {
      const result = await promptEvent.prompt();
      setPromptEvent(null);
      if (result.outcome === 'accepted') setShow(false);
      return;
    }
    // No one-tap install available: walk them through it, pointing at each button.
    const flow = detectInstallFlow();
    setShow(false);
    setCoach(flow);
    track('cta_click', { cta:'install_coach_start', flow });
  };

  const points = provider ? [
    ['doc', 'Finish your application', 'Upload your info and follow your verification status.'],
    ['bolt', 'Stay on standby', 'Mission offers go only to verified SUPERHEROS.'],
    ['phone', 'No App Store needed', 'Opens full-screen like an app. Remove it anytime.'],
  ] : [
    ['tow', 'Tow, jump, flat, fuel or lockout', 'Request roadside help in metro Atlanta in a few taps.'],
    ['pin', 'Follow it live', 'See your request move from matching to done.'],
    ['phone', 'No App Store needed', 'Opens full-screen like an app. Remove it anytime.'],
  ];

  return <div className="sos-pwa-install" role="dialog" aria-modal="true" aria-label="Install S.O.S." onClick={close} onKeyDown={event=>{if(event.key==='Escape')close()}}>
    <InstallQr/>
    <style jsx>{`
      .sos-pwa-install{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:flex-end;justify-content:center;background:rgba(2,6,9,.62);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);animation:sosPwaFade .2s ease both}
      .sos-pwa-sheet{position:relative;width:100%;max-width:460px;max-height:calc(100dvh - 24px);overflow:auto;padding:10px 20px calc(18px + env(safe-area-inset-bottom));border-radius:28px 28px 0 0;background:linear-gradient(180deg,#121c29 0%,#0a1018 60%);border:1px solid rgba(255,255,255,.08);border-bottom:0;box-shadow:0 -24px 70px rgba(0,0,0,.55);color:#f4f6f9;font-family:'DM Sans',system-ui,-apple-system,sans-serif;animation:sosPwaUp .32s cubic-bezier(.2,.8,.2,1) both}
      .sos-pwa-handle{display:block;width:40px;height:5px;margin:0 auto 14px;border-radius:99px;background:rgba(255,255,255,.22)}
      .sos-pwa-x{position:absolute;right:14px;top:14px;width:34px;height:34px;border-radius:50%;border:0;background:rgba(255,255,255,.08);color:#c9d1db;font-size:20px;line-height:34px;cursor:pointer}
      .sos-pwa-app{display:flex;align-items:center;gap:14px;padding-right:40px}
      .sos-pwa-app img{width:64px;height:64px;border-radius:15px;flex:none;box-shadow:0 8px 24px rgba(227,0,11,.28),0 0 0 1px rgba(255,255,255,.1)}
      .sos-pwa-app strong{display:block;font:800 19px/1.1 'DM Sans',system-ui,sans-serif;letter-spacing:-.01em}
      .sos-pwa-app span{display:block;margin-top:2px;color:#aab5c2;font-size:13px}
      .sos-pwa-app small{display:block;margin-top:6px;color:#7f8c9b;font-size:11.5px;font-weight:600}
      .sos-pwa-kicker{margin:20px 0 0;color:#ff5a61;font:800 11px/1 'DM Sans',system-ui,sans-serif;letter-spacing:.14em}
      .sos-pwa-sheet h2{margin:7px 0 14px;font:800 30px/1 'Barlow Condensed','DM Sans',Arial,sans-serif;letter-spacing:.005em;text-transform:uppercase}
      .sos-pwa-points{list-style:none;margin:0 0 20px;padding:0;display:grid;gap:4px}
      .sos-pwa-points li{display:flex;gap:13px;align-items:flex-start;padding:10px 0;border-top:1px solid rgba(255,255,255,.07)}
      .sos-pwa-points li:first-child{border-top:0}
      .sos-pwa-ico{flex:none;width:36px;height:36px;border-radius:11px;display:grid;place-items:center;background:rgba(227,0,11,.13);color:#ff5a61}
      .sos-pwa-points b{display:block;font-size:15px;font-weight:700;line-height:1.25}
      .sos-pwa-points p{margin:3px 0 0;color:#9aa6b4;font-size:13.5px;line-height:1.4}
      .sos-pwa-go{width:100%;min-height:54px;border:0;border-radius:16px;background:#e3000b;color:#fff;font:800 16px/1 'DM Sans',system-ui,sans-serif;display:flex;align-items:center;justify-content:center;gap:10px;cursor:pointer;box-shadow:0 12px 30px rgba(227,0,11,.32)}
      .sos-pwa-go:active{transform:scale(.985)}
      .sos-pwa-later{display:block;width:100%;margin-top:6px;min-height:46px;border:0;background:transparent;color:#aab5c2;font:600 14px/1 'DM Sans',system-ui,sans-serif;cursor:pointer}
      .sos-pwa-safety{margin:6px 0 0;text-align:center;color:#6f7c8b;font-size:11.5px;line-height:1.45}
      .sos-pwa-x:focus-visible,.sos-pwa-go:focus-visible,.sos-pwa-later:focus-visible{outline:2px solid #ff5a61;outline-offset:3px}
      @media(min-width:720px){.sos-pwa-install{align-items:center}.sos-pwa-sheet{border-radius:28px;border-bottom:1px solid rgba(255,255,255,.08);padding:14px 26px 24px}}
      @keyframes sosPwaFade{from{opacity:0}to{opacity:1}}
      @keyframes sosPwaUp{from{transform:translateY(24px);opacity:.4}to{transform:none;opacity:1}}
      @media(prefers-reduced-motion:reduce){.sos-pwa-install,.sos-pwa-sheet{animation:none}}
    `}</style>
    <section className="sos-pwa-sheet" onClick={event=>event.stopPropagation()}>
      <span className="sos-pwa-handle" aria-hidden="true"/>
      <button type="button" className="sos-pwa-x" onClick={close} aria-label="Close">×</button>
      <header className="sos-pwa-app">
        <img src="/sos-app-icon-192.png" alt="" width="64" height="64"/>
        <div>
          <strong>S.O.S.</strong>
          <span>{provider ? 'SUPERHERO portal' : 'Superheros On Standby'}</span>
          <small>Free · Web app · Metro Atlanta</small>
        </div>
      </header>
      <p className="sos-pwa-kicker">{provider ? 'ATLANTA SERVICE PROVIDERS' : 'ATLANTA ROADSIDE HELP'}</p>
      <h2>{provider ? 'Keep the Hero portal one tap away' : 'Roadside help, one tap away'}</h2>
      <ul className="sos-pwa-points">
        {points.map(([icon,title,body])=><li key={title}><span className="sos-pwa-ico"><PointIcon name={icon}/></span><div><b>{title}</b><p>{body}</p></div></li>)}
      </ul>
      <button type="button" className="sos-pwa-go" data-sos-install-go onClick={install}>{promptEvent ? 'Install app' : 'Add to Home Screen'}</button>
      <button type="button" className="sos-pwa-later" onClick={close}>Not now</button>
      <p className="sos-pwa-safety">{provider ? 'Installing doesn’t approve an application or promise jobs or earnings.' : 'S.O.S. is roadside assistance, not an emergency service. In an emergency, call 911.'}</p>
    </section>
  </div>;
}

function PointIcon({ name }) {
  const c = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  if (name === 'tow') return <svg {...c}><path d="M3 16V9h9l3 4h4a2 2 0 0 1 2 2v1"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M12 9V5l-3-1"/></svg>;
  if (name === 'pin') return <svg {...c}><path d="M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/></svg>;
  if (name === 'doc') return <svg {...c}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>;
  if (name === 'bolt') return <svg {...c}><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>;
  return <svg {...c}><rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M11 18h2"/></svg>;
}
