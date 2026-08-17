import {createClient}from'@supabase/supabase-js';

const SB='https://cxdqkjvtpilvouwtbgdy.supabase.co';
const SK='sb_publishable_x_QDbPwZuhbqB1bd58MLvg_ADSiFODN';
const CLIENT_KEY='__sosRealtimeClient';

export const getSosRealtimeClient=()=>{
  if(!globalThis[CLIENT_KEY]){
    globalThis[CLIENT_KEY]=createClient(SB,SK,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'sos-realtime-session'}});
  }
  return globalThis[CLIENT_KEY];
};

export const authorizeSosRealtime=token=>{
  const client=getSosRealtimeClient();
  if(token)client.realtime.setAuth(token);
  return client;
};
