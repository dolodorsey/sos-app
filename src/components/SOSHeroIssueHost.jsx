'use client';

import React,{useEffect,useState}from'react';

const SB='https://cxdqkjvtpilvouwtbgdy.supabase.co';
const SK='sb_publishable_x_QDbPwZuhbqB1bd58MLvg_ADSiFODN';
const stored=()=>{try{const s=JSON.parse(localStorage.getItem('sos_session'));return s?.access_token&&s?.user?s:null}catch{return null}};
const request=async(path,{method='GET',token,body}={})=>{const r=await fetch(`${SB}${path}`,{method,headers:{apikey:SK,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.message||d?.error||'Request failed');return d};

export default function SOSHeroIssueHost(){
 const[mission,setMission]=useState(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 useEffect(()=>{let disposed=false;const load=async()=>{const s=stored();if(!s)return;const us=await request(`/rest/v1/sos_users?auth_id=eq.${s.user.id}&select=id,role&limit=1`,{token:s.access_token});const u=us?.[0];if(!u||u.role!=='hero')return;const hs=await request(`/rest/v1/sos_heroes?user_id=eq.${u.id}&select=id&limit=1`,{token:s.access_token});const h=hs?.[0];if(!h)return;const ms=await request(`/rest/v1/sos_missions?hero_id=eq.${h.id}&status=in.(assigned,en_route,on_site,working)&select=id,status,requested_service_name&order=accepted_at.desc&limit=1`,{token:s.access_token});if(!disposed)setMission(ms?.[0]||null)};load().catch(()=>{});const t=setInterval(()=>load().catch(()=>{}),12000);return()=>{disposed=true;clearInterval(t)}},[]);
 const report=async()=>{const s=stored();if(!s||!mission||busy)return;const reason=window.prompt('Issue type: hero_no_show, service_incomplete, damage_claim, wrong_service, pricing_dispute, safety_incident, or other',mission.status==='on_site'?'other':'other')?.trim();if(!reason)return;const description=window.prompt('Briefly describe what happened:')?.trim();if(!description)return;setBusy(true);setNotice('');try{const id=await request('/rest/v1/rpc/sos_open_mission_dispute',{method:'POST',token:s.access_token,body:{p_mission_id:mission.id,p_reason:reason,p_description:description}});setNotice(`Case ${String(id).replaceAll('"','').slice(0,8).toUpperCase()} opened.`)}catch(e){setNotice(e.message)}finally{setBusy(false);setTimeout(()=>setNotice(''),5000)}};
 if(!mission&&!notice)return null;
 return <div style={{position:'fixed',left:18,bottom:84,zIndex:1450}}>{mission&&<button type="button" onClick={report} disabled={busy} style={{border:'1px solid rgba(255,255,255,.12)',borderRadius:999,padding:'10px 13px',background:'#111b25',color:'#fff',fontSize:10,fontWeight:900,boxShadow:'0 12px 36px rgba(0,0,0,.32)',cursor:'pointer'}}>{busy?'SENDING…':'REPORT MISSION ISSUE'}</button>}{notice&&<div role="status" style={{marginTop:8,maxWidth:300,padding:'10px 12px',borderRadius:12,background:'#111b25',color:'#fff',fontSize:11,boxShadow:'0 12px 36px rgba(0,0,0,.3)'}}>{notice}</div>}</div>
}
