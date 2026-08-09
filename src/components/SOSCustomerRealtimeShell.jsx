'use client';

import React,{useEffect,useRef,useState}from'react';
import {createClient}from'@supabase/supabase-js';
import SOSCustomerMobilityApp from'./SOSCustomerMobilityApp';

const SB='https://cxdqkjvtpilvouwtbgdy.supabase.co';
const SK='sb_publishable_x_QDbPwZuhbqB1bd58MLvg_ADSiFODN';
const session=()=>{try{const s=JSON.parse(localStorage.getItem('sos_session'));return s?.access_token&&s?.user?s:null}catch{return null}};
const activeTabLabel=()=>document.querySelector('.sos2-nav button.active small')?.textContent||'Home';
const restoreTab=label=>{const buttons=[...document.querySelectorAll('.sos2-nav button')];buttons.find(button=>String(button.textContent||'').toLowerCase().includes(String(label||'').toLowerCase()))?.click?.()};

export default function SOSCustomerRealtimeShell(){
 const[version,setVersion]=useState(0);const[connection,setConnection]=useState('connecting');const restore=useRef('Home');const timer=useRef(null);
 const refresh=preferred=>{restore.current=preferred||activeTabLabel();if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>setVersion(v=>v+1),120)};
 useEffect(()=>{const t=setTimeout(()=>restoreTab(restore.current),500);return()=>clearTimeout(t)},[version]);
 useEffect(()=>{
   let disposed=false;let currentToken='';let client=null;let channel=null;
   const disconnect=()=>{if(channel&&client)client.removeChannel(channel);channel=null;client=null;currentToken=''};
   const connect=()=>{
     const s=session();if(!s?.access_token){if(currentToken){disconnect();setConnection('connecting')}return}if(s.access_token===currentToken&&channel)return;
     disconnect();currentToken=s.access_token;client=createClient(SB,SK,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});client.realtime.setAuth(s.access_token);
     channel=client.channel(`sos-customer-live-${s.user.id}`)
       .on('postgres_changes',{event:'*',schema:'public',table:'sos_missions'},()=>refresh('Missions'))
       .on('postgres_changes',{event:'*',schema:'public',table:'sos_payments'},()=>refresh('Missions'))
       .on('postgres_changes',{event:'*',schema:'public',table:'sos_mission_offers'},()=>refresh('Missions'))
       .subscribe(status=>{if(disposed)return;setConnection(status==='SUBSCRIBED'?'live':status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED'?'fallback':'connecting')});
   };
   connect();const watcher=window.setInterval(connect,1000);return()=>{disposed=true;window.clearInterval(watcher);if(timer.current)clearTimeout(timer.current);disconnect()};
 },[]);
 return <><SOSCustomerMobilityApp key={version}/><div aria-live="polite" title="S.O.S. live mission connection" style={{position:'fixed',right:12,bottom:96,zIndex:2350,padding:'7px 10px',borderRadius:999,background:'rgba(5,8,13,.88)',border:'1px solid rgba(255,138,76,.22)',color:connection==='live'?'#7de7ad':'#ffbd63',fontSize:8,fontWeight:900,letterSpacing:'.12em',pointerEvents:'none'}}>{connection==='live'?'LIVE DATA':connection==='fallback'?'POLLING FALLBACK':'CONNECTING'}</div></>;
}
