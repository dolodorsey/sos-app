'use client';

import React,{useEffect,useState}from'react';
import{createClient}from'@supabase/supabase-js';

const SB='https://cxdqkjvtpilvouwtbgdy.supabase.co';
const SK='sb_publishable_x_QDbPwZuhbqB1bd58MLvg_ADSiFODN';
const supabase=createClient(SB,SK,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const storedSession=()=>{try{const s=JSON.parse(localStorage.getItem('sos_session'));return s?.access_token&&s?.user?s:null}catch{return null}};
const toBytes=base64=>{const padding='='.repeat((4-base64.length%4)%4);const raw=atob((base64+padding).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from([...raw].map(ch=>ch.charCodeAt(0)))};

export default function SOSPushRegistrationHost(){
 const[supported,setSupported]=useState(false);const[permission,setPermission]=useState('default');const[ready,setReady]=useState(false);const[busy,setBusy]=useState(false);const[notice,setNotice]=useState('');
 const register=async(requestPermission=false)=>{
   if(!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window))return;
   setBusy(true);setNotice('');
   try{
     let next=Notification.permission;if(requestPermission&&next==='default')next=await Notification.requestPermission();setPermission(next);if(next!=='granted'){setReady(false);return}
     const session=storedSession();if(!session?.access_token){setReady(false);return}
     supabase.realtime.setAuth(session.access_token);
     const configRes=await fetch(`${SB}/functions/v1/marketplace-push-config`,{headers:{apikey:SK},cache:'no-store'});const config=await configRes.json().catch(()=>({}));if(!configRes.ok||!config?.ready||!config?.publicKey)throw new Error('S.O.S. push configuration is unavailable.')
     const worker=await navigator.serviceWorker.register('/marketplace-sw.js',{scope:'/'});await navigator.serviceWorker.ready
     let subscription=await worker.pushManager.getSubscription();if(!subscription)subscription=await worker.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:toBytes(String(config.publicKey))})
     const json=subscription.toJSON();const endpoint=subscription.endpoint,p256dh=String(json.keys?.p256dh||''),auth=String(json.keys?.auth||'');if(!endpoint||!p256dh||!auth)throw new Error('Browser push subscription is incomplete.')
     const response=await fetch(`${SB}/rest/v1/rpc/marketplace_register_push_subscription`,{method:'POST',headers:{apikey:SK,Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({p_app:'sos',p_endpoint:endpoint,p_p256dh:p256dh,p_auth:auth,p_user_agent:navigator.userAgent})});const body=await response.json().catch(()=>null);if(!response.ok)throw new Error(body?.message||body?.error||'Push registration failed.')
     setReady(true);setNotice('Background S.O.S. alerts are on.')
   }catch(error){setReady(false);setNotice(error?.message||'Background alerts could not be enabled.')}finally{setBusy(false)}
 };
 useEffect(()=>{const ok='serviceWorker'in navigator&&'PushManager'in window&&'Notification'in window;setSupported(ok);if(ok){setPermission(Notification.permission);if(Notification.permission==='granted')register(false).catch(()=>{})}},[]);
 if(!supported||permission==='denied')return null;if(ready&&!notice)return null;
 return <div style={{position:'fixed',right:12,bottom:52,zIndex:2450,width:'min(340px,calc(100vw - 24px))',display:'flex',justifyContent:'flex-end',pointerEvents:'none'}}><div style={{pointerEvents:'auto',padding:'9px 11px',borderRadius:14,background:'rgba(5,8,13,.94)',border:'1px solid rgba(255,138,76,.22)',boxShadow:'0 14px 42px rgba(0,0,0,.28)',color:'#fff',fontSize:9,lineHeight:1.4}}>{permission==='default'?<button type="button" onClick={()=>register(true)} disabled={busy} style={{border:0,borderRadius:10,padding:'9px 11px',background:'#ff8a4c',color:'#160c05',fontWeight:900,cursor:'pointer'}}>{busy?'ENABLING…':'ENABLE BACKGROUND S.O.S. ALERTS'}</button>:<span>{notice||'Background S.O.S. alerts connected.'}</span>}</div></div>;
}
