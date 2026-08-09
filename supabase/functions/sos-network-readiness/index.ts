import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.0";
const allowed=new Set(["https://thesuperherosonstandby.com","https://www.thesuperherosonstandby.com","https://superherosonstandby.com","https://www.superherosonstandby.com"]);
const cors=(origin:string|null)=>({"Access-Control-Allow-Origin":origin&&allowed.has(origin)?origin:"https://thesuperherosonstandby.com","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"GET, POST, OPTIONS","Content-Type":"application/json","Vary":"Origin","Cache-Control":"no-store"});
Deno.serve(async req=>{
 const origin=req.headers.get("origin");if(req.method==="OPTIONS")return new Response("ok",{headers:cors(origin)});if(!["GET","POST"].includes(req.method))return new Response(JSON.stringify({error:"Method not allowed"}),{status:405,headers:cors(origin)});
 try{
  const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false,autoRefreshToken:false}});
  const [{data:heroes,error:heroError},{count:candidates},{count:checks},{count:passed}]=await Promise.all([
   admin.from("sos_heroes").select("id,user_id,verification_status,on_duty,last_gps_at"),
   admin.from("sos_recruiting_candidates").select("id",{count:"exact",head:true}).not("pipeline_stage","in","(rejected,withdrawn)"),
   admin.from("sos_hero_verification_checks").select("hero_id",{count:"exact",head:true}),
   admin.from("sos_hero_verification_checks").select("hero_id",{count:"exact",head:true}).eq("status","passed")
  ]);
  if(heroError)throw heroError;
  const userIds=[...new Set((heroes||[]).map((h:any)=>h.user_id).filter(Boolean))];
  const {data:users,error:userError}=userIds.length?await admin.from("sos_users").select("id,auth_id,status").in("id",userIds):{data:[],error:null};
  if(userError)throw userError;
  const eligibleUsers=new Set((users||[]).filter((u:any)=>u.status==='active'&&Boolean(u.auth_id)).map((u:any)=>u.id));
  const storedHeroes=(heroes||[]).length;
  const eligibleHeroes=(heroes||[]).filter((h:any)=>h.verification_status==='verified'&&eligibleUsers.has(h.user_id));
  const onDutyHeroes=eligibleHeroes.filter((h:any)=>Boolean(h.on_duty));
  return new Response(JSON.stringify({stored_heroes:storedHeroes,active_heroes:eligibleHeroes.length,on_duty_heroes:onDutyHeroes.length,recruiting_candidates:candidates||0,verification_checks:checks||0,passed_checks:passed||0,eligibility_rule:"verified hero + active authenticated user",evaluated_at:new Date().toISOString()}),{headers:cors(origin)})
 }catch(error){console.error("sos-network-readiness",error);return new Response(JSON.stringify({error:"Readiness unavailable"}),{status:500,headers:cors(origin)})}
});