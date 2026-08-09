'use client';

import {useEffect,useMemo,useState} from 'react';
import styles from './SOSOpsAlertsHost.module.css';

const SB='https://cxdqkjvtpilvouwtbgdy.supabase.co';
const SK='sb_publishable_x_QDbPwZuhbqB1bd58MLvg_ADSiFODN';
const headers=token=>({apikey:SK,Authorization:`Bearer ${token}`,'Content-Type':'application/json'});
const when=value=>new Date(value).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});

export default function SOSOpsAlertsHost({session}){
 const[alerts,setAlerts]=useState([]),[open,setOpen]=useState(false),[error,setError]=useState('');
 const unread=useMemo(()=>alerts.filter(item=>!item.is_read).length,[alerts]);
 const load=async()=>{if(!session?.access_token)return;const r=await fetch(`${SB}/rest/v1/rpc/marketplace_ops_alert_feed`,{method:'POST',headers:headers(session.access_token),body:JSON.stringify({p_limit:60})});const d=await r.json().catch(()=>[]);if(!r.ok)throw new Error(d?.message||d?.error||'Ops alerts unavailable');setAlerts(Array.isArray(d)?d:[])};
 useEffect(()=>{if(!session?.access_token)return;load().catch(()=>{});const t=setInterval(()=>load().catch(()=>{}),12000);return()=>clearInterval(t)},[session?.access_token]);
 const markRead=async item=>{if(!session?.access_token)return;setError('');try{const r=await fetch(`${SB}/rest/v1/rpc/marketplace_ops_mark_alert_read`,{method:'POST',headers:headers(session.access_token),body:JSON.stringify({p_alert_id:item.id})});const d=await r.json().catch(()=>null);if(!r.ok||d!==true)throw new Error(d?.message||'Alert could not be marked read');setAlerts(current=>current.map(row=>row.id===item.id?{...row,is_read:true}:row))}catch(e){setError(e.message||'Alert could not be marked read')}};
 const openTarget=async item=>{await markRead(item);if(item.product_key==='on_call')window.location.assign('https://oncallallday.com/ops');else window.location.assign('/ops/heroes')};
 if(!alerts.length&&!open)return null;
 return <><button className={styles.launch} onClick={()=>setOpen(true)}><span>OPS INBOX</span>{unread>0&&<b>{unread}</b>}</button>{open&&<div className={styles.backdrop} onMouseDown={()=>setOpen(false)}><section className={styles.sheet} onMouseDown={e=>e.stopPropagation()}><header><div><span>MARKETPLACE OPERATIONS</span><h2>Application activity.</h2><p>New S.O.S. Hero and ON CALL provider applications, plus review-status changes, appear here automatically.</p></div><button onClick={()=>setOpen(false)}>×</button></header>{error&&<div className={styles.error}>{error}</div>}<div className={styles.list}>{alerts.length===0?<div className={styles.empty}>No operator alerts yet.</div>:alerts.map(item=><button key={item.id} className={item.is_read?styles.read:''} onClick={()=>openTarget(item)}><i className={item.product_key==='sos'?styles.sos:''}/><div><small>{item.product_key==='on_call'?'ON CALL':'S.O.S.'} · {when(item.created_at)}</small><strong>{item.title}</strong><span>{item.body||'Application activity updated.'}</span></div>{!item.is_read&&<em>NEW</em>}</button>)}</div><p className={styles.truth}>Read state is per operator. This inbox never exposes verification documents or credentials.</p></section></div>}</>;
}
