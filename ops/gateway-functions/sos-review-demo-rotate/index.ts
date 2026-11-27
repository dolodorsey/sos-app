import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.0";
import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT } from "npm:jose@5.9.6";

// Rotates the S.O.S. App Review demo sign-in (appreview@sos-app.com) entirely server-side:
// new random password -> App Store Connect review details -> S.O.S. account -> sign-in check
// -> saved in credentials. Any failure puts everything back. Returns status only: the
// password never leaves this function. Caller: dolodorsey/sos-app ios-testflight.yml on main.
const ISSUER='https://token.actions.githubusercontent.com';
const AUDIENCE='kollective-apple-release';
const WORKFLOW_REF='dolodorsey/sos-app/.github/workflows/ios-testflight.yml@refs/heads/main';
const JWKS=createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks`));
const ASC_KEY='apple_appstoreconnect_5RBY84349Q';
const DEMO_KEY='sos_apple_reviewer_demo';
const SOS_APP_ID='6761696210';
const SOS_AUTH='https://cxdqkjvtpilvouwtbgdy.supabase.co/auth/v1';
const SOS_PUBLIC_KEY='sb_publishable_x_QDbPwZuhbqB1bd58MLvg_ADSiFODN'; // public client key (already in the S.O.S. web app)
// Versions whose App Review details Apple lets us edit. IN_REVIEW means a reviewer may be signed in: never rotate then.
const EDITABLE=new Set(['PREPARE_FOR_SUBMISSION','READY_FOR_REVIEW','WAITING_FOR_REVIEW','DEVELOPER_REJECTED','REJECTED','METADATA_REJECTED','INVALID_BINARY']);
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});

async function appleToken(privateKey:string,keyId:string,issuerId:string){
  const key=await importPKCS8(privateKey,'ES256');const now=Math.floor(Date.now()/1000);
  return new SignJWT({}).setProtectedHeader({alg:'ES256',kid:keyId,typ:'JWT'}).setIssuer(issuerId).setAudience('appstoreconnect-v1').setIssuedAt(now).setExpirationTime(now+900).sign(key);
}
async function apple(jwt:string,method:string,path:string,body?:unknown){
  const r=await fetch(`https://api.appstoreconnect.apple.com${path}`,{method,headers:{Authorization:`Bearer ${jwt}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  const b=await r.json().catch(()=>({}));return {ok:r.ok,status:r.status,body:b as any};
}
const appleError=(r:any)=>String(r.body?.errors?.[0]?.detail||r.body?.errors?.[0]?.title||`Apple ${r.status}`).slice(0,300);
async function signIn(email:string,password:string){
  const r=await fetch(`${SOS_AUTH}/token?grant_type=password`,{method:'POST',headers:{apikey:SOS_PUBLIC_KEY,'Content-Type':'application/json'},body:JSON.stringify({email,password})});
  const b=await r.json().catch(()=>({}));return {ok:r.ok&&!!b?.access_token,status:r.status,token:String(b?.access_token||'')};
}
async function setPassword(token:string,password:string){
  const r=await fetch(`${SOS_AUTH}/user`,{method:'PUT',headers:{apikey:SOS_PUBLIC_KEY,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({password})});
  await r.text().catch(()=>'');return {ok:r.ok,status:r.status};
}
function newPassword(){
  const a='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';const out:string[]=[];
  while(out.length<20){const [b]=crypto.getRandomValues(new Uint8Array(1));if(b<a.length*Math.floor(256/a.length))out.push(a[b%a.length]);}
  return `Sos-${out.join('')}-9`;
}

Deno.serve(async(req)=>{
  if(req.method!=='POST')return json({ok:false,error:'Method not allowed'},405);
  const auth=req.headers.get('authorization')||'',oidc=auth.startsWith('Bearer ')?auth.slice(7):'';
  try{
    const {payload}=await jwtVerify(oidc,JWKS,{issuer:ISSUER,audience:AUDIENCE});
    if(payload.repository!=='dolodorsey/sos-app'||payload.ref!=='refs/heads/main'||payload.workflow_ref!==WORKFLOW_REF||payload.runner_environment!=='github-hosted')return json({ok:false,error:'Caller not authorized'},403);
  }catch{return json({ok:false,error:'Invalid GitHub OIDC token'},401)}
  const dryRun=new URL(req.url).searchParams.get('dry_run')==='1';
  const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const fail=async(stage:string,detail='')=>{await admin.from('apple_release_broker_diagnostic_log').insert({repository:'dolodorsey/sos-app',stage:`review_demo_rotate:${stage}`,error_message:detail.slice(0,800)}).then(()=>{},()=>{});return json({ok:false,stage,detail},stage==='apple_in_review'?409:503)};

  const {data:ascRec}=await admin.from('credentials').select('credential_value,is_active').eq('credential_key',ASC_KEY).maybeSingle();
  const {data:demoRec}=await admin.from('credentials').select('id,credential_value,is_active').eq('credential_key',DEMO_KEY).maybeSingle();
  const asc=ascRec?.credential_value as any,demo=demoRec?.credential_value as any;
  if(!ascRec?.is_active||!asc?.api_private_key_p8||!asc?.key_id||!asc?.issuer_id)return fail('apple_key_missing');
  if(!demoRec?.is_active||!demo?.email||!demo?.password)return fail('demo_record_missing');
  const email=String(demo.email),oldPassword=String(demo.password);

  const jwt=await appleToken(String(asc.api_private_key_p8),String(asc.key_id),String(asc.issuer_id));
  const vr=await apple(jwt,'GET',`/v1/apps/${SOS_APP_ID}/appStoreVersions?fields[appStoreVersions]=versionString,appStoreState,platform&limit=50`);
  if(!vr.ok)return fail('apple_versions',appleError(vr));
  const versions=(vr.body?.data||[]).map((v:any)=>({id:v.id,version:v.attributes?.versionString,state:v.attributes?.appStoreState}));
  if(versions.some((v:any)=>v.state==='IN_REVIEW'))return fail('apple_in_review','A reviewer may be using the demo sign-in right now; not rotating.');
  const targets:any[]=[];
  for(const v of versions.filter((v:any)=>EDITABLE.has(v.state))){
    const d=await apple(jwt,'GET',`/v1/appStoreVersions/${v.id}/appStoreReviewDetail`);
    if(!d.ok||!d.body?.data?.id)continue;
    const name=String(d.body.data.attributes?.demoAccountName||'');
    if(name.toLowerCase()!==email.toLowerCase())return fail('apple_demo_name_mismatch',`Version ${v.version} lists a different demo account; not touching it.`);
    targets.push({...v,detailId:d.body.data.id});
  }
  if(!targets.length)return fail('apple_no_editable_review_detail');

  const s1=await signIn(email,oldPassword);
  if(!s1.ok)return fail('current_password_sign_in',`S.O.S. sign-in with the stored password failed (${s1.status})`);
  const summary=targets.map(t=>({version:t.version,state:t.state}));
  if(dryRun)return json({ok:true,dry_run:true,versions:summary,current_sign_in_verified:true});

  const pw=newPassword();
  const patch=(id:string,password:string)=>apple(jwt,'PATCH',`/v1/appStoreReviewDetails/${id}`,{data:{type:'appStoreReviewDetails',id,attributes:{demoAccountPassword:password,demoAccountRequired:true}}});
  const revertApple=async(ids:string[])=>{for(const id of ids)await patch(id,oldPassword)};
  const done:string[]=[];
  for(const t of targets){
    const p=await patch(t.detailId,pw);
    if(!p.ok){await revertApple(done);return fail('apple_update',`Version ${t.version}: ${appleError(p)}`)}
    done.push(t.detailId);
  }
  const u=await setPassword(s1.token,pw);
  if(!u.ok){await revertApple(done);return fail('sos_password_update',`S.O.S. password change failed (${u.status}); Apple details put back.`)}
  const s2=await signIn(email,pw);
  if(!s2.ok){await setPassword(s1.token,oldPassword);await revertApple(done);return fail('new_password_sign_in',`New password did not sign in (${s2.status}); everything put back.`)}
  const now=new Date().toISOString();
  const {error}=await admin.from('credentials').update({credential_value:{...demo,password:pw,password_rotated_at:now,password_rotation_reason:'Old password appeared in public GitHub run logs before the Nov 26 redaction fix',login_verified:true},updated_at:now,last_validated:now,last_validation_status:'sign_in_ok_after_rotation'}).eq('id',demoRec.id);
  if(error){await setPassword(s2.token,oldPassword);await revertApple(done);return fail('save_new_password',`${error.message}; everything put back.`)}
  const s3=await signIn(email,oldPassword);
  // Read Apple back so the result proves the reviewer will see the new sign-in.
  let appleMatches=0;
  for(const t of targets){const d=await apple(jwt,'GET',`/v1/appStoreReviewDetails/${t.detailId}`);if(d.ok&&d.body?.data?.attributes?.demoAccountPassword===pw)appleMatches++;}
  return json({ok:true,rotated_at:now,versions:summary,apple_review_details_updated:done.length,apple_read_back_matches:appleMatches,new_password_sign_in_verified:true,old_password_retired:!s3.ok});
});
