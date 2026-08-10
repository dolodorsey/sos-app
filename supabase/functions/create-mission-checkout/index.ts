import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from 'npm:stripe@18.5.0'
import { createClient } from 'npm:@supabase/supabase-js@2.112.0'

const ALLOWED_ORIGINS=new Set(['https://thesuperherosonstandby.com','https://www.thesuperherosonstandby.com','https://superherosonstandby.com','https://www.superherosonstandby.com','capacitor://localhost','http://localhost','https://localhost'])
const cors=(req:Request)=>{const origin=req.headers.get('Origin')||'';return{'Access-Control-Allow-Origin':ALLOWED_ORIGINS.has(origin)?origin:'https://thesuperherosonstandby.com','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'}}
const json=(req:Request,body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors(req),'content-type':'application/json','Cache-Control':'no-store'}})
function safeReturnUrl(input:unknown,fallback:string){if(typeof input!=='string'||!input)return fallback;try{const parsed=new URL(input);return ALLOWED_ORIGINS.has(parsed.origin)?parsed.toString():fallback}catch{return fallback}}

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors(req)})
  if(req.method!=='POST')return json(req,{error:'Method not allowed'},405)
  const origin=req.headers.get('Origin')||'';if(origin&&!ALLOWED_ORIGINS.has(origin))return json(req,{error:'Origin not allowed'},403)
  const auth=req.headers.get('authorization')||''
  const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if(!url||!anon||!service)return json(req,{error:'Payment services are temporarily unavailable'},503)
  const userClient=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:auth}}})
  const{data:{user},error:userError}=await userClient.auth.getUser()
  if(userError||!user)return json(req,{error:'Authentication required'},401)
  const{mission_id,success_url,cancel_url}=await req.json().catch(()=>({}))
  if(typeof mission_id!=='string'||!mission_id)return json(req,{error:'mission_id is required'},400)
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}})
  const{data:mission}=await admin.from('sos_missions').select('id,citizen_id,hero_id,status,final_price,tax_amount,tip_amount,pricing_status,requested_service_name').eq('id',mission_id).single()
  const{data:citizen}=await admin.from('sos_users').select('id,email,status').eq('auth_id',user.id).single()
  if(!mission||!citizen||citizen.status!=='active'||mission.citizen_id!==citizen.id)return json(req,{error:'Mission not found'},404)
  if(!mission.hero_id||mission.pricing_status!=='confirmed'||!mission.final_price)return json(req,{error:'Assignment and confirmed final price are required'},409)
  if(!['assigned','en_route','on_site','working'].includes(mission.status))return json(req,{error:'Mission is not eligible for payment authorization'},409)
  const{data:hero}=await admin.from('sos_heroes').select('stripe_connect_id,stripe_connect_api_version,stripe_transfer_status').eq('id',mission.hero_id).single()
  if(!hero?.stripe_connect_id||hero.stripe_connect_api_version!=='v2'||hero.stripe_transfer_status!=='active')return json(req,{error:'Hero payout account is not transfer-ready'},409)

  const serviceAmount=Math.round(Number(mission.final_price)*100)/100
  const taxAmount=Math.max(0,Math.round(Number(mission.tax_amount||0)*100)/100)
  const tipAmount=Math.max(0,Math.round(Number(mission.tip_amount||0)*100)/100)
  const chargeCents=Math.round((serviceAmount+taxAmount+tipAmount)*100)
  if(!Number.isFinite(serviceAmount)||serviceAmount<0.5||!Number.isSafeInteger(chargeCents)||chargeCents<50)return json(req,{error:'Mission total is invalid'},409)

  let stripeKey=Deno.env.get('STRIPE_SECRET_KEY')||''
  if(!stripeKey){const{data,error}=await admin.rpc('sos_get_runtime_secret',{secret_name:'STRIPE_SECRET_KEY'});if(!error&&data)stripeKey=String(data)}
  if(!stripeKey)return json(req,{error:'Secure payments are not configured'},503)
  const stripe=new Stripe(stripeKey,{httpClient:Stripe.createFetchHttpClient()})

  const{data:existing}=await admin.from('sos_payments').select('*').eq('mission_id',mission_id).maybeSingle()
  if(existing&&['authorized','captured','transfer_pending','released'].includes(existing.payment_status))return json(req,{error:'Mission payment is already authorized. Refresh mission status.'},409)
  if(existing?.stripe_checkout_session_id){
    try{
      const prior=await stripe.checkout.sessions.retrieve(existing.stripe_checkout_session_id)
      const priorCents=Math.round((Number(existing.amount||0)+Number(existing.tax||0)+Number(existing.tip||0))*100)
      if(prior.status==='open'&&prior.url&&priorCents===chargeCents)return json(req,{checkout_url:prior.url,checkout_session_id:prior.id})
      if(prior.status==='open'&&priorCents!==chargeCents)await stripe.checkout.sessions.expire(prior.id)
      if(prior.status==='complete')return json(req,{error:'Payment authorization is processing. Refresh mission status before trying again.'},409)
    }catch(error){console.warn('Prior S.O.S. checkout lookup failed',String(error))}
  }
  if(existing?.stripe_payment_intent_id){
    try{
      const intent=await stripe.paymentIntents.retrieve(existing.stripe_payment_intent_id)
      if(['requires_capture','processing','succeeded'].includes(intent.status))return json(req,{error:'Mission payment authorization already exists. Refresh mission status.'},409)
      if(['requires_payment_method','requires_confirmation','requires_action'].includes(intent.status))await stripe.paymentIntents.cancel(intent.id,{cancellation_reason:'abandoned'})
    }catch(error){console.warn('Prior S.O.S. PaymentIntent cleanup failed',String(error))}
  }

  const base=Deno.env.get('SOS_PUBLIC_URL')||'https://thesuperherosonstandby.com'
  const success=safeReturnUrl(success_url,`${base}/app/?payment=authorized`),cancel=safeReturnUrl(cancel_url,`${base}/app/?payment=canceled`)
  const session=await stripe.checkout.sessions.create({
    mode:'payment',success_url:success,cancel_url:cancel,
    line_items:[{price_data:{currency:'usd',unit_amount:chargeCents,product_data:{name:'S.O.S. roadside mission',metadata:{mission_id,service_amount:String(serviceAmount),tax_amount:String(taxAmount),tip_amount:String(tipAmount)}}},quantity:1}],
    customer_email:citizen.email||user.email||undefined,
    payment_intent_data:{capture_method:'manual',transfer_group:`sos_mission_${mission_id}`,metadata:{brand:'SOS',flow:'mission',mission_id,hero_id:mission.hero_id,service_amount:String(serviceAmount),tax_amount:String(taxAmount),tip_amount:String(tipAmount)}},
    metadata:{brand:'SOS',flow:'mission',mission_id}
  },{idempotencyKey:`sos-checkout-${mission_id}-${chargeCents}-v3`})
  const paymentIntentId=typeof session.payment_intent==='string'?session.payment_intent:null
  const{error:prepError}=await admin.rpc('sos_prepare_mission_payment',{p_mission_id:mission_id,p_payment_intent_id:paymentIntentId,p_checkout_session_id:session.id,p_amount:serviceAmount,p_platform_fee:null,p_hero_payout:null,p_currency:'usd'})
  if(prepError){try{if(session.status==='open')await stripe.checkout.sessions.expire(session.id)}catch{};console.error('S.O.S. payment ledger preparation failed',prepError);return json(req,{error:'Payment authorization could not be prepared. No active Checkout was left open.'},409)}
  return json(req,{checkout_url:session.url,checkout_session_id:session.id})
})
