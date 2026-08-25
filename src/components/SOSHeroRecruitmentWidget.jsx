'use client';
import {useEffect,useState} from 'react';

export default function SOSHeroRecruitmentWidget(){
  const[open,setOpen]=useState(false);
  useEffect(()=>{
    try{
      const key='sos_hero_recruitment_seen_at';
      const last=Number(localStorage.getItem(key)||0);
      const week=7*24*60*60*1000;
      if(Date.now()-last>week){
        const t=setTimeout(()=>setOpen(true),6500);
        return()=>clearTimeout(t);
      }
    }catch{}
  },[]);
  const close=()=>{setOpen(false);try{localStorage.setItem('sos_hero_recruitment_seen_at',String(Date.now()))}catch{}};
  return <>
    <a href="/hero/apply" aria-label="Apply to become an SOS Hero" style={{position:'fixed',right:16,bottom:84,zIndex:80,textDecoration:'none',background:'#111',color:'#fff',border:'1px solid rgba(255,255,255,.18)',borderRadius:999,padding:'10px 14px',fontSize:11,fontWeight:900,letterSpacing:'.08em',boxShadow:'0 10px 28px rgba(0,0,0,.24)'}}>EARN WITH S.O.S. · BECOME A HERO</a>
    {open&&<div role="dialog" aria-modal="true" aria-label="Become an SOS Hero" style={{position:'fixed',inset:0,zIndex:200,display:'grid',placeItems:'center',padding:20,background:'rgba(0,0,0,.58)'}} onMouseDown={close}>
      <section onMouseDown={e=>e.stopPropagation()} style={{width:'min(430px,100%)',background:'#101010',color:'#fff',border:'1px solid rgba(255,255,255,.15)',borderRadius:24,padding:24,boxShadow:'0 24px 80px rgba(0,0,0,.5)'}}>
        <div style={{fontSize:10,fontWeight:900,letterSpacing:'.16em',opacity:.65}}>S.O.S. HERO NETWORK</div>
        <h2 style={{fontSize:28,lineHeight:1.05,margin:'10px 0 10px'}}>Got the skills? Get paid to help.</h2>
        <p style={{fontSize:14,lineHeight:1.5,opacity:.72,margin:'0 0 18px'}}>Roadside pros, tow operators, mobile mechanics, detailers and vehicle-service specialists can apply, upload credentials, and join the approval waitlist.</p>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          <a href="/hero/apply" style={{flex:'1 1 190px',textAlign:'center',textDecoration:'none',background:'#ff6b35',color:'#fff',borderRadius:14,padding:'13px 16px',fontWeight:900}}>APPLY AS A HERO</a>
          <button type="button" onClick={close} style={{border:'1px solid rgba(255,255,255,.15)',background:'transparent',color:'#fff',borderRadius:14,padding:'13px 16px',fontWeight:800}}>NOT NOW</button>
        </div>
      </section>
    </div>}
  </>;
}
