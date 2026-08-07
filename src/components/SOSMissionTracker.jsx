import React,{useEffect,useMemo,useState}from'react';
import{getCustomerMission,cancelCustomerMission,authorizeCustomerMission,rateCustomerMission,missionPhase}from'../lib/sosMissionClient';

const STEPS=[
  {id:'received',label:'Request received'},
  {id:'matching',label:'Finding a verified Hero'},
  {id:'assigned',label:'Hero assigned'},
  {id:'en_route',label:'Hero en route'},
  {id:'on_site',label:'Hero arrived'},
  {id:'working',label:'Service in progress'},
  {id:'completed',label:'Service completed'},
];
const rank=phase=>Math.max(0,STEPS.findIndex(step=>step.id===phase));
const paid=status=>['authorized','captured','released'].includes(status||'');

export default function SOSMissionTracker({token,missionId,initialMission,onClose}){
  const[mission,setMission]=useState(initialMission||null);
  const[error,setError]=useState('');
  const[canceling,setCanceling]=useState(false);
  const[paying,setPaying]=useState(false);
  const[ratingBusy,setRatingBusy]=useState(false);
  const[ratingValue,setRatingValue]=useState(0);
  const phase=missionPhase(mission?.status||initialMission?.status||'requested');
  const stepIndex=rank(phase);
  const hero=mission?.hero;
  const heroUser=hero?.user;
  const hasAssignment=Boolean(mission?.hero_id&&hero);
  const activeOffers=(mission?.offers||[]).filter(offer=>offer.status==='pending');
  const payment=mission?.payments?.[0]||null;
  const alreadyRated=Boolean(mission?.ratings?.length);
  const paymentReady=paid(payment?.payment_status);
  const finalPrice=Number(mission?.final_price||0);
  const canAuthorize=hasAssignment&&mission?.pricing_status==='confirmed'&&finalPrice>0&&!paymentReady&&!['completed','canceled_by_citizen','canceled_by_hero','canceled_by_system'].includes(mission?.status);
  const mapUrl=useMemo(()=>{
    const lat=mission?.pickup_lat||initialMission?.pickup_lat||33.749;
    const lng=mission?.pickup_lng||initialMission?.pickup_lng||-84.388;
    const dx=.035,dy=.025;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${lng-dx}%2C${lat-dy}%2C${lng+dx}%2C${lat+dy}&layer=mapnik&marker=${lat}%2C${lng}`;
  },[mission?.pickup_lat,mission?.pickup_lng,initialMission?.pickup_lat,initialMission?.pickup_lng]);

  useEffect(()=>{
    if(!token||!missionId)return;
    let active=true;
    const refresh=async()=>{
      try{const next=await getCustomerMission(token,missionId);if(active&&next){setMission(next);setError('')}}
      catch(e){if(active)setError(e.message||'Status update unavailable')}
    };
    refresh();
    const interval=setInterval(refresh,4000);
    return()=>{active=false;clearInterval(interval)};
  },[token,missionId]);

  const cancel=async()=>{
    if(canceling)return;
    setCanceling(true);setError('');
    try{const next=await cancelCustomerMission(token,missionId);setMission(next)}
    catch(e){setError(e.message||'Unable to cancel')}
    finally{setCanceling(false)}
  };

  const authorize=async()=>{
    if(paying)return;
    setPaying(true);setError('');
    try{
      const result=await authorizeCustomerMission(token,missionId);
      if(!result?.checkout_url)throw new Error('Secure checkout is unavailable');
      window.location.assign(result.checkout_url);
    }catch(e){setError(e.message||'Payment authorization is unavailable');setPaying(false)}
  };

  const submitRating=async value=>{
    if(ratingBusy||alreadyRated)return;
    setRatingBusy(true);setError('');
    try{await rateCustomerMission(token,missionId,value);setRatingValue(value);const next=await getCustomerMission(token,missionId);if(next)setMission(next)}
    catch(e){setError(e.message||'Rating could not be submitted')}
    finally{setRatingBusy(false)}
  };

  const title=phase==='matching'?'Searching for your Hero':phase==='assigned'?'Your Hero accepted':phase==='en_route'?'Help is on the way':phase==='on_site'?'Your Hero has arrived':phase==='working'?'Service is underway':phase==='completed'?'You’re back on the road':phase==='canceled'?'Request canceled':'Roadside request active';
  const subtitle=phase==='matching'
    ?activeOffers.length?`${activeOffers.length} verified Hero${activeOffers.length===1?'':'es'} notified. The first qualified acceptance wins.`:'No verified on-duty Hero has accepted yet. Dispatch remains active.'
    :hasAssignment?`${heroUser?.first_name||'Your Hero'} is assigned to ${mission?.requested_service_name||'your request'}.`
    :'Your request is saved and visible to S.O.S. operations.';

  return <div className="sos-mobility-layer" role="dialog" aria-modal="true" aria-label="S.O.S. mission tracker">
    <div className="sos-live-map"><iframe title="S.O.S. live mission map" src={mapUrl}/><div className="sos-map-overlay"/><div className="sos-radar"><span/><i/><b/></div><div className="sos-live-pill"><span/> LIVE MISSION</div></div>
    <section className="sos-tracker-sheet">
      <div className="sos-sheet-handle"/>
      <div className="sos-tracker-head"><div><small>{mission?.requested_service_name||'ROADSIDE ASSISTANCE'}</small><h2>{title}</h2><p>{subtitle}</p></div><button onClick={onClose} aria-label="Minimize tracker">—</button></div>
      {hasAssignment&&<div className="sos-hero-card"><div className="sos-hero-avatar">{heroUser?.avatar_url?<img src={heroUser.avatar_url} alt=""/>:(heroUser?.first_name?.[0]||'H')}</div><div><span>VERIFIED HERO</span><strong>{[heroUser?.first_name,heroUser?.last_name].filter(Boolean).join(' ')||'Assigned Hero'}</strong><small>★ {Number(hero?.rating||5).toFixed(1)} · {hero?.level||'S.O.S. Hero'}</small></div>{mission?.eta_minutes&&<em>{mission.eta_minutes}<small>MIN</small></em>}</div>}
      <div className="sos-progress-track">{STEPS.map((step,index)=><div key={step.id} className={`${index<=stepIndex?'done':''} ${index===stepIndex?'current':''}`}><span>{index<stepIndex?'✓':index+1}</span><label>{step.label}</label></div>)}</div>
      <div className="sos-mission-facts"><div><span>PICKUP</span><strong>{mission?.pickup_address||initialMission?.pickup_address||'Current GPS location'}</strong></div><div><span>{mission?.pricing_status==='confirmed'?'FINAL PRICE':'STARTING ESTIMATE'}</span><strong>${Number(finalPrice||mission?.estimated_price||initialMission?.estimated_price||0).toFixed(0)}</strong></div></div>

      {hasAssignment&&mission?.pricing_status!=='confirmed'&&phase==='assigned'&&<div className="sos-tracker-error" style={{borderColor:'rgba(255,179,71,.35)',color:'#ffcf8a'}}>Your Hero is confirming the final price. You will approve it before the Hero starts the route.</div>}
      {canAuthorize&&<div style={{background:'#111827',border:'1px solid rgba(255,107,53,.45)',borderRadius:16,padding:16,margin:'14px 0'}}><div style={{fontSize:11,letterSpacing:'.12em',color:'#ff9a73',fontWeight:800}}>PAYMENT AUTHORIZATION REQUIRED</div><div style={{fontSize:20,fontWeight:900,color:'#fff',marginTop:5}}>${finalPrice.toFixed(2)}</div><p style={{fontSize:12,lineHeight:1.5,color:'rgba(255,255,255,.7)',margin:'6px 0 12px'}}>Authorize securely with Stripe. Your card is authorized now and captured only after service completion.</p><button className="sos-support-action" style={{width:'100%',background:'#ff6b35',color:'#fff',borderColor:'#ff6b35'}} onClick={authorize} disabled={paying}>{paying?'Opening secure checkout…':'Authorize & dispatch Hero'}</button></div>}
      {paymentReady&&<div style={{background:'rgba(16,185,129,.08)',border:'1px solid rgba(16,185,129,.28)',borderRadius:14,padding:'12px 14px',margin:'12px 0',color:'#9ff0d3',fontSize:12,fontWeight:700}}>✓ Payment {payment?.payment_status==='released'?'completed':payment?.payment_status==='captured'?'captured after service':'authorized — your Hero can begin the route'}</div>}

      {phase==='completed'&&!alreadyRated&&<div style={{background:'#111827',border:'1px solid rgba(255,179,71,.28)',borderRadius:16,padding:16,margin:'14px 0',textAlign:'center'}}><strong style={{display:'block',color:'#fff',fontSize:15}}>How did your Hero do?</strong><div style={{display:'flex',justifyContent:'center',gap:8,marginTop:12}}>{[1,2,3,4,5].map(value=><button key={value} disabled={ratingBusy} onClick={()=>submitRating(value)} style={{width:42,height:42,borderRadius:12,border:'1px solid rgba(255,179,71,.35)',background:ratingValue>=value?'#ffb347':'#0d1320',color:ratingValue>=value?'#111':'#ffb347',fontSize:20,cursor:'pointer'}}>★</button>)}</div></div>}
      {phase==='completed'&&alreadyRated&&<div style={{color:'#9ff0d3',fontSize:12,fontWeight:700,textAlign:'center',margin:'12px 0'}}>✓ Rating submitted. Thank you.</div>}

      {error&&<div className="sos-tracker-error">{error}</div>}
      <div className="sos-tracker-actions">{['requested','matching'].includes(mission?.status||'requested')&&<button className="sos-cancel-mission" onClick={cancel} disabled={canceling}>{canceling?'Canceling…':'Cancel request'}</button>}<button className="sos-support-action" onClick={()=>window.location.href='/support'}>S.O.S. support</button><button className="sos-support-action" onClick={()=>window.location.href='tel:911'}>Emergency? Call 911</button></div>
      <p className="sos-tracker-safety">S.O.S. is roadside assistance—not emergency services. Assignment, payment, location, and ETA appear only from live mission data.</p>
    </section>
  </div>;
}
