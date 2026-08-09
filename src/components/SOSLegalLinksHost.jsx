'use client';

import { usePathname } from 'next/navigation';

export default function SOSLegalLinksHost(){
  const pathname=usePathname()||'/';
  if(pathname.startsWith('/ops')||pathname==='/privacy'||pathname==='/terms'||pathname==='/legal')return null;
  return <nav aria-label="S.O.S. legal and support" style={{position:'fixed',left:'50%',bottom:8,transform:'translateX(-50%)',zIndex:1600,display:'flex',alignItems:'center',gap:9,padding:'6px 9px',borderRadius:999,background:'rgba(3,8,14,.8)',backdropFilter:'blur(14px)',border:'1px solid rgba(255,255,255,.08)',fontSize:9,fontWeight:850,letterSpacing:'.045em',whiteSpace:'nowrap'}}><a href="/privacy" style={{color:'rgba(255,255,255,.68)',textDecoration:'none'}}>PRIVACY</a><span style={{color:'rgba(255,255,255,.18)'}}>•</span><a href="/terms" style={{color:'rgba(255,255,255,.68)',textDecoration:'none'}}>TERMS</a><span style={{color:'rgba(255,255,255,.18)'}}>•</span><a href="/legal" style={{color:'rgba(255,255,255,.68)',textDecoration:'none'}}>NOT 911</a><span style={{color:'rgba(255,255,255,.18)'}}>•</span><a href="mailto:thedoctordorsey@gmail.com" style={{color:'rgba(255,255,255,.68)',textDecoration:'none'}}>SUPPORT</a></nav>;
}
