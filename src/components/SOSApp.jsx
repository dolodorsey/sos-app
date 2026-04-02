import React,{useState,useEffect}from'react';

/* ═══════════════════════════════════════════
   S.O.S — SUPERHEROES ON STANDBY — MOBILE APP
   8 categories, 40 services, citizen/hero portals
   ═══════════════════════════════════════════ */

const SB='https://cxdqkjvtpilvouwtbgdy.supabase.co';
const SK='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4ZHFranZ0cGlsdm91d3RiZ2R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0OTg4MzgsImV4cCI6MjA4NzA3NDgzOH0.pIOX5kzkY6X-lpQjrGkQN7BWSMQSUFVVIvyZ2RA31-4';
const getSosUserId=async(authId,token)=>{const d=await fetch(`${SB}/rest/v1/sos_users?auth_id=eq.${authId}&select=id,role,full_name,referral_code`,{headers:{apikey:SK,Authorization:`Bearer ${token}`}}).then(r=>r.json());return d?.[0]||null;};
const sbAuth=async(ep,body)=>{const r=await fetch(`${SB}/auth/v1/${ep}`,{method:'POST',headers:{'Content-Type':'application/json',apikey:SK,Authorization:`Bearer ${SK}`},body:JSON.stringify(body)});const d=await r.json();if(d.error||d.msg)throw new Error(d.error_description||d.msg||d.error);return d;};
const sbResetPw=async(email)=>{const r=await fetch(`${SB}/auth/v1/recover`,{method:'POST',headers:{'Content-Type':'application/json',apikey:SK},body:JSON.stringify({email})});if(!r.ok)throw new Error('Failed to send reset email');};
const getSession=()=>{try{const s=JSON.parse(localStorage.getItem('sos_session'));if(s?.expires_at&&Date.now()/1000>s.expires_at)return null;return s;}catch{return null;}};
const getMissions=async(userId,token)=>{try{const r=await fetch(`${SB}/rest/v1/sos_missions?citizen_id=eq.${userId}&select=id,status,pickup_address,estimated_price,request_type,created_at&order=created_at.desc&limit=20`,{headers:{apikey:SK,Authorization:`Bearer ${token}`}});return await r.json();}catch{return[];}};
const getLocation=async()=>{try{if(navigator.geolocation){return new Promise((res,rej)=>{navigator.geolocation.getCurrentPosition(p=>res({lat:p.coords.latitude,lng:p.coords.longitude,address:`${p.coords.latitude.toFixed(4)}, ${p.coords.longitude.toFixed(4)}`}),()=>res({lat:null,lng:null,address:'GPS Location'}),{timeout:10000});});}return{lat:null,lng:null,address:'GPS Location'};}catch{return{lat:null,lng:null,address:'GPS Location'};}};

