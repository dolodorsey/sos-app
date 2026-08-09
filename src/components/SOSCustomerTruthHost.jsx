'use client';

import {useEffect,useState} from 'react';

const COVERAGE_URL='https://cxdqkjvtpilvouwtbgdy.supabase.co/functions/v1/marketplace-public-coverage';
const DEFAULT_CENTER={lat:33.749,lng:-84.388};

function mapUrl(lat,lng){
  const center=Number.isFinite(lat)&&Number.isFinite(lng)?{lat,lng}:DEFAULT_CENTER;
  const west=center.lng-0.11;
  const east=center.lng+0.11;
  const south=center.lat-0.10;
  const north=center.lat+0.10;
  const bbox=encodeURIComponent(`${west},${south},${east},${north}`);
  const marker=encodeURIComponent(`${center.lat},${center.lng}`);
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${marker}`;
}

export default function SOSCustomerTruthHost(){
  const[coverageCount,setCoverageCount]=useState(null);

  useEffect(()=>{
    let alive=true;
    const load=async()=>{
      try{
        const response=await fetch(COVERAGE_URL,{headers:{Accept:'application/json'},cache:'no-store'});
        const payload=await response.json().catch(()=>null);
        if(!alive||!response.ok)return;
        const rows=Array.isArray(payload?.sos?.services)?payload.sos.services:[];
        setCoverageCount(rows.filter(row=>row?.has_verified_supply).length);
      }catch{}
    };
    load();
    const timer=setInterval(load,60000);
    return()=>{alive=false;clearInterval(timer)};
  },[]);

  useEffect(()=>{
    const applyTruth=()=>{
      for(const head of document.querySelectorAll('.sos2-screen-head')){
        const eyebrow=String(head.querySelector('span')?.textContent||'').trim().toUpperCase();
        if(eyebrow!=='SERVICE NETWORK')continue;
        const copy=head.querySelector('p');
        if(!copy)continue;
        const count=document.querySelectorAll('.sos2-service-list>button').length;
        copy.textContent=`${count} roadside services in the catalog. Verified Hero coverage is shown service-by-service.`;
      }

      const quickTitle=document.querySelector('.sos2-quick .sos2-section-title h2');
      if(quickTitle&&coverageCount===0)quickTitle.textContent='Browse roadside help';

      for(const button of document.querySelectorAll('.sos2-service-list>button,.sos2-quick-grid>button')){
        const subline=button.querySelector('small');
        if(!subline)continue;
        if(!subline.dataset.sosOriginalCopy)subline.dataset.sosOriginalCopy=subline.textContent||'';
        if(button.dataset.verifiedCoverage==='activating')subline.textContent='Verified Hero coverage not active yet';
        else if(button.dataset.verifiedCoverage==='active')subline.textContent=subline.dataset.sosOriginalCopy;
      }
    };

    applyTruth();
    const observer=new MutationObserver(applyTruth);
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['data-verified-coverage']});
    return()=>observer.disconnect();
  },[coverageCount]);

  useEffect(()=>{
    const recenter=()=>{
      if(!navigator.geolocation)return;
      navigator.geolocation.getCurrentPosition(position=>{
        const frame=document.querySelector('.sos2-map-hero iframe');
        if(frame)frame.src=mapUrl(position.coords.latitude,position.coords.longitude);
      },()=>{}, {enableHighAccuracy:true,timeout:12000,maximumAge:15000});
    };

    const handleClick=event=>{
      if(event.target?.closest?.('.sos2-location-pill'))recenter();
    };

    document.addEventListener('click',handleClick,false);
    return()=>document.removeEventListener('click',handleClick,false);
  },[]);

  return null;
}
