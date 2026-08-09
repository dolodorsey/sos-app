'use client';

import {useEffect,useMemo,useState} from 'react';
import styles from './SOSCustomerCoverageStatusHost.module.css';

const COVERAGE_URL='https://cxdqkjvtpilvouwtbgdy.supabase.co/functions/v1/marketplace-public-coverage';
const normalize=value=>String(value||'').trim().toLowerCase().replace(/\s+/g,' ');

export default function SOSCustomerCoverageStatusHost(){
 const[rows,setRows]=useState([]),[loaded,setLoaded]=useState(false),[notice,setNotice]=useState('');
 const map=useMemo(()=>{const next=new Map();for(const row of rows){const full=normalize(row.service_name);next.set(full,Boolean(row.has_verified_supply));next.set(normalize(full.replace(/ help$/,'').replace(/ delivery$/,'')),Boolean(row.has_verified_supply))}return next},[rows]);
 const covered=rows.filter(row=>row.has_verified_supply).length;
 useEffect(()=>{let alive=true;const load=async()=>{try{const r=await fetch(COVERAGE_URL,{headers:{Accept:'application/json'},cache:'no-store'});const d=await r.json().catch(()=>null);if(!alive)return;if(!r.ok)throw new Error('Coverage status unavailable');setRows(Array.isArray(d?.sos?.services)?d.sos.services:[]);setLoaded(true)}catch{if(alive){setRows([]);setLoaded(true)}}};load();const t=setInterval(load,60000);return()=>{alive=false;clearInterval(t)}},[]);
 useEffect(()=>{if(!loaded)return;const apply=()=>{for(const button of document.querySelectorAll('.sos2-service-list>button,.sos2-quick-grid>button')){const strong=button.querySelector('strong');if(!strong)continue;const key=normalize(strong.textContent);const available=map.has(key)&&Boolean(map.get(key));button.dataset.verifiedCoverage=available?'active':'activating';button.classList.toggle(styles.unavailable,!available);let badge=button.querySelector(`.${styles.badge}`);if(!badge){badge=document.createElement('span');badge.className=styles.badge;button.appendChild(badge)}badge.textContent=available?'Verified coverage':'Coverage activating'}};apply();const observer=new MutationObserver(apply);observer.observe(document.body,{subtree:true,childList:true});const block=event=>{const button=event.target?.closest?.(`button.${styles.unavailable}`);if(!button)return;event.preventDefault();event.stopImmediatePropagation();setNotice(rows.length?'S.O.S. verified Hero coverage is not active for this service yet. No mission was created.':'S.O.S. coverage status is temporarily unavailable. No mission was created.')};document.addEventListener('click',block,true);return()=>{observer.disconnect();document.removeEventListener('click',block,true)}},[loaded,rows,map]);
 useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),4200);return()=>clearTimeout(t)},[notice]);
 if(!loaded)return null;
 return <>{covered===0&&<aside className={styles.banner}><span/><div><strong>{rows.length?'Hero coverage is activating.':'Coverage check unavailable.'}</strong><small>{rows.length?`You can browse all ${rows.length} roadside services. Requests unlock service-by-service as real Heroes complete verification and payout onboarding.`:'Mission requests stay locked until verified Hero coverage can be confirmed.'}</small></div></aside>}{notice&&<div className={styles.toast}>{notice}</div>}</>;
}
