import Stripe from 'npm:stripe@18.5.0'
import { createClient } from 'npm:@supabase/supabase-js@2.57.4'
const stripe=new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!)
Deno.serve(async(req)=>{
  const body=await req.text(), sig=req.headers.get('stripe-signature')||''
  let event:Stripe.Event
  try{ event=await stripe.webhooks.constructEventAsync(body,sig,Deno.env.get('STRIPE_WEBHOOK_SIGNING_SECRET')!) }catch{ return new Response('Invalid signature',{status:400}) }
  const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const object=event.data.object as any
  const {error:dedupe}=await admin.from('sos_stripe_events').insert({event_id:event.id,event_type:event.type,livemode:event.livemode,object_id:object?.id,payload:{created:event.created}})
  if(dedupe?.code==='23505') return Response.json({received:true,duplicate:true})
  if(dedupe) return new Response('Event ledger unavailable',{status:500})
  const missionId=object?.metadata?.mission_id
  if(missionId){
    const patch:any={updated_at:new Date().toISOString()}
    if(event.type==='payment_intent.amount_capturable_updated'){patch.payment_status='authorized';patch.escrow_status='authorized_hold';patch.authorized_at=new Date().toISOString();patch.stripe_charge_id=typeof object.latest_charge==='string'?object.latest_charge:null}
    else if(event.type==='payment_intent.succeeded'){patch.payment_status='captured';patch.escrow_status='held_for_release';patch.captured_at=new Date().toISOString();patch.stripe_charge_id=typeof object.latest_charge==='string'?object.latest_charge:null}
    else if(event.type==='payment_intent.payment_failed'){patch.payment_status='failed';patch.escrow_status='failed';patch.failed_at=new Date().toISOString()}
    else if(event.type==='payment_intent.canceled'){patch.payment_status='canceled';patch.escrow_status='released_to_customer'}
    else if(event.type==='charge.dispute.created'){patch.payment_status='disputed';patch.escrow_status='disputed';patch.stripe_dispute_id=object.id;patch.disputed_at=new Date().toISOString()}
    if(Object.keys(patch).length>1) await admin.from('sos_payments').update(patch).eq('mission_id',missionId)
  }
  return Response.json({received:true})
})
