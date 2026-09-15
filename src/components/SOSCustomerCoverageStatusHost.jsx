'use client';

import {useEffect,useMemo,useState} from 'react';
import styles from './SOSCustomerCoverageStatusHost.module.css';

const COVERAGE_URL='https://cxdqkjvtpilvouwtbgdy.supabase.co/functions/v1/sos-public-coverage';
const normalize=value=>String(value||'').trim().toLowerCase().replace(/\s+/g,' ');

export default function SOSCustomerCoverageStatusHost(){
 const[rows,setRows]=useState([]),[loaded,setLoaded]=useState(false),[notice,setNotice]=useState('');
 const[retry,setRetry]=useState(0),[checking,setChecking]=useState(true);
 const[customerVisible,setCustomerVisible]=useState(false);
 useEffect(()=>{
  const sync=()=>setCustomerVisible(Boolean(document.querySelector('.sos2-nav')));
  sync();const observer=new MutationObserver(sync);observer.observe(document.body,{childList:true,subtree:true});
  return()=>observer.disconnect();
 },[]);
 const map=useMemo(()=>{const next=new Map();for(const row of rows){const full=normalize(row.service_name);next.set(full,Boolean(row.has_verified_supply));next.set(normalize(full.replace(/ help$/,'').replace(/ delivery$/,'')),Boolean(row.has_verified_supply))}return next},[rows]);
 const covered=rows.filter(row=>row.has_verified_supply).length;
 useEffect(()=>{
  let alive=true,controller=null;
  const load=async()=>{
   controller?.abort();
   const request=new AbortController();controller=request;
   const timeout=setTimeout(()=>request.abort(),10000);
   setChecking(true);
   try{
    const r=await fetch(COVERAGE_URL,{headers:{Accept:'application/json'},cache:'no-store',signal:request.signal});
    const d=await r.json().catch(()=>null);
    if(!r.ok||!Array.isArray(d?.sos?.services))throw new Error('Coverage status unavailable');
    if(alive&&controller===request)setRows(d.sos.services);
   }catch{if(alive&&controller===request)setRows([])}
   finally{clearTimeout(timeout);if(alive&&controller===request){setLoaded(true);setChecking(false)}}
  };
  load();const t=setInterval(load,60000);
  return()=>{alive=false;controller?.abort();clearInterval(t)};
 },[retry]);
 useEffect(()=>{const apply=()=>{for(const button of document.querySelectorAll('.sos2-service-list>button,.sos2-quick-grid>button')){const strong=button.querySelector('strong');if(!strong)continue;const key=normalize(strong.textContent);const available=map.has(key)&&Boolean(map.get(key));button.dataset.verifiedCoverage=available?'active':'activating';button.classList.toggle(styles.unavailable,!available);let badge=button.querySelector(`.${styles.badge}`);if(!badge){badge=document.createElement('span');badge.className=styles.badge;button.appendChild(badge)}const label=available?'Verified coverage':'Coverage activating';/* Avoid replacing child nodes when the observed text is already correct. */if(badge.textContent!==label)badge.textContent=label;}};apply();const observer=new MutationObserver(apply);observer.observe(document.body,{subtree:true,childList:true});const block=event=>{const button=event.target?.closest?.(`button.${styles.unavailable}`);if(!button)return;event.preventDefault();event.stopImmediatePropagation();setNotice(rows.length?'S.O.S. verified Hero coverage is not active for this service yet. No mission was created.':'S.O.S. coverage status is temporarily unavailable. No mission was created.')};document.addEventListener('click',block,true);return()=>{observer.disconnect();document.removeEventListener('click',block,true)}},[loaded,rows,map]);
 useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),4200);return()=>clearTimeout(t)},[notice]);
 if(!customerVisible)return null;
 if(!loaded)return <aside className={styles.banner} role="status" aria-live="polite"><span/><div><strong>Checking Hero coverage…</strong><small>We’ll confirm service availability before you request help.</small></div></aside>;
 return <>{covered===0&&<aside className={styles.banner} role="status" aria-live="polite"><span/><div><strong>{rows.length?'Hero coverage is activating.':'Coverage check unavailable.'}</strong><small>{rows.length?`You can browse all ${rows.length} roadside services. Requests unlock service-by-service as real Heroes complete verification and payout onboarding.`:'Mission requests stay locked until verified Hero coverage can be confirmed.'}</small>{rows.length===0&&<button type="button" className={styles.retry} disabled={checking} onClick={()=>setRetry(value=>value+1)}>{checking?'Checking…':'Check coverage again'}</button>}</div></aside>}{notice&&<div className={styles.toast} role="status" aria-live="polite" aria-atomic="true">{notice}</div>}</>;
}
