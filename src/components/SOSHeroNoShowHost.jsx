'use client';

import React,{useEffect,useState}from'react';
const SB='https://cxdqkjvtpilvouwtbgdy.supabase.co';
const SK='sb_publishable_x_QDbPwZuhbqB1bd58MLvg_ADSiFODN';
const stored=()=>{try{const s=JSON.parse(localStorage.getItem('sos_session'));return s?.access_token&&s?.user?s:null}catch{return null}};
const request=async(path,{method='GET',token,body}={})=>{const r=await fetch(`${SB}${path}`,{method,headers:{apikey:SK,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.message||d?.error_description||d?.error||'Request failed');return d};

export default function SOSHeroNoShowHost(){
 const[mission,setMission]=useState(null),[quote,setQuote]=useState(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const load=async()=>{const s=stored();if(!s){setMission(null);setQuote(null);return}const us=await request(`/rest/v1/sos_users?auth_id=eq.${s.user.id}&select=id,role&limit=1`,{token:s.access_token});const u=us?.[0];if(!u||u.role!=='hero'){setMission(null);setQuote(null);return}const hs=await request(`/rest/v1/sos_heroes?user_id=eq.${u.id}&select=id&limit=1`,{token:s.access_token});const h=hs?.[0];if(!h){setMission(null);setQuote(null);return}const ms=await request(`/rest/v1/sos_missions?hero_id=eq.${h.id}&status=eq.on_site&select=id,status,requested_service_name,arrived_at&order=arrived_at.desc&limit=1`,{token:s.access_token});const next=ms?.[0]||null;setMission(next);if(!next){setQuote(null);return}try{setQuote(await request('/functions/v1/sos-customer-no-show',{method:'POST',token:s.access_token,body:{missionId:next.id,action:'quote'}}))}catch{setQuote(null)}};
 useEffect(()=>{let disposed=false;const run=()=>{if(!disposed)load().catch(()=>{})};run();const t=setInterval(run,5000);return()=>{disposed=true;clearInterval(t)}},[]);
 const settle=async()=>{const s=stored();if(!s||!mission||!quote?.canSettle||busy)return;if(!window.confirm(`Close this mission as a customer no-show?\n\nS.O.S. will capture a $${Number(quote.fee||0).toFixed(2)} no-show fee. Your Hero compensation is $${Number(quote.heroCompensation||0).toFixed(2)}.`))return;setBusy(true);setNotice('');try{const d=await request('/functions/v1/sos-customer-no-show',{method:'POST',token:s.access_token,body:{missionId:mission.id,action:'settle'}});setMission(null);setQuote(null);setNotice(`Customer no-show recorded. $${Number(d.heroCompensation||0).toFixed(2)} Hero compensation is processing.`)}catch(e){setNotice(e.message)}finally{setBusy(false);setTimeout(()=>setNotice(''),5000)}};
 if(!mission&&!notice)return null;const remaining=Math.max(0,Number(quote?.remainingMinutes||0));
 return <div style={{position:'fixed',left:18,bottom:190,zIndex:1480,display:'grid',gap:7}}>
  {mission&&quote&&!quote.canSettle&&<div style={{padding:'10px 13px',borderRadius:999,background:'rgba(17,27,37,.96)',color:'#fff',border:'1px solid rgba(255,255,255,.12)',fontSize:10,fontWeight:900,boxShadow:'0 12px 36px rgba(0,0,0,.32)'}}>CUSTOMER NO-SHOW · {remaining>0?`${remaining} MIN`:quote.reason||'NOT READY'}</div>}
  {mission&&quote?.canSettle&&<button type="button" onClick={settle} disabled={busy} style={{border:'1px solid rgba(255,183,71,.35)',borderRadius:999,padding:'10px 13px',background:'#34230a',color:'#ffdca5',fontSize:10,fontWeight:900,boxShadow:'0 12px 36px rgba(0,0,0,.32)',cursor:'pointer'}}>{busy?'SETTLING…':`CUSTOMER NO-SHOW · $${Number(quote.heroCompensation||0).toFixed(2)} COMP`}</button>}
  {notice&&<div role="status" style={{maxWidth:330,padding:'10px 12px',borderRadius:12,background:'#111b25',color:'#fff',fontSize:11,boxShadow:'0 12px 36px rgba(0,0,0,.3)'}}>{notice}</div>}
 </div>;
}
