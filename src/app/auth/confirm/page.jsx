'use client';

import { useEffect, useState } from 'react';
import { supabase, resendConfirmation } from '../../../lib/supabase';

export default function SOSAuthConfirmPage(){
  const[status,setStatus]=useState('Confirming your email…');const[failed,setFailed]=useState(false);const[email,setEmail]=useState('');
  useEffect(()=>{(async()=>{const url=new URL(window.location.href);const hash=new URLSearchParams(url.hash.slice(1));const tokenHash=url.searchParams.get('token_hash');const code=url.searchParams.get('code');let error=null;
    if(tokenHash)({error}=await supabase.auth.verifyOtp({token_hash:tokenHash,type:'signup'}));else if(code)({error}=await supabase.auth.exchangeCodeForSession(code));else if(hash.get('access_token')&&hash.get('refresh_token'))({error}=await supabase.auth.setSession({access_token:hash.get('access_token'),refresh_token:hash.get('refresh_token')}));else error=new Error('Missing confirmation token');
    if(error){setFailed(true);setStatus('This link has expired or was already used. Request a fresh confirmation email below.');return;}setStatus('Email confirmed. Returning to SOS…');setTimeout(()=>window.location.replace('/'),900);})()},[]);
  return <main style={{minHeight:'100vh',display:'grid',placeItems:'center',background:'#080c14',color:'#fff',padding:24,fontFamily:'system-ui'}}><section style={{maxWidth:480,textAlign:'center'}}><h1>SUPERHEROES ON STANDBY</h1><p>{status}</p>{failed&&<form onSubmit={async e=>{e.preventDefault();await resendConfirmation(email);setStatus('A fresh email is on the way. Open only the newest link.')}}><input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email address" style={{padding:12,borderRadius:8,width:'100%',marginBottom:12}}/><button style={{padding:'12px 18px',borderRadius:8,border:0,fontWeight:700}}>Resend confirmation</button></form>}</section></main>
}
