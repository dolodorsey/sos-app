'use client';

import React,{useEffect,useState}from'react';
import{createClient}from'@supabase/supabase-js';

const SB='https://cxdqkjvtpilvouwtbgdy.supabase.co';
const SK='sb_publishable_x_QDbPwZuhbqB1bd58MLvg_ADSiFODN';
const client=createClient(SB,SK,{auth:{persistSession:false,autoRefreshToken:false}});
const stored=()=>{try{const s=JSON.parse(localStorage.getItem('sos_session'));return s?.access_token&&s?.user?s:null}catch{return null}};

export default function SOSHeroAlertsHost(){
 const[permission,setPermission]=useState(()=>typeof Notification==='undefined'?'denied':Notification.permission),[alert,setAlert]=useState(null);
 useEffect(()=>{
  const s=stored();if(!s)return;let channel=null,disposed=false;
  const run=async()=>{
   const r=await fetch(`${SB}/rest/v1/sos_users?auth_id=eq.${s.user.id}&select=id,role&limit=1`,{headers:{apikey:SK,Authorization:`Bearer ${s.access_token}`}});const rows=await r.json().catch(()=>[]);const u=rows?.[0];if(!u||u.role!=='hero'||disposed)return;
   client.realtime.setAuth(s.access_token);
   channel=client.channel(`sos-hero-alerts:${u.id}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'sos_notifications',filter:`user_id=eq.${u.id}`},payload=>{
    const row=payload.new||{};setAlert(row);window.setTimeout(()=>setAlert(cur=>cur?.id===row.id?null:cur),5000);
    if(typeof Notification!=='undefined'&&Notification.permission==='granted'){const n=new Notification(row.title||'S.O.S. Hero Command',{body:row.body||'Your Hero network has an update.',tag:row.id?`hero-${row.id}`:`hero-${Date.now()}`,icon:'/favicon.png'});n.onclick=()=>{window.focus();window.location.assign('/hero')}}
   }).subscribe();
  };
  run().catch(e=>console.warn('Hero realtime alerts unavailable',e));return()=>{disposed=true;if(channel)client.removeChannel(channel)}
 },[]);
 const enable=async()=>{if(typeof Notification==='undefined')return;const p=await Notification.requestPermission();setPermission(p);if(p==='granted')setAlert({title:'Hero alerts enabled',body:'Mission offers and field updates can now alert you.'})};
 return <>{permission==='default'&&<button type="button" onClick={enable} style={{position:'fixed',right:16,bottom:92,zIndex:1400,border:0,borderRadius:999,padding:'10px 13px',background:'#ff6b35',color:'#fff',fontSize:10,fontWeight:900,boxShadow:'0 12px 36px rgba(0,0,0,.32)'}}>ENABLE MISSION ALERTS</button>}{alert&&<div role="status" aria-live="polite" style={{position:'fixed',right:16,top:78,zIndex:1500,width:'min(360px,calc(100vw - 32px))',padding:'13px 15px',borderRadius:15,background:'#101922',color:'#fff',boxShadow:'0 18px 56px rgba(0,0,0,.36)',border:'1px solid rgba(255,255,255,.1)'}}><strong style={{display:'block',fontSize:13}}>{alert.title||'S.O.S. update'}</strong><span style={{display:'block',fontSize:11,marginTop:4,color:'rgba(255,255,255,.68)',lineHeight:1.45}}>{alert.body}</span></div>}</>
}
