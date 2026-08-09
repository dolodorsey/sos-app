'use client';

import React,{useEffect,useState}from'react';
const SB='https://cxdqkjvtpilvouwtbgdy.supabase.co';
const SK='sb_publishable_x_QDbPwZuhbqB1bd58MLvg_ADSiFODN';
const stored=()=>{try{const s=JSON.parse(localStorage.getItem('sos_session'));return s?.access_token&&s?.user?s:null}catch{return null}};

export default function SOSHeroClaimAccess(){
 const[show,setShow]=useState(false);
 useEffect(()=>{let active=true;(async()=>{const s=stored();if(!s){if(active)setShow(true);return}try{const r=await fetch(`${SB}/rest/v1/sos_users?auth_id=eq.${s.user.id}&select=role&limit=1`,{headers:{apikey:SK,Authorization:`Bearer ${s.access_token}`}});const rows=await r.json();if(active)setShow(rows?.[0]?.role!=='hero')}catch{if(active)setShow(true)}})();return()=>{active=false}},[]);
 if(!show)return null;
 return <div style={{position:'fixed',right:16,bottom:18,zIndex:1700,display:'flex',gap:7,flexWrap:'wrap',justifyContent:'flex-end',maxWidth:'calc(100vw - 32px)'}}><a href="/hero/apply" style={{padding:'10px 13px',borderRadius:999,background:'linear-gradient(135deg,#ff8a4c,#c73c13)',color:'#fff',border:'1px solid rgba(255,183,71,.28)',boxShadow:'0 12px 38px rgba(0,0,0,.3)',fontSize:9,fontWeight:900,letterSpacing:'.08em',textDecoration:'none'}}>BECOME AN S.O.S. HERO</a><a href="/hero/claim" style={{padding:'10px 13px',borderRadius:999,background:'rgba(13,27,43,.96)',color:'#ffd18a',border:'1px solid rgba(255,183,71,.28)',boxShadow:'0 12px 38px rgba(0,0,0,.3)',fontSize:9,fontWeight:900,letterSpacing:'.08em',textDecoration:'none',backdropFilter:'blur(14px)'}}>ALREADY APPROVED? CLAIM PROFILE</a></div>;
}
