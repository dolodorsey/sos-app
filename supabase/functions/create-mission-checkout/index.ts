import Stripe from 'npm:stripe@18.5.0'
import { createClient } from 'npm:@supabase/supabase-js@2.57.4'

const cors={ 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type' }
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'content-type':'application/json'}})
Deno.serve(async(req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors})
  if(req.method!=='POST') return json({error:'Method not allowed'},405)
  const auth=req.headers.get('authorization')||''
  const url=Deno.env.get('SUPABASE_URL')!, anon=Deno.env.get('SUPABASE_ANON_KEY')!, service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}})
  const {data:{user}}=await userClient.auth.getUser()
  if(!user) return json({error:'Authentication required'},401)
  const {mission_id,success_url,cancel_url}=await req.json().catch(()=>({}))
  if(!mission_id) return json({error:'mission_id is required'},400)
  const admin=createClient(url,service)
  const {data:mission}=await admin.from('sos_missions').select('id,citizen_id,hero_id,status,final_price,pricing_status').eq('id',mission_id).single()
  const {data:citizen}=await admin.from('sos_users').select('id').eq('auth_id',user.id).single()
  if(!mission||!citizen||mission.citizen_id!==citizen.id) return json({error:'Mission not found'},404)
  if(!mission.hero_id||mission.pricing_status!=='confirmed'||!mission.final_price) return json({error:'Assignment and confirmed final price are required'},409)
  const {data:hero}=await admin.from('sos_heroes').select('stripe_connect_id').eq('id',mission.hero_id).single()
  if(!hero?.stripe_connect_id) return json({error:'Hero payout account is not ready'},409)
  const amount=Math.round(Number(mission.final_price)*100), fee=Math.round(amount*.20), payout=amount-fee
  const stripe=new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!)
  const base=Deno.env.get('SOS_PUBLIC_URL')||'https://superherosonstandby.com'
  const session=await stripe.checkout.sessions.create({mode:'payment',success_url:success_url||`${base}/app/?payment=authorized`,cancel_url:cancel_url||`${base}/app/?payment=canceled`,line_items:[{price_data:{currency:'usd',unit_amount:amount,product_data:{name:'S.O.S. roadside mission',metadata:{mission_id}}},quantity:1}],payment_method_types:['card'],payment_intent_data:{capture_method:'manual',transfer_group:`sos_mission_${mission_id}`,metadata:{mission_id,hero_id:mission.hero_id}},metadata:{mission_id}}, {idempotencyKey:`sos-checkout-${mission_id}-${amount}`})
  await admin.rpc('sos_prepare_mission_payment',{p_mission_id:mission_id,p_payment_intent_id:String(session.payment_intent),p_checkout_session_id:session.id,p_amount:amount/100,p_platform_fee:fee/100,p_hero_payout:payout/100,p_currency:'usd'})
  return json({checkout_url:session.url,checkout_session_id:session.id})
})
