import Stripe from 'npm:stripe@18.5.0'
import { createClient } from 'npm:@supabase/supabase-js@2.57.4'
const roles=new Set(['admin','operations','dispatcher'])
const json=(body:unknown,status=200)=>Response.json(body,{status})
Deno.serve(async(req)=>{
  if(req.method!=='POST') return json({error:'Method not allowed'},405)
  const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const auth=req.headers.get('authorization')||''
  const scoped=createClient(url,anon,{global:{headers:{Authorization:auth}}})
  const {data:{user}}=await scoped.auth.getUser()
  if(!user) return json({error:'Authentication required'},401)
  if(!roles.has(String(user.app_metadata?.sos_role||'').toLowerCase())) return json({error:'Operations access required'},403)
  const {mission_id,action,amount}=await req.json().catch(()=>({}))
  if(!mission_id||!['capture','release','cancel','refund'].includes(action)) return json({error:'Valid mission_id and action required'},400)
  const admin=createClient(url,service),stripe=new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!)
  const {data:payment}=await admin.from('sos_payments').select('*').eq('mission_id',mission_id).single()
  const {data:mission}=await admin.from('sos_missions').select('status,hero_id').eq('id',mission_id).single()
  if(!payment||!mission) return json({error:'Payment not found'},404)
  if(action==='capture'){
    if(mission.status!=='completed'||payment.payment_status!=='authorized') return json({error:'Completed mission with an authorized payment required'},409)
    const pi=await stripe.paymentIntents.capture(payment.stripe_payment_intent_id,{amount_to_capture:Math.round(Number(payment.amount)*100)},{idempotencyKey:`sos-capture-${mission_id}`})
    await admin.from('sos_payments').update({payment_status:'captured',escrow_status:'held_for_release',captured_at:new Date().toISOString(),stripe_charge_id:typeof pi.latest_charge==='string'?pi.latest_charge:null,updated_at:new Date().toISOString()}).eq('id',payment.id)
  }else if(action==='release'){
    if(mission.status!=='completed'||payment.payment_status!=='captured'||!payment.stripe_charge_id) return json({error:'Captured completed mission required'},409)
    const {data:hero}=await admin.from('sos_heroes').select('stripe_connect_id').eq('id',mission.hero_id).single()
    if(!hero?.stripe_connect_id) return json({error:'Hero Connect account missing'},409)
    const transfer=await stripe.transfers.create({amount:Math.round(Number(payment.hero_payout)*100),currency:payment.currency,destination:hero.stripe_connect_id,source_transaction:payment.stripe_charge_id,transfer_group:`sos_mission_${mission_id}`,metadata:{mission_id}},{idempotencyKey:`sos-release-${mission_id}`})
    await admin.from('sos_payments').update({payment_status:'released',escrow_status:'released_to_hero',stripe_transfer_id:transfer.id,released_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',payment.id)
  }else if(action==='cancel'){
    if(!['pending','requires_action','authorized'].includes(payment.payment_status)) return json({error:'Payment cannot be canceled'},409)
    await stripe.paymentIntents.cancel(payment.stripe_payment_intent_id,{}, {idempotencyKey:`sos-cancel-${mission_id}`})
    await admin.from('sos_payments').update({payment_status:'canceled',escrow_status:'released_to_customer',updated_at:new Date().toISOString()}).eq('id',payment.id)
  }else{
    if(!payment.stripe_charge_id||!['captured','released','partially_refunded'].includes(payment.payment_status)) return json({error:'Captured payment required'},409)
    const cents=amount==null?undefined:Math.round(Number(amount)*100)
    const refund=await stripe.refunds.create({charge:payment.stripe_charge_id,amount:cents,reverse_transfer:!!payment.stripe_transfer_id,metadata:{mission_id}},{idempotencyKey:`sos-refund-${mission_id}-${cents||'full'}`})
    const total=(Number(payment.refund_amount)||0)+refund.amount/100, full=total>=Number(payment.amount)+Number(payment.tip||0)
    await admin.from('sos_payments').update({payment_status:full?'refunded':'partially_refunded',escrow_status:full?'refunded':'partially_refunded',refund_amount:total,stripe_refund_id:refund.id,refunded_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',payment.id)
  }
  return json({ok:true,mission_id,action})
})
