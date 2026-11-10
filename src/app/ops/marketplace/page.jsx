'use client';

// S.O.S. management backend: both sides of the marketplace in one place.
//  · Launch & providers — customer go-live date, the 14-day packet trigger,
//    legal documents, the standby Hero roster, packet + background check review.
//  · Live marketplace — customers, requests, nearest-Hero offers, Heroes on duty.

import {useEffect,useMemo,useState} from 'react';
import styles from '../heroes/HeroOps.module.css';
import m from './Marketplace.module.css';

const SB='https://cxdqkjvtpilvouwtbgdy.supabase.co';
const SK='sb_publishable_x_QDbPwZuhbqB1bd58MLvg_ADSiFODN';
const MARKET='atlanta-ga-2026';
const headers=token=>({apikey:SK,Authorization:`Bearer ${token}`,'Content-Type':'application/json'});
const pretty=v=>String(v||'—').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
const ZONE={east:'East',south:'South',west:'West',downtown:'Downtown',midtown:'Midtown',buckhead:'Buckhead'};
const AVAIL={weekday_days:'Weekdays',weekday_evenings:'Evenings',overnight:'Overnight',weekends:'Weekends'};
const SERVICE={tow:'Tow',fuel:'Gas',jump:'Jump',flat:'Flat',lockout:'Lockout'};
const LEGAL={background_check_disclosure:'Background check disclosure',background_check_authorization:'Background check authorization',independent_contractor_agreement:'Independent contractor agreement'};
const BG=['not_started','authorized','in_progress','clear','consider','not_cleared'];
const when=v=>v?new Date(v).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'—';
const day=v=>v?new Date(`${v}T12:00:00`).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'Not set';

