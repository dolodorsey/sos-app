import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.0";

const ALLOWED=new Set(['https://thesuperherosonstandby.com','https://www.thesuperherosonstandby.com','https://superherosonstandby.com','https://www.superherosonstandby.com']);
const KHG_BRIDGE_URL='https://dzlmtvodpyhetvektfuo.supabase.co/functions/v1/khg-sos-hero-bridge';
const ACTIVE_APPLICATION_STATUSES=['documents_required','waitlisted','reviewing','needs_information','conditionally_approved','approved'];
const cors=(origin:string)=>({'Access-Control-Allow-Origin':ALLOWED.has(origin)?origin:'https://thesuperherosonstandby.com','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'});
const json=(origin:string,body:unknown,status=200)=>Response.json(body,{status,headers:{...cors(origin),'Cache-Control':'no-store'}});
const text=(v:unknown,max=3000)=>String(v??'').trim().slice(0,max);
const list=(v:unknown,max=30)=>Array.isArray(v)?v.map(x=>text(x,100)).filter(Boolean).slice(0,max):[];
const sha256=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(b=>b.toString(16).padStart(2,'0')).join('');
const trackingToken=()=>{const bytes=crypto.getRandomValues(new Uint8Array(32));return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};
const MAX_BODY_BYTES=32768;

const syncKHG=async(admin:any,applicationId:string)=>{
  const attemptedAt=new Date().toISOString();
  try{
    await admin.from('sos_hero_applications').update({khg_bridge_last_attempt_at:attemptedAt,khg_bridge_last_error:null}).eq('id',applicationId);
    const {data:receipt,error:receiptError}=await admin.rpc('sos_issue_khg_bridge_receipt',{p_application_id:applicationId});
    if(receiptError||!receipt) throw receiptError||new Error('Bridge receipt unavailable');
    const response=await fetch(KHG_BRIDGE_URL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({receipt_token:String(receipt)})});
    const result=await response.json().catch(()=>({}));
    if(!response.ok||result?.ok!==true) throw new Error(`KHG bridge returned ${response.status}`);
    const syncedAt=new Date().toISOString();
    await admin.from('sos_hero_applications').update({khg_bridge_status:'synced',khg_bridge_synced_at:syncedAt,khg_bridge_last_attempt_at:syncedAt,khg_bridge_last_error:null}).eq('id',applicationId);
    return true;
  }catch(error){
    const message=error instanceof Error?error.message:String(error);
    console.error('sos-khg-bridge',applicationId,message);
    await admin.from('sos_hero_applications').update({khg_bridge_status:'pending',khg_bridge_last_attempt_at:new Date().toISOString(),khg_bridge_last_error:message.slice(0,500)}).eq('id',applicationId);
    return false;
  }
};

const linkRecruitingCandidate=async(admin:any,applicationId:string)=>{
  try{
    const {data,error}=await admin.rpc('sos_link_hero_application_candidate',{p_application_id:applicationId});
    if(error) throw error;
    return data||null;
  }catch(error){
    console.error('sos-hero-application-attribution',applicationId,error instanceof Error?error.message:String(error));
    return null;
  }
};

