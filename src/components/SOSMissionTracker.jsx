import React,{useEffect,useMemo,useState}from'react';
import{getCustomerMission,cancelCustomerMission,missionPhase}from'../lib/sosMissionClient';

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

export default function SOSMissionTracker({token,missionId,initialMission,onClose}){
  const[mission,setMission]=useState(initialMission||null);
  const[error,setError]=useState('');
  const[canceling,setCanceling]=useState(false);
  const phase=missionPhase(mission?.status||initialMission?.status||'requested');
  const stepIndex=rank(phase);
  const hero=mission?.hero;
  const heroUser=hero?.user;
  const hasAssignment=Boolean(mission?.hero_id&&hero);
  const activeOffers=(mission?.offers||[]).filter(offer=>offer.status==='pending');
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
    const interval=setInterval(refresh,5000);
    return()=>{active=false;clearInterval(interval)};
  },[token,missionId]);

  const cancel=async()=>{
    if(canceling)return;
    setCanceling(true);setError('');
    try{const next=await cancelCustomerMission(token,missionId);setMission(next)}
    catch(e){setError(e.message||'Unable to cancel')}
    finally{setCanceling(false)}
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
      <div className="sos-mission-facts"><div><span>PICKUP</span><strong>{mission?.pickup_address||initialMission?.pickup_address||'Current GPS location'}</strong></div><div><span>STARTING ESTIMATE</span><strong>${Number(mission?.estimated_price||initialMission?.estimated_price||0).toFixed(0)}</strong></div></div>
      {error&&<div className="sos-tracker-error">{error}</div>}
      <div className="sos-tracker-actions">{['requested','matching'].includes(mission?.status||'requested')&&<button className="sos-cancel-mission" onClick={cancel} disabled={canceling}>{canceling?'Canceling…':'Cancel request'}</button>}<button className="sos-support-action" onClick={()=>window.location.href='tel:911'}>Emergency? Call 911</button></div>
      <p className="sos-tracker-safety">S.O.S. is roadside assistance—not emergency services. Assignment, location, and ETA appear only from live mission data.</p>
    </section>
  </div>;
}