export default function MarketplaceOpsPage(){
 const[session,setSession]=useState(null),[email,setEmail]=useState(''),[password,setPassword]=useState('');
 const[tab,setTab]=useState('launch'),[launch,setLaunch]=useState(null),[live,setLive]=useState(null);
 const[busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const[goLive,setGoLive]=useState(''),[leadDays,setLeadDays]=useState(14),[filter,setFilter]=useState('all'),[query,setQuery]=useState('');
 const[review,setReview]=useState({}),[legal,setLegal]=useState({type:'background_check_disclosure',version:'',title:'',body:''});

 const rpc=async(name,body={},token=session?.access_token)=>{
  const r=await fetch(`${SB}/rest/v1/rpc/${name}`,{method:'POST',headers:headers(token),body:JSON.stringify(body)});
  const d=await r.json().catch(()=>null);if(!r.ok)throw new Error(d?.message||d?.error||`${name} failed`);return d;
 };
 const load=async(token=session?.access_token)=>{
  const[l,v]=await Promise.all([rpc('sos_ops_launch_overview',{p_market_key:MARKET},token),rpc('sos_ops_marketplace_live',{},token)]);
  setLaunch(l);setLive(v);setGoLive(l?.market?.go_live_date||'');setLeadDays(l?.market?.packet_lead_days||14);
 };
 useEffect(()=>{try{const s=JSON.parse(localStorage.getItem('sos_ops_session'));if(s?.access_token){setSession(s);load(s.access_token).catch(()=>{localStorage.removeItem('sos_ops_session');setSession(null)})}}catch{}},[]);
 useEffect(()=>{if(!session||tab!=='live')return;const t=setInterval(()=>rpc('sos_ops_marketplace_live').then(setLive).catch(()=>{}),15000);return()=>clearInterval(t)},[session?.access_token,tab]);

 const login=async e=>{e.preventDefault();setBusy('login');setError('');
  try{
   const r=await fetch(`${SB}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:SK,'Content-Type':'application/json'},body:JSON.stringify({email,password})});
   const d=await r.json();if(!r.ok)throw new Error(d.error_description||'Sign in failed');
   const ok=await rpc('marketplace_operator_check',{},d.access_token);if(ok!==true)throw new Error('This account is not an active marketplace operator.');
   localStorage.setItem('sos_ops_session',JSON.stringify(d));setSession(d);await load(d.access_token);
  }catch(e){setError(e.message)}finally{setBusy('')}};
 const act=async(key,fn,success)=>{setBusy(key);setError('');setNotice('');try{const r=await fn();setNotice(typeof success==='function'?success(r):success);await load()}catch(e){setError(e.message)}finally{setBusy('')}};

 const roster=useMemo(()=>{
  const rows=launch?.roster||[];const q=query.trim().toLowerCase();
  return rows.filter(r=>filter==='all'?!['rejected','withdrawn'].includes(r.status)
    :filter==='packet_review'?r.packet_status==='submitted'
    :filter==='closed'?['rejected','withdrawn'].includes(r.status):r.status===filter)
   .filter(r=>!q||[r.name,r.email,r.phone,r.vehicle].join(' ').toLowerCase().includes(q));
 },[launch,filter,query]);

 if(!session)return <main className={styles.page}><form className={styles.auth} onSubmit={login}>
  <span className={styles.status}>S.O.S. OPERATIONS</span><h1>Marketplace command</h1>
  <p>Both sides of S.O.S.: the provider launch roster and onboarding packets, plus live customer requests and nearest-Hero dispatch.</p>
  <label className={styles.field}>Operator email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
  <label className={styles.field}>Password<input type="password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>
  {error&&<div className={styles.error}>{error}</div>}
  <button className={styles.primary} disabled={busy==='login'}>{busy==='login'?'Signing in…':'Sign in'}</button></form></main>;

 const mk=launch?.market||{},c=launch?.counts||{},lc=live?.counts||{};
 return <main className={styles.page}><div className={styles.shell}>
  <header className={m.top}>
   <div><span className={styles.status}>S.O.S. OPERATIONS · {mk.city||'ATLANTA'}</span><h1>Marketplace command</h1></div>
   <nav className={m.tabs}>
    <button className={tab==='launch'?m.tabOn:''} onClick={()=>setTab('launch')}>Launch &amp; providers</button>
    <button className={tab==='live'?m.tabOn:''} onClick={()=>setTab('live')}>Live marketplace</button>
    <a href="/ops/heroes">Hero activation</a><a href="/ops">Ops home</a>
    <button onClick={()=>act('refresh',()=>Promise.resolve(),'Refreshed.')}>{busy==='refresh'?'…':'Refresh'}</button>
   </nav>
  </header>
  {error&&<div className={styles.error}>{error}</div>}{notice&&<div className={styles.notice}>{notice}</div>}

  {tab==='launch'&&launch&&<>
   <section className={m.grid2}>
    <div className={m.card}>
     <span className={m.kicker}>CUSTOMER GO-LIVE</span>
     <h2>{mk.go_live_date?day(mk.go_live_date):'Date not set'}</h2>
     <p>{mk.go_live_date?`Full onboarding packets go out automatically on ${day(mk.packet_send_date)} (${mk.packet_lead_days} days before), 8:00 AM Eastern, to every standby Hero.`:'Set the date customers go live. Packets go out automatically 14 days before it. Standby Heroes keep joining until then.'}</p>
     <div className={m.row}>
      <label className={styles.field}>Go-live date<input type="date" value={goLive||''} onChange={e=>setGoLive(e.target.value)}/></label>
      <label className={styles.field}>Lead days<input type="number" min="1" max="60" value={leadDays} onChange={e=>setLeadDays(Number(e.target.value))}/></label>
     </div>
     <div className={m.row}>
      <button className={styles.primary} disabled={busy==='golive'||!goLive} onClick={()=>act('golive',()=>rpc('sos_ops_set_market_go_live',{p_market_key:MARKET,p_go_live:goLive,p_lead_days:leadDays}),r=>`Go-live saved. Packets send ${day(r?.packet_send_date)}.`)}>Save go-live</button>
      <button className={styles.secondary} disabled={busy==='send'||!launch.legal_ready} title={launch.legal_ready?'':'Publish attorney-approved legal documents first'} onClick={()=>{if(confirm('Send the full onboarding packet to every standby Hero now?'))act('send',()=>rpc('sos_ops_send_onboarding_packets',{p_market_key:MARKET}),r=>`${r?.packets_sent||0} packets sent.`)}}>Send packets now</button>
     </div>
    </div>
    <div className={m.card}>
     <span className={m.kicker}>LEGAL DOCUMENTS IN THE PACKET</span>
     <h2>{launch.legal_ready?'Ready':'Attorney sign-off needed'}</h2>
     <p>{launch.legal_ready?'Providers sign these versions in their packet. Signatures are permanent records.':'Packets will not send until each document has attorney-approved text. Drafts are in place as placeholders.'}</p>
     <ul className={m.checklist}>{(launch.legal_documents||[]).map(d=><li key={d.consent_type} className={d.ready?m.ok:m.warn}><b>{d.ready?'✓':'!'}</b>{LEGAL[d.consent_type]}<small>{d.ready?`v ${d.approved_version}`:'Not approved'}</small></li>)}</ul>
     <details className={m.details}><summary>Publish final text</summary>
      <select value={legal.type} onChange={e=>setLegal({...legal,type:e.target.value})}>{Object.entries(LEGAL).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select>
      <div className={m.row}><input placeholder="Version (e.g. 2026-11)" value={legal.version} onChange={e=>setLegal({...legal,version:e.target.value})}/><input placeholder="Title" value={legal.title} onChange={e=>setLegal({...legal,title:e.target.value})}/></div>
      <textarea rows={6} placeholder="Paste the attorney-approved text" value={legal.body} onChange={e=>setLegal({...legal,body:e.target.value})}/>
      <button className={styles.primary} disabled={busy==='legal'||!legal.version||!legal.title||legal.body.length<20} onClick={()=>{if(confirm('Publish this as final? Published text cannot be edited once providers sign it.'))act('legal',()=>rpc('sos_ops_publish_consent_document',{p_consent_type:legal.type,p_version:legal.version,p_title:legal.title,p_body:legal.body}),'Published.')}}>Publish</button>
     </details>
    </div>
   </section>

   <section className={m.tiles}>
    {[['Signed up, no login',c.standby_pending],['Active standby',c.standby],['Packets sent',c.packets_sent],['Packets submitted',c.packets_submitted],['Background clear',c.background_clear],['In review',c.in_review],['Approved',c.approved],['Verified (dispatchable)',c.verified]].map(([k,v])=><div key={k}><strong>{v??0}</strong><span>{k}</span></div>)}
   </section>

   <section className={m.grid2}>
    <div className={m.card}><span className={m.kicker}>ROSTER BY ZONE</span><div className={m.bars}>{Object.entries(launch.by_zone||{}).map(([z,n])=><div key={z}><span>{ZONE[z]}</span><i style={{width:`${Math.min(100,n*4)}%`}}/><b>{n}</b></div>)}</div></div>
    <div className={m.card}><span className={m.kicker}>COVERAGE BY SERVICE</span><div className={m.bars}>{Object.entries(launch.by_service||{}).map(([id,s])=><div key={id}><span>{SERVICE[id]||s.name}</span><i style={{width:`${Math.min(100,s.roster*4)}%`}}/><b>{s.roster}<small> · {s.verified} verified</small></b></div>)}</div></div>
   </section>

   <section className={m.card}>
    <div className={m.listHead}><div><span className={m.kicker}>PROVIDER ROSTER</span><h2>{roster.length} providers</h2></div>
     <div className={m.row}>
      <select value={filter} onChange={e=>setFilter(e.target.value)}>{[['all','All active'],['standby','Active standby'],['standby_pending','Signed up, no login'],['packet_review','Packet ready for review'],['reviewing','In review'],['needs_information','Needs changes'],['conditionally_approved','Approved'],['closed','Closed']].map(([k,v])=><option key={k} value={k}>{v}</option>)}</select>
      <input placeholder="Search name, email, phone" value={query} onChange={e=>setQuery(e.target.value)}/>
     </div></div>
    {roster.length===0&&<p className={m.empty}>No providers in this view yet.</p>}
    <div className={m.list}>{roster.map(r=>{
     const done=(r.packet_items||[]).filter(i=>i.done).length,total=(r.packet_items||[]).length,rv=review[r.application_id]||{};
     return <article key={r.application_id} className={m.item}>
      <div className={m.itemHead}><div><b>{r.name}</b><small>{r.email} · {r.phone}</small></div><span className={m.pill}>{pretty(r.status)}</span></div>
      <div className={m.facts}>
       <span><em>Zone</em>{ZONE[r.service_zone]||'—'}</span>
       <span><em>Services</em>{(r.services||[]).map(s=>SERVICE[s]||s).join(', ')||'—'}</span>
       <span><em>Hours</em>{(r.availability||[]).map(a=>AVAIL[a]).join(', ')||'—'}</span>
       <span><em>Vehicle</em>{r.vehicle||'—'}</span>
       <span><em>Joined</em>{when(r.standby_at||r.submitted_at)}</span>
       <span><em>Packet</em>{r.packet_id?`${pretty(r.packet_status)} · ${done}/${total}`:'Not sent yet'}</span>
       <span><em>Background</em>{pretty(r.background_check_status||'not_started')}</span>
      </div>
      {r.packet_id&&<div className={m.items}>{(r.packet_items||[]).map(i=><span key={i.key} className={i.done?m.ok:m.warn}>{i.done?'✓':'○'} {i.label}</span>)}</div>}
      {r.packet_id&&['submitted','needs_changes'].includes(r.packet_status)&&<div className={m.reviewBox}>
       <div className={m.row}>
        <select value={rv.bg||r.background_check_status||'authorized'} onChange={e=>setReview(x=>({...x,[r.application_id]:{...rv,bg:e.target.value}}))}>{BG.map(b=><option key={b} value={b}>Background: {pretty(b)}</option>)}</select>
        <input placeholder="Background check reference #" value={rv.ref??r.background_check_reference??''} onChange={e=>setReview(x=>({...x,[r.application_id]:{...rv,ref:e.target.value}}))}/>
       </div>
       <input placeholder="Note to provider (required for changes)" value={rv.note||''} onChange={e=>setReview(x=>({...x,[r.application_id]:{...rv,note:e.target.value}}))}/>
       <div className={m.row}>
        <button className={styles.secondary} disabled={!!busy} onClick={()=>act(`bg${r.application_id}`,()=>rpc('sos_ops_review_onboarding_packet',{p_packet_id:r.packet_id,p_decision:'background_update',p_note:null,p_background_status:rv.bg||r.background_check_status,p_background_reference:rv.ref||null}),'Background check updated.')}>Save background</button>
        <button className={styles.reject} disabled={!!busy||!(rv.note||'').trim()} onClick={()=>act(`chg${r.application_id}`,()=>rpc('sos_ops_review_onboarding_packet',{p_packet_id:r.packet_id,p_decision:'needs_changes',p_note:rv.note}),'Sent back for changes.')}>Needs changes</button>
        <button className={styles.primary} disabled={!!busy} title="Requires accepted driver license + insurance (Hero activation page) and a clear background check" onClick={()=>act(`ok${r.application_id}`,()=>rpc('sos_ops_review_onboarding_packet',{p_packet_id:r.packet_id,p_decision:'approve',p_note:rv.note||null,p_background_status:rv.bg||null,p_background_reference:rv.ref||null}),'Approved. Hero moves to final activation (test mission + payout).')}>Approve packet</button>
       </div>
       <small className={m.hint}>Accept the driver license and insurance files on <a href="/ops/heroes">Hero activation</a> first, then record a clear background check and approve.</small>
      </div>}
      {!['rejected','withdrawn'].includes(r.status)&&<button className={m.remove} disabled={!!busy} onClick={()=>{const note=prompt(`Remove ${r.name} from the roster? Add a reason:`);if(note)act(`rm${r.application_id}`,()=>rpc('sos_ops_review_hero_application',{p_application_id:r.application_id,p_decision:'rejected',p_note:note}),'Removed from roster.')}}>Remove from roster</button>}
     </article>})}</div>
   </section>
  </>}

  {tab==='live'&&live&&<>
   <section className={m.tiles}>
    {[['Customers',lc.customers],['New customers (7 days)',lc.customers_new_7d],['Heroes on duty now',lc.heroes_on_duty],['Verified Heroes',lc.heroes_verified],['Standby Heroes',lc.heroes_standby],['Open requests',lc.missions_open],['Waiting for a Hero',lc.missions_unmatched],['Offers out now',lc.offers_pending],['Requests today',lc.missions_today],['Completed today',lc.completed_today]].map(([k,v])=><div key={k} className={k==='Waiting for a Hero'&&v>0?m.alert:''}><strong>{v??0}</strong><span>{k}</span></div>)}
   </section>
   <section className={m.card}>
    <span className={m.kicker}>REQUESTS · NEAREST HEROES GET OFFERS FIRST · REFRESHES EVERY 15s</span>
    {(live.missions||[]).length===0&&<p className={m.empty}>No customer requests yet.</p>}
    <div className={m.list}>{(live.missions||[]).map(x=><article key={x.id} className={m.item}>
     <div className={m.itemHead}><div><b>{x.service}</b><small>{x.address||'—'}</small></div><span className={`${m.pill} ${['requested','matching'].includes(x.status)?m.pillHot:''}`}>{pretty(x.status)}</span></div>
     <div className={m.facts}>
      <span><em>Customer</em>{x.customer||'—'}{x.customer_phone?` · ${x.customer_phone}`:''}</span>
      <span><em>Hero</em>{x.hero||'Not assigned'}</span>
      <span><em>Requested</em>{when(x.created_at)}</span>
      <span><em>Offers</em>{x.offers?.total?`${x.offers.total} sent · ${x.offers.pending} pending · ${x.offers.declined} declined · ${x.offers.expired} expired`:'None yet'}</span>
      <span><em>Nearest offer</em>{x.offers?.nearest_miles!=null?`${Number(x.offers.nearest_miles).toFixed(1)} mi`:'—'}</span>
      <span><em>Search radius</em>{x.radius_miles?`${x.radius_miles} mi`:'—'}</span>
      <span><em>Price</em>{x.price!=null?`$${Number(x.price).toFixed(0)}`:'—'}</span>
     </div>
    </article>)}</div>
   </section>
   <section className={m.card}>
    <span className={m.kicker}>HEROES ON DUTY</span>
    {(live.heroes_on_duty||[]).length===0&&<p className={m.empty}>No Heroes on duty right now.</p>}
    <div className={m.list}>{(live.heroes_on_duty||[]).map(h=><article key={h.hero_id} className={m.item}><div className={m.itemHead}><div><b>{h.name}</b><small>{h.zone||'—'} · {(h.services||[]).map(s=>SERVICE[s]||s).join(', ')}</small></div><span className={m.pill}>GPS {when(h.last_gps_at)}</span></div></article>)}</div>
   </section>
  </>}
 </div></main>;
}
