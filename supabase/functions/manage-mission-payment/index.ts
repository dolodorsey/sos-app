import Stripe from 'npm:stripe@18.5.0'
import { createClient } from 'npm:@supabase/supabase-js@2.112.0'

const json=(body:unknown,status=200)=>Response.json(body,{status})

Deno.serve(async(req)=>{
  if(req.method!=='POST')return json({error:'Method not allowed'},405)
  const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const auth=req.headers.get('authorization')||''
  const scoped=createClient(url,anon,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}})
  const{data:{user}}=await scoped.auth.getUser()
  if(!user)return json({error:'Authentication required'},401)
  const{data:isOperator,error:operatorError}=await scoped.rpc('marketplace_operator_check')
  if(operatorError||isOperator!==true)return json({error:'Operations access required'},403)

  const{mission_id,action,amount}=await req.json().catch(()=>({}))
  if(typeof mission_id!=='string'||!['capture','release','cancel','refund'].includes(action))return json({error:'Valid mission_id and action required'},400)
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}})
  let stripeKey=Deno.env.get('STRIPE_SECRET_KEY')||''
  if(!stripeKey){const{data,error}=await admin.rpc('sos_get_runtime_secret',{secret_name:'STRIPE_SECRET_KEY'});if(!error&&data)stripeKey=String(data)}
  if(!stripeKey)return json({error:'Secure payments are not configured'},503)
  const stripe=new Stripe(stripeKey,{httpClient:Stripe.createFetchHttpClient()})
  const{data:payment}=await admin.from('sos_payments').select('*').eq('mission_id',mission_id).single()
  const{data:mission}=await admin.from('sos_missions').select('status,hero_id').eq('id',mission_id).single()
  if(!payment||!mission)return json({error:'Payment not found'},404)

  if(action==='capture'){
    if(mission.status!=='completed'||payment.payment_status!=='authorized'||!payment.stripe_payment_intent_id)return json({error:'Completed mission with an authorized payment required'},409)
    const pi=await stripe.paymentIntents.capture(payment.stripe_payment_intent_id,{amount_to_capture:Math.round(Number(payment.amount)*100)},{idempotencyKey:`sos-capture-${mission_id}`})
    await admin.from('sos_payments').update({payment_status:'captured',escrow_status:'held_for_release',captured_at:new Date().toISOString(),stripe_charge_id:typeof pi.latest_charge==='string'?pi.latest_charge:null,updated_at:new Date().toISOString()}).eq('id',payment.id)
  }else if(action==='release'){
    if(mission.status!=='completed'||!['captured','transfer_pending'].includes(payment.payment_status)||!payment.stripe_charge_id||!mission.hero_id)return json({error:'Captured completed mission required'},409)
    const{data:hero}=await admin.from('sos_heroes').select('stripe_connect_id,stripe_connect_api_version,stripe_transfer_status').eq('id',mission.hero_id).single()
    if(!hero?.stripe_connect_id||hero.stripe_connect_api_version!=='v2'||hero.stripe_transfer_status!=='active')return json({error:'Hero payout account is not transfer-ready'},409)
    try{
      const transfer=await stripe.transfers.create({amount:Math.round(Number(payment.hero_payout)*100),currency:payment.currency||'usd',destination:hero.stripe_connect_id,source_transaction:payment.stripe_charge_id,transfer_group:`sos_mission_${mission_id}`,metadata:{mission_id}},{idempotencyKey:`sos-release-${mission_id}`})
      await admin.from('sos_payments').update({payment_status:'released',escrow_status:'released_to_hero',stripe_transfer_id:transfer.id,released_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',payment.id)
    }catch(error){
      await admin.from('sos_payments').update({payment_status:'transfer_pending',escrow_status:'held_for_release',updated_at:new Date().toISOString()}).eq('id',payment.id)
      throw error
    }
  }else if(action==='cancel'){
    if(!['canceled_by_citizen','canceled_by_hero','canceled_by_system'].includes(mission.status))return json({error:'Cancel the mission before canceling payment authorization'},409)
    if(!['pending','requires_action','authorized'].includes(payment.payment_status)||!payment.stripe_payment_intent_id)return json({error:'Payment cannot be canceled'},409)
    await stripe.paymentIntents.cancel(payment.stripe_payment_intent_id,{cancellation_reason:'requested_by_customer'},{idempotencyKey:`sos-cancel-${mission_id}`})
    await admin.from('sos_payments').update({payment_status:'canceled',escrow_status:'released_to_customer',updated_at:new Date().toISOString()}).eq('id',payment.id)
  }else{
    if(!payment.stripe_charge_id||!['captured','released','partially_refunded','transfer_pending'].includes(payment.payment_status))return json({error:'Captured payment required'},409)
    const totalPaid=Number(payment.amount||0)+Number(payment.tip||0),alreadyRefunded=Number(payment.refund_amount||0),remaining=Math.max(0,totalPaid-alreadyRefunded)
    const requested=amount==null?remaining:Number(amount)
    if(!Number.isFinite(requested)||requested<=0||requested>remaining+0.0001)return json({error:'Refund amount exceeds the remaining captured balance'},422)
    const cents=Math.round(requested*100)
    const refund=await stripe.refunds.create({charge:payment.stripe_charge_id,amount:cents,reverse_transfer:!!payment.stripe_transfer_id,metadata:{mission_id}},{idempotencyKey:`sos-refund-${mission_id}-${cents}`})
    const total=alreadyRefunded+refund.amount/100,full=total>=totalPaid-0.0001
    await admin.from('sos_payments').update({payment_status:full?'refunded':'partially_refunded',escrow_status:full?'refunded':'partially_refunded',refund_amount:total,stripe_refund_id:refund.id,refunded_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',payment.id)
  }
  return json({ok:true,mission_id,action})
})
