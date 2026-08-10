import { createClient } from 'npm:@supabase/supabase-js@2.112.0'

const ALLOWED_ORIGINS = new Set([
  'https://thesuperherosonstandby.com','https://www.thesuperherosonstandby.com',
  'https://superherosonstandby.com','https://www.superherosonstandby.com',
  'capacitor://localhost','http://localhost','https://localhost',
])
const cors=(req:Request)=>{const origin=req.headers.get('Origin')||'';return{'Access-Control-Allow-Origin':ALLOWED_ORIGINS.has(origin)?origin:'https://thesuperherosonstandby.com','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'}}
const json=(req:Request,body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors(req),'Content-Type':'application/json; charset=utf-8'}})

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors(req)})
  if(req.method!=='POST')return json(req,{error:'Method not allowed'},405)
  const origin=req.headers.get('Origin')||'';if(origin&&!ALLOWED_ORIGINS.has(origin))return json(req,{error:'Origin not allowed'},403)
  const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if(!url||!anon||!service)return json(req,{error:'Pricing service is unavailable'},503)
  const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');if(!token)return json(req,{error:'Authentication required'},401)
  const scoped=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token}`}}})
  const {data:authData}=await scoped.auth.getUser();if(!authData.user)return json(req,{error:'Invalid or expired session'},401)
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}})
  const {data:sosUser}=await admin.from('sos_users').select('id,role,status').eq('auth_id',authData.user.id).single()
  if(!sosUser||sosUser.role!=='hero'||sosUser.status!=='active')return json(req,{error:'Active Hero account required'},403)
  const {data:hero}=await admin.from('sos_heroes').select('id').eq('user_id',sosUser.id).single();if(!hero)return json(req,{error:'Hero profile not found'},404)
  const input=await req.json().catch(()=>({})) as Record<string,unknown>;const missionId=String(input.mission_id||'');const requested=Number(input.final_price)
  if(!missionId)return json(req,{error:'mission_id is required'},400)
  const {data:mission}=await admin.from('sos_missions').select('id,hero_id,status,subcategory_id,estimated_price,pricing_status,tax_rate_percent').eq('id',missionId).single()
  if(!mission||mission.hero_id!==hero.id)return json(req,{error:'Assigned mission not found'},404)
  if(mission.status!=='assigned')return json(req,{error:'Final price must be confirmed before the Hero starts the route'},409)
  const {data:serviceRow}=await admin.from('sos_subcategories').select('id,name,base_fee,min_fee,max_fee,price_model').eq('id',mission.subcategory_id).single()
  if(!serviceRow)return json(req,{error:'Mission service is unavailable'},409)
  const {data:rule}=await admin.from('sos_pricing_rules').select('base_fee,min_fee,max_fee,surge_cap').eq('subcategory_id',mission.subcategory_id).eq('is_active',true).limit(1).maybeSingle()
  const base=Number(rule?.base_fee??serviceRow.base_fee??mission.estimated_price??0)
  const min=Number(rule?.min_fee??serviceRow.min_fee??(base>0?base:1))
  const configuredMax=Number(rule?.max_fee??serviceRow.max_fee??0)
  const surgeCap=Math.max(1,Number(rule?.surge_cap??2))
  const max=configuredMax>0?configuredMax:(base>0?base*surgeCap:10000)
  const fixed=serviceRow.price_model==='fixed'
  const price=fixed?base:requested
  if(!Number.isFinite(price)||price<=0)return json(req,{error:'A valid final price is required'},400)
  if(price<min||price>max)return json(req,{error:`Final price must be between $${min.toFixed(2)} and $${max.toFixed(2)}`},409)
  const rounded=Math.round(price*100)/100
  const taxRate=Math.max(0,Number(mission.tax_rate_percent||0))
  const taxAmount=Math.round(rounded*taxRate)/100
  const now=new Date().toISOString()
  const {data:updated,error}=await admin.from('sos_missions').update({final_price:rounded,tax_amount:taxAmount,pricing_status:'confirmed',updated_at:now}).eq('id',mission.id).eq('hero_id',hero.id).eq('status','assigned').select('id,final_price,tax_amount,tax_rate_percent,pricing_status,status').single()
  if(error||!updated)return json(req,{error:error?.message||'Price could not be confirmed'},409)
  await admin.from('sos_mission_events').insert({mission_id:mission.id,event_type:'pricing_confirmed',old_status:mission.status,new_status:mission.status,payload:{final_price:rounded,tax_amount:taxAmount,tax_rate_percent:taxRate,service_id:serviceRow.id,price_model:serviceRow.price_model,source:'hero_app'},actor:'hero'})
  return json(req,{mission:updated,price_bounds:{min,max},message:'Final price confirmed. Customer authorization is required before travel begins.'})
})
