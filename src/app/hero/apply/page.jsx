'use client';

import {useEffect,useMemo,useState} from 'react';
import styles from './HeroApply.module.css';
import {LAUNCH_SERVICES,LAUNCH_MARKET} from '@/lib/sosLaunch';

// S.O.S. provider side.
// Phase 1 (now): simple signup + secure login = ACTIVE standby Hero on the launch roster.
// Phase 2 (go-live minus 14 days): full onboarding packet — license, insurance,
// registration, headshot, background check + contractor agreement signatures.
// Nobody receives jobs until the packet, background check and verification clear.

const SB='https://cxdqkjvtpilvouwtbgdy.supabase.co';
const SK='sb_publishable_x_QDbPwZuhbqB1bd58MLvg_ADSiFODN';
const RECEIPT_KEY='sos_hero_application_receipt';
const DRAFT_KEY='sos_hero_application_draft';
const ZONES=[['east','East'],['south','South'],['west','West'],['downtown','Downtown'],['midtown','Midtown'],['buckhead','Buckhead']];
const AVAILABILITY=[['weekday_days','Weekdays (day)'],['weekday_evenings','Weekday evenings'],['overnight','Overnight'],['weekends','Weekends']];
// Legacy credential-first applications (submitted before standby onboarding).
const requiredDocs=[['government_id','Government ID','Clear photo or PDF'],['drivers_license','Driver license','Front of current license'],['insurance','Insurance','Current policy / card']];
const packetDocs={drivers_license:'Front and back of your current license',insurance:'Current auto or commercial policy / card',vehicle_registration:'Registration for your service vehicle',headshot:'Clear, well-lit photo of your face'};
const empty={firstName:'',lastName:'',email:'',phone:'',city:'Atlanta',state:'GA',serviceZone:'',availability:[],services:[],tools:[],vehicleType:'',vehicleMake:'',vehicleModel:'',vehicleYear:'',yearsExperience:'',experienceSummary:'',licenseAttested:false,insuranceAttested:false,backgroundConsent:false,termsAccepted:false};
const authHeaders=token=>({apikey:SK,Authorization:`Bearer ${token}`,'Content-Type':'application/json'});
const allowed=new Set(['application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif']);
const ext=f=>f.name?.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g,'')||'bin';
const pretty=s=>String(s||'standby_pending').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
const day=d=>d?new Date(`${d}T12:00:00`).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}):'';
const LEGACY=new Set(['documents_required','waitlisted']);
const STATUS_TITLE={standby_pending:'Almost active',standby:'Active standby Hero',reviewing:'Packet under review',needs_information:'Packet needs changes',conditionally_approved:'Conditionally approved',approved:'Approved',rejected:'Application closed',withdrawn:'Application withdrawn'};

