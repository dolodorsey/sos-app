'use client';

import React,{useEffect,useState}from'react';
const SB='https://cxdqkjvtpilvouwtbgdy.supabase.co';
const SK='sb_publishable_x_QDbPwZuhbqB1bd58MLvg_ADSiFODN';
const stored=()=>{try{const s=JSON.parse(localStorage.getItem('sos_session'));return s?.access_token&&s?.user?s:null}catch{return null}};
const request=async(path,{method='GET',token,body}={})=>{const r=await fetch(`${SB}${path}`,{method,headers:{apikey:SK,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.message||d?.error||'Request failed');return d};

export default function SOSSettlementReviewHost(){
 const[mission,setMission]=useState(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[dismissed,setDismissed]=useState('');
 useEffect(()=>{let disposed=false;try{setDismissed(localStorage.getItem('sos_fee_review_dismissed')||'')}catch{};(async()=>{const s=stored();if(!s)return;const users=await request(`/rest/v1/sos_users?auth_id=eq.${s.user.id}&select=id,role&limit=1`,{token:s.access_token});const u=users?.[0];if(!u||u.role==='hero')return;const cutoff=new Date(Date.now()-14*86400000).toISOString();const rows=await request(`/rest/v1/sos_missions?citizen_id=eq.${u.id}&status=in.(canceled_by_citizen,canceled_by_system)&cancellation_fee=gt.0&updated_at=gte.${encodeURIComponent(cutoff)}&select=id,requested_service_name,status,cancellation_fee,cancel_reason,canceled_at,updated_at&order=updated_at.desc&limit=1`,{token:s.access_token});if(!disposed)setMission(rows?.[0]||null)})().catch(()=>{});return()=>{disposed=true}},[]);
 const review=async()=>{const s=stored();if(!s||!mission||busy)return;const description=window.prompt('Tell S.O.S. why this cancellation/no-show fee should be reviewed:')?.trim();if(!description)return;setBusy(true);setNotice('');try{const id=await request('/rest/v1/rpc/sos_open_mission_dispute',{method:'POST',token:s.access_token,body:{p_mission_id:mission.id,p_reason:'pricing_dispute',p_description:`Cancellation fee review: ${description}`}});setNotice(`Review ${String(id).replaceAll('"','').slice(0,8).toUpperCase()} opened.`);setTimeout(()=>setNotice(''),5000)}catch(e){setNotice(e.message)}finally{setBusy(false)}};
 const dismiss=()=>{if(!mission)return;try{localStorage.setItem('sos_fee_review_dismissed',mission.id)}catch{};setDismissed(mission.id)};
 if(!mission||dismissed===mission.id)return notice?<div style={{position:'fixed',right:16,bottom:92,zIndex:1500,padding:'11px 14px',borderRadius:13,background:'#111b25',color:'#fff',fontSize:11}}>{notice}</div>:null;
 const fee=Number(mission.cancellation_fee||0),isNoShow=mission.cancel_reason==='customer_no_show';
 return <section style={{position:'fixed',right:16,bottom:92,zIndex:1490,width:'min(390px,calc(100vw - 32px))',padding:15,borderRadius:18,background:'rgba(13,23,34,.97)',color:'#fff',border:'1px solid rgba(255,179,71,.22)',boxShadow:'0 18px 60px rgba(0,0,0,.36)',backdropFilter:'blur(16px)'}}>
   <div style={{display:'flex',justifyContent:'space-between',gap:10}}><div><small style={{fontSize:9,fontWeight:900,letterSpacing:'.12em',color:'#ffca78'}}>{isNoShow?'NO-SHOW FEE':'CANCELLATION FEE'}</small><strong style={{display:'block',fontSize:15,marginTop:4}}>{mission.requested_service_name||'S.O.S. mission'}</strong><span style={{display:'block',fontSize:11,color:'rgba(255,255,255,.64)',marginTop:3}}>${fee.toFixed(2)} · {mission.cancel_reason||'Applied under the live cancellation policy'}</span></div><button onClick={dismiss} aria-label="Dismiss" style={{border:0,background:'transparent',color:'#8fa0b4',fontSize:18}}>×</button></div>
   <p style={{fontSize:11,lineHeight:1.45,color:'rgba(255,255,255,.7)',margin:'11px 0'}}>If the arrival, timing, or fee is incorrect, open a pricing review. The mission and payment history stay attached to the dispute.</p>
   <button onClick={review} disabled={busy} style={{width:'100%',border:'1px solid rgba(255,255,255,.14)',borderRadius:12,padding:11,background:'#172632',color:'#fff',fontWeight:900,fontSize:10}}>{busy?'OPENING REVIEW…':'REVIEW THIS FEE'}</button>
   {notice&&<div style={{marginTop:8,fontSize:11,color:'#b9f6dc'}}>{notice}</div>}
 </section>;
}
