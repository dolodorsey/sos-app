import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.0";

const STRIPE_VERSION='2026-06-24.dahlia';
const BASE='https://api.stripe.com';
const ALLOWED_ORIGINS=new Set(['https://thesuperherosonstandby.com','https://www.thesuperherosonstandby.com','https://superherosonstandby.com','https://www.superherosonstandby.com','capacitor://localhost','http://localhost','https://localhost']);
const cors=(req:Request)=>{const origin=req.headers.get('Origin')||'';return{'Access-Control-Allow-Origin':ALLOWED_ORIGINS.has(origin)?origin:'https://thesuperherosonstandby.com','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'}};
const json=(req:Request,body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors(req),'Content-Type':'application/json; charset=utf-8'}});
async function stripeV2(key:string,path:string,init:RequestInit={}){const response=await fetch(`${BASE}${path}`,{...init,headers:{Authorization:`Bearer ${key}`,'Stripe-Version':STRIPE_VERSION,'Content-Type':'application/json',...(init.headers||{})}});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data?.error?.message||data?.error||`Stripe v2 request failed (${response.status})`);return data}
const dueList=(account:any)=>account?.requirements?.summary?.currently_due??account?.requirements?.currently_due??[];
const transferStatus=(account:any)=>account?.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status||'inactive';

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors(req)});
  if(req.method!=='POST')return json(req,{error:'Method not allowed'},405);
  const origin=req.headers.get('Origin')||'';if(origin&&!ALLOWED_ORIGINS.has(origin))return json(req,{error:'Origin not allowed'},403);
  const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!anon||!service)return json(req,{error:'Payout database runtime is temporarily unavailable'},503);
  const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');if(!token)return json(req,{error:'Authentication required'},401);
  const scoped=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token}`}}});
  const{data:authData,error:authError}=await scoped.auth.getUser();if(authError||!authData.user)return json(req,{error:'Invalid or expired session'},401);
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  let stripeKey=Deno.env.get('STRIPE_SECRET_KEY')||'';if(!stripeKey){const{data,error}=await admin.rpc('sos_get_runtime_secret',{secret_name:'STRIPE_SECRET_KEY'});if(!error&&data)stripeKey=String(data)}
  if(!stripeKey)return json(req,{error:'Payout setup is temporarily unavailable while secure Stripe credentials are restored.'},503);
  const{data:sosUser}=await admin.from('sos_users').select('id,role,email,first_name,last_name,status').eq('auth_id',authData.user.id).single();if(!sosUser||sosUser.role!=='hero'||sosUser.status!=='active')return json(req,{error:'Active Hero account required'},403);
  const{data:hero}=await admin.from('sos_heroes').select('id,stripe_connect_id,verification_status').eq('user_id',sosUser.id).single();if(!hero)return json(req,{error:'Hero profile not found'},404);
  const input=await req.json().catch(()=>({})) as Record<string,unknown>;const action=String(input.action||'status');const base=Deno.env.get('SOS_PUBLIC_URL')||'https://thesuperherosonstandby.com';
  let accountId=hero.stripe_connect_id as string|null;let account:any;
  try{
    if(!accountId&&action==='onboard'){
      account=await stripeV2(stripeKey,'/v2/core/accounts',{method:'POST',headers:{'Idempotency-Key':`sos-hero-${hero.id}-connect-v2`},body:JSON.stringify({contact_email:sosUser.email||authData.user.email,display_name:[sosUser.first_name,sosUser.last_name].filter(Boolean).join(' ')||sosUser.email||'S.O.S. Hero',defaults:{responsibilities:{fees_collector:'application',losses_collector:'application'}},dashboard:'express',identity:{country:'us'},configuration:{recipient:{capabilities:{stripe_balance:{stripe_transfers:{requested:true}}}}},metadata:{brand:'SOS',sos_hero_id:String(hero.id),sos_user_id:String(sosUser.id)},include:['configuration.recipient','requirements']})});
      accountId=account.id;
    }else if(accountId){
      account=await stripeV2(stripeKey,`/v2/core/accounts/${encodeURIComponent(accountId)}?include[]=configuration.recipient&include[]=requirements`,{method:'GET'});
    }
  }catch(error){if(accountId){await admin.from('sos_heroes').update({stripe_connect_id:null,stripe_connect_api_version:null,stripe_transfer_status:null,stripe_requirements_due:[],payout_method:null,updated_at:new Date().toISOString()}).eq('id',hero.id)}const message=error instanceof Error?error.message:'Payout account could not be verified.';return json(req,{connected:false,payout_ready:false,requirements_due:[],error:message},409)}
  if(!accountId)return json(req,{connected:false,payout_ready:false,requirements_due:[],message:'Stripe payout setup is required before going on patrol.'});
  const transfers=transferStatus(account);const requirements=dueList(account);const ready=transfers==='active';
  await admin.from('sos_heroes').update({stripe_connect_id:accountId,stripe_connect_api_version:'v2',stripe_transfer_status:transfers,stripe_requirements_due:requirements,payout_method:'stripe_connect',updated_at:new Date().toISOString()}).eq('id',hero.id);
  const statusPayload={connected:true,payout_ready:ready,account_id:accountId,transfer_status:transfers,requirements_due:requirements};
  if(action==='status')return json(req,statusPayload);if(action!=='onboard')return json(req,{error:'Invalid action'},400);if(ready)return json(req,statusPayload);
  const link=await stripeV2(stripeKey,'/v2/core/account_links',{method:'POST',body:JSON.stringify({account:accountId,use_case:{type:'account_onboarding',account_onboarding:{configurations:['recipient'],collection_options:{fields:'eventually_due',future_requirements:'include'},refresh_url:`${base}/hero/?connect=refresh`,return_url:`${base}/hero/?connect=return`}}})});
  return json(req,{...statusPayload,onboarding_url:link.url});
});