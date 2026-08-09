'use client';

import React,{useEffect}from'react';
const SB='https://cxdqkjvtpilvouwtbgdy.supabase.co';
const SK='sb_publishable_x_QDbPwZuhbqB1bd58MLvg_ADSiFODN';
const CONFIG=`${SB}/functions/v1/marketplace-push-config`;
const stored=()=>{try{const s=JSON.parse(localStorage.getItem('sos_session'));if(!s?.access_token||!s?.user)return null;if(s.expires_at&&s.expires_at<Date.now()/1000)return null;return s}catch{return null}};
const toBytes=value=>{const pad='='.repeat((4-value.length%4)%4),raw=atob((value+pad).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)))};
const request=async(path,{method='GET',token,body}={})=>{const r=await fetch(`${SB}${path}`,{method,headers:{apikey:SK,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.message||d?.error||'Request failed');return d};

export default function SOSPushSubscriptionHost(){
 useEffect(()=>{let disposed=false;const sync=async()=>{if(disposed||!('serviceWorker'in navigator)||!('PushManager'in window)||typeof Notification==='undefined'||Notification.permission!=='granted')return;const s=stored();if(!s)return;const us=await request(`/rest/v1/sos_users?auth_id=eq.${s.user.id}&select=id,status&limit=1`,{token:s.access_token});if(!us?.[0]||us[0].status!=='active')return;const r=await fetch(CONFIG,{cache:'no-store'});const cfg=await r.json().catch(()=>({}));if(!r.ok||!cfg.ready||!cfg.publicKey)return;const reg=await navigator.serviceWorker.ready;let sub=await reg.pushManager.getSubscription();if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:toBytes(cfg.publicKey)});const j=sub.toJSON();if(!j.endpoint||!j.keys?.p256dh||!j.keys?.auth)return;await request('/rest/v1/rpc/marketplace_register_push_subscription',{method:'POST',token:s.access_token,body:{p_app:'sos',p_endpoint:j.endpoint,p_p256dh:j.keys.p256dh,p_auth:j.keys.auth,p_user_agent:navigator.userAgent}})};sync().catch(()=>{});const t=setInterval(()=>sync().catch(()=>{}),30000);const run=()=>sync().catch(()=>{});window.addEventListener('focus',run);window.addEventListener('online',run);window.addEventListener('sos:session-refreshed',run);return()=>{disposed=true;clearInterval(t);window.removeEventListener('focus',run);window.removeEventListener('online',run);window.removeEventListener('sos:session-refreshed',run)}},[]);return null;
}
