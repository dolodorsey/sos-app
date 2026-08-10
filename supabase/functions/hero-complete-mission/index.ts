import Stripe from 'npm:stripe@18.5.0'
import { createClient } from 'npm:@supabase/supabase-js@2.112.0'

const ALLOWED_ORIGINS=new Set(['https://thesuperherosonstandby.com','https://www.thesuperherosonstandby.com','https://superherosonstandby.com','https://www.superherosonstandby.com','capacitor://localhost','http://localhost','https://localhost'])
const cors=(req:Request)=>{const o=req.headers.get('Origin')||'';return{'Access-Control-Allow-Origin':ALLOWED_ORIGINS.has(o)?o:'https://thesuperherosonstandby.com','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'}}
const json=(req:Request,body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors(req),'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}})

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors(req)})
  if(req.method!=='POST')return json(req,{error:'Method not allowed'},405)
  const origin=req.headers.get('Origin')||'';if(origin&&!ALLOWED_ORIGINS.has(origin))return json(req,{error:'Origin not allowed'},403)
  const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if(!url||!anon||!service)return json(req,{error:'Mission completion database runtime is temporarily unavailable'},503)
  const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');if(!token)return json(req,{error:'Authentication required'},401)
  const scoped=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token}`}}})
  const{data:authData}=await scoped.auth.getUser();if(!authData.user)return json(req,{error:'Invalid or expired session'},401)
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}})
  let stripeKey=Deno.env.get('STRIPE_SECRET_KEY')||''
  if(!stripeKey){const{data,error}=await admin.rpc('sos_get_runtime_secret',{secret_name:'STRIPE_SECRET_KEY'});if(!error&&data)stripeKey=String(data)}
  if(!stripeKey)return json(req,{error:'Mission completion payments are temporarily unavailable while secure Stripe credentials are restored.'},503)

  const{data:sosUser}=await admin.from('sos_users').select('id,role,status').eq('auth_id',authData.user.id).single()
  if(!sosUser||sosUser.role!=='hero'||sosUser.status!=='active')return json(req,{error:'Active Hero account required'},403)
  const{data:hero}=await admin.from('sos_heroes').select('id,stripe_connect_id,stripe_connect_api_version,stripe_transfer_status').eq('user_id',sosUser.id).single()
  if(!hero)return json(req,{error:'Hero profile not found'},404)
  if(!hero.stripe_connect_id||hero.stripe_connect_api_version!=='v2'||hero.stripe_transfer_status!=='active')return json(req,{error:'Hero payout account must be transfer-ready before a paid mission can be completed'},409)

  const input=await req.json().catch(()=>({})) as Record<string,unknown>
  const missionId=String(input.mission_id||''),notes=String(input.notes||'').trim().slice(0,2000),lat=Number(input.lat),lng=Number(input.lng)
  const mediaUrls=Array.isArray(input.media_urls)?input.media_urls.map(v=>String(v)).filter(v=>/^https:\/\//.test(v)).slice(0,5):[]
  if(!missionId)return json(req,{error:'mission_id is required'},400)
  if(notes.length<3)return json(req,{error:'A short completion note is required as proof of service'},400)
  if(!Number.isFinite(lat)||lat<-90||lat>90||!Number.isFinite(lng)||lng<-180||lng>180)return json(req,{error:'Fresh GPS coordinates are required to complete a mission'},400)

  const{data:mission}=await admin.from('sos_missions').select('id,hero_id,status,pricing_status,final_price,tax_amount,requested_service_name').eq('id',missionId).single()
  if(!mission||mission.hero_id!==hero.id)return json(req,{error:'Assigned mission not found'},404)
  if(mission.status!=='working')return json(req,{error:'Mission must be in service before completion'},409)
  if(mission.pricing_status!=='confirmed'||!mission.final_price)return json(req,{error:'Final price must be confirmed'},409)
  const{data:payment}=await admin.from('sos_payments').select('*').eq('mission_id',missionId).single()
  if(!payment||payment.payment_status!=='authorized'||!payment.stripe_payment_intent_id)return json(req,{error:'Customer payment authorization is required before completion'},409)

  const captureCents=Math.round((Number(payment.amount||0)+Number(payment.tax||0)+Number(payment.tip||0))*100)
  if(!Number.isSafeInteger(captureCents)||captureCents<50)return json(req,{error:'Authorized payment total is invalid'},409)
  const stripe=new Stripe(stripeKey,{httpClient:Stripe.createFetchHttpClient()})
  const now=new Date().toISOString()
  const{data:existingProof}=await admin.from('sos_proof_of_service').select('id').eq('mission_id',missionId).eq('hero_id',hero.id).limit(1).maybeSingle()
  if(!existingProof){
    const{error:proofError}=await admin.from('sos_proof_of_service').insert({mission_id:missionId,hero_id:hero.id,required_items:['completion_note','gps'],submitted_items:{completion_note:true,gps:true,authenticated_hero:true},media_urls:mediaUrls,notes,lat,lng,validation_status:'passed',validated_at:now,validated_by:'system:authenticated_hero_completion'})
    if(proofError)return json(req,{error:'Proof of service could not be recorded'},409)
  }

  let captured:Stripe.PaymentIntent
  try{
    const intent=await stripe.paymentIntents.retrieve(payment.stripe_payment_intent_id)
    if(intent.amount<captureCents)return json(req,{error:'Payment authorization is lower than the confirmed service total. Mission remains in service.'},409)
    captured=await stripe.paymentIntents.capture(payment.stripe_payment_intent_id,{amount_to_capture:captureCents},{idempotencyKey:`sos-capture-${missionId}`})
  }catch(error){
    console.error('SOS capture failed',{missionId,error:String(error)})
    return json(req,{error:'Payment capture failed. Mission remains in service and requires support.'},409)
  }
  const chargeId=typeof captured.latest_charge==='string'?captured.latest_charge:captured.latest_charge?.id||payment.stripe_charge_id||null
  const{error:paymentUpdateError}=await admin.from('sos_payments').update({payment_status:'captured',escrow_status:'held_for_release',captured_at:now,stripe_charge_id:chargeId,updated_at:now}).eq('id',payment.id)
  if(paymentUpdateError){console.error('SOS captured payment ledger update failed',{missionId,error:paymentUpdateError.message});return json(req,{error:'Payment was captured but the mission ledger requires automatic reconciliation.'},500)}

  const{data:completed,error:missionError}=await admin.from('sos_missions').update({status:'completed',completed_at:now,updated_at:now}).eq('id',missionId).eq('hero_id',hero.id).eq('status','working').select('id,status,completed_at,final_price,tax_amount').single()
  if(missionError||!completed){console.error('SOS mission finalization failed after capture',{missionId,error:missionError?.message});return json(req,{error:'Payment was captured but mission completion requires automatic reconciliation.'},500)}
  await admin.from('sos_mission_events').insert({mission_id:missionId,event_type:'status_change',old_status:'working',new_status:'completed',payload:{proof:'passed',payment:'captured',capture_cents:captureCents,source:'hero_app'},lat,lng,actor:'hero'})

  let release:{released:boolean,transfer_id?:string,warning?:string}={released:false}
  try{
    if(!chargeId)throw new Error('Captured charge ID unavailable')
    const transfer=await stripe.transfers.create({amount:Math.round(Number(payment.hero_payout)*100),currency:payment.currency||'usd',destination:hero.stripe_connect_id,source_transaction:chargeId,transfer_group:`sos_mission_${missionId}`,metadata:{mission_id:missionId,hero_id:hero.id}},{idempotencyKey:`sos-release-${missionId}`})
    await admin.from('sos_payments').update({payment_status:'released',escrow_status:'released_to_hero',stripe_transfer_id:transfer.id,released_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',payment.id)
    release={released:true,transfer_id:transfer.id}
  }catch(error){
    console.error('SOS payout release failed',{missionId,error:String(error)})
    await admin.from('sos_payments').update({payment_status:'transfer_pending',escrow_status:'held_for_release',updated_at:new Date().toISOString()}).eq('id',payment.id)
    release={released:false,warning:'Service is complete and payment is captured. Hero payout will retry automatically.'}
  }
  return json(req,{ok:true,mission:completed,payment:{captured:true,...release}})
})
