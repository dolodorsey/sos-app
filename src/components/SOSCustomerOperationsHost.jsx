'use client';

import React,{useEffect,useMemo,useState}from'react';
import{createClient}from'@supabase/supabase-js';

const SB='https://cxdqkjvtpilvouwtbgdy.supabase.co';
const SK='sb_publishable_x_QDbPwZuhbqB1bd58MLvg_ADSiFODN';
const client=createClient(SB,SK,{auth:{persistSession:false,autoRefreshToken:false}});
const stored=()=>{try{const s=JSON.parse(localStorage.getItem('sos_session'));return s?.access_token&&s?.user?s:null}catch{return null}};
const headers=t=>({apikey:SK,Authorization:`Bearer ${t}`,'Content-Type':'application/json'});
const miles=(a,b,c,d)=>{const r=3958.8,rad=v=>v*Math.PI/180;const x=rad(c-a),y=rad(d-b);const h=Math.sin(x/2)**2+Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(y/2)**2;return 2*r*Math.asin(Math.sqrt(h))};
const labels={assigned:'Hero assigned',en_route:'Hero en route',on_site:'Hero arrived',working:'Service in progress'};

export default function SOSCustomerOperationsHost(){
 const[mission,setMission]=useState(null),[hero,setHero]=useState(null),[alert,setAlert]=useState(null),[permission,setPermission]=useState(()=>typeof Notification==='undefined'?'denied':Notification.permission);
 useEffect(()=>{
  const s=stored();if(!s)return;let disposed=false,missionChannel=null,notificationChannel=null,locationTimer=null;
  const notify=row=>{setAlert(row);window.setTimeout(()=>setAlert(cur=>cur?.id===row.id?null:cur),4800);if(typeof Notification!=='undefined'&&Notification.permission==='granted'){const n=new Notification(row.title||'S.O.S. mission update',{body:row.body||'Your mission has an update.',tag:row.id?`sos-c-${row.id}`:`sos-c-${Date.now()}`,icon:'/favicon.png'});n.onclick=()=>{window.focus();window.location.assign('/app')}}};
  const rpc=async(name,body)=>{const r=await fetch(`${SB}/rest/v1/rpc/${name}`,{method:'POST',headers:headers(s.access_token),body:JSON.stringify(body||{})});const d=await r.json().catch(()=>null);if(!r.ok)throw new Error(d?.message||d?.error||'Request failed');return d};
  const loadLocation=async id=>{if(!id){if(!disposed)setHero(null);return}try{const rows=await rpc('sos_get_assigned_hero_live_location',{p_mission_id:id});const row=Array.isArray(rows)?rows[0]:rows;if(!disposed)setHero(row||null)}catch{if(!disposed)setHero(null)}};
  const connect=async()=>{
   const ur=await fetch(`${SB}/rest/v1/sos_users?auth_id=eq.${s.user.id}&select=id,role&limit=1`,{headers:headers(s.access_token)});const users=await ur.json().catch(()=>[]);const u=users?.[0];if(!u||u.role!=='citizen'||disposed)return;
   const refresh=async()=>{const r=await fetch(`${SB}/rest/v1/sos_missions?citizen_id=eq.${u.id}&status=in.(assigned,en_route,on_site,working)&select=id,status,requested_service_name,pickup_address,pickup_lat,pickup_lng,eta_minutes,hero_id&order=created_at.desc&limit=1`,{headers:headers(s.access_token)});const rows=await r.json().catch(()=>[]);const current=rows?.[0]||null;if(disposed)return;setMission(current);await loadLocation(current?.id)};
   await refresh();client.realtime.setAuth(s.access_token);
   missionChannel=client.channel(`sos-customer-mission:${u.id}`).on('postgres_changes',{event:'*',schema:'public',table:'sos_missions',filter:`citizen_id=eq.${u.id}`},()=>refresh().catch(()=>{})).subscribe();
   notificationChannel=client.channel(`sos-customer-notify:${u.id}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'sos_notifications',filter:`user_id=eq.${u.id}`},p=>notify(p.new||{})).subscribe();
   locationTimer=window.setInterval(()=>{if(!disposed&&mission?.id)loadLocation(mission.id)},5000);
  };
  connect().catch(e=>console.warn('S.O.S. customer operations host unavailable',e));return()=>{disposed=true;if(missionChannel)client.removeChannel(missionChannel);if(notificationChannel)client.removeChannel(notificationChannel);if(locationTimer)clearInterval(locationTimer)}
 },[mission?.id]);
 const distance=useMemo(()=>mission&&hero?.lat!=null&&hero?.lng!=null&&mission.pickup_lat!=null&&mission.pickup_lng!=null?miles(Number(hero.lat),Number(hero.lng),Number(mission.pickup_lat),Number(mission.pickup_lng)):null,[mission,hero]);
 const age=hero?.last_gps_at?Math.max(0,Math.floor((Date.now()-new Date(hero.last_gps_at).getTime())/1000)):null;
 const mapUrl=useMemo(()=>{if(hero?.lat==null||hero?.lng==null)return null;const d=.03;return `https://www.openstreetmap.org/export/embed.html?bbox=${Number(hero.lng)-d}%2C${Number(hero.lat)-d}%2C${Number(hero.lng)+d}%2C${Number(hero.lat)+d}&layer=mapnik&marker=${hero.lat}%2C${hero.lng}`},[hero]);
 const enable=async()=>{if(typeof Notification==='undefined')return;setPermission(await Notification.requestPermission())};
 if(!mission&&!alert&&permission!=='default')return null;
 return <>
  {permission==='default'&&<button type="button" onClick={enable} style={{position:'fixed',right:16,bottom:92,zIndex:1480,border:0,borderRadius:999,padding:'10px 13px',background:'#ff6b35',color:'#fff',fontSize:10,fontWeight:900,boxShadow:'0 12px 36px rgba(0,0,0,.32)'}}>ENABLE MISSION ALERTS</button>}
  {mission&&<section style={{position:'fixed',left:'50%',transform:'translateX(-50%)',bottom:84,zIndex:1450,width:'min(620px,calc(100vw - 28px))',overflow:'hidden',borderRadius:20,background:'rgba(7,16,24,.96)',color:'#fff',boxShadow:'0 20px 70px rgba(0,0,0,.42)',border:'1px solid rgba(255,255,255,.1)',backdropFilter:'blur(16px)'}}>
    {mapUrl&&<div style={{height:150,position:'relative',background:'#0d1722'}}><iframe title="Live S.O.S. Hero location" src={mapUrl} style={{width:'100%',height:'100%',border:0,filter:'saturate(.7) contrast(1.04)'}}/><div style={{position:'absolute',left:12,top:10,padding:'6px 8px',borderRadius:999,background:'rgba(7,16,24,.9)',fontSize:9,fontWeight:900,letterSpacing:'.08em'}}>LIVE HERO GPS</div></div>}
    <div style={{padding:'13px 15px'}}><small style={{fontSize:9,fontWeight:900,letterSpacing:'.12em',color:'#ff8a5c'}}>ACTIVE MISSION</small><strong style={{display:'block',fontSize:13,marginTop:3}}>{labels[mission.status]||mission.status} · {mission.requested_service_name}</strong><span style={{display:'block',fontSize:11,marginTop:4,color:'rgba(255,255,255,.64)'}}>{distance!=null?`${distance.toFixed(1)} mi away · approx. ${Math.max(2,Math.ceil(distance*3))} min`:hero?'Hero GPS connected':'Waiting for Hero GPS'}{age!=null?` · updated ${age<5?'now':`${age}s ago`}`:''}</span></div>
  </section>}
  {alert&&<div role="status" aria-live="polite" style={{position:'fixed',right:16,top:78,zIndex:1550,width:'min(360px,calc(100vw - 32px))',padding:'13px 15px',borderRadius:15,background:'#101922',color:'#fff',boxShadow:'0 18px 56px rgba(0,0,0,.36)',border:'1px solid rgba(255,255,255,.1)'}}><strong style={{display:'block',fontSize:13}}>{alert.title||'S.O.S. update'}</strong><span style={{display:'block',fontSize:11,marginTop:4,color:'rgba(255,255,255,.68)',lineHeight:1.45}}>{alert.body}</span></div>}
 </>
}
