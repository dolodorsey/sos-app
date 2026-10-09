'use client';

import { useEffect } from 'react';
import { observeBody } from '../lib/domObserver';

const COVERAGE_URL='https://cxdqkjvtpilvouwtbgdy.supabase.co/functions/v1/marketplace-public-coverage';

export default function SOSMarketplaceTruthHost(){
  useEffect(()=>{
    let stopped=false;
    let stopObserving=()=>{};
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
        const response=await fetch(COVERAGE_URL,{headers:{Accept:'application/json'}});
        const data=await response.json().catch(()=>null);
        if(response.ok)hasVerifiedSupply=Boolean(data?.sos?.has_verified_supply);
      }catch{}
      applyTruth(hasVerifiedSupply);
      if(!stopped)stopObserving=observeBody(()=>applyTruth(hasVerifiedSupply));
    })();
    return()=>{stopped=true;stopObserving();};
  },[]);
  return null;
}
