'use client';

import React,{useEffect,useState}from'react';
const SB='https://cxdqkjvtpilvouwtbgdy.supabase.co';
const SK='sb_publishable_x_QDbPwZuhbqB1bd58MLvg_ADSiFODN';

export default function SOSPaymentReadinessHost({audience='customer'}){
 const[health,setHealth]=useState(null);
 useEffect(()=>{let disposed=false;const load=async()=>{try{const r=await fetch(`${SB}/functions/v1/marketplace-payments-health`,{headers:{apikey:SK},cache:'no-store'});const d=await r.json().catch(()=>({}));if(!disposed)setHealth(d)}catch{if(!disposed)setHealth({ready:false})}};load();const t=setInterval(load,60000);return()=>{disposed=true;clearInterval(t)}},[]);
 if(!health||health.ready)return null;
 const provider=audience==='hero';
 return <aside role="status" aria-live="polite" style={{position:'fixed',left:'50%',transform:'translateX(-50%)',top:10,zIndex:2200,width:'min(760px,calc(100vw - 24px))',padding:'10px 14px',borderRadius:14,background:'rgba(63,28,10,.97)',color:'#fff1df',border:'1px solid rgba(255,138,91,.35)',boxShadow:'0 16px 48px rgba(0,0,0,.32)',backdropFilter:'blur(14px)',display:'flex',gap:12,alignItems:'center',justifyContent:'space-between'}}>
  <div><strong style={{display:'block',fontSize:11,letterSpacing:'.06em'}}>S.O.S. PAYMENT RUNTIME MAINTENANCE</strong><span style={{display:'block',fontSize:10,lineHeight:1.45,marginTop:2,color:'rgba(255,241,223,.72)'}}>{provider?'Patrol, matching and mission operations remain available. Paid mission completion and payout setup are blocked before Stripe is called.':'Requesting, matching and live Hero tracking remain available. Payment authorization and paid cancellation are blocked before Stripe is called.'}</span></div>
  <span style={{whiteSpace:'nowrap',fontSize:9,fontWeight:900,color:'#ffc49e'}}>NO CHARGE ATTEMPTED</span>
 </aside>;
}
