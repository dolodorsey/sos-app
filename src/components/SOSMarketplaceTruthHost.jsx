'use client';

import { useEffect } from 'react';

const SB='https://cxdqkjvtpilvouwtbgdy.supabase.co';
const SK='sb_publishable_x_QDbPwZuhbqB1bd58MLvg_ADSiFODN';

export default function SOSMarketplaceTruthHost(){
  useEffect(()=>{
    let stopped=false;
    let observer;
    const applyTruth=hasVerifiedSupply=>{
      if(stopped)return;
      document.querySelectorAll('p,small,span').forEach(node=>{
        const text=String(node.textContent||'').replace(/\s+/g,' ').trim();
        if(!hasVerifiedSupply&&/^\d+ live services available\.$/i.test(text))node.textContent=text.replace(/live services available\./i,'service types configured.');
      });
    };
    (async()=>{
      let hasVerifiedSupply=false;
      try{
        const response=await fetch(`${SB}/rest/v1/rpc/sos_public_service_coverage`,{method:'POST',headers:{apikey:SK,Authorization:`Bearer ${SK}`,'Content-Type':'application/json'},body:'{}'});
        const data=await response.json().catch(()=>[]);
        if(response.ok&&Array.isArray(data))hasVerifiedSupply=data.some(row=>Boolean(row?.has_verified_supply));
      }catch{}
      applyTruth(hasVerifiedSupply);
      observer=new MutationObserver(()=>applyTruth(hasVerifiedSupply));
      observer.observe(document.body,{childList:true,subtree:true,characterData:true});
    })();
    return()=>{stopped=true;observer?.disconnect();};
  },[]);
  return null;
}
