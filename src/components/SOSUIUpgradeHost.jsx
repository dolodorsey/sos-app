'use client';

import React,{useEffect,useState}from'react';

const ASSET='https://woqlhjodiedyqfvzweoe.supabase.co/storage/v1/object/public';
const MOTION=`${ASSET}/animations/sos-ani2.mp4`;

const icons={
  tire:'<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="15"/><circle cx="24" cy="24" r="7"/><path d="M24 9v8M24 31v8M9 24h8M31 24h8M13.5 13.5l5.7 5.7M28.8 28.8l5.7 5.7M34.5 13.5l-5.7 5.7M19.2 28.8l-5.7 5.7"/></svg>',
  battery:'<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="7" y="14" width="34" height="24" rx="4"/><path d="M17 10v4M31 10v4M13 26h8M17 22v8M29 26h8"/></svg>',
  jump:'<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="7" y="14" width="34" height="24" rx="4"/><path d="M17 10v4M31 10v4M27 18l-8 11h7l-4 7 10-12h-7z"/></svg>',
  lock:'<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="10" y="21" width="28" height="20" rx="4"/><path d="M16 21v-6a8 8 0 0116 0v6M24 29v5"/></svg>',
  tow:'<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M4 28h23v9H4zM27 18h9l7 10v9H27zM31 18v-6h8M39 12l-8 11"/><circle cx="12" cy="38" r="4"/><circle cx="36" cy="38" r="4"/></svg>',
  fuel:'<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="9" y="8" width="22" height="33" rx="3"/><rect x="13" y="12" width="14" height="10" rx="1"/><path d="M31 15h5l4 5v14a3 3 0 01-6 0v-8M17 31h7"/></svg>',
  glass:'<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M7 31l5-17h24l5 17-6 6H13zM24 15l-4 9 6-2-4 10 10-13-6 2z"/></svg>',
  wash:'<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10 29l4-10h20l4 10v9H10zM14 29h20M15 38v4M33 38v4"/><circle cx="17" cy="33" r="2"/><circle cx="31" cy="33" r="2"/><path d="M15 7v6M24 5v8M33 7v6"/></svg>',
  wrench:'<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M32 7a10 10 0 00-9 14L8 36l4 4 15-15a10 10 0 0014-12l-7 7-6-6z"/></svg>',
  fleet:'<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M5 17h27v18H5zM32 23h7l5 6v6H32z"/><circle cx="13" cy="37" r="4"/><circle cx="37" cy="37" r="4"/><path d="M10 12h18"/></svg>',
  snow:'<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 5v38M8 14l32 20M40 14L8 34M19 9l5 5 5-5M19 39l5-5 5 5M10 20l7 1-2-7M38 28l-7-1 2 7M38 20l-7 1 2-7M10 28l7-1-2 7"/></svg>',
  crown:'<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 34h32l-3-19-8 9-5-13-5 13-8-9zM10 39h28"/></svg>',
  bag:'<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10 18h28l-2 24H12zM18 18a6 6 0 0112 0M24 25v10M19 30h10"/></svg>',
  home:'<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M7 24L24 9l17 15v17H29V29H19v12H7z"/></svg>',
};

function pickIcon(text=''){
  const t=text.toLowerCase();
  if(t.includes('flat')||t.includes('tire'))return'tire';
  if(t.includes('jump'))return'jump';
  if(t.includes('lock'))return'lock';
  if(t.includes('tow'))return'tow';
  if(t.includes('fuel')||t.includes('gas'))return'fuel';
  if(t.includes('battery'))return'battery';
  if(t.includes('glass')||t.includes('windshield')||t.includes('dent')||t.includes('scratch'))return'glass';
  if(t.includes('wash')||t.includes('detail')||t.includes('sanit'))return'wash';
  if(t.includes('maintenance')||t.includes('repair')||t.includes('mechanic'))return'wrench';
  if(t.includes('fleet'))return'fleet';
  if(t.includes('season'))return'snow';
  if(t.includes('premium')||t.includes('concierge'))return'crown';
  if(t.includes('convenience'))return'bag';
  return'home';
}

function legalCopy(kind){
  const common={
    privacy:{eyebrow:'LEGAL · IN APP',title:'Privacy Policy',intro:'Your privacy matters. S.O.S. uses account, vehicle, location, mission and payment information only to operate the roadside network and app features.',sections:[['Information we handle','Account and contact information, vehicle details, device/location data and mission information required to deliver service.'],['How we use it','To dispatch qualified Heroes, process requests, protect the marketplace, communicate with you and improve the app.'],['Security & choices','Access controls, verification gates and secure payment flows protect marketplace data. Manage supported preferences from your profile.'],['Children','S.O.S. accounts are intended for people legally able to request or provide roadside services and are not directed to children under 13.']]},
    terms:{eyebrow:'LEGAL · IN APP',title:'Terms of Service',intro:'S.O.S. connects customers with qualified independent roadside providers. Service availability, final assignment and ETA depend on live marketplace conditions.',sections:[['Service requests','A request is not assigned until a qualified Hero accepts it.'],['Pricing','Starting prices and estimates are shown before request. Final approved adjustments must be disclosed.'],['Safety','S.O.S. is not an emergency response service. For life-threatening emergencies, call 911.'],['Account conduct','Accurate information, lawful use and respectful conduct are required.']]},
    safety:{eyebrow:'SAFETY',title:'Not 911',intro:'S.O.S. is roadside assistance. It does not replace police, fire, EMS or 911.',sections:[['Call 911 when','There is injury, fire, immediate danger, a collision blocking traffic, suspected crime or another life-threatening emergency.'],['Use S.O.S. for','Flat tires, jump starts, lockouts, towing, fuel delivery, batteries and other eligible roadside services.'],['Stay safe','Move away from traffic when possible, use hazard lights and follow local safety guidance while help is being matched.']]},
    support:{eyebrow:'SUPPORT · IN APP',title:'Support',intro:'Need help with an account, mission, payment or completed service? Keep the conversation inside S.O.S. so the correct mission context stays attached.',sections:[['Active mission','Open Missions and select the live request for status and support options.'],['Account & billing','Use Profile for vehicles, payments, membership and account tools.'],['General support','Use the support action from the app or email thedoctordorsey@gmail.com when email follow-up is required.']]},
  };
  return common[kind]||common.support;
}

