'use client';

import React,{useEffect,useState}from'react';
const SB='https://cxdqkjvtpilvouwtbgdy.supabase.co';
const SK='sb_publishable_x_QDbPwZuhbqB1bd58MLvg_ADSiFODN';
const stored=()=>{try{const s=JSON.parse(localStorage.getItem('sos_session'));return s?.access_token&&s?.user?s:null}catch{return null}};
const rpc=async(token,name)=>{const r=await fetch(`${SB}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:SK,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:'{}'});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.message||d?.error||'Request failed');return d};
export default function SOSHeroReliabilityHost(){
 const[state,setState]=useState(null),[open,setOpen]=useState(false);
 useEffect(()=>{let disposed=false;const load=async()=>{const s=stored();if(!s)return;try{const d=await rpc(s.access_token,'sos_hero_reliability_status');if(!disposed)setState(d)}catch{}};load();const t=setInterval(load,30000);return()=>{disposed=true;clearInterval(t)}},[]);
 if(!state?.needs_review)return null;const safety=state.open_safety_reviews||[],events=state.recent_reliability_events||[];
 return <div style={{position:'fixed',right:16,bottom:84,zIndex:1495,width:open?'min(390px,calc(100vw - 32px))':'auto'}}>
  {!open?<button type="button" onClick={()=>setOpen(true)} style={{border:'1px solid rgba(255,183,71,.35)',borderRadius:999,padding:'10px 13px',background:'#34230a',color:'#ffdca5',fontSize:10,fontWeight:900,boxShadow:'0 12px 36px rgba(0,0,0,.32)'}}>HERO RELIABILITY REVIEW · {safety.length}</button>:
  <section style={{padding:15,borderRadius:18,background:'rgba(17,27,37,.98)',color:'#fff',border:'1px solid rgba(255,183,71,.25)',boxShadow:'0 20px 60px rgba(0,0,0,.42)'}}><div style={{display:'flex',justifyContent:'space-between',gap:10}}><div><small style={{fontSize:9,letterSpacing:'.12em',fontWeight:900,color:'#ffca78'}}>HERO RELIABILITY</small><strong style={{display:'block',marginTop:4,fontSize:15}}>Your field account needs review.</strong></div><button onClick={()=>setOpen(false)} style={{border:0,background:'transparent',color:'#9aa6b7',fontSize:18}}>×</button></div><p style={{fontSize:11,lineHeight:1.45,color:'rgba(255,255,255,.68)'}}>These are your own unresolved safety/reliability records. They do not expose other Heroes or internal operations data.</p>{safety.map((s,i)=><div key={i} style={{padding:11,borderRadius:12,background:'rgba(255,183,71,.08)',marginTop:8}}><b style={{fontSize:11,textTransform:'capitalize'}}>{(s.event_type||'review').replaceAll('_',' ')}</b><span style={{display:'block',fontSize:10,color:'rgba(255,255,255,.65)',marginTop:3}}>{s.notes||'Reliability review in progress'}</span></div>)}{events.slice(0,3).map((e,i)=><div key={`e-${i}`} style={{padding:10,borderRadius:12,background:'rgba(255,255,255,.05)',marginTop:8}}><b style={{fontSize:10,textTransform:'capitalize'}}>{(e.event||'reliability event').replaceAll('_',' ')}</b><span style={{display:'block',fontSize:9,color:'rgba(255,255,255,.58)',marginTop:3}}>{e.created_at?new Date(e.created_at).toLocaleString():''}</span></div>)}</section>}
 </div>;
}
