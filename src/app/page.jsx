'use client';
import dynamic from 'next/dynamic';
const SOSApp = dynamic(() => import('@/components/SOSApp'), { 
  ssr: false,
  loading: () => (
    <div style={{minHeight:'100vh',background:'#080c14',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',fontFamily:"'Inter',sans-serif",color:'#fff'}}>
      <div style={{fontSize:32,fontWeight:900,marginBottom:8}}>S.O.S</div>
      <div style={{fontSize:12,color:'rgba(255,255,255,0.4)',letterSpacing:2}}>SUPERHEROES ON STANDBY</div>
      <div style={{width:40,height:40,border:'3px solid rgba(255,107,53,0.2)',borderTopColor:'#FF6B35',borderRadius:'50%',animation:'spin 0.8s linear infinite',marginTop:24}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
});
export default function Home() { return <SOSApp />; }