Deno.serve(async req=>{
 const origin=req.headers.get('Origin')||'';if(req.method==='OPTIONS')return new Response('ok',{headers:cors(origin)});if(req.method!=='POST')return json(origin,{error:'Method not allowed'},405);if(origin&&!ALLOWED.has(origin))return json(origin,{error:'Origin not allowed'},403);
 const declared=Number(req.headers.get('content-length')||0);if(Number.isFinite(declared)&&declared>MAX_BODY_BYTES)return json(origin,{error:'Application request is too large.'},413);
 const url=Deno.env.get('SUPABASE_URL')||'',service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';if(!url||!service)return json(origin,{error:'Application service unavailable'},503);
 try{
  const raw=await req.text();if(new TextEncoder().encode(raw).byteLength>MAX_BODY_BYTES)return json(origin,{error:'Application request is too large.'},413);
  let b:any;try{b=JSON.parse(raw||'{}')}catch{return json(origin,{error:'Application request must be valid JSON.'},400)}
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  if(b?.action==='status'){
    const applicationId=text(b.application_id,80),token=text(b.tracking_token,200);if(!applicationId||token.length<30)return json(origin,{error:'Application ID and private tracking receipt are required.'},422);
    const hash=await sha256(token);const{data,error}=await admin.from('sos_hero_applications').select('id,status,submitted_at,updated_at,reviewed_at,source_hero_id,candidate_id').eq('id',applicationId).eq('status_token_hash',hash).maybeSingle();
    if(error)throw error;if(!data)return json(origin,{error:'Application receipt was not recognized.'},404);
    const claimReady=['conditionally_approved','approved'].includes(data.status);
    return json(origin,{application_id:data.id,status:data.status,submitted_at:data.submitted_at,updated_at:data.updated_at,reviewed_at:data.reviewed_at,next_action:claimReady?'Create or sign in with the same email and claim your approved Hero profile.':data.status==='rejected'?'Application review is closed. Contact S.O.S. operations if information should be reconsidered.':'No action is required while S.O.S. operations reviews your application.',claim_url:claimReady?'/hero/claim':null},200);
  }
  const email=text(b.email,254).toLowerCase(),phone=text(b.phone,40),first=text(b.firstName,80),last=text(b.lastName,80);
  if(!first||!last||!/^\S+@\S+\.\S+$/.test(email)||phone.length<7)return json(origin,{error:'Name, valid email, and phone are required.'},422);
  if(!b.licenseAttested||!b.insuranceAttested||!b.backgroundConsent||!b.termsAccepted)return json(origin,{error:'Required eligibility attestations and consent must be accepted.'},422);
  const{data:existing}=await admin.from('sos_hero_applications').select('id,status,submitted_at,khg_bridge_status,candidate_id').eq('email',email).in('status',ACTIVE_APPLICATION_STATUSES).maybeSingle();
  if(existing){
    const attribution=existing.candidate_id?{linked:true}:await linkRecruitingCandidate(admin,existing.id);
    if(existing.khg_bridge_status!=='synced')await syncKHG(admin,existing.id);
    return json(origin,{application_id:existing.id,status:existing.status,duplicate:true,source_attributed:attribution?.linked===true,message:'An active Hero application already exists for this email. Use the private receipt saved on the original device to track it.'},200)
  }
  const source=(req.headers.get('x-forwarded-for')||req.headers.get('x-real-ip')||req.headers.get('cf-connecting-ip')||'unknown').split(',')[0].trim(),ipHash=await sha256(source);
  const{data:limit,error:limitError}=await admin.rpc('marketplace_consume_intake_rate_limit',{p_app:'sos_hero',p_ip_hash:ipHash,p_limit:8,p_window_minutes:60});if(limitError)throw limitError;if(limit?.allowed!==true)return json(origin,{error:'Too many new applications from this network. Try again later.',retry_after_minutes:60},429);
  const token=trackingToken(),hash=await sha256(token);
  const{data,error}=await admin.from('sos_hero_applications').insert({first_name:first,last_name:last,email,phone,city:text(b.city,100)||null,state:text(b.state,50)||null,services_requested:list(b.services),tools_available:list(b.tools),vehicle_type:text(b.vehicleType,100)||null,vehicle_make:text(b.vehicleMake,100)||null,vehicle_model:text(b.vehicleModel,100)||null,vehicle_year:b.vehicleYear?Number(b.vehicleYear):null,years_experience:Math.max(0,Math.min(80,Number(b.yearsExperience)||0)),experience_summary:text(b.experienceSummary,3000)||null,license_attested:true,insurance_attested:true,background_consent:true,terms_accepted:true,status:'documents_required',status_token_hash:hash,khg_bridge_status:'pending'}).select('id,status,submitted_at').single();
  if(error)throw error;
  const attribution=await linkRecruitingCandidate(admin,data.id);
  await syncKHG(admin,data.id);
  return json(origin,{application_id:data.id,status:data.status,submitted_at:data.submitted_at,tracking_token:token,source_attributed:attribution?.linked===true,message:'Hero application received. This browser can now track review status. Approval does not bypass identity, license, insurance, background, test mission, or payout requirements.'},201);
 }catch(error){console.error('submit-sos-hero-application',error);return json(origin,{error:'Hero application could not be processed.'},500)}
});