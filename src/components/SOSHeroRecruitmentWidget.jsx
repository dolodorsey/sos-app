'use client';
import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';

// Pre-launch (issue #103): no timed pop-up. A quiet link to provider early registration only.
export default function SOSHeroRecruitmentWidget(){
  const[authPanel,setAuthPanel]=useState(null);
  useEffect(()=>{
    const sync=()=>setAuthPanel(document.querySelector('.sos2-auth-panel'));
    sync();const observer=new MutationObserver(sync);observer.observe(document.body,{childList:true,subtree:true});
    return()=>observer.disconnect();
  },[]);
  const link=<a href="/become-a-hero/" aria-label="Register early interest as an S.O.S. provider" style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:44,marginTop:12,color:'#ffbd90',fontSize:13,textDecoration:'underline',textUnderlineOffset:4}}>Join as a provider</a>;
  return authPanel?createPortal(link,authPanel):null;
}
