'use client';

import React,{useEffect,useState}from'react';

const SB='https://cxdqkjvtpilvouwtbgdy.supabase.co';
const SK='sb_publishable_x_QDbPwZuhbqB1bd58MLvg_ADSiFODN';
const stored=()=>{try{const s=JSON.parse(localStorage.getItem('sos_session'));return s?.access_token&&s?.user?s:null}catch{return null}};
const request=async(path,{method='GET',token,body}={})=>{const r=await fetch(`${SB}${path}`,{method,headers:{apikey:SK,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.message||d?.error||'Request failed');return d};

export default function SOSHeroIssueHost(){
 const[mission,setMission]=useState(null),[busy,setBusy]=useState(''),[notice,setNotice]=useState('');
 const load=async()=>{const s=stored();if(!s)return;const us=await request(`/rest/v1/sos_users?auth_id=eq.${s.user.id}&select=id,role&limit=1`,{token:s.access_token});const u=us?.[0];if(!u||u.role!=='hero')return;const hs=await request(`/rest/v1/sos_heroes?user_id=eq.${u.id}&select=id&limit=1`,{token:s.access_token});const h=hs?.[0];if(!h)return;const ms=await request(`/rest/v1/sos_missions?hero_id=eq.${h.id}&status=in.(assigned,en_route,on_site,working)&select=id,status,requested_service_name&order=accepted_at.desc&limit=1`,{token:s.access_token});setMission(ms?.[0]||null)};
 useEffect(()=>{let disposed=false;const run=()=>{if(!disposed)load().catch(()=>{})};run();const t=setInterval(run,10000);return()=>{disposed=true;clearInterval(t)}},[]);
 const report=async()=>{const s=stored();if(!s||!mission||busy)return;const reason=window.prompt('Issue type: hero_no_show, service_incomplete, damage_claim, wrong_service, pricing_dispute, safety_incident, or other',mission.status==='on_site'?'other':'other')?.trim();if(!reason)return;const description=window.prompt('Briefly describe what happened:')?.trim();if(!description)return;setBusy('report');setNotice('');try{const id=await request('/rest/v1/rpc/sos_open_mission_dispute',{method:'POST',token:s.access_token,body:{p_mission_id:mission.id,p_reason:reason,p_description:description}});setNotice(`Case ${String(id).replaceAll('"','').slice(0,8).toUpperCase()} opened.`)}catch(e){setNotice(e.message)}finally{setBusy('');setTimeout(()=>setNotice(''),5000)}};
 const release=async()=>{const s=stored();if(!s||!mission||busy||mission.status==='working')return;const late=mission.status==='en_route'||mission.status==='on_site';if(late&&!window.confirm('Release this mission after travel started? S.O.S. will rematch the customer immediately and pause your patrol availability.'))return;const reason=window.prompt('Why can’t you complete this mission?','Unable to complete this mission')?.trim();if(!reason)return;setBusy('release');setNotice('');try{await request('/rest/v1/rpc/sos_hero_release_mission',{method:'POST',token:s.access_token,body:{p_mission_id:mission.id,p_reason:reason}});setMission(null);setNotice(late?'Mission released. Customer rematching started and patrol was paused.':'Mission released. Customer rematching started.');setTimeout(()=>setNotice(''),5000)}catch(e){setNotice(e.message)}finally{setBusy('')}};
 if(!mission&&!notice)return null;
 return <div style={{position:'fixed',left:18,bottom:84,zIndex:1450,display:'grid',gap:7}}>
  {mission&&mission.status!=='working'&&<button type="button" onClick={release} disabled={!!busy} style={{border:'1px solid rgba(255,117,128,.34)',borderRadius:999,padding:'10px 13px',background:'#351319',color:'#ffd8dc',fontSize:10,fontWeight:900,boxShadow:'0 12px 36px rgba(0,0,0,.32)',cursor:'pointer'}}>{busy==='release'?'RELEASING…':'RELEASE MISSION'}</button>}
  {mission&&<button type="button" onClick={report} disabled={!!busy} style={{border:'1px solid rgba(255,255,255,.12)',borderRadius:999,padding:'10px 13px',background:'#111b25',color:'#fff',fontSize:10,fontWeight:900,boxShadow:'0 12px 36px rgba(0,0,0,.32)',cursor:'pointer'}}>{busy==='report'?'SENDING…':'REPORT MISSION ISSUE'}</button>}
  {notice&&<div role="status" style={{maxWidth:320,padding:'10px 12px',borderRadius:12,background:'#111b25',color:'#fff',fontSize:11,boxShadow:'0 12px 36px rgba(0,0,0,.3)'}}>{notice}</div>}
 </div>;
}
