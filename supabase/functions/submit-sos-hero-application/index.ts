import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.0";

const ALLOWED=new Set(['https://thesuperherosonstandby.com','https://www.thesuperherosonstandby.com','https://superherosonstandby.com','https://www.superherosonstandby.com']);
const cors=(origin:string)=>({'Access-Control-Allow-Origin':ALLOWED.has(origin)?origin:'https://thesuperherosonstandby.com','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'});
const json=(origin:string,body:unknown,status=200)=>Response.json(body,{status,headers:{...cors(origin),'Cache-Control':'no-store'}});
const text=(v:unknown,max=3000)=>String(v??'').trim().slice(0,max);
const list=(v:unknown,max=30)=>Array.isArray(v)?v.map(x=>text(x,100)).filter(Boolean).slice(0,max):[];

Deno.serve(async req=>{
 const origin=req.headers.get('Origin')||'';if(req.method==='OPTIONS')return new Response('ok',{headers:cors(origin)});if(req.method!=='POST')return json(origin,{error:'Method not allowed'},405);if(origin&&!ALLOWED.has(origin))return json(origin,{error:'Origin not allowed'},403);
 const url=Deno.env.get('SUPABASE_URL')||'',service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';if(!url||!service)return json(origin,{error:'Application service unavailable'},503);
 try{
  const b=await req.json().catch(()=>({}));const email=text(b.email,254).toLowerCase(),phone=text(b.phone,40),first=text(b.firstName,80),last=text(b.lastName,80);
  if(!first||!last||!email.includes('@')||phone.length<7)return json(origin,{error:'Name, valid email, and phone are required.'},422);
  if(!b.licenseAttested||!b.insuranceAttested||!b.backgroundConsent||!b.termsAccepted)return json(origin,{error:'Required eligibility attestations and consent must be accepted.'},422);
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const{data:existing}=await admin.from('sos_hero_applications').select('id,status,submitted_at').eq('email',email).in('status',['submitted','reviewing','approved']).maybeSingle();
  if(existing)return json(origin,{application_id:existing.id,status:existing.status,duplicate:true,message:'An active Hero application already exists for this email.'},200);
  const{data,error}=await admin.from('sos_hero_applications').insert({first_name:first,last_name:last,email,phone,city:text(b.city,100)||null,state:text(b.state,50)||null,services_requested:list(b.services),tools_available:list(b.tools),vehicle_type:text(b.vehicleType,100)||null,vehicle_make:text(b.vehicleMake,100)||null,vehicle_model:text(b.vehicleModel,100)||null,vehicle_year:b.vehicleYear?Number(b.vehicleYear):null,years_experience:Math.max(0,Math.min(80,Number(b.yearsExperience)||0)),experience_summary:text(b.experienceSummary,3000)||null,license_attested:true,insurance_attested:true,background_consent:true,terms_accepted:true,status:'submitted'}).select('id,status,submitted_at').single();
  if(error)throw error;
  return json(origin,{application_id:data.id,status:data.status,submitted_at:data.submitted_at,message:'Hero application received. Approval does not bypass identity, license, insurance, background, test mission, or payout requirements.'},201);
 }catch(error){console.error('submit-sos-hero-application',error);return json(origin,{error:'Hero application could not be submitted.'},400)}
});