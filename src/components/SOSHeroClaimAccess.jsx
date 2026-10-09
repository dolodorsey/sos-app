'use client';

import React,{useEffect,useState}from'react';
import{createPortal}from'react-dom';
import{observeBody}from'../lib/domObserver';
const SB='https://cxdqkjvtpilvouwtbgdy.supabase.co';
const SK='sb_publishable_x_QDbPwZuhbqB1bd58MLvg_ADSiFODN';
const stored=()=>{try{const s=JSON.parse(localStorage.getItem('sos_session'));return s?.access_token&&s?.user?s:null}catch{return null}};

export default function SOSHeroClaimAccess(){
 const[show,setShow]=useState(false);const[card,setCard]=useState(null);
 useEffect(()=>observeBody(()=>{const next=document.querySelector('.shc-auth-card');setCard(cur=>cur===next?cur:next)}),[]);
 useEffect(()=>{let active=true;(async()=>{const s=stored();if(!s){if(active)setShow(true);return}try{const r=await fetch(`${SB}/rest/v1/sos_users?auth_id=eq.${s.user.id}&select=role&limit=1`,{headers:{apikey:SK,Authorization:`Bearer ${s.access_token}`}});const rows=await r.json();if(active)setShow(rows?.[0]?.role!=='hero')}catch{if(active)setShow(true)}})();return()=>{active=false}},[]);
 if(!show)return null;
 if(card)return createPortal(<div className="sos-hero-auth-links"><a href="/hero/apply" style={{padding:'10px 13px',borderRadius:999,background:'linear-gradient(135deg,#ff3b42,#c7131c)',color:'#fff',border:'1px solid rgba(255,90,96,.28)',boxShadow:'0 12px 38px rgba(0,0,0,.3)',fontSize:9,fontWeight:900,letterSpacing:'.08em',textDecoration:'none'}}>BECOME AN S.O.S. HERO</a><a href="/hero/claim" style={{padding:'10px 13px',borderRadius:999,background:'rgba(13,27,43,.96)',color:'#ffb8bb',border:'1px solid rgba(255,90,96,.28)',boxShadow:'0 12px 38px rgba(0,0,0,.3)',fontSize:9,fontWeight:900,letterSpacing:'.08em',textDecoration:'none',backdropFilter:'blur(14px)'}}>ALREADY APPROVED? CLAIM PROFILE</a></div>,card);
 return <div style={{position:'fixed',right:16,bottom:18,zIndex:1700,display:'flex',gap:7,flexWrap:'wrap',justifyContent:'flex-end',maxWidth:'calc(100vw - 32px)'}}><a href="/hero/apply" style={{padding:'10px 13px',borderRadius:999,background:'linear-gradient(135deg,#ff3b42,#c7131c)',color:'#fff',border:'1px solid rgba(255,90,96,.28)',boxShadow:'0 12px 38px rgba(0,0,0,.3)',fontSize:9,fontWeight:900,letterSpacing:'.08em',textDecoration:'none'}}>BECOME AN S.O.S. HERO</a><a href="/hero/claim" style={{padding:'10px 13px',borderRadius:999,background:'rgba(13,27,43,.96)',color:'#ffb8bb',border:'1px solid rgba(255,90,96,.28)',boxShadow:'0 12px 38px rgba(0,0,0,.3)',fontSize:9,fontWeight:900,letterSpacing:'.08em',textDecoration:'none',backdropFilter:'blur(14px)'}}>ALREADY APPROVED? CLAIM PROFILE</a></div>;
}
