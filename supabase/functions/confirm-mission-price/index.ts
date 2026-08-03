import { createClient } from 'npm:@supabase/supabase-js@2.57.4'
const roles=new Set(['admin','operations','dispatcher'])
const json=(b:unknown,s=200)=>Response.json(b,{status:s})
Deno.serve(async(req)=>{
  if(req.method!=='POST')return json({error:'Method not allowed'},405)
  const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,auth=req.headers.get('authorization')||''
  const scoped=createClient(url,anon,{global:{headers:{Authorization:auth}}});const {data:{user}}=await scoped.auth.getUser()
  if(!user)return json({error:'Authentication required'},401)
  if(!roles.has(String(user.app_metadata?.sos_role||'').toLowerCase()))return json({error:'Operations access required'},403)
  const {mission_id,final_price}=await req.json().catch(()=>({}));const price=Number(final_price)
  if(!mission_id||!Number.isFinite(price))return json({error:'mission_id and final_price required'},400)
  const admin=createClient(url,service);const {data,error}=await admin.rpc('sos_confirm_mission_price',{p_mission_id:mission_id,p_final_price:price,p_operator_auth_id:user.id})
  if(error)return json({error:error.message},error.code==='P0002'?404:409)
  return json({mission_id:data.id,final_price:data.final_price,pricing_status:data.pricing_status})
})