export default function SOSUIUpgradeHost(){
  const[legal,setLegal]=useState(null);

  useEffect(()=>{
    const apply=()=>{
      document.documentElement.classList.add('sos-ui-v3');
      document.querySelectorAll('.sos2-brand').forEach(brand=>{
        if(brand.dataset.v3)return;
        brand.dataset.v3='1';
        brand.innerHTML='<img class="sos3-logo" src="/brand/sos-logo.webp" alt="S.O.S. — Superheroes On Standby"/><div class="sos3-brand-copy"><strong>SUPERHEROES ON STANDBY</strong><small>Roadside Mobility Network</small></div>';
      });

      const hero=document.querySelector('.sos2-map-hero');
      if(hero&&!hero.dataset.v3){
        hero.dataset.v3='1';
        const intro=document.createElement('section');
        intro.className='sos3-home-intro';
        intro.innerHTML='<span>ROADSIDE RESCUE</span><h1>What happened?</h1><p>Tell us what you need. We’ll notify qualified Heroes near your real location.</p>';
        hero.parentNode?.insertBefore(intro,hero);
        const video=document.createElement('video');
        video.className='sos3-home-motion';
        video.autoplay=true;video.muted=true;video.loop=true;video.playsInline=true;video.setAttribute('aria-label','S.O.S. brand animation');
        video.src=MOTION;
        hero.insertBefore(video,hero.firstChild);
      }

      document.querySelectorAll('.sos2-quick-grid button,.sos2-service-list button').forEach(button=>{
        const box=button.querySelector('.sos2-service-icon');
        if(!box)return;
        const key=pickIcon(button.textContent||'');
        if(box.dataset.icon===key)return;
        box.dataset.icon=key;box.innerHTML=icons[key];
      });
      document.querySelectorAll('.sos2-category-grid button').forEach(button=>{
        const box=button.querySelector('.sos2-category-symbol');
        if(!box)return;
        const key=pickIcon(button.textContent||'');
        if(box.dataset.icon===key)return;
        box.dataset.icon=key;box.innerHTML=icons[key];
      });

      const categories=document.querySelector('.sos2-categories');
      if(categories&&!document.querySelector('.sos3-ad-slot')){
        const ad=document.createElement('section');
        ad.className='sos3-ad-slot';
        ad.innerHTML='<div><span>SPONSORED · PARTNER PLACEMENT</span><h2>Your brand can ride with S.O.S.</h2><p>Reserved inventory for roadside, automotive, insurance, fuel, mobility and local-market partners.</p></div><button type="button">Partner with S.O.S.</button>';
        categories.parentNode?.insertBefore(ad,categories);
      }
    };
    apply();
    const observer=new MutationObserver(()=>requestAnimationFrame(apply));
    observer.observe(document.body,{childList:true,subtree:true});
    return()=>observer.disconnect();
  },[]);

  const copy=legal?legalCopy(legal):null;
  return <>
    <div className="sos3-utility" role="navigation" aria-label="S.O.S. legal and support">
      <button onClick={()=>setLegal('privacy')}>Privacy</button><i/>
      <button onClick={()=>setLegal('terms')}>Terms</button><i/>
      <button onClick={()=>setLegal('safety')}>Not 911</button><i/>
      <button onClick={()=>setLegal('support')}>Support</button>
    </div>
    {copy&&<section className="sos3-legal" role="dialog" aria-modal="true" aria-label={copy.title}>
      <header><button onClick={()=>setLegal(null)} aria-label="Back to S.O.S.">←</button><img src="/brand/sos-logo.webp" alt="S.O.S."/><span/></header>
      <div className="sos3-legal-scroll"><p className="sos3-legal-eyebrow">{copy.eyebrow}</p><h1>{copy.title}</h1><p className="sos3-legal-intro">{copy.intro}</p><div className="sos3-legal-card">{copy.sections.map(([title,text])=><article key={title}><span className="sos3-legal-icon">{icons[title.includes('Safety')?'lock':title.includes('Account')?'home':title.includes('Information')?'bag':'home']}</span><div><h2>{title}</h2><p>{text}</p></div></article>)}</div></div>
    </section>}
  </>;
}
