'use client';

import React,{useEffect,useRef,useState}from'react';
import SOSCustomerMobilityApp from'./SOSCustomerMobilityApp';
import{createPortal}from'react-dom';
import{authorizeSosRealtime}from'../lib/sosRealtimeClient';
import{useAppSlot}from'../lib/useAppSlot';

const session=()=>{try{const s=JSON.parse(localStorage.getItem('sos_session'));return s?.access_token&&s?.user?s:null}catch{return null}};
const activeTabLabel=()=>document.querySelector('.sos2-nav button.active small')?.textContent||'Home';
const restoreTab=label=>{const buttons=[...document.querySelectorAll('.sos2-nav button')];buttons.find(button=>String(button.textContent||'').toLowerCase().includes(String(label||'').toLowerCase()))?.click?.()};

export default function SOSCustomerRealtimeShell(){
 const[authenticated,setAuthenticated]=useState(false);const[version,setVersion]=useState(0);const[connection,setConnection]=useState('connecting');const restore=useRef('Home');const timer=useRef(null);
 const topSlot=useAppSlot('top-actions');
 const refresh=preferred=>{restore.current=preferred||activeTabLabel();if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>setVersion(v=>v+1),120)};
 useEffect(()=>{const t=setTimeout(()=>restoreTab(restore.current),500);return()=>clearTimeout(t)},[version]);
 useEffect(()=>{
   let disposed=false;let currentToken='';let client=null;let channel=null;
   const disconnect=()=>{if(channel&&client)client.removeChannel(channel);channel=null;client=null;currentToken=''};
   const connect=()=>{
     const s=session();setAuthenticated(Boolean(s?.access_token));if(!s?.access_token){if(currentToken){disconnect();setConnection('connecting')}return}if(s.access_token===currentToken&&channel)return;
     disconnect();currentToken=s.access_token;client=authorizeSosRealtime(s.access_token);
     channel=client.channel(`sos-customer-live-${s.user.id}`)
       .on('postgres_changes',{event:'*',schema:'public',table:'sos_missions'},()=>refresh('Missions'))
       .on('postgres_changes',{event:'*',schema:'public',table:'sos_payments'},()=>refresh('Missions'))
       .on('postgres_changes',{event:'*',schema:'public',table:'sos_mission_offers'},()=>refresh('Missions'))
       .subscribe(status=>{if(disposed)return;setConnection(status==='SUBSCRIBED'?'live':status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED'?'fallback':'connecting')});
   };
   connect();const watcher=window.setInterval(connect,1000);return()=>{disposed=true;window.clearInterval(watcher);if(timer.current)clearTimeout(timer.current);disconnect()};
 },[]);
 return <><SOSCustomerMobilityApp key={version}/>{authenticated&&topSlot&&createPortal(<span className={`sos-live-dot ${connection}`} role="status" aria-live="polite" title={connection==='live'?'LIVE DATA — live mission updates connected':connection==='fallback'?'POLLING FALLBACK — live updates reconnecting, refreshing periodically':'Connecting live mission data'}><i/>{connection==='live'?'LIVE':connection==='fallback'?'SYNC':'…'}</span>,topSlot)}</>;
}
