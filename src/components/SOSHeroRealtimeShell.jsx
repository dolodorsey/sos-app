'use client';

import React,{useEffect,useRef,useState}from'react';
import SOSHeroMobilityApp from'./SOSHeroMobilityApp';
import{authorizeSosRealtime}from'../lib/sosRealtimeClient';

const session=()=>{try{const s=JSON.parse(localStorage.getItem('sos_session'));return s?.access_token&&s?.user?s:null}catch{return null}};

const activeTabLabel=()=>document.querySelector('.shc-side button.active span')?.textContent||document.querySelector('.shc-mobile-nav button.active span')?.textContent||'Home';
const restoreTab=label=>{const buttons=[...document.querySelectorAll('.shc-side button,.shc-mobile-nav button')];const target=buttons.find(button=>String(button.textContent||'').toLowerCase().includes(String(label||'').toLowerCase()));target?.click?.()};

export default function SOSHeroRealtimeShell(){
 const[version,setVersion]=useState(0);const[connection,setConnection]=useState('connecting');const restore=useRef('Home');const timer=useRef(null);
 const refresh=(preferred)=>{restore.current=preferred||activeTabLabel();if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>setVersion(v=>v+1),90)};
 useEffect(()=>{const t=setTimeout(()=>restoreTab(restore.current),500);return()=>clearTimeout(t)},[version]);
 useEffect(()=>{
   let disposed=false;let currentToken='';let client=null;let channel=null;
   const disconnect=()=>{if(channel&&client)client.removeChannel(channel);channel=null;client=null;currentToken=''};
   const connect=()=>{
     const s=session();
     if(!s?.access_token){if(currentToken){disconnect();setConnection('connecting')}return}
     if(s.access_token===currentToken&&channel)return
     disconnect();currentToken=s.access_token;
     client=authorizeSosRealtime(s.access_token);
     const notifyOffer=()=>{if(document.hidden&&'Notification'in window&&Notification.permission==='granted'){try{new Notification('New S.O.S. mission offer',{body:'Open Hero Command to review the live offer.'})}catch{}}refresh('Offers')};
     channel=client.channel(`sos-hero-live-${s.user.id}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'sos_mission_offers'},notifyOffer)
      .on('postgres_changes',{event:'*',schema:'public',table:'sos_missions'},()=>refresh('Missions'))
      .on('postgres_changes',{event:'*',schema:'public',table:'sos_payments'},()=>refresh('Missions'))
      .subscribe(status=>{if(disposed)return;setConnection(status==='SUBSCRIBED'?'live':status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED'?'fallback':'connecting')});
   };
   connect();const sessionWatcher=window.setInterval(connect,1000);
   return()=>{disposed=true;window.clearInterval(sessionWatcher);if(timer.current)clearTimeout(timer.current);disconnect()};
 },[]);
 return <><SOSHeroMobilityApp key={version}/><div aria-live="polite" title="Hero Command live data connection" style={{position:'fixed',right:12,bottom:12,zIndex:2400,padding:'7px 10px',borderRadius:999,background:'rgba(5,8,13,.88)',border:'1px solid rgba(255,138,76,.22)',color:connection==='live'?'#7de7ad':'#ffbd63',fontSize:8,fontWeight:900,letterSpacing:'.12em',pointerEvents:'none'}}>{connection==='live'?'LIVE DATA':connection==='fallback'?'POLLING FALLBACK':'CONNECTING'}</div></>;
}
