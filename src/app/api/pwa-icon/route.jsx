import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(request) {
  const requested = Number(new URL(request.url).searchParams.get('size') || 512);
  const size = [192, 512].includes(requested) ? requested : 512;

  return new ImageResponse(
    <div style={{
      width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',
      position:'relative',overflow:'hidden',
      background:'radial-gradient(circle at 50% 22%, rgba(255,107,53,.34), transparent 42%), linear-gradient(145deg,#101a29,#020609 74%)'
    }}>
      <div style={{position:'absolute',width:'82%',height:'82%',border:'2px solid rgba(255,107,53,.35)',borderRadius:'28%'}} />
      <div style={{
        display:'flex',alignItems:'center',justifyContent:'center',
        width:'66%',height:'66%',borderRadius:'24%',
        background:'linear-gradient(145deg,#ff8a4c,#ff6b35 56%,#b83f1c)',
        boxShadow:'0 26px 80px rgba(255,107,53,.35)',
        color:'#fff',fontFamily:'Arial,sans-serif',fontWeight:900,fontSize:size*.22,letterSpacing:'-.06em'
      }}>SOS</div>
      <div style={{
        position:'absolute',bottom:'7%',display:'flex',color:'#f7f8fa',
        fontFamily:'Arial,sans-serif',fontWeight:900,fontSize:Math.max(10,size*.032),letterSpacing:Math.max(2,size*.008)
      }}>ON STANDBY</div>
    </div>,
    { width:size, height:size }
  );
}