export default function HeroApplyPage(){
 const[form,setForm]=useState(empty),[otherServices,setOtherServices]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const[receipt,setReceipt]=useState(null),[status,setStatus]=useState(null),[auth,setAuth]=useState(null),[password,setPassword]=useState(''),[docs,setDocs]=useState([]);
 const[uploading,setUploading]=useState(''),[step,setStep]=useState(0),[notices,setNotices]=useState([]),[saved,setSaved]=useState(false);
 const[resumeOpen,setResumeOpen]=useState(false),[resumeMode,setResumeMode]=useState('signin'),[resumeEmail,setResumeEmail]=useState('');
 const[onboarding,setOnboarding]=useState(null),[signName,setSignName]=useState({}),[readDoc,setReadDoc]=useState({}),[profileEdit,setProfileEdit]=useState(null);

 useEffect(()=>{
  fetch(`${SB}/rest/v1/sos_subcategories?select=id,name&is_active=eq.true&order=sort_order.asc,name.asc`,{headers:{apikey:SK}})
   .then(r=>r.json()).then(d=>Array.isArray(d)&&setOtherServices(d.filter(s=>!LAUNCH_SERVICES.some(l=>l.id===s.id)))).catch(()=>{});
  try{
   const r=JSON.parse(localStorage.getItem(RECEIPT_KEY));if(r?.application_id&&(r?.tracking_token||r?.resumed_by_verified_email))setReceipt(r);
   const s=JSON.parse(localStorage.getItem('sos_session'));if(s?.access_token)setAuth(s);
   const draft=JSON.parse(localStorage.getItem(DRAFT_KEY));if(draft&&!r)setForm({...empty,...draft});
  }catch{}
 },[]);
 useEffect(()=>{if(receipt)return;const t=setTimeout(()=>{try{localStorage.setItem(DRAFT_KEY,JSON.stringify(form));setSaved(true);setTimeout(()=>setSaved(false),900)}catch{}},500);return()=>clearTimeout(t)},[form,receipt]);

 const loadPrivate=async(session=auth,nextReceipt=receipt)=>{
  if(!session||!nextReceipt?.application_id)return;
  const h=authHeaders(session.access_token);
  const[dr,nr,or]=await Promise.all([
   fetch(`${SB}/rest/v1/rpc/sos_hero_application_document_status`,{method:'POST',headers:h,body:JSON.stringify({p_application_id:nextReceipt.application_id})}),
   fetch(`${SB}/rest/v1/rpc/sos_hero_application_notifications`,{method:'POST',headers:h,body:JSON.stringify({p_application_id:nextReceipt.application_id})}),
   fetch(`${SB}/rest/v1/rpc/sos_hero_onboarding_status`,{method:'POST',headers:h,body:JSON.stringify({p_application_id:nextReceipt.application_id})})
  ]);
  const d=await dr.json().catch(()=>({}));if(dr.ok){setDocs(d.documents||[]);setStatus(s=>({...s,status:d.status,credentials_complete_at:d.credentials_complete_at}))}
  const n=await nr.json().catch(()=>[]);if(nr.ok&&Array.isArray(n))setNotices(n);
  const o=await or.json().catch(()=>null);if(or.ok&&o?.found){setOnboarding(o);setStatus(s=>({...s,status:o.status}))}
 };
 const refreshStatus=async nextReceipt=>{
  if(!nextReceipt?.application_id)return;
  if(!nextReceipt?.tracking_token&&auth){await loadPrivate(auth,nextReceipt);return}
  if(!nextReceipt?.tracking_token)return;
  const r=await fetch(`${SB}/functions/v1/submit-sos-hero-application`,{method:'POST',headers:{apikey:SK,'Content-Type':'application/json'},body:JSON.stringify({action:'status',application_id:nextReceipt.application_id,tracking_token:nextReceipt.tracking_token})});
  const d=await r.json().catch(()=>({}));if(r.ok)setStatus(s=>({...s,...d}));
  if(auth)await loadPrivate(auth,nextReceipt);
 };
 const resumeApplication=async session=>{
  if(!session?.access_token)return false;
  const r=await fetch(`${SB}/rest/v1/rpc/sos_hero_resume_application`,{method:'POST',headers:authHeaders(session.access_token),body:'{}'});
  const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.message||d.error||'Could not resume the application');
  if(!d.found)return false;
  const next={application_id:d.application_id,email:d.email,resumed_by_verified_email:true};
  localStorage.setItem(RECEIPT_KEY,JSON.stringify(next));setReceipt(next);setStatus(d);setResumeOpen(false);await loadPrivate(session,next);return true;
 };
 useEffect(()=>{if(receipt)refreshStatus(receipt)},[receipt?.application_id]);
 useEffect(()=>{if(!receipt)return;const t=setInterval(()=>refreshStatus(receipt),30000);return()=>clearInterval(t)},[receipt?.application_id,receipt?.tracking_token,auth?.access_token]);
 useEffect(()=>{if(auth&&receipt)loadPrivate(auth,receipt)},[auth?.access_token,receipt?.application_id]);

 const toggle=(key,value)=>setForm(f=>({...f,[key]:f[key].includes(value)?f[key].filter(x=>x!==value):[...f[key],value]}));
 const canNext=[
  Boolean(form.firstName&&form.lastName&&form.email&&form.phone&&form.serviceZone),
  form.services.length>0,
  form.availability.length>0,
  Boolean(form.licenseAttested&&form.insuranceAttested&&form.backgroundConsent&&form.termsAccepted)
 ];
 const submit=async e=>{
  e.preventDefault();if(step<3){if(canNext[step])setStep(step+1);return}
  setBusy(true);setError('');setNotice('');
  try{
   const r=await fetch(`${SB}/functions/v1/submit-sos-hero-application`,{method:'POST',headers:{apikey:SK,'Content-Type':'application/json'},body:JSON.stringify(form)});
   const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Signup could not be submitted');
   if(d.tracking_token){const x={application_id:d.application_id,tracking_token:d.tracking_token,email:form.email};localStorage.setItem(RECEIPT_KEY,JSON.stringify(x));localStorage.removeItem(DRAFT_KEY);setReceipt(x);setStatus(d)}
   else if(d.duplicate){setResumeEmail(form.email);setResumeOpen(true);setNotice('An active Hero signup already exists for this email. Sign in with the same email to resume it securely on this device.')}
   else setStatus(d);
  }catch(e){setError(e.message)}finally{setBusy(false)}
 };
 const authSession=async(mode,email)=>{
  const endpoint=mode==='signup'?`${SB}/auth/v1/signup`:`${SB}/auth/v1/token?grant_type=password`;
  const r=await fetch(endpoint,{method:'POST',headers:{apikey:SK,'Content-Type':'application/json'},body:JSON.stringify({email,password})});
  const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error_description||d.msg||d.error||'Account authentication failed');
  const token=d.access_token||d.session?.access_token;
  if(!token){setNotice('Check your email to confirm your S.O.S. account, then return here and sign in.');return null}
  const session={...d,access_token:token,user:d.user||d.session?.user};localStorage.setItem('sos_session',JSON.stringify(session));setAuth(session);return session;
 };
 const authenticate=async mode=>{
  if(!receipt?.email&&!form.email){setError('Signup email missing.');return}
  setBusy(true);setError('');setNotice('');
  try{
   const email=receipt.email||form.email;const session=await authSession(mode,email);if(!session)return;
   const br=await fetch(`${SB}/rest/v1/rpc/sos_hero_bind_application`,{method:'POST',headers:authHeaders(session.access_token),body:JSON.stringify({p_application_id:receipt.application_id,p_tracking_token:receipt.tracking_token})});
   const bd=await br.json().catch(()=>({}));if(!br.ok)throw new Error(bd.message||'Could not secure the signup to this account');
   if(bd.status==='standby')setNotice('You are now an active S.O.S. standby Hero.');
   await loadPrivate(session,receipt);
  }catch(e){setError(e.message)}finally{setBusy(false)}
 };
 const resumeAuthenticate=async()=>{
  if(!resumeEmail||!password){setError('Enter the same email used on your signup and your password.');return}
  setBusy(true);setError('');setNotice('');
  try{const session=await authSession(resumeMode,resumeEmail.trim().toLowerCase());if(!session)return;const found=await resumeApplication(session);if(!found){setNotice('No active Hero signup was found for this verified email. You can start a new one below.');setResumeOpen(false)}}
  catch(e){setError(e.message)}finally{setBusy(false)}
 };
 const upload=async(type,file)=>{
  if(!file||!auth||!receipt)return;
  if(file.size>10*1024*1024){setError('Files must be 10 MB or smaller.');return}
  if(!allowed.has(file.type)){setError('Use PDF, JPEG, PNG, WebP, HEIC, or HEIF.');return}
  setUploading(type);setError('');
  try{
   const path=`applications/${auth.user.id}/${receipt.application_id}/${type}/${crypto.randomUUID()}.${ext(file)}`;
   const ur=await fetch(`${SB}/storage/v1/object/marketplace-verification/${path}`,{method:'POST',headers:{apikey:SK,Authorization:`Bearer ${auth.access_token}`,'Content-Type':file.type,'x-upsert':'false'},body:file});
   const ud=await ur.json().catch(()=>({}));if(!ur.ok)throw new Error(ud.message||'Upload failed');
   const rr=await fetch(`${SB}/rest/v1/rpc/sos_hero_submit_application_document`,{method:'POST',headers:authHeaders(auth.access_token),body:JSON.stringify({p_application_id:receipt.application_id,p_document_type:type,p_path:path})});
   const rd=await rr.json().catch(()=>({}));if(!rr.ok)throw new Error(rd.message||'Document submission failed');
   await loadPrivate();
  }catch(e){setError(e.message)}finally{setUploading('')}
 };
 const sign=async type=>{
  const name=(signName[type]||'').trim();if(!readDoc[type]){setError('Open and read the document, then check the box.');return}
  if(name.length<3){setError('Type your full legal name to sign.');return}
  setBusy(true);setError('');
  try{
   const r=await fetch(`${SB}/rest/v1/rpc/sos_hero_sign_consent`,{method:'POST',headers:authHeaders(auth.access_token),body:JSON.stringify({p_application_id:receipt.application_id,p_consent_type:type,p_signed_name:name,p_user_agent:navigator.userAgent})});
   const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.message||'Signature failed');
   await loadPrivate();
  }catch(e){setError(e.message)}finally{setBusy(false)}
 };
 const saveProfile=async()=>{
  if(!profileEdit)return;setBusy(true);setError('');
  try{
   const r=await fetch(`${SB}/rest/v1/rpc/sos_hero_update_standby_profile`,{method:'POST',headers:authHeaders(auth.access_token),body:JSON.stringify({p_application_id:receipt.application_id,p_service_zone:profileEdit.zone,p_availability:profileEdit.availability,p_services:profileEdit.services})});
   const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.message||'Could not save your profile');
   setProfileEdit(null);setNotice('Standby profile updated.');await loadPrivate();
  }catch(e){setError(e.message)}finally{setBusy(false)}
 };

 const uploaded=t=>docs.some(d=>d.document_type===t&&d.status!=='rejected');
 const reqDone=requiredDocs.filter(([t])=>uploaded(t)).length;
 const currentStatus=onboarding?.status||status?.status||'standby_pending';
 const packet=onboarding?.packet||null;
 const packetItems=packet?.items||[];
 const packetDone=packetItems.filter(i=>i.done).length;
 const market=onboarding?.market||{};
 const legacy=LEGACY.has(currentStatus);
 const progress=currentStatus==='approved'?100:currentStatus==='conditionally_approved'?96:currentStatus==='reviewing'?90
  :legacy?(currentStatus==='waitlisted'?72:auth?42+reqDone*10:28)
  :packet?50+Math.round(40*packetDone/Math.max(packetItems.length,1))
  :currentStatus==='standby'?50:auth?40:25;
 const packetOpens=market.packet_opens_on?day(market.packet_opens_on):null;

 if(receipt)return <main className={styles.page}><div className={styles.shell}>
  <header className={styles.top}><a className={styles.brand} href="/"><div className={styles.mark}>SOS</div><div><strong>SUPERHEROS ON STANDBY</strong><small>HERO PORTAL</small></div></a><span className={styles.secure}>PRIVATE · SECURE</span></header>
  <section className={styles.commandCard}>
   <div>
    <span className={styles.eyebrow}>{currentStatus==='standby'?`${LAUNCH_MARKET.name.toUpperCase()} LAUNCH ROSTER`:'HERO STATUS'}</span>
    <h1>{legacy?pretty(currentStatus):STATUS_TITLE[currentStatus]||pretty(currentStatus)}</h1>
    <p>{currentStatus==='standby'
      ?(packet?'Your full onboarding packet is open. Finish it so you can receive jobs when customers go live.'
        :`You are active on the S.O.S. roster. Your full onboarding packet arrives ${packetOpens?`on ${packetOpens}`:'14 days before customers go live'}.`)
      :status?.next_action||'Complete the next step below. Your progress is saved.'}</p>
    {['conditionally_approved','approved'].includes(currentStatus)&&<a className={styles.submit} href="/hero/claim">Continue Hero activation</a>}
   </div>
   <div className={styles.progressRing}><strong>{Math.min(progress,100)}%</strong><span>complete</span></div>
  </section>

  {legacy
   ?<div className={styles.timeline}><div className={styles.done}><b>1</b><span>Application<small>Submitted</small></span></div><div className={auth?styles.done:styles.active}><b>2</b><span>Account<small>{auth?'Secured':'Next'}</small></span></div><div className={reqDone===3?styles.done:auth?styles.active:''}><b>3</b><span>Credentials<small>{reqDone}/3 required</small></span></div><div className={currentStatus==='waitlisted'?styles.active:''}><b>4</b><span>Operations review<small>{pretty(currentStatus)}</small></span></div></div>
   :<div className={`${styles.timeline} ${styles.timeline5}`}>
     <div className={styles.done}><b>1</b><span>Signup<small>Received</small></span></div>
     <div className={auth&&currentStatus!=='standby_pending'?styles.done:styles.active}><b>2</b><span>Active standby<small>{auth&&currentStatus!=='standby_pending'?'On the roster':'Create login'}</small></span></div>
     <div className={packet&&['submitted','approved'].includes(packet.status)?styles.done:packet?styles.active:''}><b>3</b><span>Onboarding packet<small>{packet?`${packetDone}/${packetItems.length} done`:packetOpens?`Opens ${packetOpens}`:'Opens 14 days pre-launch'}</small></span></div>
     <div className={['conditionally_approved','approved'].includes(currentStatus)?styles.done:['reviewing','needs_information'].includes(currentStatus)?styles.active:''}><b>4</b><span>Operations review<small>Background check</small></span></div>
     <div className={currentStatus==='approved'?styles.done:currentStatus==='conditionally_approved'?styles.active:''}><b>5</b><span>Activation<small>{currentStatus==='approved'?'Ready':'Receive jobs'}</small></span></div>
    </div>}

  {error&&<div className={styles.error}>{error}</div>}{notice&&<div className={styles.notice}>{notice}</div>}

  <div className={styles.workspace}><section className={styles.form}>
   {!auth?<>
     <div className={styles.sectionHead}><span>STEP 2 · ACTIVATE YOUR STANDBY ACCOUNT</span><h2>Create your Hero login.</h2><p>Use the same email from your signup. Once your login is created you are an active standby Hero on the {LAUNCH_MARKET.name} launch roster.</p></div>
     <label className={styles.field}>Password<input type="password" minLength="8" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters"/></label>
     <div className={styles.dual}><button type="button" className={styles.submit} disabled={busy||password.length<8} onClick={()=>authenticate('signup')}>Create Hero login</button><button type="button" className={styles.secondary} disabled={busy||password.length<8} onClick={()=>authenticate('signin')}>I already have an account</button></div>
    </>
   :legacy?<>
     <div className={styles.sectionHead}><span>CREDENTIALS</span><h2>Upload 3 required documents.</h2><p>Once all three are received, you enter the S.O.S. Hero waitlist automatically.</p></div>
     <div className={styles.docGrid}>{requiredDocs.map(([type,label,hint])=><label className={`${styles.docCard} ${uploaded(type)?styles.docDone:''}`} key={type}><input type="file" hidden accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={e=>{void upload(type,e.target.files?.[0]);e.target.value=''}}/><div className={styles.docIcon}>{uploaded(type)?'✓':'↑'}</div><div><strong>{label}</strong><span>{uploaded(type)?'Received':hint}</span></div><b>{uploading===type?'Uploading…':uploaded(type)?'Add another':'Upload'}</b></label>)}</div>
    </>
   :packet?<>
     <div className={styles.sectionHead}><span>FULL ONBOARDING PACKET · {packetDone}/{packetItems.length} COMPLETE</span><h2>{['submitted','approved'].includes(packet.status)?'Packet submitted.':'Finish your onboarding packet.'}</h2>
      <p>{['submitted','approved'].includes(packet.status)
        ?'S.O.S. Operations is running your background check and reviewing your documents. You will be notified here.'
        :`Everything S.O.S. needs to verify you and hold every Hero to the same standard.${packet.due_date?` Complete it by ${day(packet.due_date)}.`:''}`}</p></div>
     {packet.status==='needs_changes'&&packet.operator_note&&<div className={styles.error}>Operations note: {packet.operator_note}</div>}
     <div className={styles.docGrid}>{packetItems.filter(i=>i.kind==='document').map(item=><label className={`${styles.docCard} ${item.done?styles.docDone:''}`} key={item.key}>
      <input type="file" hidden disabled={['submitted','approved'].includes(packet.status)} accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={e=>{void upload(item.key,e.target.files?.[0]);e.target.value=''}}/>
      <div className={styles.docIcon}>{item.done?'✓':'↑'}</div>
      <div><strong>{item.label}</strong><span>{item.status==='accepted'?'Accepted':item.status==='submitted'?'Received':item.status==='rejected'?'Rejected — upload again':packetDocs[item.key]}</span></div>
      <b>{uploading===item.key?'Uploading…':item.done?'Add another':'Upload'}</b></label>)}</div>
     <div className={styles.consents}>{packetItems.filter(i=>i.kind==='consent').map(item=>{
      const docText=(packet.documents||[]).find(d=>d.consent_type===item.key);
      return <div key={item.key} className={`${styles.consent} ${item.done?styles.consentDone:''}`}>
       <div className={styles.consentHead}><b>{item.done?'✓ ':''}{docText?.title||item.label}</b><small>{item.done?'Signed':item.status==='unavailable'?'Not available yet':'Signature required'}</small></div>
       {!item.done&&docText&&<>
        <details className={styles.consentBody} onToggle={e=>e.currentTarget.open&&setReadDoc(x=>({...x,[item.key]:x[item.key]||'opened'}))}><summary>Read the full document (version {docText.version})</summary><p>{docText.body}</p></details>
        <label className={styles.check}><input type="checkbox" checked={readDoc[item.key]===true} onChange={e=>setReadDoc(x=>({...x,[item.key]:e.target.checked}))}/><span><b>I have read and agree</b>Typing my name below is my legal electronic signature.</span></label>
        <div className={styles.signRow}><label className={styles.field}>Full legal name<input value={signName[item.key]||''} onChange={e=>setSignName(x=>({...x,[item.key]:e.target.value}))} placeholder={`${onboarding.first_name} ${onboarding.last_name}`}/></label><button type="button" className={styles.submit} disabled={busy||readDoc[item.key]!==true} onClick={()=>sign(item.key)}>Sign</button></div>
       </>}
      </div>})}</div>
    </>
   :<>
     <div className={styles.sectionHead}><span>ACTIVE STANDBY HERO</span><h2>You are on the roster.</h2><p>No documents are needed yet. When {LAUNCH_MARKET.name} customer launch is scheduled, your full onboarding packet opens 14 days before go-live{packetOpens?` (${packetOpens})`:''}. Watch for it here, by email and text.</p></div>
     {onboarding&&!profileEdit&&<div className={styles.reviewBox}>
      <div><span>ZONE</span><strong>{ZONES.find(z=>z[0]===onboarding.service_zone)?.[1]||'Not set'}</strong><small>{market.city||'Atlanta'}</small></div>
      <div><span>AVAILABILITY</span><strong>{(onboarding.availability||[]).map(a=>AVAILABILITY.find(x=>x[0]===a)?.[1]).filter(Boolean).join(' · ')||'Not set'}</strong><small>You can change this any time</small></div>
      <div className={styles.wide}><span>SERVICES</span><strong>{(onboarding.services||[]).map(s=>s.name).join(' · ')||'Not set'}</strong><small>Launch services: tow, gas, jump start, flat tire, lockout</small></div>
     </div>}
     {profileEdit&&<div className={styles.profileEdit}>
      <span className={styles.eyebrow}>MAIN ZONE</span><div className={styles.chips}>{ZONES.map(([id,label])=><button type="button" key={id} className={`${styles.chip} ${profileEdit.zone===id?styles.chipActive:''}`} onClick={()=>setProfileEdit(p=>({...p,zone:id}))}>{label}</button>)}</div>
      <span className={styles.eyebrow}>AVAILABILITY</span><div className={styles.chips}>{AVAILABILITY.map(([id,label])=><button type="button" key={id} className={`${styles.chip} ${profileEdit.availability.includes(id)?styles.chipActive:''}`} onClick={()=>setProfileEdit(p=>({...p,availability:p.availability.includes(id)?p.availability.filter(x=>x!==id):[...p.availability,id]}))}>{label}</button>)}</div>
      <span className={styles.eyebrow}>SERVICES</span><div className={styles.chips}>{LAUNCH_SERVICES.map(s=><button type="button" key={s.id} className={`${styles.chip} ${profileEdit.services.includes(s.id)?styles.chipActive:''}`} onClick={()=>setProfileEdit(p=>({...p,services:p.services.includes(s.id)?p.services.filter(x=>x!==s.id):[...p.services,s.id]}))}>{s.name}</button>)}</div>
      <div className={styles.dual}><button type="button" className={styles.submit} disabled={busy||!profileEdit.zone||!profileEdit.availability.length||!profileEdit.services.length} onClick={saveProfile}>Save profile</button><button type="button" className={styles.secondary} onClick={()=>setProfileEdit(null)}>Cancel</button></div>
     </div>}
     <div className={styles.dual}>
      {!profileEdit&&onboarding&&<button type="button" className={styles.secondary} onClick={()=>setProfileEdit({zone:onboarding.service_zone||'',availability:onboarding.availability||[],services:(onboarding.services||[]).map(s=>s.id).filter(id=>LAUNCH_SERVICES.some(l=>l.id===id))})}>Edit zone, hours or services</button>}
      <a className={styles.secondary} href="/hero">Open the Hero app</a>
     </div>
     <details className={styles.optional}><summary>Get ahead: add your headshot now (optional)</summary><div className={styles.optionalGrid}><label><input type="file" hidden accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={e=>{void upload('headshot',e.target.files?.[0]);e.target.value=''}}/><span>{uploaded('headshot')?'✓ ':''}Headshot photo</span><b>{uploading==='headshot'?'Uploading…':uploaded('headshot')?'Replace':'Add'}</b></label></div></details>
    </>}
   <p className={styles.truth}>Approval is not verification. Standby status is not dispatch approval: only Heroes with a cleared onboarding packet, background check, test mission and payout setup receive jobs. S.O.S. is not 911.</p>
  </section>
  <aside className={styles.side}>
   <div className={styles.sideCard}><span>HOW IT WORKS</span><ol>
    <li><b>Sign up + create login</b><small>You are instantly an active standby Hero.</small></li>
    <li><b>Onboarding packet</b><small>Opens 14 days before customers go live: driver license, insurance, registration, headshot, signatures.</small></li>
    <li><b>Operations review</b><small>Background check and document review.</small></li>
    <li><b>Activation</b><small>Test mission and payout setup, then you go on duty and receive nearby jobs.</small></li>
   </ol></div>
   {notices.length>0&&<div className={styles.sideCard}><span>UPDATES</span><div className={styles.noticeList}>{notices.slice(0,5).map(n=><div key={n.id}><b>{n.title}</b><p>{n.body}</p><small>{new Date(n.created_at).toLocaleDateString()}</small></div>)}</div></div>}
  </aside></div>
 </div></main>;

 const stepData=[['ABOUT YOU','Start with the basics so we can reach you and place you in the right part of Atlanta.'],['SERVICES',`Choose the launch services you can perform safely and professionally.`],['AVAILABILITY & SETUP','When you usually work, and what you arrive with.'],['REVIEW & CONSENT','Confirm the requirements that apply before you receive jobs.']];
 return <main className={styles.page}><div className={styles.shell}>
  <header className={styles.top}><a className={styles.brand} href="/"><div className={styles.mark}>SOS</div><div><strong>SUPERHEROS ON STANDBY</strong><small>HERO NETWORK</small></div></a><span className={styles.saveState}>{saved?'SAVED ✓':'PROGRESS SAVES AUTOMATICALLY'}</span></header>
  <section className={styles.firstHero}>
   <div><span className={styles.eyebrow}>BECOME AN S.O.S. HERO · {LAUNCH_MARKET.name.toUpperCase()}</span><h1>Get on the launch roster in 3 minutes.</h1>
    <p>Sign up, create your login, and you are an active standby Hero. Your full onboarding packet — license, insurance, background check and agreements — opens 14 days before customers go live.</p>
    <div className={styles.heroBadges}><span>No documents today</span><span>Active instantly</span><span>Nearby jobs at launch</span></div>
    <div className={styles.heroActions}><button type="button" className={styles.resumeButton} onClick={()=>{setResumeEmail(form.email||auth?.user?.email||'');setResumeOpen(true)}}>Resume an application</button><span>S.O.S. is not 911. For an emergency, call 911.</span></div></div>
   <div className={styles.heroPanel}><strong>FROM SIGNUP TO FIRST JOB</strong><span>Sign up</span><i>→</i><span>Active standby</span><i>→</i><span>Onboarding packet</span><i>→</i><span>Operations review</span><i>→</i><span>Activation</span></div>
  </section>
  {notice&&<div className={styles.notice}>{notice}</div>}
  {resumeOpen&&<section className={styles.resumePanel}><div><span className={styles.eyebrow}>RETURNING HERO</span><h2>Pick up where you left off.</h2><p>Use the same verified email from your Hero signup. You can resume on a new phone or computer after sign-in.</p></div>
   <div className={styles.resumeForm}><div className={styles.resumeTabs}><button type="button" className={resumeMode==='signin'?styles.resumeTabActive:''} onClick={()=>setResumeMode('signin')}>Sign in</button><button type="button" className={resumeMode==='signup'?styles.resumeTabActive:''} onClick={()=>setResumeMode('signup')}>Create login</button></div>
    <label className={styles.field}>Signup email<input type="email" autoComplete="email" value={resumeEmail} onChange={e=>setResumeEmail(e.target.value)}/></label>
    <label className={styles.field}>Password<input type="password" minLength="8" autoComplete={resumeMode==='signup'?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)}/></label>
    <div className={styles.dual}><button type="button" className={styles.submit} disabled={busy||password.length<8} onClick={resumeAuthenticate}>{busy?'Connecting…':resumeMode==='signup'?'Create secure login':'Resume'}</button><button type="button" className={styles.secondary} onClick={()=>setResumeOpen(false)}>Cancel</button></div></div></section>}
  <section className={styles.preflight}>
   <div><b>1</b><span><strong>About 3 minutes</strong><small>Basic info, services, zone and availability.</small></span></div>
   <div><b>2</b><span><strong>Active standby today</strong><small>Create your login and you are on the roster.</small></span></div>
   <div><b>3</b><span><strong>Full packet before launch</strong><small>Driver license, insurance, background check and agreements, 14 days before go-live.</small></span></div>
  </section>
  <div className={styles.stepper}>{stepData.map((s,i)=><button key={s[0]} type="button" className={i===step?styles.stepActive:i<step?styles.stepDone:''} onClick={()=>i<step&&setStep(i)}><b>{i<step?'✓':i+1}</b><span>{s[0]}</span></button>)}</div>
  <form className={styles.form} onSubmit={submit}>
   <div className={styles.sectionHead}><span>STEP {step+1} OF 4</span><h2>{stepData[step][0]}</h2><p>{stepData[step][1]}</p></div>
   {step===0&&<><div className={styles.grid}>
    <label className={styles.field}>First name<input required autoComplete="given-name" value={form.firstName} onChange={e=>setForm({...form,firstName:e.target.value})}/></label>
    <label className={styles.field}>Last name<input required autoComplete="family-name" value={form.lastName} onChange={e=>setForm({...form,lastName:e.target.value})}/></label>
    <label className={styles.field}>Email<input required type="email" autoComplete="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>
    <label className={styles.field}>Mobile phone<input required type="tel" autoComplete="tel" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label>
   </div>
   <span className={`${styles.eyebrow} ${styles.groupLabel}`}>MAIN ATLANTA ZONE</span>
   <div className={styles.chips}>{ZONES.map(([id,label])=><button type="button" key={id} className={`${styles.chip} ${form.serviceZone===id?styles.chipActive:''}`} onClick={()=>setForm({...form,serviceZone:id})}>{form.serviceZone===id?'✓ ':''}{label}</button>)}</div></>}
   {step===1&&<><div className={styles.selectionCount}><strong>{form.services.length}</strong><span>launch services selected</span></div>
    <div className={styles.chips}>{LAUNCH_SERVICES.map(s=><button type="button" key={s.id} className={`${styles.chip} ${form.services.includes(s.name)?styles.chipActive:''}`} onClick={()=>toggle('services',s.name)}>{form.services.includes(s.name)?'✓ ':''}{s.name}</button>)}</div>
    {otherServices.length>0&&<><span className={`${styles.eyebrow} ${styles.groupLabel}`}>COMING AFTER LAUNCH</span><div className={styles.chips}>{otherServices.slice(0,24).map(s=><span key={s.id} className={`${styles.chip} ${styles.chipDisabled}`}>{s.name}</span>)}</div></>}</>}
   {step===2&&<><span className={`${styles.eyebrow} ${styles.groupLabel}`}>WHEN ARE YOU USUALLY AVAILABLE?</span>
    <div className={styles.chips}>{AVAILABILITY.map(([id,label])=><button type="button" key={id} className={`${styles.chip} ${form.availability.includes(id)?styles.chipActive:''}`} onClick={()=>toggle('availability',id)}>{form.availability.includes(id)?'✓ ':''}{label}</button>)}</div>
    <div className={`${styles.grid} ${styles.groupLabel}`}>
     <label className={styles.field}>Years experience<input type="number" min="0" max="80" value={form.yearsExperience} onChange={e=>setForm({...form,yearsExperience:e.target.value})}/></label>
     <label className={styles.field}>Service vehicle type<input placeholder="Pickup, van, tow truck…" value={form.vehicleType} onChange={e=>setForm({...form,vehicleType:e.target.value})}/></label>
     <label className={styles.field}>Vehicle make<input value={form.vehicleMake} onChange={e=>setForm({...form,vehicleMake:e.target.value})}/></label>
     <label className={styles.field}>Vehicle model<input value={form.vehicleModel} onChange={e=>setForm({...form,vehicleModel:e.target.value})}/></label>
     <label className={styles.field}>Vehicle year<input type="number" min="1900" max={new Date().getFullYear()+2} value={form.vehicleYear} onChange={e=>setForm({...form,vehicleYear:e.target.value})}/></label>
     <label className={styles.field}>Tools / equipment<input placeholder="Jump box, jack, lockout kit, fuel can…" value={form.tools.join(', ')} onChange={e=>setForm({...form,tools:e.target.value.split(',').map(v=>v.trim()).filter(Boolean)})}/></label>
     <label className={`${styles.field} ${styles.wide}`}>Experience (optional)<textarea placeholder="Roadside, towing, locksmith, tire or mechanic experience." value={form.experienceSummary} onChange={e=>setForm({...form,experienceSummary:e.target.value})}/></label>
    </div></>}
   {step===3&&<><div className={styles.reviewBox}>
     <div><span>HERO</span><strong>{form.firstName} {form.lastName}</strong><small>{form.email} · {form.phone}</small></div>
     <div><span>ZONE</span><strong>{ZONES.find(z=>z[0]===form.serviceZone)?.[1]||'Not set'} · {LAUNCH_MARKET.name}</strong><small>{form.services.length} services · {form.availability.length} availability windows</small></div>
    </div>
    <div className={styles.checks}>
     <label className={styles.check}><input required type="checkbox" checked={form.licenseAttested} onChange={e=>setForm({...form,licenseAttested:e.target.checked})}/><span><b>Driver license</b>I hold a valid driver license and will upload it in my onboarding packet before launch.</span></label>
     <label className={styles.check}><input required type="checkbox" checked={form.insuranceAttested} onChange={e=>setForm({...form,insuranceAttested:e.target.checked})}/><span><b>Insurance</b>I carry (or will carry) current insurance for my service vehicle and will upload proof in my packet.</span></label>
     <label className={styles.check}><input required type="checkbox" checked={form.backgroundConsent} onChange={e=>setForm({...form,backgroundConsent:e.target.checked})}/><span><b>Background check</b>I understand I must complete an S.O.S. background check before receiving jobs. I will sign the authorization in my packet.</span></label>
     <label className={styles.check}><input required type="checkbox" checked={form.termsAccepted} onChange={e=>setForm({...form,termsAccepted:e.target.checked})}/><span><b>Accuracy</b>I certify that the information I provided is accurate.</span></label>
    </div></>}
   {error&&<div className={styles.error}>{error}</div>}
   <div className={styles.actions}>{step>0&&<button type="button" className={styles.secondary} onClick={()=>setStep(step-1)}>← Back</button>}<button className={styles.submit} disabled={busy||!canNext[step]}>{busy?'Submitting…':step===3?'Join the roster →':'Continue →'}</button></div>
   <p className={styles.truth}>Approval is not verification. Standby Heroes do not receive jobs until the onboarding packet, background check, test mission and payout setup are complete. Driver license, insurance and Government ID or equivalent documents are collected in the packet.</p>
  </form>
 </div></main>;
}
