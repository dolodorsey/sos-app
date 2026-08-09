'use client';

import {useEffect,useMemo,useState} from 'react';
import styles from './SOSCustomerCoverageStatusHost.module.css';

const SB='https://cxdqkjvtpilvouwtbgdy.supabase.co';
const SK='sb_publishable_x_QDbPwZuhbqB1bd58MLvg_ADSiFODN';
const normalize=value=>String(value||'').trim().toLowerCase().replace(/\s+/g,' ');

export default function SOSCustomerCoverageStatusHost(){
 const[rows,setRows]=useState([]),[notice,setNotice]=useState('');
 const map=useMemo(()=>{const next=new Map();for(const row of rows){const full=normalize(row.service_name);next.set(full,Boolean(row.has_verified_supply));next.set(normalize(full.replace(/ help$/,'').replace(/ delivery$/,'')),Boolean(row.has_verified_supply))}return next},[rows]);
 const covered=rows.filter(row=>row.has_verified_supply).length;
 useEffect(()=>{let alive=true;const load=async()=>{try{const r=await fetch(`${SB}/rest/v1/rpc/sos_public_service_coverage`,{method:'POST',headers:{apikey:SK,'Content-Type':'application/json'},body:'{}'});const d=await r.json();if(alive&&r.ok&&Array.isArray(d))setRows(d)}catch{}};load();const t=setInterval(load,60000);return()=>{alive=false;clearInterval(t)}},[]);
 useEffect(()=>{if(!rows.length)return;const apply=()=>{for(const button of document.querySelectorAll('.sos2-service-list>button,.sos2-quick-grid>button')){const strong=button.querySelector('strong');if(!strong)continue;const key=normalize(strong.textContent);if(!map.has(key))continue;const available=Boolean(map.get(key));button.dataset.verifiedCoverage=available?'active':'activating';button.classList.toggle(styles.unavailable,!available);let badge=button.querySelector(`.${styles.badge}`);if(!badge){badge=document.createElement('span');badge.className=styles.badge;button.appendChild(badge)}badge.textContent=available?'Verified coverage':'Coverage activating'}};apply();const observer=new MutationObserver(apply);observer.observe(document.body,{subtree:true,childList:true});const block=event=>{const button=event.target?.closest?.(`button.${styles.unavailable}`);if(!button)return;event.preventDefault();event.stopImmediatePropagation();setNotice('S.O.S. verified Hero coverage is not active for this service yet. No mission was created.')};document.addEventListener('click',block,true);return()=>{observer.disconnect();document.removeEventListener('click',block,true)}},[rows,map]);
 useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),4200);return()=>clearTimeout(t)},[notice]);
 if(!rows.length)return null;
 return <>{covered===0&&<aside className={styles.banner}><span/><div><strong>Hero coverage is activating.</strong><small>You can browse all {rows.length} roadside services. Requests unlock service-by-service as real Heroes complete 9/9 verification and payout onboarding.</small></div></aside>}{notice&&<div className={styles.toast}>{notice}</div>}</>;
}
