'use client';

import {useEffect,useState} from 'react';

const SB='https://cxdqkjvtpilvouwtbgdy.supabase.co';
const SK='sb_publishable_x_QDbPwZuhbqB1bd58MLvg_ADSiFODN';

export default function SOSAuthRedirectSessionHost(){
 const[message,setMessage]=useState('');
 useEffect(()=>{
  let active=true;
  (async()=>{
   try{
    const hash=new URLSearchParams(window.location.hash.replace(/^#/,''));
    const accessToken=hash.get('access_token');
    if(!accessToken)return;
    const refreshToken=hash.get('refresh_token')||'';
    const expiresIn=Math.max(60,Number(hash.get('expires_in')||3600));
    const type=hash.get('type')||'';
    const userResponse=await fetch(`${SB}/auth/v1/user`,{headers:{apikey:SK,Authorization:`Bearer ${accessToken}`}});
    const user=await userResponse.json().catch(()=>null);
    if(!userResponse.ok||!user?.id)throw new Error(type==='recovery'?'Recovery session could not be restored.':'Confirmed account session could not be restored.');
    const session={access_token:accessToken,refresh_token:refreshToken,token_type:hash.get('token_type')||'bearer',expires_in:expiresIn,expires_at:Math.floor(Date.now()/1000)+expiresIn,user};
    const clean=`${window.location.pathname}${window.location.search}`;
    history.replaceState({},'',clean);
    if(type==='recovery'){
      localStorage.removeItem('sos_session');
      localStorage.setItem('sos_password_recovery',JSON.stringify(session));
      window.dispatchEvent(new CustomEvent('sos-password-recovery'));
      if(active)setMessage('Recovery link verified. Choose a new password.');
      return;
    }
    localStorage.setItem('sos_session',JSON.stringify(session));
    if(!active)return;
    setMessage('Email confirmed. S.O.S. account connected.');
    window.setTimeout(()=>window.location.reload(),450);
   }catch(e){if(active)setMessage(e.message||'Email confirmed. Sign in with the same email to continue.')}
  })();
  return()=>{active=false};
 },[]);
 if(!message)return null;
 return <div style={{position:'fixed',left:'50%',top:14,transform:'translateX(-50%)',zIndex:5100,width:'min(520px,calc(100vw - 24px))',padding:'11px 14px',borderRadius:14,background:'#132016',border:'1px solid rgba(72,205,130,.28)',color:'#d8ffe7',fontSize:11,fontWeight:800,textAlign:'center',boxShadow:'0 18px 55px rgba(0,0,0,.35)'}}>{message}</div>;
}
