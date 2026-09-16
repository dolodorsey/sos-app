'use client';

import { useEffect } from 'react';

const CAPTURE_URL='https://wfkohcwxxsrhcxhepfql.supabase.co/functions/v1/marketing-event-capture';
const BRAND_KEY='s-o-s';
const AUTH_PATHS=['/login','/auth','/connect'];

function getStored(key){try{return localStorage.getItem(key)}catch{return null}}
function setStored(key,value){try{localStorage.setItem(key,value)}catch{}}
function clean(value,max=180){const text=String(value||'').replace(/\s+/g,' ').trim();return text?text.slice(0,max):undefined}
function visitorKey(){const existing=getStored('khg_vid');if(existing)return existing;const created=crypto.randomUUID();setStored('khg_vid',created);return created}
function trackingCode(){
  const incoming=clean(new URLSearchParams(location.search).get('khg_track'),80);
  const key=`khg_track:${BRAND_KEY}`;
  if(incoming){setStored(key,incoming);return incoming}
  return getStored(key)||undefined;
}
function referrerDomain(){try{return document.referrer?new URL(document.referrer).hostname:undefined}catch{return undefined}}
function classify(element){
  const forced=clean(element?.dataset?.khgEvent,60);
  if(forced)return forced;
  const text=clean(element?.dataset?.khgCta||element?.textContent,160)?.toLowerCase()||'';
  const href=element instanceof HTMLAnchorElement?element.href.toLowerCase():'';
  if(href.includes('apps.apple.com')||href.includes('play.google.com')||/download app|app store|google play/.test(text))return 'app_install_click';
  if(/request roadside|request help|start request|need help|dispatch|roadside help/.test(text))return 'booking_interest';
  if(/become a hero|apply|provider application|join as a hero/.test(text))return 'application';
  return 'cta_click';
}

export default function KHGTrackingHost(){
  useEffect(()=>{
    let code=trackingCode();
    const visitor=visitorKey();
    async function track(eventType,metadata={}){
      try{
        const response=await fetch(CAPTURE_URL,{
          method:'POST',keepalive:true,headers:{'content-type':'application/json'},
          body:JSON.stringify({
            ...(code?{code}:{brand_key:BRAND_KEY}),
            event_type:eventType,
            visitor_key:visitor,
            metadata:{event_id:crypto.randomUUID(),path:`${location.pathname}${location.search}`.slice(0,500),referrer_domain:referrerDomain(),app:'s-o-s',channel:'app',...metadata},
          }),
        });
        if(!response.ok)return;
        const result=await response.json().catch(()=>null);
        if(result?.tracking_code){code=result.tracking_code;setStored(`khg_track:${BRAND_KEY}`,code)}
      }catch{}
    }
    window.khgTrack=track;
    void track('page_view',{page:clean(document.title,200),platform:window.Capacitor?'capacitor':'web'});
    const onClick=(event)=>{
      const target=event.target;
      if(!(target instanceof Element))return;
      const element=target.closest('a,button,[role="button"],[data-khg-event]');
      if(!element)return;
      const eventType=classify(element);
      void track(eventType,{cta:clean(element.dataset?.khgCta||element.textContent,200),page:element instanceof HTMLAnchorElement?element.href.slice(0,300):undefined,conversion_type:['booking_interest','application'].includes(eventType)?eventType:undefined});
    };
    const onSubmit=(event)=>{
      if(AUTH_PATHS.some(path=>location.pathname.includes(path)))return;
      const form=event.target;
      if(!(form instanceof HTMLFormElement))return;
      const path=location.pathname;
      const eventType=path.includes('/become-a-hero')||path.includes('/apply')?'application':path.includes('/request-roadside-help')?'booking_interest':'form_submission';
      void track(eventType,{cta:clean(form.dataset?.khgCta||form.getAttribute('aria-label')||form.id,200),conversion_type:eventType});
    };
    document.addEventListener('click',onClick,{capture:true});
    document.addEventListener('submit',onSubmit,{capture:true});
    return()=>{
      document.removeEventListener('click',onClick,{capture:true});
      document.removeEventListener('submit',onSubmit,{capture:true});
      if(window.khgTrack===track)delete window.khgTrack;
    };
  },[]);
  return null;
}
