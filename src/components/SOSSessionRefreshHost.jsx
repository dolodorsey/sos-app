'use client';

import { useEffect } from 'react';

const SB='https://cxdqkjvtpilvouwtbgdy.supabase.co';
const SK='sb_publishable_x_QDbPwZuhbqB1bd58MLvg_ADSiFODN';
const SESSION_KEY='sos_session';
const REFRESH_SKEW_SECONDS=300;
const MIN_RETRY_MS=30000;

const readSession=()=>{try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{return null}};
const writeSession=session=>{localStorage.setItem(SESSION_KEY,JSON.stringify(session));window.dispatchEvent(new CustomEvent('sos:session-refreshed',{detail:{expires_at:session?.expires_at||null}}));};

async function refreshSession(current){
  if(!current?.refresh_token)return null;
  const response=await fetch(`${SB}/auth/v1/token?grant_type=refresh_token`,{
    method:'POST',
    headers:{apikey:SK,'Content-Type':'application/json'},
    body:JSON.stringify({refresh_token:current.refresh_token}),
  });
  const payload=await response.json().catch(()=>null);
  if(!response.ok||!payload?.access_token)throw new Error(payload?.error_description||payload?.msg||payload?.message||'Session refresh failed');
  const next={...current,...payload,user:payload.user||current.user};
  if(!next.expires_at&&payload.expires_in)next.expires_at=Math.floor(Date.now()/1000)+Number(payload.expires_in);
  writeSession(next);
  return next;
}

export default function SOSSessionRefreshHost(){
  useEffect(()=>{
    let cancelled=false;
    let timer;

    const schedule=async()=>{
      if(cancelled)return;
      const current=readSession();
      if(!current?.access_token||!current?.refresh_token)return;
      const now=Math.floor(Date.now()/1000);
      const expiresAt=Number(current.expires_at||0);
      const secondsUntilRefresh=expiresAt?expiresAt-now-REFRESH_SKEW_SECONDS:0;
      if(secondsUntilRefresh>0){timer=window.setTimeout(schedule,Math.max(MIN_RETRY_MS,secondsUntilRefresh*1000));return;}
      try{
        const next=await refreshSession(current);
        if(cancelled||!next)return;
        const nextExpiry=Number(next.expires_at||0);
        const delay=nextExpiry?Math.max(MIN_RETRY_MS,(nextExpiry-Math.floor(Date.now()/1000)-REFRESH_SKEW_SECONDS)*1000):5*60*1000;
        timer=window.setTimeout(schedule,delay);
      }catch(error){
        console.warn('S.O.S. session refresh deferred',error instanceof Error?error.message:'refresh failed');
        timer=window.setTimeout(schedule,MIN_RETRY_MS);
      }
    };

    schedule();
    const onStorage=event=>{if(event.key===SESSION_KEY){if(timer)window.clearTimeout(timer);schedule();}};
    const onFocus=()=>{if(timer)window.clearTimeout(timer);schedule();};
    window.addEventListener('storage',onStorage);
    window.addEventListener('focus',onFocus);
    return()=>{cancelled=true;if(timer)window.clearTimeout(timer);window.removeEventListener('storage',onStorage);window.removeEventListener('focus',onFocus);};
  },[]);
  return null;
}
