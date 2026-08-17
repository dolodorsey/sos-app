'use client';

import React,{useEffect,useMemo,useState}from'react';
import{authorizeSosRealtime,getSosRealtimeClient}from'../lib/sosRealtimeClient';

const SB='https://cxdqkjvtpilvouwtbgdy.supabase.co';
const SK='sb_publishable_x_QDbPwZuhbqB1bd58MLvg_ADSiFODN';
const headers=token=>({apikey:SK,Authorization:`Bearer ${token}`,'Content-Type':'application/json'});
const storedSession=()=>{try{const v=JSON.parse(localStorage.getItem('sos_session'));if(!v?.access_token||!v?.user)return null;if(v.expires_at&&v.expires_at<Date.now()/1000)return null;return v}catch{return null}};
const req=async(path,{method='GET',token,body}={})=>{const r=await fetch(`${SB}${path}`,{method,headers:headers(token),body:body===undefined?undefined:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.message||d?.error||'Request failed');return d};
const rpc=(token,name,body={})=>req(`/rest/v1/rpc/${name}`,{method:'POST',token,body});
const miles=(a,b,c,d)=>{const r=3958.8,tr=v=>v*Math.PI/180;const x=tr(c-a),y=tr(d-b);const h=Math.sin(x/2)**2+Math.cos(tr(a))*Math.cos(tr(c))*Math.sin(y/2)**2;return 2*r*Math.asin(Math.sqrt(h))};
const liveStatuses=new Set(['assigned','en_route','on_site','working']);
const labels={assigned:'Hero assigned',en_route:'Hero en route',on_site:'Hero arrived',working:'Roadside service in progress'};

export default function SOSCustomerLiveHost(){
 const[session,setSession]=useState(null),[mission,setMission]=useState(null),[position,setPosition]=useState(null),[alert,setAlert]=useState(null),[permission,setPermission]=useState('denied'),[busy,setBusy]=useState(false);
 useEffect(()=>{
   let disposed=false,missionCh=null,posCh=null,notificationCh=null;
   if(typeof Notification!=='undefined')setPermission(Notification.permission);
   const show=row=>{setAlert(row);window.setTimeout(()=>setAlert(cur=>cur?.id===row?.id?null:cur),4200);if(typeof Notification!=='undefined'&&Notification.permission==='granted'){const n=new Notification(row?.title||'S.O.S. update',{body:row?.body||'Your roadside mission has an update.',tag:row?.id?`sos-${row.id}`:`sos-${Date.now()}`,icon:'/favicon.png'});n.onclick=()=>window.focus()}};
   const connect=async()=>{
     const s=storedSession();if(!s||disposed)return;setSession(s);
     const users=await req(`/rest/v1/sos_users?auth_id=eq.${s.user.id}&select=id,role&limit=1`,{token:s.access_token});const u=users?.[0];if(!u||u.role==='hero'||disposed)return;
     const missions=await req(`/rest/v1/sos_missions?citizen_id=eq.${u.id}&status=in.(assigned,en_route,on_site,working)&select=id,status,hero_id,requested_service_name,pickup_lat,pickup_lng,pickup_address,eta_minutes,accepted_at&order=created_at.desc&limit=1`,{token:s.access_token});const m=missions?.[0]||null;setMission(m);
     if(m){const p=await req(`/rest/v1/sos_mission_live_positions?mission_id=eq.${m.id}&select=lat,lng,updated_at&limit=1`,{token:s.access_token});setPosition(p?.[0]||null)}
     const client=authorizeSosRealtime(s.access_token);
     missionCh=client.channel(`sos-customer-mission:${u.id}`).on('postgres_changes',{event:'*',schema:'public',table:'sos_missions',filter:`citizen_id=eq.${u.id}`},payload=>{const row=payload.new||{};if(row.id&&liveStatuses.has(row.status))setMission(row);else if(row.id===m?.id&&!liveStatuses.has(row.status)){setMission(null);setPosition(null)}}).subscribe();
     if(m)posCh=client.channel(`sos-live-position:${m.id}`).on('postgres_changes',{event:'*',schema:'public',table:'sos_mission_live_positions',filter:`mission_id=eq.${m.id}`},payload=>setPosition(payload.new||null)).subscribe();
     notificationCh=client.channel(`sos-customer-notify:${u.id}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'sos_notifications',filter:`user_id=eq.${u.id}`},payload=>show(payload.new||{})).subscribe();
   };
   connect().catch(e=>console.warn('S.O.S. customer live layer unavailable',e));
   return()=>{disposed=true;const client=getSosRealtimeClient();[missionCh,posCh,notificationCh].forEach(ch=>{if(ch)client.removeChannel(ch)})}
 },[]);
 const distance=useMemo(()=>mission&&position&&mission.pickup_lat!=null&&mission.pickup_lng!=null?miles(Number(position.lat),Number(position.lng),Number(mission.pickup_lat),Number(mission.pickup_lng)):null,[mission,position]);
 const age=position?.updated_at?Math.max(0,Math.floor((Date.now()-new Date(position.updated_at).getTime())/1000)):null;
 const report=async()=>{if(!mission||!session||busy)return;const reason=window.prompt('Issue type: hero_no_show, service_incomplete, damage_claim, wrong_service, pricing_dispute, safety_incident, or other','other')?.trim();if(!reason)return;const description=window.prompt('Briefly describe what happened:')?.trim();if(!description)return;setBusy(true);try{const id=await rpc(session.access_token,'sos_open_mission_dispute',{p_mission_id:mission.id,p_reason:reason,p_description:description});setAlert({title:'S.O.S. support case opened',body:`Case ${String(id).slice(0,8).toUpperCase()} is recorded.`})}catch(e){setAlert({title:'Could not open case',body:e.message})}finally{setBusy(false)}};
 const enable=async()=>{if(typeof Notification==='undefined')return;setPermission(await Notification.requestPermission())};
 if(!mission&&!alert&&permission!=='default')return null;
 return <>
   {permission==='default'&&<button type="button" onClick={enable} style={{position:'fixed',right:16,bottom:92,zIndex:1180,border:0,borderRadius:999,padding:'10px 13px',background:'#101922',color:'#fff',fontSize:10,fontWeight:900,boxShadow:'0 12px 36px rgba(0,0,0,.28)'}}>ENABLE HERO ALERTS</button>}
   {mission&&<section style={{position:'fixed',left:'50%',transform:'translateX(-50%)',bottom:84,zIndex:1150,width:'min(570px,calc(100vw - 28px))',borderRadius:18,padding:'13px 15px',background:'rgba(7,16,24,.95)',color:'#fff',boxShadow:'0 18px 60px rgba(0,0,0,.38)',border:'1px solid rgba(255,255,255,.10)',backdropFilter:'blur(16px)'}}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}><div><small style={{fontSize:9,fontWeight:900,letterSpacing:'.12em',color:'#ff8a5b'}}>LIVE HERO</small><strong style={{display:'block',fontSize:13,marginTop:3}}>{labels[mission.status]||mission.status} · {mission.requested_service_name}</strong><span style={{display:'block',fontSize:11,marginTop:3,color:'rgba(255,255,255,.66)'}}>{distance!=null?`${distance.toFixed(1)} mi from you · approx. ${Math.max(2,Math.ceil(distance*3))} min`:position?'Hero GPS connected':'Waiting for live Hero GPS'}{age!=null?` · updated ${age<5?'now':`${age}s ago`}`:''}</span></div><button type="button" onClick={report} disabled={busy} style={{border:'1px solid rgba(255,255,255,.15)',background:'transparent',color:'#fff',borderRadius:10,padding:'9px 10px',fontSize:10,fontWeight:800,cursor:'pointer'}}>{busy?'SENDING…':'GET HELP'}</button></div></section>}
   {alert&&<div role="status" aria-live="polite" style={{position:'fixed',right:16,top:78,zIndex:1300,width:'min(360px,calc(100vw - 32px))',padding:'13px 15px',borderRadius:15,background:'#101922',color:'#fff',boxShadow:'0 18px 56px rgba(0,0,0,.34)'}}><strong style={{display:'block',fontSize:13}}>{alert.title||'S.O.S. update'}</strong><span style={{display:'block',fontSize:11,marginTop:4,color:'rgba(255,255,255,.68)',lineHeight:1.45}}>{alert.body}</span></div>}
 </>
}