/* Error Boundary */
class SOSErrorBoundary extends React.Component{
  constructor(p){super(p);this.state={hasError:false};}
  static getDerivedStateFromError(){return{hasError:true};}
  render(){
    if(this.state.hasError)return React.createElement('div',{style:{minHeight:'100vh',background:'#080c14',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',fontFamily:"'Inter',sans-serif",color:'#fff',padding:24,textAlign:'center'}},
      React.createElement('div',{style:{fontSize:40,marginBottom:16}},'\u26A0\uFE0F'),
      React.createElement('h2',{style:{fontSize:20,fontWeight:700,marginBottom:8}},'Something went wrong'),
      React.createElement('button',{onClick:()=>{this.setState({hasError:false});window.location.reload()},style:{background:'#FF6B35',color:'#fff',border:'none',borderRadius:14,padding:'14px 32px',fontSize:16,fontWeight:700,cursor:'pointer'}},'Reload App')
    );
    return this.props.children;
  }
}

const C={bg:'#080c14',card:'#0d1320',card2:'#111827',accent:'#FF6B35',accentDk:'#E55A2B',gold:'#FFB347',green:'#10B981',red:'#EF4444',text:'#fff',sub:'rgba(255,255,255,.6)',muted:'rgba(255,255,255,.35)',border:'rgba(255,255,255,.08)'};
const ff="'Inter',-apple-system,BlinkMacSystemFont,sans-serif";
const F=(d='row',a='center',j='center',g=0)=>({display:'flex',flexDirection:d,alignItems:a,justifyContent:j,gap:g});

/* ─── 8 Categories, 40 Services (from sos_categories + sos_subcategories) ─── */
const CATS=[
  {id:'er',name:'Emergency Roadside',icon:'\u{1F6A8}',color:'#FF6B35',services:[
    {name:'Towing',desc:'Secure tow to destination',price:75,eta:'5-10 min'},
    {name:'Flat Tire Help',desc:'Spare install or patch',price:55,eta:'5-10 min'},
    {name:'Tire Concierge',desc:'Buy, pickup & install',price:85,eta:'10-20 min'},
    {name:'Jump Start',desc:'Battery boost',price:45,eta:'5-10 min'},
    {name:'Battery Replace',desc:'Deliver & install',price:95,eta:'10-20 min'},
    {name:'Fuel Delivery',desc:'Gas, diesel, EV',price:55,eta:'5-10 min'},
    {name:'Lockout',desc:'Non-destructive unlock',price:50,eta:'5-10 min'},
    {name:'Winch Out & Recovery',desc:'Get you unstuck',price:95,eta:'10-20 min'},
  ]},
  {id:'mm',name:'Mobile Maintenance',icon:'\u{1F527}',color:'#14b8a6',services:[
    {name:'Oil Change',desc:'Full synthetic available',price:65,eta:'10-20 min'},
    {name:'Fluids / Top-ups',desc:'Coolant, brake, washer',price:35,eta:'5-10 min'},
    {name:'OBD Scan + Report',desc:'Diagnostic readout',price:40,eta:'5-10 min'},
    {name:'Bulb Replacement',desc:'Headlight, tail, signal',price:30,eta:'5-10 min'},
    {name:'Belt/Hose Swap',desc:'Minor belt & hose',price:85,eta:'20-40 min'},
    {name:'Brake Pads',desc:'On-site where feasible',price:120,eta:'20-40 min'},
  ]},
  {id:'gb',name:'Glass & Body',icon:'\u{1F539}',color:'#3B82F6',services:[
    {name:'Windshield Repair',desc:'Chip & crack repair',price:65,eta:'10-20 min'},
    {name:'Windshield Replace',desc:'Full replacement',price:0,eta:'Scheduled',quote:true},
    {name:'Paintless Dent Repair',desc:'No-paint dent removal',price:0,eta:'Scheduled',quote:true},
    {name:'Scratch Buff',desc:'Minor surface repair',price:75,eta:'10-20 min'},
  ]},
  {id:'cw',name:'Car Wash & Detailing',icon:'\u2728',color:'#8b5cf6',services:[
    {name:'Express Wash',desc:'Quick exterior wash',price:35,eta:'5-10 min'},
    {name:'Interior Detail',desc:'Deep clean interior',price:85,eta:'20-40 min'},
    {name:'Full Detail',desc:'Complete in & out',price:150,eta:'20-40 min'},
    {name:'Ceramic Coating',desc:'Professional coating',price:0,eta:'Scheduled',quote:true},
    {name:'Odor / Sanitization',desc:'Ozone & deep clean',price:65,eta:'10-20 min'},
  ]},
  {id:'ca',name:'Convenience Add-Ons',icon:'\u{1F6D2}',color:'#f59e0b',services:[
    {name:'Errand Assist',desc:'Parts pickup',price:40,eta:'10-20 min'},
    {name:'Accessory Install',desc:'Dash cam, mounts',price:55,eta:'10-20 min'},
    {name:'Safety Kit Delivery',desc:'Flares, first aid',price:35,eta:'5-10 min'},
    {name:'Wiper Blade Install',desc:'Replace worn wipers',price:25,eta:'5-10 min'},
    {name:'Key/Fob Support',desc:'Where legal',price:0,eta:'Scheduled',quote:true},
  ]},
  {id:'fs',name:'Fleet Services',icon:'\u{1F690}',color:'#06b6d4',services:[
    {name:'Fleet Jump/Lockout',desc:'Priority response',price:45,eta:'5-10 min'},
    {name:'Fleet Fuel',desc:'Bulk fuel delivery',price:55,eta:'10-20 min'},
    {name:'Fleet Wash',desc:'Multi-vehicle wash',price:40,eta:'10-20 min'},
    {name:'Fleet Inspections',desc:'Pre-trip compliance',price:60,eta:'10-20 min'},
  ]},
  {id:'ss',name:'Seasonal & Specialty',icon:'\u2744\uFE0F',color:'#f43f5e',services:[
    {name:'Winter Prep',desc:'Fluids, tires, battery',price:85,eta:'20-40 min'},
    {name:'Summer Prep',desc:'AC, coolant, tires',price:75,eta:'20-40 min'},
    {name:'Seasonal Tire Swap',desc:'Winter/summer swap',price:80,eta:'20-40 min'},
    {name:'Storm Cleanup',desc:'Post-storm assistance',price:0,eta:'Scheduled',quote:true},
  ]},
  {id:'pc',name:'Premium Concierge',icon:'\u{1F451}',color:'#D4A853',services:[
    {name:'Valet Fuel + Wash',desc:'Fuel & wash combo',price:75,eta:'10-20 min'},
    {name:'Pickup/Return Mechanic',desc:'We pick up, fix, return',price:0,eta:'Scheduled',quote:true},
    {name:'Tire/Rim Upgrade',desc:'Concierge sourcing',price:0,eta:'Scheduled',quote:true},
    {name:'VIP Roadside Priority',desc:'Top-tier dispatch',price:95,eta:'5-10 min'},
  ]},
];

const QUICK=[
  {name:'Flat Tire',emoji:'\u{1F6DE}',price:55,eta:'5-10 min',desc:'Spare install or patch'},
  {name:'Jump Start',emoji:'\u{1F50B}',price:45,eta:'5-10 min',desc:'Battery boost'},
  {name:'Lockout',emoji:'\u{1F511}',price:50,eta:'5-10 min',desc:'Non-destructive unlock'},
  {name:'Towing',emoji:'\u{1F69B}',price:75,eta:'5-10 min',desc:'Secure tow'},
  {name:'Fuel',emoji:'\u26FD',price:55,eta:'5-10 min',desc:'Gas, diesel, EV'},
  {name:'Battery',emoji:'\u{1F50B}',price:95,eta:'10-20 min',desc:'Deliver & install'},
];

const SHIELD=[
  {name:'Shield Free',price:0,per:'',tag:'',feats:['Pay-as-you-go','Standard response','GPS tracking','Email support']},
  {name:'Shield',price:7.99,per:'/mo',tag:'POPULAR',feats:['Priority response','24/7 Command Center','Free tow under 10mi','15% off services','Live GPS + ETA']},
  {name:'Shield Pro',price:14.99,per:'/mo',tag:'BEST',feats:['VIP priority response','24/7 Command Center','Free tow under 25mi','25% off all services','Family coverage (up to 4)','Dedicated concierge']},
];

export default function SOSAppWrapper(){return React.createElement(SOSErrorBoundary,null,React.createElement(SOSAppInner));}
function SOSAppInner(){
  const[screen,setScreen]=useState('loading');
  const[authMode,setAuthMode]=useState('signup');
  const[authRole,setAuthRole]=useState('citizen');
  const[email,setEmail]=useState('');const[pw,setPw]=useState('');const[name,setName]=useState('');
  const[err,setErr]=useState('');const[loading,setLoading]=useState(false);
  const[session,setSession]=useState(null);const[sosUser,setSosUser]=useState(null);
  const[tab,setTab]=useState('home');
  const[openCat,setOpenCat]=useState(null);
  const[dispatch,setDispatch]=useState(null);// null | {phase,service}
  const[heroOn,setHeroOn]=useState(false);
  const[heroTab,setHeroTab]=useState('home');
  const[legalView,setLegalView]=useState(null);
  const[missions,setMissions]=useState([]);
  const[forgotMode,setForgotMode]=useState(false);
  const[resetSent,setResetSent]=useState(false);

  // Restore session
  useEffect(()=>{
    try{
      const s=getSession();
      if(s?.access_token){
        setSession(s);
        getSosUserId(s.user.id,s.access_token).then(u=>{
          if(u){setSosUser(u);setScreen(u.role==='hero'?'hero':'citizen');
            // Load mission history
            getMissions(u.id,s.access_token).then(m=>setMissions(m||[]));
          }
          else setScreen('auth');
        }).catch(()=>setScreen('auth'));
      }else setScreen('auth');
    }catch{setScreen('auth')}
  },[]);

  const doAuth=async()=>{
    if(loading)return;setLoading(true);setErr('');
    try{
      if(authMode==='signup'){
        if(!name.trim()){setErr('Enter your name');setLoading(false);return;}
        await sbAuth('signup',{email,password:pw,data:{full_name:name.trim(),role:authRole,app:'sos'}});
      }
      const d=await sbAuth('token?grant_type=password',{email,password:pw});
      localStorage.setItem('sos_session',JSON.stringify(d));setSession(d);
      const u=await getSosUserId(d.user.id,d.access_token);setSosUser(u);
      setScreen(u?.role==='hero'?'hero':'citizen');
    }catch(e){
      let m=e.message||'Failed';
      if(m.includes('Invalid login'))m='Wrong email or password';
      if(m.includes('already registered'))m='Already registered \u2014 try Sign In';
      setErr(m);
    }finally{setLoading(false);}
  };

  const signOut=()=>{localStorage.removeItem('sos_session');setSession(null);setSosUser(null);setScreen('auth');setTab('home');setHeroTab('home');};

  const request=(svc)=>setDispatch({phase:'confirm',service:svc});
  const confirmReq=async()=>{
    setDispatch(p=>({...p,phase:'finding'}));
    const loc=await getLocation();
    if(session&&sosUser){
      try{await fetch(`${SB}/rest/v1/sos_missions`,{method:'POST',headers:{'Content-Type':'application/json',apikey:SK,Authorization:`Bearer ${session.access_token}`,Prefer:'return=minimal'},
        body:JSON.stringify({citizen_id:sosUser.id,status:'requested',pickup_address:loc.address,estimated_price:dispatch.service.price||0,request_type:'now'})});}catch{}
    }
    setTimeout(()=>setDispatch(p=>({...p,phase:'matched'})),3000);
    setTimeout(()=>setDispatch(p=>({...p,phase:'tracking',eta:7})),5500);
  };
  const finishMission=()=>{setDispatch(null);setOpenCat(null);if(session&&sosUser)getMissions(sosUser.id,session.access_token).then(m=>setMissions(m||[]));};

  const W={fontFamily:ff,color:C.text,background:C.bg,minHeight:'100vh',position:'relative'};
  const safeTop=parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sat')||'0')||44;

  // ═══ LOADING ═══
  if(screen==='loading')return(<div style={{...W,...F('column','center','center')}}><div style={{fontSize:28,fontWeight:900}}>S.O.S</div><div style={{fontSize:12,color:C.sub,marginTop:8}}>Loading...</div></div>);

  // ═══ AUTH ═══
  if(screen==='auth'){
    const ok=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&pw.length>=8&&(authMode==='signin'||name.trim().length>=2);
    return(
    <div style={{...W,padding:'60px 24px 24px'}}>
      <div style={{textAlign:'center',marginBottom:28}}>
        <div style={{fontWeight:900,fontSize:28,letterSpacing:-1}}>S.O.S</div>
        <div style={{fontSize:12,color:C.accent,fontWeight:700,letterSpacing:2,marginTop:2}}>SUPERHEROES ON STANDBY</div>
      </div>
      {/* Role */}
      <div style={{...F('row','center','center',0),background:C.card2,borderRadius:12,padding:3,marginBottom:16}}>
        {['citizen','hero'].map(r=><button key={r} onClick={()=>setAuthRole(r)} style={{flex:1,padding:'11px',borderRadius:10,border:'none',cursor:'pointer',fontSize:13,fontWeight:700,fontFamily:ff,background:authRole===r?(r==='hero'?C.green:C.accent):'transparent',color:authRole===r?'#fff':C.sub,textTransform:'capitalize'}}>{r==='citizen'?'\u{1F198} Citizen':'\u{1F9B8} Hero'}</button>)}
      </div>
      {/* Mode */}
      <div style={{...F('row','center','center',0),background:C.card2,borderRadius:12,padding:3,marginBottom:20}}>
        {['signup','signin'].map(m=><button key={m} onClick={()=>{setAuthMode(m);setErr('')}} style={{flex:1,padding:'11px',borderRadius:10,border:'none',cursor:'pointer',fontSize:13,fontWeight:700,fontFamily:ff,background:authMode===m?C.card:'transparent',color:authMode===m?C.text:C.sub}}>{m==='signup'?'Sign Up':'Sign In'}</button>)}
      </div>
      {authMode==='signup'&&<input value={name} onChange={e=>setName(e.target.value)} placeholder="Full Name" style={{width:'100%',padding:'14px 16px',background:C.card2,border:`1px solid ${C.border}`,borderRadius:12,color:C.text,fontSize:14,outline:'none',boxSizing:'border-box',fontFamily:ff,marginBottom:12}}/>}
      <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" style={{width:'100%',padding:'14px 16px',background:C.card2,border:`1px solid ${C.border}`,borderRadius:12,color:C.text,fontSize:14,outline:'none',boxSizing:'border-box',fontFamily:ff,marginBottom:12}}/>
      <input type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="Password (8+ chars)" style={{width:'100%',padding:'14px 16px',background:C.card2,border:`1px solid ${C.border}`,borderRadius:12,color:C.text,fontSize:14,outline:'none',boxSizing:'border-box',fontFamily:ff,marginBottom:16}}/>
      {err&&<div style={{padding:'10px 14px',background:'rgba(239,68,68,.12)',border:'1px solid rgba(239,68,68,.3)',borderRadius:12,marginBottom:14,fontSize:13,color:C.red,fontWeight:600}}>{err}</div>}
      <button onClick={doAuth} disabled={!ok||loading} style={{width:'100%',padding:'16px',background:ok&&!loading?`linear-gradient(135deg,${authRole==='hero'?C.green:C.accent},${authRole==='hero'?'#059669':C.accentDk})`:'rgba(255,255,255,.08)',color:ok?'#fff':C.muted,border:'none',borderRadius:14,fontSize:16,fontWeight:700,cursor:ok&&!loading?'pointer':'not-allowed',fontFamily:ff}}>{loading?'\u00B7\u00B7\u00B7':(authMode==='signup'?'Create Account':'Sign In')}</button>
      {authMode==='signin'&&!forgotMode&&<button onClick={()=>{setForgotMode(true);setErr('');setResetSent(false)}} style={{background:'none',border:'none',color:C.muted,fontSize:12,cursor:'pointer',fontFamily:ff,marginTop:12,width:'100%',textAlign:'center'}}>Forgot password?</button>}
      {forgotMode&&!resetSent&&<div style={{marginTop:16,padding:16,background:C.card2,borderRadius:14,border:`1px solid ${C.border}`}}>
        <div style={{fontSize:14,fontWeight:700,marginBottom:8}}>Reset Password</div>
        <div style={{fontSize:12,color:C.sub,marginBottom:12}}>Enter your email to receive a reset link</div>
        <button onClick={async()=>{if(!email)return;setLoading(true);setErr('');try{await sbResetPw(email);setResetSent(true);}catch(e){setErr(e.message);}finally{setLoading(false);}}} style={{width:'100%',padding:'12px',background:C.accent,color:'#fff',border:'none',borderRadius:10,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:ff}}>{loading?'...':'Send Reset Link'}</button>
      </div>}
      {resetSent&&<div style={{marginTop:16,padding:16,background:`${C.green}15`,borderRadius:14,textAlign:'center'}}>
        <div style={{fontSize:14,fontWeight:700,color:C.green,marginBottom:4}}>{'\u2709\uFE0F'} Check your email</div>
        <div style={{fontSize:12,color:C.sub}}>Reset link sent to {email}</div>
        <button onClick={()=>{setForgotMode(false);setResetSent(false)}} style={{background:'none',border:'none',color:C.accent,fontSize:12,cursor:'pointer',fontFamily:ff,marginTop:8}}>Back to Sign In</button>
      </div>}
    </div>
  );}

  // ═══ DISPATCH OVERLAY ═══
  const DispatchOverlay=()=>{
    if(!dispatch)return null;
    const s=dispatch.service;
    return(
      <div style={{position:'fixed',inset:0,background:'rgba(8,12,20,.97)',zIndex:999,...F('column','center','center'),padding:24}}>
        {dispatch.phase==='confirm'&&(<div style={{background:C.card,borderRadius:20,padding:24,width:'100%',maxWidth:340,textAlign:'center',border:`1px solid ${C.border}`}}>
          <div style={{fontSize:18,fontWeight:800,marginBottom:12}}>Confirm Service</div>
          <div style={{fontSize:16,fontWeight:700,color:C.accent}}>{s.name}</div>
          <div style={{fontSize:13,color:C.sub,margin:'4px 0 16px'}}>{s.desc}</div>
          <div style={{fontSize:32,fontWeight:900,color:C.accent,marginBottom:4}}>{s.quote?'Quote':('$'+s.price)}</div>
          <div style={{fontSize:12,color:C.muted,marginBottom:24}}>ETA: {s.eta}</div>
          <button onClick={confirmReq} style={{width:'100%',padding:'16px',background:`linear-gradient(135deg,${C.accent},${C.accentDk})`,color:'#fff',border:'none',borderRadius:14,fontSize:16,fontWeight:700,cursor:'pointer',fontFamily:ff}}>{'\u{1F198}'} Dispatch Hero</button>
          <button onClick={()=>setDispatch(null)} style={{background:'none',border:'none',color:C.sub,marginTop:14,cursor:'pointer',fontSize:13,fontFamily:ff}}>Cancel</button>
        </div>)}
        {dispatch.phase==='finding'&&(<div style={{textAlign:'center'}}><div style={{width:80,height:80,borderRadius:'50%',border:`3px solid ${C.accent}`,margin:'0 auto 20px',...F('row','center','center'),fontSize:36}}>{'\u{1F9B8}'}</div><div style={{fontSize:20,fontWeight:800}}>Finding Your Hero...</div><div style={{fontSize:14,color:C.sub,marginTop:8}}>Locating verified Heroes nearby</div></div>)}
        {dispatch.phase==='matched'&&(<div style={{textAlign:'center'}}><div style={{width:80,height:80,borderRadius:'50%',background:`${C.green}20`,margin:'0 auto 20px',...F('row','center','center'),fontSize:36}}>{'\u2705'}</div><div style={{fontSize:20,fontWeight:800,color:C.green}}>Hero Found!</div><div style={{fontSize:14,color:C.sub,marginTop:8}}>Preparing to depart</div></div>)}
        {dispatch.phase==='tracking'&&(<div style={{background:C.card,borderRadius:20,padding:24,width:'100%',maxWidth:340,textAlign:'center',border:`1px solid ${C.border}`}}>
          <div style={{fontSize:16,fontWeight:800}}>Hero En Route {'\u{1F9B8}'}</div>
          <div style={{fontSize:13,color:C.sub,marginBottom:16}}>{s.name}</div>
          <div style={{width:110,height:110,borderRadius:'50%',background:`linear-gradient(135deg,${C.accent}15,${C.green}15)`,margin:'0 auto 16px',...F('row','center','center')}}>
            <div><div style={{fontSize:30,fontWeight:900,color:C.accent}}>{dispatch.eta||7}</div><div style={{fontSize:11,color:C.sub}}>min</div></div>
          </div>
          <div style={{background:C.card2,borderRadius:12,padding:12,marginBottom:16}}>
            <div style={{...F('row','center','space-between'),marginBottom:6}}><span style={{fontSize:11,color:C.sub}}>GPS Tracking</span><span style={{fontSize:11,color:C.green}}>{'\u25CF'} Live</span></div>
            <div style={{height:4,background:C.border,borderRadius:2}}><div style={{width:'60%',height:'100%',background:`linear-gradient(90deg,${C.accent},${C.green})`,borderRadius:2}}/></div>
          </div>
          <button onClick={finishMission} style={{width:'100%',padding:'14px',background:C.green,color:'#fff',border:'none',borderRadius:12,fontSize:15,fontWeight:700,cursor:'pointer',fontFamily:ff}}>Mission Complete {'\u2705'}</button>
        </div>)}
      </div>
    );
  };

  // ═══ CITIZEN APP ═══
  if(screen==='citizen'){
    const NavBar=()=>(
      <div style={{position:'fixed',bottom:0,left:0,right:0,background:C.card,borderTop:`1px solid ${C.border}`,padding:'8px 0 20px',...F('row','center','space-around'),zIndex:100}}>
        {[{id:'home',icon:'\u{1F3E0}',l:'Home'},{id:'services',icon:'\u{1F527}',l:'Services'},{id:'history',icon:'\u{1F4CB}',l:'History'},{id:'shield',icon:'\u{1F6E1}\uFE0F',l:'Shield'},{id:'profile',icon:'\u{1F464}',l:'Profile'}].map(n=>(
          <button key={n.id} onClick={()=>{setTab(n.id);setOpenCat(null)}} style={{background:'none',border:'none',cursor:'pointer',fontFamily:ff,...F('column','center','center',2),padding:'4px 8px'}}>
            <span style={{fontSize:20}}>{n.icon}</span>
            <span style={{fontSize:10,fontWeight:600,color:tab===n.id?C.accent:C.muted}}>{n.l}</span>
          </button>
        ))}
      </div>
    );

    return(
      <div style={W}>
        <DispatchOverlay/>
        <div style={{paddingBottom:80}}>
          {/* ── HOME TAB ── */}
          {tab==='home'&&(<div style={{padding:'20px 20px 0'}}>
            <div style={{...F('row','center','space-between'),marginBottom:20}}>
              <div><div style={{fontWeight:900,fontSize:22}}>S.O.S</div><div style={{fontSize:11,color:C.sub}}>Hi {sosUser?.full_name?.split(' ')[0]||session?.user?.user_metadata?.full_name?.split(' ')[0]||'there'} {'\u{1F44B}'}</div></div>
              <div style={{background:`${C.accent}15`,borderRadius:10,padding:'6px 12px',fontSize:11,fontWeight:700,color:C.accent}}>Shield Free</div>
            </div>
            {/* SOS Button */}
            <div style={{textAlign:'center',margin:'20px 0 28px'}}>
              <div onClick={()=>request(QUICK[0])} style={{width:110,height:110,borderRadius:'50%',background:`linear-gradient(135deg,${C.accent},${C.accentDk})`,margin:'0 auto 10px',cursor:'pointer',...F('row','center','center'),boxShadow:`0 0 50px ${C.accent}30`,fontSize:30,fontWeight:900,color:'#fff'}}>SOS</div>
              <div style={{fontSize:12,color:C.sub}}>Tap for Emergency Rescue</div>
            </div>
            {/* Quick */}
            <div style={{fontWeight:700,fontSize:15,marginBottom:10}}>Quick Rescue</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:24}}>
              {QUICK.map((s,i)=>(<div key={i} onClick={()=>request(s)} style={{background:C.card,borderRadius:14,padding:12,textAlign:'center',cursor:'pointer',border:`1px solid ${C.border}`}}>
                <div style={{fontSize:22,marginBottom:2}}>{s.emoji}</div>
                <div style={{fontWeight:600,fontSize:11}}>{s.name}</div>
                <div style={{fontSize:13,fontWeight:700,color:C.accent,marginTop:3}}>${s.price}</div>
              </div>))}
            </div>
            {/* Categories preview */}
            <div style={{fontWeight:700,fontSize:15,marginBottom:10}}>Browse Services</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              {CATS.map(c=>(<div key={c.id} onClick={()=>{setTab('services');setOpenCat(c.id)}} style={{background:C.card,borderRadius:14,padding:14,cursor:'pointer',border:`1px solid ${C.border}`,...F('row','center','flex-start',10)}}>
                <div style={{width:36,height:36,borderRadius:10,background:`${c.color}15`,fontSize:18,...F('row','center','center'),flexShrink:0}}>{c.icon}</div>
                <div><div style={{fontWeight:700,fontSize:12}}>{c.name}</div><div style={{fontSize:10,color:C.muted}}>{c.services.length} services</div></div>
              </div>))}
            </div>
          </div>)}

          {/* ── SERVICES TAB ── */}
          {tab==='services'&&(<div style={{padding:'20px 20px 0'}}>
            <div style={{fontWeight:800,fontSize:20,marginBottom:16}}>All Services</div>
            {CATS.map(cat=>(<div key={cat.id} style={{marginBottom:10}}>
              <div onClick={()=>setOpenCat(openCat===cat.id?null:cat.id)} style={{background:C.card,borderRadius:14,padding:'14px 16px',cursor:'pointer',border:openCat===cat.id?`1px solid ${cat.color}40`:`1px solid ${C.border}`,...F('row','center','space-between')}}>
                <div style={F('row','center','flex-start',10)}>
                  <div style={{width:36,height:36,borderRadius:10,background:`${cat.color}15`,fontSize:18,...F('row','center','center'),flexShrink:0}}>{cat.icon}</div>
                  <div><div style={{fontWeight:700,fontSize:14}}>{cat.name}</div><div style={{fontSize:11,color:C.sub}}>{cat.services.length} services</div></div>
                </div>
                <span style={{color:C.sub,fontSize:14}}>{openCat===cat.id?'\u25BE':'\u25B8'}</span>
              </div>
              {openCat===cat.id&&(<div style={{background:C.card2,borderRadius:12,marginTop:4,overflow:'hidden'}}>
                {cat.services.map((s,i)=>(<div key={i} onClick={()=>request(s)} style={{padding:'12px 16px',borderBottom:i<cat.services.length-1?`1px solid ${C.border}`:'none',cursor:'pointer',...F('row','center','space-between')}}>
                  <div style={{flex:1}}><div style={{fontWeight:600,fontSize:13}}>{s.name}</div><div style={{fontSize:11,color:C.sub}}>{s.desc} {'\u00B7'} {s.eta}</div></div>
                  <div style={{fontWeight:700,fontSize:14,color:s.quote?C.gold:C.accent,flexShrink:0,marginLeft:8}}>{s.quote?'Quote':('$'+s.price)}</div>
                </div>))}
              </div>)}
            </div>))}
          </div>)}

          {/* ── HISTORY TAB ── */}
          {tab==='history'&&(<div style={{padding:'20px 20px 0'}}>
            <div style={{fontWeight:800,fontSize:20,marginBottom:16}}>Mission History</div>
            {missions.length===0?<div style={{background:C.card,borderRadius:16,padding:32,textAlign:'center',border:`1px solid ${C.border}`}}>
              <div style={{fontSize:32,marginBottom:8}}>{'\u{1F4CB}'}</div>
              <div style={{fontWeight:700,fontSize:15}}>No missions yet</div>
              <div style={{fontSize:13,color:C.sub,marginTop:4}}>Your completed rescues will appear here</div>
            </div>:missions.map((m,i)=>(
              <div key={m.id} style={{background:C.card,borderRadius:14,padding:14,marginBottom:8,border:`1px solid ${C.border}`}}>
                <div style={{...F('row','center','space-between'),marginBottom:4}}>
                  <div style={{fontWeight:700,fontSize:14}}>{m.pickup_address||'Service Request'}</div>
                  <div style={{fontSize:11,fontWeight:600,color:m.status==='completed'?C.green:m.status==='requested'?C.accent:C.gold,background:m.status==='completed'?`${C.green}15`:m.status==='requested'?`${C.accent}15`:`${C.gold}15`,padding:'2px 8px',borderRadius:6}}>{m.status}</div>
                </div>
                <div style={{...F('row','center','space-between')}}>
                  <div style={{fontSize:12,color:C.sub}}>{new Date(m.created_at).toLocaleDateString()} {'\u00B7'} {m.request_type}</div>
                  <div style={{fontSize:13,fontWeight:700,color:C.accent}}>{m.estimated_price>0?('$'+m.estimated_price):'Quote'}</div>
                </div>
              </div>
            ))}
          </div>)}

          {/* ── SHIELD TAB ── */}
          {tab==='shield'&&(<div style={{padding:'20px 20px 0'}}>
            <div style={{fontWeight:800,fontSize:20,marginBottom:4}}>Shield Plans</div>
            <div style={{fontSize:13,color:C.sub,marginBottom:16}}>Priority response, free tows, family coverage</div>
            {SHIELD.map((p,i)=>(<div key={i} style={{background:C.card,borderRadius:16,padding:18,marginBottom:10,border:p.tag==='POPULAR'?`2px solid ${C.accent}`:`1px solid ${C.border}`,position:'relative'}}>
              {p.tag&&<div style={{position:'absolute',top:-9,right:14,background:p.tag==='POPULAR'?C.accent:C.gold,color:p.tag==='POPULAR'?'#fff':'#000',fontSize:9,fontWeight:800,padding:'2px 8px',borderRadius:6,letterSpacing:1}}>{p.tag}</div>}
              <div style={{...F('row','baseline','space-between'),marginBottom:10}}>
                <div style={{fontWeight:700,fontSize:16}}>{p.name}</div>
                <div><span style={{fontWeight:800,fontSize:22}}>{p.price===0?'Free':('$'+p.price)}</span><span style={{fontSize:11,color:C.sub}}>{p.per}</span></div>
              </div>
              {p.feats.map((f,j)=><div key={j} style={{fontSize:12,color:C.sub,padding:'3px 0',...F('row','center','flex-start',6)}}><span style={{color:C.green,fontSize:13}}>{'\u2713'}</span>{f}</div>)}
              {i>0&&<button style={{width:'100%',marginTop:12,padding:'12px',background:i===1?C.accent:`${C.gold}20`,color:i===1?'#fff':C.gold,border:'none',borderRadius:10,fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:ff}}>Subscribe Now</button>}
            </div>))}
          </div>)}

          {/* ── PROFILE TAB ── */}
          {tab==='profile'&&(<div style={{padding:'20px 20px 0'}}>
            <div style={{fontWeight:800,fontSize:20,marginBottom:16}}>Profile</div>
            <div style={{background:C.card,borderRadius:16,padding:20,border:`1px solid ${C.border}`,textAlign:'center',marginBottom:12}}>
              <div style={{width:64,height:64,borderRadius:'50%',background:`${C.accent}15`,margin:'0 auto 10px',...F('row','center','center'),fontSize:28}}>{'\u{1F464}'}</div>
              <div style={{fontWeight:700,fontSize:16}}>{sosUser?.full_name||session?.user?.user_metadata?.full_name||'Citizen'}</div>
              <div style={{fontSize:13,color:C.sub,marginTop:2}}>{session?.user?.email}</div>
              <div style={{fontSize:11,color:C.accent,fontWeight:600,marginTop:4}}>Shield Free Member</div>
            </div>
            {[{l:'Payment Methods',icon:'\u{1F4B3}'},{l:'Safety Settings',icon:'\u{1F512}'},{l:'Notifications',icon:'\u{1F514}'},{l:'Help & Support',icon:'\u2753'}].map((item,i)=>(
              <div key={i} style={{background:C.card,borderRadius:12,padding:'14px 16px',marginBottom:6,border:`1px solid ${C.border}`,...F('row','center','space-between'),cursor:'pointer'}}>
                <div style={F('row','center','flex-start',10)}><span style={{fontSize:18}}>{item.icon}</span><span style={{fontSize:14,fontWeight:600}}>{item.l}</span></div>
                <span style={{color:C.muted}}>{'\u25B8'}</span>
              </div>
            ))}
            <div style={{display:'flex',justifyContent:'center',gap:16,marginTop:12}}>
              <button onClick={()=>setLegalView('terms')} style={{background:'none',border:'none',color:C.muted,fontSize:11,cursor:'pointer',fontFamily:ff,textDecoration:'underline'}}>Terms of Service</button>
              <button onClick={()=>setLegalView('privacy')} style={{background:'none',border:'none',color:C.muted,fontSize:11,cursor:'pointer',fontFamily:ff,textDecoration:'underline'}}>Privacy Policy</button>
            </div>
            <button onClick={signOut} style={{width:'100%',padding:'14px',background:'transparent',border:`1px solid ${C.red}30`,color:C.red,borderRadius:12,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:ff,marginTop:8}}>Sign Out</button>
          </div>)}
        </div>
        <NavBar/>
      </div>
    );
  }

