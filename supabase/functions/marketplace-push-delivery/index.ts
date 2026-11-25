import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.0";
import webpush from "npm:web-push@3.6.7";

// Shared S.O.S. / ON CALL push worker.
// Nov 25, 2026: Dolo asked to finish the S.O.S. app, so S.O.S. rescue alerts are
// restored behind the on/off switch sos_system_config.rescue_alerts.
// ON CALL stays under the Oct 7, 2026 founder stop: its notifications are not sent here.

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}});
const sha256=async(value:string)=>{const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(d)).map(b=>b.toString(16).padStart(2,'0')).join('')};
const safeEqual=(a:string,b:string)=>{if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0};

Deno.serve(async(req)=>{
  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  try{
    const supplied=req.headers.get('x-worker-token')||'';if(!supplied)return json({error:'Unauthorized'},401);
    const url=Deno.env.get('SUPABASE_URL')||'',service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';if(!url||!service)return json({error:'Worker database configuration unavailable'},503);
    const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
    const{data:authRow}=await admin.from('internal_worker_auth').select('token_hash').eq('worker_name','marketplace_push_delivery').maybeSingle();if(!authRow?.token_hash||!safeEqual(await sha256(supplied),String(authRow.token_hash)))return json({error:'Unauthorized'},401);

    const{data:sw}=await admin.from('sos_system_config').select('config_value,is_active').eq('config_key','rescue_alerts').maybeSingle();
    const sosOn=Boolean(sw?.is_active)&&(sw?.config_value as any)?.enabled===true;
    if(!sosOn)return json({ok:false,status:'paused',reason:'S.O.S. rescue alerts switch is off (sos_system_config.rescue_alerts).'},423);

    const readSecret=async(name:string)=>{const{data,error}=await admin.rpc('sos_get_runtime_secret',{secret_name:name});return error||!data?'':String(data)};
    const publicKey=await readSecret('MARKETPLACE_VAPID_PUBLIC_KEY'),privateKey=await readSecret('MARKETPLACE_VAPID_PRIVATE_KEY');
    if(!publicKey||!privateKey)return json({ok:false,error:'Push keys unavailable'},503);
    webpush.setVapidDetails('mailto:help@superherosonstandby.com',publicKey,privateKey);

    let sent=0,failed=0,deactivated=0,examined=0;
    const deliver=async(notification:any,authId:string,urlPath:string)=>{
      const{data:subs}=await admin.from('marketplace_push_subscriptions').select('id,endpoint,p256dh,auth_secret').eq('auth_id',authId).eq('app','sos').eq('is_active',true);
      for(const sub of subs||[]){
        examined++;
        const ref=String(notification.id);
        const{data:existing}=await admin.from('marketplace_push_deliveries').select('id,status,attempt_count').eq('app','sos').eq('notification_ref',ref).eq('subscription_id',sub.id).maybeSingle();
        if(existing?.status==='sent'||Number(existing?.attempt_count||0)>=5)continue;
        const attempts=Number(existing?.attempt_count||0)+1;
        const payload=JSON.stringify({app:'sos',title:notification.title||'S.O.S. update',body:notification.body||'',url:urlPath,type:notification.type||'system',notification_ref:ref});
        try{
          await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth_secret}},payload,{TTL:300,urgency:'high'} as any);
          await admin.from('marketplace_push_deliveries').upsert({app:'sos',notification_ref:ref,subscription_id:sub.id,status:'sent',attempt_count:attempts,last_error:null,sent_at:new Date().toISOString(),updated_at:new Date().toISOString()},{onConflict:'app,notification_ref,subscription_id'});
          sent++;
          await admin.from('sos_notifications').update({push_sent_at:new Date().toISOString()}).eq('id',notification.id).is('push_sent_at',null);
        }catch(error:any){
          const code=Number(error?.statusCode||error?.status||0),message=String(error?.message||error).slice(0,1000);
          await admin.from('marketplace_push_deliveries').upsert({app:'sos',notification_ref:ref,subscription_id:sub.id,status:'failed',attempt_count:attempts,last_error:message,updated_at:new Date().toISOString()},{onConflict:'app,notification_ref,subscription_id'});
          failed++;
          if(code===404||code===410){await admin.from('marketplace_push_subscriptions').update({is_active:false,updated_at:new Date().toISOString()}).eq('id',sub.id);deactivated++;}
        }
      }
    };

    // Only fresh notifications: an alert about a rescue from an hour ago is noise.
    const cutoff=new Date(Date.now()-60*60*1000).toISOString();
    const{data:sos}=await admin.from('sos_notifications').select('id,user_id,type,title,body,created_at').eq('channel','push').gte('created_at',cutoff).order('created_at',{ascending:true}).limit(100);
    for(const n of sos||[]){const{data:u}=await admin.from('sos_users').select('auth_id,role').eq('id',n.user_id).maybeSingle();if(u?.auth_id)await deliver(n,String(u.auth_id),u.role==='hero'?'/hero':'/app');}
    return json({ok:true,app:'sos',on_call:'paused',examined,sent,failed,deactivated});
  }catch(error){console.error('marketplace push delivery failed',error);return json({error:error instanceof Error?error.message:'Push delivery failed'},500);}
});
