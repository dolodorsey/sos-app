'use client';

import {useEffect,useState} from 'react';
import styles from './SOSAuthConfirmationGuard.module.css';

const SB='https://cxdqkjvtpilvouwtbgdy.supabase.co';
const SK='sb_publishable_x_QDbPwZuhbqB1bd58MLvg_ADSiFODN';

export default function SOSAuthConfirmationGuard(){
 const[email,setEmail]=useState('');const[open,setOpen]=useState(false);const[busy,setBusy]=useState(false);const[error,setError]=useState('');const[notice,setNotice]=useState('');
 useEffect(()=>{
  const handle=async event=>{
   const form=event.target?.closest?.('form');if(!form)return;
   const path=window.location.pathname;
   const isCustomer=form.classList.contains('sos2-auth-panel');
   const submit=[...form.querySelectorAll('button')].find(button=>button.type==='submit'||(!button.type&&/create|enter|sign/i.test(button.textContent||'')));
   const active=[...form.querySelectorAll('button')].find(button=>button.classList.contains('active'));
   const createMode=/create account|create citizen account|create hero account|create.*account/i.test(`${active?.textContent||''} ${submit?.textContent||''}`);
   const allowed=isCustomer||(path.startsWith('/hero/claim')&&createMode);
   if(!allowed||!createMode)return;
   event.preventDefault();event.stopPropagation();event.stopImmediatePropagation?.();if(busy)return;
   const inputs=[...form.querySelectorAll('input')];const emailInput=inputs.find(input=>input.type==='email');const passwordInput=inputs.find(input=>input.type==='password');const nameInput=inputs.find(input=>input.type!=='email'&&input.type!=='password'&&input.type!=='hidden');
   const nextEmail=(emailInput?.value||'').trim().toLowerCase(),password=passwordInput?.value||'',fullName=(nameInput?.value||'').trim();
   if(!nextEmail||password.length<8){setError('Enter a valid email and an 8+ character password.');setOpen(true);return}
   setBusy(true);setError('');setNotice('');
   try{
    const redirect=`https://thesuperherosonstandby.com${path.startsWith('/hero/claim')?'/hero/claim':'/app'}`;
    const r=await fetch(`${SB}/auth/v1/signup?redirect_to=${encodeURIComponent(redirect)}`,{method:'POST',headers:{apikey:SK,'Content-Type':'application/json'},body:JSON.stringify({email:nextEmail,password,data:{full_name:fullName||undefined,app:'sos',role:'citizen'}})});
    const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.msg||d?.error_description||d?.message||d?.error||'Account creation failed');setEmail(nextEmail);
    if(d.access_token){localStorage.setItem('sos_session',JSON.stringify(d));window.location.reload();return}
    setNotice('Your S.O.S. account was created. Confirm the email we sent you before signing in. The live Auth configuration requires email confirmation.');setOpen(true);
   }catch(e){setError(e.message||'Account creation failed');setOpen(true)}finally{setBusy(false)}
  };
  document.addEventListener('submit',handle,true);return()=>document.removeEventListener('submit',handle,true)
 },[busy]);
 const resend=async()=>{if(!email||busy)return;setBusy(true);setError('');try{const redirect=`https://thesuperherosonstandby.com${window.location.pathname.startsWith('/hero/claim')?'/hero/claim':'/app'}`;const r=await fetch(`${SB}/auth/v1/resend?redirect_to=${encodeURIComponent(redirect)}`,{method:'POST',headers:{apikey:SK,'Content-Type':'application/json'},body:JSON.stringify({type:'signup',email})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.msg||d?.error_description||d?.message||d?.error||'Confirmation email could not be resent');setNotice('Confirmation email resent. Confirm it, then return and sign in with the same email.')}catch(e){setError(e.message||'Confirmation email could not be resent')}finally{setBusy(false)}};
 const signIn=()=>{const form=[...document.querySelectorAll('form')].find(item=>item.classList.contains('sos2-auth-panel')||window.location.pathname.startsWith('/hero/claim'));const button=[...form?.querySelectorAll('button')||[]].find(item=>/sign in|enter hero/i.test(item.textContent||''));button?.click();setOpen(false)};
 if(!open)return null;
 return <div className={styles.backdrop}><section className={styles.card} role="dialog" aria-modal="true"><div className={styles.mark}>SOS</div><span>EMAIL CONFIRMATION REQUIRED</span><h2>Confirm your account.</h2><p>{notice||'S.O.S. requires email confirmation before the first sign-in.'}</p>{email&&<strong>{email}</strong>}{error&&<div className={styles.error}>{error}</div>}<button className={styles.primary} onClick={signIn}>I confirmed — sign in</button>{email&&<button className={styles.secondary} disabled={busy} onClick={resend}>{busy?'Sending…':'Resend confirmation email'}</button>}<small>Do not create a second account. Use this same email for Hero claim/activation if applicable.</small></section></div>;
}