  // ═══ HERO APP ═══
  if(screen==='hero'){
    const HeroNav=()=>(
      <div style={{position:'fixed',bottom:0,left:0,right:0,background:C.card,borderTop:`1px solid ${C.border}`,padding:'8px 0 20px',...F('row','center','space-around'),zIndex:100}}>
        {[{id:'home',icon:'\u{1F3E0}',l:'Home'},{id:'missions',icon:'\u{1F4CB}',l:'Missions'},{id:'earnings',icon:'\u{1F4B0}',l:'Earnings'},{id:'profile',icon:'\u{1F464}',l:'Profile'}].map(n=>(
          <button key={n.id} onClick={()=>setHeroTab(n.id)} style={{background:'none',border:'none',cursor:'pointer',fontFamily:ff,...F('column','center','center',2),padding:'4px 8px'}}>
            <span style={{fontSize:20}}>{n.icon}</span>
            <span style={{fontSize:10,fontWeight:600,color:heroTab===n.id?C.green:C.muted}}>{n.l}</span>
          </button>
        ))}
      </div>
    );
    return(
      <div style={W}>
        <div style={{paddingBottom:80}}>
          {heroTab==='home'&&(<div style={{padding:'20px 20px 0'}}>
            <div style={{...F('row','center','space-between'),marginBottom:20}}>
              <div><div style={{fontWeight:900,fontSize:22,color:C.green}}>{'\u{1F9B8}'} Hero</div><div style={{fontSize:11,color:C.sub}}>{sosUser?.full_name||session?.user?.user_metadata?.full_name||'Hero'}</div></div>
            </div>
            <div style={{background:C.card,borderRadius:16,padding:'16px 20px',marginBottom:16,border:`1px solid ${C.border}`,...F('row','center','space-between')}}>
              <div><div style={{fontWeight:700,fontSize:15}}>On Patrol</div><div style={{fontSize:12,color:heroOn?C.green:C.sub}}>{heroOn?'Accepting missions':'Off duty'}</div></div>
              <div onClick={()=>setHeroOn(!heroOn)} style={{width:52,height:28,borderRadius:14,background:heroOn?C.green:C.border,cursor:'pointer',padding:2,transition:'all .3s'}}><div style={{width:24,height:24,borderRadius:12,background:'#fff',transform:heroOn?'translateX(24px)':'translateX(0)',transition:'all .3s'}}/></div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:20}}>
              {[{l:'Missions',v:'0',c:C.accent},{l:'Rating',v:'5.0',c:C.gold},{l:'Earned',v:'$0',c:C.green}].map((s,i)=>(<div key={i} style={{background:C.card,borderRadius:14,padding:14,textAlign:'center',border:`1px solid ${C.border}`}}><div style={{fontSize:20,fontWeight:800,color:s.c}}>{s.v}</div><div style={{fontSize:10,color:C.sub}}>{s.l}</div></div>))}
            </div>
            <div style={{background:C.card,borderRadius:16,padding:28,textAlign:'center',border:`1px solid ${C.border}`}}>
              {heroOn?<><div style={{fontSize:32,marginBottom:8}}>{'\u{1F4E1}'}</div><div style={{fontWeight:700,fontSize:15}}>Scanning for Missions</div><div style={{fontSize:12,color:C.sub,marginTop:4}}>You'll be notified when a citizen needs help</div></>
              :<><div style={{fontSize:32,marginBottom:8}}>{'\u{1F634}'}</div><div style={{fontWeight:700,fontSize:15}}>Off Patrol</div><div style={{fontSize:12,color:C.sub,marginTop:4}}>Toggle On Patrol to accept missions</div></>}
            </div>
          </div>)}
          {heroTab==='missions'&&(<div style={{padding:'20px 20px 0'}}><div style={{fontWeight:800,fontSize:20,marginBottom:16}}>Missions</div><div style={{background:C.card,borderRadius:16,padding:28,textAlign:'center',border:`1px solid ${C.border}`}}><div style={{fontSize:32,marginBottom:8}}>{'\u{1F4CB}'}</div><div style={{fontWeight:700}}>No missions yet</div><div style={{fontSize:12,color:C.sub,marginTop:4}}>Completed missions appear here</div></div></div>)}
          {heroTab==='earnings'&&(<div style={{padding:'20px 20px 0'}}><div style={{fontWeight:800,fontSize:20,marginBottom:16}}>Earnings</div><div style={{background:C.card,borderRadius:16,padding:28,textAlign:'center',border:`1px solid ${C.border}`}}><div style={{fontSize:32,marginBottom:8}}>{'\u{1F4B0}'}</div><div style={{fontWeight:700}}>$0.00</div><div style={{fontSize:12,color:C.sub,marginTop:4}}>Earnings and payouts appear here</div></div></div>)}
          {heroTab==='profile'&&(<div style={{padding:'20px 20px 0'}}>
            <div style={{fontWeight:800,fontSize:20,marginBottom:16}}>Hero Profile</div>
            <div style={{background:C.card,borderRadius:16,padding:20,border:`1px solid ${C.border}`,textAlign:'center',marginBottom:12}}>
              <div style={{width:64,height:64,borderRadius:'50%',background:`${C.green}15`,margin:'0 auto 10px',...F('row','center','center'),fontSize:28}}>{'\u{1F9B8}'}</div>
              <div style={{fontWeight:700,fontSize:16}}>{sosUser?.full_name||session?.user?.user_metadata?.full_name||'Hero'}</div>
              <div style={{fontSize:13,color:C.sub,marginTop:2}}>{session?.user?.email}</div>
            </div>
            <div style={{display:'flex',justifyContent:'center',gap:16,marginTop:12}}>
              <button onClick={()=>setLegalView('terms')} style={{background:'none',border:'none',color:C.muted,fontSize:11,cursor:'pointer',fontFamily:ff,textDecoration:'underline'}}>Terms of Service</button>
              <button onClick={()=>setLegalView('privacy')} style={{background:'none',border:'none',color:C.muted,fontSize:11,cursor:'pointer',fontFamily:ff,textDecoration:'underline'}}>Privacy Policy</button>
            </div>
            <button onClick={signOut} style={{width:'100%',padding:'14px',background:'transparent',border:`1px solid ${C.red}30`,color:C.red,borderRadius:12,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:ff,marginTop:8}}>Sign Out</button>
          </div>)}
        </div>
        <HeroNav/>
      </div>
    );
  }
  // ═══ LEGAL MODAL (renders on top of any screen) ═══
  const LegalOverlay=legalView?(
    <div style={{position:'fixed',inset:0,zIndex:999,background:'rgba(8,12,20,0.97)',overflowY:'auto',padding:'50px 16px 40px'}} onClick={()=>setLegalView(null)}>
      <div onClick={e=>e.stopPropagation()} style={{maxWidth:420,margin:'0 auto',background:C.card,borderRadius:20,padding:'20px 16px',border:`1px solid ${C.border}`}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
          <div style={{fontWeight:800,fontSize:17}}>{legalView==='terms'?'Terms of Service':'Privacy Policy'}</div>
          <button onClick={()=>setLegalView(null)} style={{background:'none',border:'none',color:C.sub,fontSize:18,cursor:'pointer',fontFamily:ff}}>{'\u2715'}</button>
        </div>
        <div style={{fontSize:11,color:C.sub,lineHeight:1.8,whiteSpace:'pre-wrap'}}>{legalView==='terms'?'TERMS OF SERVICE \u2014 The Kollective Hospitality Group\nLast Updated: April 2, 2026\n\n1. ACCEPTANCE OF TERMS\nBy using any application provided by The Kollective Hospitality Group ("KHG"), including Good Times, SOS, On Call, and Help 911, you agree to these Terms.\n\n2. ELIGIBILITY\nYou must be at least 18 years old.\n\n3. ACCOUNT REGISTRATION\nYou are responsible for maintaining the confidentiality of your credentials.\n\n4. USE OF SERVICES\nSOS provides roadside assistance dispatch connecting citizens with verified Heroes. Services include emergency roadside, mobile maintenance, glass & body, car wash & detailing, convenience add-ons, fleet services, seasonal & specialty, and premium concierge.\n\n5. PAYMENTS\nCertain services require payment. All fees are non-refundable except as required by law. Shield plan subscriptions may be canceled at any time.\n\n6. SERVICE PROVIDER DISCLAIMER\nKHG connects users with independent service providers ("Heroes"). We are not liable for services provided by third parties.\n\n7. INTELLECTUAL PROPERTY\nAll content and technology are owned by KHG.\n\n8. LIMITATION OF LIABILITY\nKHG shall not be liable for indirect, incidental, or consequential damages.\n\n9. GOVERNING LAW\nGoverned by the laws of Georgia, United States.\n\n10. CONTACT\nThe Kollective Hospitality Group\nAtlanta, Georgia\nthedoctordorsey@gmail.com':'PRIVACY POLICY \u2014 The Kollective Hospitality Group\nLast Updated: April 2, 2026\n\n1. INFORMATION WE COLLECT\nAccount info (name, email, phone), location data for dispatch, payment info via third-party processors.\n\n2. HOW WE USE IT\nTo provide services, dispatch Heroes, process payments, improve the app, and comply with legal obligations.\n\n3. SHARING\nWe do not sell your data. We share with Heroes (name, location for dispatch), payment processors, analytics (anonymized), and law enforcement when required.\n\n4. SECURITY\nEncryption in transit, secure database storage, access controls.\n\n5. RETENTION\nData retained while your account is active. Request deletion by contacting us.\n\n6. YOUR RIGHTS\nAccess, correct, or delete your data. Opt out of non-essential communications.\n\n7. CHILDREN\nNot intended for users under 18.\n\n8. CONTACT\nThe Kollective Hospitality Group\nAtlanta, Georgia\nthedoctordorsey@gmail.com'}</div>
      </div>
    </div>
  ):null;

  // Render legal overlay on top of whatever screen is active
  if(legalView)return(<div style={W}>{LegalOverlay}</div>);

  return null;
}
