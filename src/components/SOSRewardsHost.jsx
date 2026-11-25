'use client';

import React,{useEffect,useState}from'react';
import{createPortal}from'react-dom';
import{useAppSlot}from'../lib/useAppSlot';

// Rewards: promo codes and referrals.
// - A promo code (e.g. ATL SUPERHERO, typed with or without the space) adds a reward to the customer's account.
// - Share link: 10 different people open it -> 50% off a service.
// - Every 5 friends who sign up with the link -> 1 complimentary service.
// One reward applies automatically at checkout per job; S.O.S. covers the
// discount and the Hero is paid in full.
const SB='https://cxdqkjvtpilvouwtbgdy.supabase.co';
const SK='sb_publishable_x_QDbPwZuhbqB1bd58MLvg_ADSiFODN';
const REF_KEY='sos_ref',PROMO_KEY='sos_pending_promo',VISITOR_KEY='sos_visitor_id';
const getSession=()=>{try{const v=JSON.parse(localStorage.getItem('sos_session'));if(!v?.access_token)return null;if(v.expires_at&&v.expires_at<Date.now()/1000)return null;return v}catch{return null}};
const rpc=async(name,body,token)=>{const r=await fetch(`${SB}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:SK,Authorization:`Bearer ${token||SK}`,'Content-Type':'application/json'},body:JSON.stringify(body||{})});const d=await r.json().catch(()=>null);if(!r.ok)throw new Error(d?.message||'Rewards are unavailable right now.');return d};
const visitorId=()=>{try{let v=localStorage.getItem(VISITOR_KEY);if(!v){v=(crypto.randomUUID?.()||String(Math.random()).slice(2)+Date.now()).replace(/-/g,'');localStorage.setItem(VISITOR_KEY,v)}return v}catch{return''}};
const fmtDate=v=>v?new Date(v).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'';
const STATUS={available:'Ready to use',reserved:'Applied to a job',used:'Used',expired:'Expired',void:'Removed'};

// Read ?ref= and ?promo= from any link into the app, once per visit.
export function captureRewardLinks(){
  try{
    const q=new URLSearchParams(window.location.search);
    const ref=(q.get('ref')||'').toLowerCase().replace(/[^a-z0-9]/g,'');
    if(/^[a-z0-9]{6,12}$/.test(ref)){localStorage.setItem(REF_KEY,ref);const v=visitorId();if(v)rpc('sos_referral_link_open',{p_ref:ref,p_visitor:v},getSession()?.access_token).catch(()=>{})}
    const promo=(q.get('promo')||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
    if(promo.length>=3&&promo.length<=24)localStorage.setItem(PROMO_KEY,promo);
  }catch{}
}
export const pendingReferral=()=>{try{return localStorage.getItem(REF_KEY)||undefined}catch{return undefined}};

export default function SOSRewardsHost(){
  const[open,setOpen]=useState(false);const[data,setData]=useState(null);const[code,setCode]=useState('');const[busy,setBusy]=useState(false);const[msg,setMsg]=useState(null);const[copied,setCopied]=useState(false);
  const profileSlot=useAppSlot('profile'),statusSlot=useAppSlot('status');

  const load=async()=>{const s=getSession();if(!s){setData(null);return null}try{const d=await rpc('sos_my_rewards',{},s.access_token);setData(d?.ok?d:null);return d}catch{return null}};
  const redeem=async(value)=>{const s=getSession();const c=(value||code).trim();if(!c)return;if(!s){setMsg({bad:true,text:'Sign in to use a promo code.'});return}setBusy(true);setMsg(null);try{const d=await rpc('sos_redeem_promo_code',{p_code:c},s.access_token);setMsg({bad:!d?.ok,text:d?.message||'Code checked.'});if(d?.ok||d?.reason==='already_redeemed'){setCode('');try{localStorage.removeItem(PROMO_KEY)}catch{}}await load()}catch(e){setMsg({bad:true,text:e.message})}finally{setBusy(false)}};

  useEffect(()=>{captureRewardLinks();load();const onOpen=()=>setOpen(true);window.addEventListener('sos:open-rewards',onOpen);
    // A promo link (?promo=ATLSUPERHERO) applies itself once the customer is signed in.
    const t=setInterval(()=>{let p=null;try{p=localStorage.getItem(PROMO_KEY)}catch{}if(p&&getSession()){clearInterval(t);setOpen(true);redeem(p)}},1500);
    return()=>{window.removeEventListener('sos:open-rewards',onOpen);clearInterval(t)}},[]);
  useEffect(()=>{if(open)load()},[open]);

  const share=async()=>{if(!data?.share_url)return;const text=`I use S.O.S. for roadside help in Atlanta — towing, jump starts, flat tires, lockouts and fuel. Sign up with my link: ${data.share_url}`;try{if(navigator.share){await navigator.share({title:'S.O.S. Superheros On Standby',text,url:data.share_url});return}}catch{return}try{await navigator.clipboard.writeText(text);setCopied(true);setTimeout(()=>setCopied(false),2200)}catch{}};

  const available=(data?.credits||[]).filter(c=>c.status==='available');
  const opens=Math.min(data?.link_opens||0,data?.link_opens_goal||10),goal=data?.link_opens_goal||10;
  const per=data?.signups_per_reward||5,signups=data?.signups||0,towardNext=signups%per;

  const entry=profileSlot&&createPortal(<button type="button" data-sos-rewards-entry onClick={()=>setOpen(true)}><span>🎁</span><div><strong>Rewards & promo codes</strong><small>{available.length?`${available.length} reward${available.length>1?'s':''} ready to use`:'Enter a code or share S.O.S. to earn free service'}</small></div><em>›</em></button>,profileSlot);
  const banner=statusSlot&&available.length>0&&createPortal(<button type="button" className="sosx-reward-banner" data-sos-reward-banner onClick={()=>setOpen(true)}><b>🎁 {available[0].label}</b><span>Applies automatically at checkout</span></button>,statusSlot);

  return <>{entry}{banner}
    {open&&<div className="sosx-backdrop" onMouseDown={()=>setOpen(false)}><section className="sosx-sheet sosx-rewards" data-sos-rewards onMouseDown={e=>e.stopPropagation()}><div className="sosx-handle"/>
      <header><div><span>REWARDS</span><h2>Free service is<br/>one code away.</h2><p>Rewards apply automatically at checkout, one per service. Your Hero is always paid in full.</p></div><button onClick={()=>setOpen(false)} aria-label="Close rewards">×</button></header>
      {!getSession()&&<div className="sosx-notice">Sign in or create an account to add promo codes and earn rewards.</div>}
      <form className="sosx-promo" onSubmit={e=>{e.preventDefault();redeem()}}><label htmlFor="sos-promo-code">Promo code</label><div><input id="sos-promo-code" value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="e.g. ATL SUPERHERO" autoCapitalize="characters" autoComplete="off" maxLength={24}/><button disabled={busy||!code.trim()}>{busy?'Checking…':'Apply'}</button></div></form>
      {msg&&<div className={msg.bad?'sosx-error':'sosx-notice'} role="status">{msg.text}</div>}
      {data&&<>
        <div className="sosx-reward-grid">
          <article><small>SHARE S.O.S.</small><h3>50% off a service</h3><p>Send your link. When 10 different people open it, you get 50% off.</p><div className="sosx-meter" aria-label={`${opens} of ${goal} people opened your link`}><i style={{width:`${(opens/goal)*100}%`}}/></div><b>{data.share_reward_earned?'Earned ✓':`${opens} of ${goal} people opened your link`}</b></article>
          <article><small>INVITE FRIENDS</small><h3>1 complimentary service</h3><p>Every {per} friends who sign up with your link earns you a free service.</p><div className="sosx-meter" aria-label={`${towardNext} of ${per} friends signed up`}><i style={{width:`${(towardNext/per)*100}%`}}/></div><b>{towardNext} of {per} friends signed up{signups>=per?` · ${Math.floor(signups/per)} earned`:''}</b></article>
        </div>
        <div className="sosx-share"><code>{data.share_url}</code><button type="button" onClick={share}>{copied?'Copied ✓':'Share my link'}</button></div>
        <h4 className="sosx-rewards-title">Your rewards</h4>
        {(data.credits||[]).length===0?<p className="sosx-rewards-empty">No rewards yet. Add a code above or share your link.</p>:<ul className="sosx-reward-list">{data.credits.map(c=><li key={c.id} className={c.status}><div><strong>{c.label}</strong><small>{STATUS[c.status]||c.status}{c.status==='available'&&c.expires_at?` · use by ${fmtDate(c.expires_at)}`:''}</small></div><em>{c.kind==='free_service'?'FREE':`${c.percent_off}% OFF`}</em></li>)}</ul>}
      </>}
      <p className="sosx-truth">One reward per service. Rewards cover the service price; tips go to your Hero. Promo codes can't be exchanged for cash.</p>
    </section></div>}
  </>;
}
