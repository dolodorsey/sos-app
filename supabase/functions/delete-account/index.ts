// S.O.S. — Account deletion (Apple App Store Guideline 5.1.1(v))
// Personal data and private verification evidence are erased before the Auth
// identity is deleted. Financial/safety records remain only as anonymized tombstones.

import { createClient } from "npm:@supabase/supabase-js@2.112.0";

const ALLOWED_ORIGINS = new Set([
  "https://thesuperherosonstandby.com","https://www.thesuperherosonstandby.com","https://superherosonstandby.com","https://www.superherosonstandby.com","capacitor://localhost","http://localhost","https://localhost",
]);
function corsHeaders(req:Request){const origin=req.headers.get("Origin")??"";return{"Access-Control-Allow-Origin":ALLOWED_ORIGINS.has(origin)?origin:"https://thesuperherosonstandby.com","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"}}
function json(req:Request,body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...corsHeaders(req),"Content-Type":"application/json; charset=utf-8"}})}

async function removeEvidence(admin:any,authUserId:string){
  const{data:sosUser,error:userLookupError}=await admin.from('sos_users').select('id').eq('auth_id',authUserId).maybeSingle();if(userLookupError)throw userLookupError;if(!sosUser?.id)return 0;
  const{data:hero,error:heroError}=await admin.from('sos_heroes').select('id').eq('user_id',sosUser.id).maybeSingle();if(heroError)throw heroError;if(!hero?.id)return 0;
  const{data:checks,error:checkError}=await admin.from('sos_hero_verification_checks').select('evidence_urls').eq('hero_id',hero.id);if(checkError)throw checkError;
  const prefix=`sos/${authUserId}/`;
  const paths=[...new Set((checks||[]).flatMap((row:any)=>Array.isArray(row.evidence_urls)?row.evidence_urls:[]).map((value:any)=>String(value)).filter((value:string)=>value.startsWith(prefix)))];
  for(let i=0;i<paths.length;i+=100){const batch=paths.slice(i,i+100);const{error}=await admin.storage.from('marketplace-verification').remove(batch);if(error)throw error}
  return paths.length;
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders(req)});if(req.method!=="POST")return json(req,{error:"Method not allowed"},405);
  const origin=req.headers.get('Origin');if(origin&&!ALLOWED_ORIGINS.has(origin))return json(req,{error:'Origin not allowed'},403);
  const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY"),serviceRole=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");if(!url||!anon||!serviceRole){console.error("delete-account missing required Supabase runtime configuration");return json(req,{error:"Account deletion is temporarily unavailable"},503)}
  const jwt=(req.headers.get("Authorization")??"").replace(/^Bearer\s+/i,"");if(!jwt)return json(req,{error:"Missing Authorization bearer token"},401);
  const userClient=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${jwt}`}}});const{data:{user},error:userError}=await userClient.auth.getUser();if(userError||!user)return json(req,{error:"Invalid or expired session"},401);
  const admin=createClient(url,serviceRole,{auth:{persistSession:false,autoRefreshToken:false}});
  let evidenceDeleted=0;try{evidenceDeleted=await removeEvidence(admin,user.id)}catch(error){console.error('S.O.S. verification evidence deletion failed',{authUserId:user.id,message:error instanceof Error?error.message:String(error)});return json(req,{error:'Verification evidence could not be erased safely. Account deletion was stopped before profile anonymization.'},500)}
  const{data:erasure,error:erasureError}=await admin.rpc("sos_anonymize_account",{p_auth_id:user.id});if(erasureError){console.error("delete-account anonymization failed",{authUserId:user.id,code:erasureError.code,message:erasureError.message});return json(req,{error:"Account data could not be erased safely"},500)}
  const{error:deleteError}=await admin.auth.admin.deleteUser(user.id);if(deleteError){console.error("delete-account auth deletion failed",{authUserId:user.id,message:deleteError.message});return json(req,{error:"Personal data was anonymized, but the sign-in identity could not be removed",profile_anonymized:true,verification_evidence_deleted:evidenceDeleted},500)}
  return json(req,{ok:true,account_deleted:true,profile_anonymized:Boolean(erasure?.profile_anonymized??erasure?.found),support_cases_scrubbed:Number(erasure?.support_cases_scrubbed||0),hero_applications_deleted:Number(erasure?.hero_applications_deleted||0),recruiting_candidates_deleted:Number(erasure?.recruiting_candidates_deleted||0),verification_rows_deleted:Number(erasure?.verification_rows_deleted||0),verification_evidence_deleted:evidenceDeleted});
});
