'use client';

import {useEffect,useState} from 'react';
import styles from './SOSHeroVerificationReadinessHost.module.css';

const SB='https://cxdqkjvtpilvouwtbgdy.supabase.co';
const SK='sb_publishable_x_QDbPwZuhbqB1bd58MLvg_ADSiFODN';
const headers=token=>({apikey:SK,Authorization:`Bearer ${token}`,'Content-Type':'application/json'});
const session=()=>{try{const s=JSON.parse(localStorage.getItem('sos_session'));return s?.access_token?s:null}catch{return null}};
const label=v=>String(v||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());

export default function SOSHeroVerificationReadinessHost(){
 const[state,setState]=useState(null),[open,setOpen]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const load=async()=>{const s=session();if(!s)return;const r=await fetch(`${SB}/rest/v1/rpc/sos_hero_verification_status`,{method:'POST',headers:headers(s.access_token),body:'{}'});const d=await r.json().catch(()=>null);if(!r.ok)throw new Error(d?.message||d?.error||'Hero verification status unavailable');setState(d)};
 useEffect(()=>{let alive=true;const refresh=()=>load().catch(()=>{});refresh();const t=setInterval(refresh,12000);return()=>{alive=false;clearInterval(t)}},[]);
 const ready=Boolean(state?.dispatch_ready);
 useEffect(()=>{if(state?.state!=='hero')return;document.documentElement.dataset.sosHeroVerificationUi='1';document.documentElement.dataset.sosHeroDispatchReady=ready?'true':'false';if(!ready)setOpen(true);return()=>{delete document.documentElement.dataset.sosHeroVerificationUi;delete document.documentElement.dataset.sosHeroDispatchReady}},[state?.state,ready]);
 if(state?.state!=='hero'||ready)return null;
 const checks=state.checks||[];const payout=checks.find(c=>c.check_type==='payout_account');
 const onboard=async()=>{const s=session();if(!s)return;setBusy(true);setError('');try{const r=await fetch(`${SB}/functions/v1/hero-payouts`,{method:'POST',headers:headers(s.access_token),body:JSON.stringify({action:'onboard'})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.error||'Payout setup unavailable');if(d.onboarding_url)window.location.assign(d.onboarding_url);else await load()}catch(e){setError(e.message)}finally{setBusy(false)}};
 return <><button className={styles.launch} onClick={()=>setOpen(true)}><span>HERO SETUP REQUIRED</span><b>{state.passed_checks||0}/{state.required_checks||9}</b><small>{label(state.verification_status||'pending')}</small></button>{open&&<div className={styles.backdrop} onMouseDown={()=>setOpen(false)}><section className={styles.sheet} onMouseDown={e=>e.stopPropagation()}><header><div><span>HERO LAUNCH READINESS</span><h2>Complete 9/9 before patrol.</h2><p>These are the exact checks enforced by S.O.S. when you try to go on patrol. There is no separate “verified” shortcut.</p></div><button onClick={()=>setOpen(false)}>×</button></header>{error&&<div className={styles.error}>{error}</div>}<div className={styles.progress}><strong>{state.passed_checks||0}</strong><span>of {state.required_checks||9} required checks passed</span></div><div className={styles.checks}>{checks.map(check=>{const done=check.status==='passed';const stripe=check.check_type==='payout_account';return <div className={done?styles.done:''} key={check.check_type}><i>{done?'✓':stripe?'$':'!'}</i><span><strong>{label(check.check_type)}</strong><small>{stripe?'STRIPE-MANAGED':check.required?'REQUIRED':'OPTIONAL'} · {label(check.status)}</small>{check.notes&&<em>{check.notes}</em>}</span></div>})}</div>{payout?.status!=='passed'&&<button className={styles.primary} disabled={busy} onClick={onboard}>{busy?'Opening Stripe…':'Finish payout setup →'}</button>}<p className={styles.truth}>Identity, background, license, insurance, equipment, vehicle, service skills, test mission, and payout account must all pass before patrol can start.</p></section></div>}</>;
}
