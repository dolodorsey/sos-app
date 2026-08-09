import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.0";
const allowed=new Set(["https://thesuperherosonstandby.com","https://www.thesuperherosonstandby.com","https://superherosonstandby.com","https://www.superherosonstandby.com"]);
const cors=(origin:string|null)=>({"Access-Control-Allow-Origin":origin&&allowed.has(origin)?origin:"https://thesuperherosonstandby.com","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"GET, POST, OPTIONS","Content-Type":"application/json","Vary":"Origin","Cache-Control":"no-store"});
Deno.serve(async req=>{
 const origin=req.headers.get("origin");if(req.method==="OPTIONS")return new Response("ok",{headers:cors(origin)});if(!["GET","POST"].includes(req.method))return new Response(JSON.stringify({error:"Method not allowed"}),{status:405,headers:cors(origin)});
 try{
  const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false,autoRefreshToken:false}});
  const [{data:heroes,error:heroError},{count:candidates},{count:demoCandidates}]=await Promise.all([
   admin.from("sos_heroes").select("id,user_id,verification_status,on_duty,last_gps_at,user:sos_users!sos_heroes_user_id_fkey(is_demo)"),
   admin.from("sos_recruiting_candidates").select("id",{count:"exact",head:true}).eq("is_demo",false).not("pipeline_stage","in","(rejected,withdrawn)"),
   admin.from("sos_recruiting_candidates").select("id",{count:"exact",head:true}).eq("is_demo",true)
  ]);
  if(heroError)throw heroError;
  const realHeroes=(heroes||[]).filter((h:any)=>!h.user?.is_demo);
  const demoHeroes=(heroes||[]).length-realHeroes.length;
  const userIds=[...new Set(realHeroes.map((h:any)=>h.user_id).filter(Boolean))];
  const {data:users,error:userError}=userIds.length?await admin.from("sos_users").select("id,auth_id,status,is_demo").in("id",userIds):{data:[],error:null};
  if(userError)throw userError;
  const eligibleUsers=new Set((users||[]).filter((u:any)=>u.status==='active'&&!u.is_demo&&Boolean(u.auth_id)).map((u:any)=>u.id));
  const eligibleHeroes=realHeroes.filter((h:any)=>h.verification_status==='verified'&&eligibleUsers.has(h.user_id));
  const onDutyHeroes=eligibleHeroes.filter((h:any)=>Boolean(h.on_duty));
  const {data:realCandidateRows}=await admin.from("sos_recruiting_candidates").select("source_hero_id").eq("is_demo",false).not("pipeline_stage","in","(rejected,withdrawn)");
  const realHeroIds=(realCandidateRows||[]).map((c:any)=>c.source_hero_id).filter(Boolean);
  let checks=0,passed=0;
  if(realHeroIds.length){
    const [{count:allCount},{count:passedCount}]=await Promise.all([
      admin.from("sos_hero_verification_checks").select("hero_id",{count:"exact",head:true}).in("hero_id",realHeroIds),
      admin.from("sos_hero_verification_checks").select("hero_id",{count:"exact",head:true}).in("hero_id",realHeroIds).eq("status","passed")
    ]);
    checks=allCount||0;passed=passedCount||0;
  }
  return new Response(JSON.stringify({stored_real_heroes:realHeroes.length,demo_hero_fixtures:demoHeroes,active_heroes:eligibleHeroes.length,on_duty_heroes:onDutyHeroes.length,recruiting_candidates:candidates||0,demo_candidate_fixtures:demoCandidates||0,verification_checks:checks,passed_checks:passed,eligibility_rule:"verified real hero + active authenticated user",evaluated_at:new Date().toISOString()}),{headers:cors(origin)})
 }catch(error){console.error("sos-network-readiness",error);return new Response(JSON.stringify({error:"Readiness unavailable"}),{status:500,headers:cors(origin)})}
});