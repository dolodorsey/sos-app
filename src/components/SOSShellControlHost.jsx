'use client';

import React,{useEffect,useState}from'react';
import{createPortal}from'react-dom';

const buttonText=element=>String(element?.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();

export default function SOSShellControlHost(){
  const[header,setHeader]=useState(null);

  useEffect(()=>{
    const sync=()=>setHeader(document.querySelector('.sos2-topbar'));
    sync();
    const observer=new MutationObserver(sync);
    observer.observe(document.body,{childList:true,subtree:true});
    return()=>observer.disconnect();
  },[]);

  const goBack=()=>{
    const close=document.querySelector('.sos-subcat-backdrop .sos-subcat-close, .sos2-backdrop .sos2-close, .sos-mobility-layer .sos-tracker-head > button');
    if(close instanceof HTMLElement){close.click();return}

    const nav=[...document.querySelectorAll('.sos2-nav button')];
    const active=nav.find(button=>button.classList.contains('active'));
    const home=nav.find(button=>buttonText(button).includes('home'));
    if(active&&home&&active!==home){home.click();return}

    if(window.history.length>1){window.history.back();return}
    if(home instanceof HTMLElement){home.click();return}
    document.querySelector('.sos2-content')?.scrollTo?.({top:0,behavior:'smooth'});
  };

  return <>
    <style>{`
      .sos2-app{height:100dvh!important;min-height:0!important;padding-bottom:0!important;display:flex!important;flex-direction:column!important;overflow:hidden!important}
      .sos2-topbar{position:relative!important;top:auto!important;flex:0 0 69px!important;justify-content:flex-start!important;gap:8px!important}
      .sos2-topbar .sos-shell-back{order:-1}.sos2-topbar .sos2-brand{order:0;margin-right:auto}.sos2-topbar .sos2-avatar{order:1}
      .sos2-content{flex:1 1 auto!important;min-height:0!important;overflow-y:auto!important;overflow-x:hidden!important;overscroll-behavior-y:contain!important;-webkit-overflow-scrolling:touch!important;scroll-padding-top:68px!important}
      .sos2-nav{position:relative!important;left:auto!important;right:auto!important;bottom:auto!important;transform:none!important;width:100%!important;max-width:none!important;flex:0 0 auto!important;z-index:80!important}
      .sos2-search{position:sticky!important;top:0!important;z-index:65!important}
      .sos-shell-back{height:39px;min-width:58px;padding:0 9px;border-radius:12px;border:1px solid rgba(255,138,76,.2);background:#101722;color:#ffbd63;display:flex;align-items:center;justify-content:center;gap:4px;font:900 7px 'DM Sans',sans-serif;letter-spacing:.08em;flex:0 0 auto}
      .sos-shell-back span{font-size:19px;line-height:1;margin-top:-2px}
      @media(max-width:390px){.sos2-topbar{padding-left:10px!important;padding-right:10px!important}.sos-shell-back{min-width:42px;padding:0 7px;font-size:0}.sos-shell-back span{font-size:22px}.sos2-brand small{display:none}}
    `}</style>
    {header?createPortal(<button type="button" className="sos-shell-back" onClick={goBack} aria-label="Go back"><span>‹</span>BACK</button>,header):null}
  </>;
}
