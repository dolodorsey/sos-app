import{useState,useEffect,useCallback}from'react';

/* ═══════════════════════════════════════════
   S.O.S — SUPERHEROES ON STANDBY
   Full rebuild — Lovable extraction + Supabase data
   8 categories, 40 services, Shield plans, citizen/hero
   ═══════════════════════════════════════════ */

const SB='https://cxdqkjvtpilvouwtbgdy.supabase.co';
const SK='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4ZHFranZ0cGlsdm91d3RiZ2R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0OTg4MzgsImV4cCI6MjA4NzA3NDgzOH0.pIOX5kzkY6X-lpQjrGkQN7BWSMQSUFVVIvyZ2RA31-4';
const getSosUserId=async(authId,token)=>{const d=await fetch(`${SB}/rest/v1/sos_users?auth_id=eq.${authId}&select=id,role`,{headers:{apikey:SK,Authorization:`Bearer ${token}`}}).then(r=>r.json());return d?.[0]||null;};
const sbAuth=async(ep,body)=>{const r=await fetch(`${SB}/auth/v1/${ep}`,{method:'POST',headers:{'Content-Type':'application/json',apikey:SK,Authorization:`Bearer ${SK}`},body:JSON.stringify(body)});const d=await r.json();if(d.error||d.msg)throw new Error(d.error_description||d.msg||d.error);return d;};

/* ─── Theme ─── */
const C={bg:'#080c14',card:'#0d1320',card2:'#111827',accent:'#FF6B35',accentDark:'#E55A2B',gold:'#FFB347',blue:'#3B82F6',green:'#10B981',red:'#EF4444',purple:'#8B5CF6',text:'#FFFFFF',sub:'rgba(255,255,255,0.6)',muted:'rgba(255,255,255,0.35)',border:'rgba(255,255,255,0.08)',overlay:'rgba(8,12,20,0.95)'};
const ff="'Inter',-apple-system,BlinkMacSystemFont,sans-serif";
const F=(d='row',a='center',j='center',g=0)=>({display:'flex',flexDirection:d,alignItems:a,justifyContent:j,gap:g});
const btn=(bg,c='#fff',x)=>({background:bg,color:c,border:'none',borderRadius:14,padding:'14px 28px',fontSize:16,fontWeight:700,cursor:'pointer',transition:'all .2s',fontFamily:'inherit',...x});
const card={background:C.card,borderRadius:16,padding:20,border:`1px solid ${C.border}`};
const inp={width:'100%',padding:'14px 16px',background:C.card2,border:`1px solid ${C.border}`,borderRadius:12,color:C.text,fontSize:14,outline:'none',boxSizing:'border-box',fontFamily:'inherit'};

/* ─── 8 Categories + 40 Services ─── */
const CATS=[
  {id:'emergency-roadside',name:'Emergency Roadside',icon:'\u{1F6A8}',color:'#FF6B35',desc:'24/7 emergency rescue services',services:[
    {name:'Towing',desc:'Secure tow to your destination',price:'$75',eta:'5-10 min'},
    {name:'Flat Tire Help',desc:'Spare install or patch',price:'$55',eta:'5-10 min'},
    {name:'Tire Concierge',desc:'Buy, pickup & install',price:'$85',eta:'10-20 min'},
    {name:'Jump Start',desc:'Battery boost',price:'$45',eta:'5-10 min'},
    {name:'Battery Replace',desc:'Deliver & install',price:'$95',eta:'10-20 min'},
    {name:'Fuel Delivery',desc:'Gas, diesel, EV',price:'$55',eta:'5-10 min'},
    {name:'Lockout',desc:'Non-destructive unlock',price:'$50',eta:'5-10 min'},
    {name:'Winch Out & Recovery',desc:'Get you unstuck',price:'$95',eta:'10-20 min'},
  ]},
  {id:'mobile-maintenance',name:'Mobile Maintenance',icon:'\u{1F527}',color:'#14b8a6',desc:'On-site repairs & maintenance',services:[
    {name:'Oil Change',desc:'Full synthetic available',price:'$65',eta:'10-20 min'},
    {name:'Fluids / Top-ups',desc:'Coolant, brake, washer',price:'$35',eta:'5-10 min'},
    {name:'OBD Scan + Report',desc:'Diagnostic readout',price:'$40',eta:'5-10 min'},
    {name:'Bulb Replacement',desc:'Headlight, tail, signal',price:'$30',eta:'5-10 min'},
    {name:'Belt/Hose Swap',desc:'Minor belt & hose',price:'$85',eta:'20-40 min'},
    {name:'Brake Pads',desc:'On-site where feasible',price:'$120',eta:'20-40 min'},
  ]},
  {id:'glass-body',name:'Glass & Body',icon:'\u{1F539}',color:'#3B82F6',desc:'Windshield, dents & surface repair',services:[
    {name:'Windshield Repair',desc:'Chip & crack repair',price:'$65',eta:'10-20 min'},
    {name:'Windshield Replace',desc:'Full replacement',price:'Quote',eta:'Scheduled'},
    {name:'Paintless Dent Repair',desc:'No-paint dent removal',price:'Quote',eta:'Scheduled'},
    {name:'Scratch Buff',desc:'Minor surface repair',price:'$75',eta:'10-20 min'},
  ]},
  {id:'car-wash-detailing',name:'Car Wash & Detailing',icon:'\u2728',color:'#8b5cf6',desc:'Express wash to full detail',services:[
    {name:'Express Wash',desc:'Quick exterior wash',price:'$35',eta:'5-10 min'},
    {name:'Interior Detail',desc:'Deep clean interior',price:'$85',eta:'20-40 min'},
    {name:'Full Detail',desc:'Complete in & out',price:'$150',eta:'20-40 min'},
    {name:'Ceramic Coating',desc:'Professional coating',price:'Quote',eta:'Scheduled'},
    {name:'Odor / Sanitization',desc:'Ozone & deep clean',price:'$65',eta:'10-20 min'},
  ]},
  {id:'convenience-addons',name:'Convenience Add-Ons',icon:'\u{1F6D2}',color:'#f59e0b',desc:'Errands, installs & extras',services:[
    {name:'Errand Assist',desc:'Parts pickup',price:'$40',eta:'10-20 min'},
    {name:'Accessory Install',desc:'Dash cam, mounts',price:'$55',eta:'10-20 min'},
    {name:'Safety Kit Delivery',desc:'Flares, first aid',price:'$35',eta:'5-10 min'},
    {name:'Wiper Blade Install',desc:'Replace worn wipers',price:'$25',eta:'5-10 min'},
    {name:'Key/Fob Support',desc:'Where legal',price:'Quote',eta:'Scheduled'},
  ]},
  {id:'fleet-services',name:'Fleet Services',icon:'\u{1F690}',color:'#06b6d4',desc:'Multi-vehicle & business accounts',services:[
    {name:'Fleet Jump/Lockout',desc:'Priority response',price:'$45',eta:'5-10 min'},
    {name:'Fleet Fuel',desc:'Bulk fuel delivery',price:'$55',eta:'10-20 min'},
    {name:'Fleet Wash',desc:'Multi-vehicle wash',price:'$40',eta:'10-20 min'},
    {name:'Fleet Inspections',desc:'Pre-trip compliance',price:'$60',eta:'10-20 min'},
  ]},
  {id:'seasonal-specialty',name:'Seasonal & Specialty',icon:'\u2744\uFE0F',color:'#f43f5e',desc:'Weather prep & seasonal care',services:[
    {name:'Winter Prep',desc:'Fluids, tires, battery',price:'$85',eta:'20-40 min'},
    {name:'Summer Prep',desc:'AC, coolant, tires',price:'$75',eta:'20-40 min'},
    {name:'Seasonal Tire Swap',desc:'Winter/summer swap',price:'$80',eta:'20-40 min'},
    {name:'Storm Cleanup',desc:'Post-storm assistance',price:'Quote',eta:'Scheduled'},
  ]},
  {id:'premium-concierge',name:'Premium Concierge',icon:'\u{1F451}',color:'#D4A853',desc:'VIP service & white-glove care',services:[
    {name:'Valet Fuel + Wash',desc:'Fuel & wash combo',price:'$75',eta:'10-20 min'},
    {name:'Pickup/Return Mechanic',desc:'We pick up, fix, return',price:'Quote',eta:'Scheduled'},
    {name:'Tire/Rim Upgrade',desc:'Concierge sourcing',price:'Quote',eta:'Scheduled'},
    {name:'VIP Roadside Priority',desc:'Top-tier dispatch',price:'$95',eta:'5-10 min'},
  ]},
];

const QUICK=[
  {name:'Flat Tire',emoji:'\u{1F6DE}',price:55,eta:'5-10 min',desc:'Spare install or patch'},
  {name:'Jump Start',emoji:'\u{1F50B}',price:45,eta:'5-10 min',desc:'Battery boost'},
  {name:'Lockout',emoji:'\u{1F511}',price:50,eta:'5-10 min',desc:'Non-destructive unlock'},
  {name:'Towing',emoji:'\u{1F69B}',price:75,eta:'5-10 min',desc:'Secure tow'},
  {name:'Fuel Delivery',emoji:'\u26FD',price:55,eta:'5-10 min',desc:'Gas, diesel, EV'},
  {name:'Battery Replace',emoji:'\u{1F50B}',price:95,eta:'10-20 min',desc:'Deliver & install'},
];

const PLANS=[
  {name:'Shield Free',price:'$0',per:'/forever',feats:['Pay-as-you-go pricing','Standard response time','GPS tracking','Email support'],pop:false},
  {name:'Shield',price:'$7.99',per:'/mo',feats:['Priority response','24/7 Command Center','Free tow under 10mi','15% off all services','Live GPS + ETA alerts'],pop:true},
  {name:'Shield Pro',price:'$14.99',per:'/mo',feats:['VIP priority response','24/7 Command Center','Free tow under 25mi','25% off all services','Family coverage (up to 4)','Dedicated concierge line'],pop:false},
];

const HOW_STEPS=[
  {icon:'\u{1F4E1}',title:'Send Your Signal',desc:'Tap SOS NOW and describe your situation. We instantly locate verified Heroes near you.'},
  {icon:'\u{1F9B8}',title:'Hero Dispatched',desc:'We match you with the closest qualified Hero. Track their arrival in real-time with GPS.'},
  {icon:'\u2705',title:'Mission Complete',desc:'Professional service with transparent pricing. Pay securely through the app when the job is complete.'},
];

const REVIEWS=[
  {text:"S.O.S saved me when I was stranded with a flat tire at 2 AM. The Hero arrived in 6 minutes and had me back on the road quickly.",name:'Sarah M.',plan:'Shield Member',stars:5},
  {text:"As a rideshare driver, S.O.S keeps me earning. The family plan covers my whole fleet at an amazing price.",name:'Mike R.',plan:'Family Plan',stars:5},
  {text:"The Hero was professional, fast, and kind. Best rescue experience I've ever had.",name:'Jessica L.',plan:'Shield Pro',stars:5},
];

const TRUST=[
  {icon:'\u2713',label:'Background Checked',desc:'Comprehensive verification for all Heroes'},
  {icon:'\u2B50',label:'Highly Rated',desc:'Only top-rated professionals'},
  {icon:'\u{1F4CD}',label:'GPS Tracked',desc:'Real-time location sharing'},
  {icon:'\u{1F512}',label:'Insured',desc:'Full liability coverage'},
];

export default function SOSApp(){
  const[screen,setScreen]=useState('landing');
  const[authMode,setAuthMode]=useState('signup');
  const[authRole,setAuthRole]=useState('citizen');
  const[email,setEmail]=useState('');const[pw,setPw]=useState('');const[name,setName]=useState('');
  const[err,setErr]=useState('');const[loading,setLoading]=useState(false);
  const[session,setSession]=useState(null);const[sosUser,setSosUser]=useState(null);
  const[selectedService,setSelectedService]=useState(null);
  const[selectedCat,setSelectedCat]=useState(null);
  const[dispatchPhase,setDispatchPhase]=useState(null);
  const[eta,setEta]=useState(0);
  const[heroOnPatrol,setHeroOnPatrol]=useState(false);
  const[heroTab,setHeroTab]=useState('dashboard');

  useEffect(()=>{try{const s=JSON.parse(localStorage.getItem('sos_session'));if(s?.access_token){setSession(s);getSosUserId(s.user.id,s.access_token).then(u=>{if(u){setSosUser(u);setScreen(u.role==='hero'?'hero':'citizen')}else setScreen('auth')}).catch(()=>setScreen('auth'))}else setScreen('landing')}catch{setScreen('landing')}},[]);

  const doAuth=async()=>{
    if(loading)return;setLoading(true);setErr('');
    try{
      if(authMode==='signup'){
        if(!name.trim()){setErr('Enter your name');setLoading(false);return;}
        await sbAuth('signup',{email,password:pw,data:{full_name:name.trim(),role:authRole,app:'sos'}});
        const d=await sbAuth('token?grant_type=password',{email,password:pw});
        localStorage.setItem('sos_session',JSON.stringify(d));setSession(d);
        const u=await getSosUserId(d.user.id,d.access_token);setSosUser(u);
        setScreen(u?.role==='hero'?'hero':'citizen');
      }else{
        const d=await sbAuth('token?grant_type=password',{email,password:pw});
        localStorage.setItem('sos_session',JSON.stringify(d));setSession(d);
        const u=await getSosUserId(d.user.id,d.access_token);setSosUser(u);
        setScreen(u?.role==='hero'?'hero':'citizen');
      }
    }catch(e){let m=e.message||'Failed';if(m.includes('Invalid login'))m='Wrong email or password';if(m.includes('already registered'))m='Email taken — try signing in';setErr(m);}
    finally{setLoading(false);}
  };
  const signOut=()=>{localStorage.removeItem('sos_session');setSession(null);setSosUser(null);setScreen('landing');};
  const requestService=(svc)=>{setSelectedService(svc);setDispatchPhase('confirm');};
  const confirmDispatch=async()=>{
    setDispatchPhase('finding');
    if(session&&sosUser){
      try{await fetch(`${SB}/rest/v1/sos_missions`,{method:'POST',headers:{'Content-Type':'application/json',apikey:SK,Authorization:`Bearer ${session.access_token}`,Prefer:'return=minimal'},
        body:JSON.stringify({citizen_id:sosUser.id,status:'requested',pickup_address:'GPS Location',estimated_price:parseFloat((selectedService.price||'$0').replace(/[^0-9.]/g,''))||0,request_type:'now'})
      });}catch{}
    }
    setTimeout(()=>{setDispatchPhase('matched');setEta(8);},3000);
    setTimeout(()=>setDispatchPhase('tracking'),5000);
  };

  const S={fontFamily:ff,color:C.text,background:C.bg,minHeight:'100vh',overflowX:'hidden'};

  /* ═══ LANDING PAGE ═══ */
  if(screen==='landing')return(
    <div style={S}>
      <div style={{minHeight:'100vh',background:`radial-gradient(ellipse at 50% 20%, rgba(255,107,53,0.15) 0%, ${C.bg} 70%)`,display:'flex',flexDirection:'column',padding:'20px 24px'}}>
        <div style={{...F('row','center','space-between'),padding:'16px 0'}}>
          <div style={{fontWeight:900,fontSize:22,letterSpacing:-0.5}}>S.O.S <span style={{fontSize:10,color:C.accent,verticalAlign:'super'}}>{'\u2122'}</span></div>
          <div style={F('row','center','flex-end',12)}>
            <button onClick={()=>{setAuthRole('hero');setScreen('auth')}} style={{background:'transparent',border:`1px solid ${C.accent}40`,color:C.accent,borderRadius:10,padding:'8px 16px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:ff}}>Hero Portal</button>
            <button onClick={()=>setScreen('auth')} style={btn(C.accent,'#fff',{padding:'8px 20px',fontSize:13,borderRadius:10})}>Get Help</button>
          </div>
        </div>
        <div style={{flex:1,...F('column','center','center'),textAlign:'center',maxWidth:440,margin:'0 auto',padding:'40px 0'}}>
          <div style={{fontSize:11,letterSpacing:4,color:C.accent,fontWeight:800,marginBottom:16}}>SUPERHEROES ON STANDBY</div>
          <h1 style={{fontSize:38,fontWeight:900,lineHeight:1.1,margin:'0 0 16px',letterSpacing:-1}}>Your Rescue<br/>Is <span style={{color:C.accent}}>Moments</span> Away</h1>
          <p style={{fontSize:15,color:C.sub,lineHeight:1.6,margin:'0 0 32px',maxWidth:360}}>Verified Heroes, transparent pricing, 24/7 rescue assistance. Help is always just one tap away.</p>
          <button onClick={()=>setScreen('auth')} style={btn(`linear-gradient(135deg,${C.accent},${C.accentDark})`,'#fff',{padding:'18px 48px',fontSize:17,borderRadius:16,width:'100%',maxWidth:320,letterSpacing:0.5})}>{'\u{1F198}'} Get Help Now</button>
          <button onClick={()=>{setAuthRole('hero');setScreen('auth')}} style={{background:'transparent',color:C.accent,border:'none',fontSize:14,fontWeight:600,cursor:'pointer',marginTop:16,fontFamily:ff}}>Join the Hero Network {'\u2192'}</button>
        </div>
      </div>

      {/* How It Works */}
      <div style={{padding:'60px 24px',background:C.card}}>
        <div style={{textAlign:'center',marginBottom:40}}>
          <div style={{fontSize:11,letterSpacing:4,color:C.accent,fontWeight:800,marginBottom:8}}>HOW S.O.S WORKS</div>
          <h2 style={{fontSize:28,fontWeight:800,margin:0}}>Three Simple Steps</h2>
        </div>
        <div style={{...F('column','stretch','flex-start',16),maxWidth:440,margin:'0 auto'}}>
          {HOW_STEPS.map((s,i)=>(
            <div key={i} style={{...card,...F('row','flex-start','flex-start',16)}}>
              <div style={{width:48,height:48,borderRadius:14,background:`${C.accent}15`,fontSize:24,...F('row','center','center'),flexShrink:0}}>{s.icon}</div>
              <div><div style={{fontWeight:700,fontSize:16,marginBottom:4}}>{s.title}</div><div style={{fontSize:13,color:C.sub,lineHeight:1.5}}>{s.desc}</div></div>
            </div>
          ))}
        </div>
      </div>

      {/* All 8 Service Categories */}
      <div style={{padding:'60px 24px'}}>
        <div style={{textAlign:'center',marginBottom:40}}>
          <div style={{fontSize:11,letterSpacing:4,color:C.accent,fontWeight:800,marginBottom:8}}>OUR SERVICES</div>
          <h2 style={{fontSize:28,fontWeight:800,margin:'0 0 8px'}}>Everything Your Vehicle Needs</h2>
          <p style={{fontSize:14,color:C.sub,margin:0}}>8 categories, 40+ services, transparent pricing</p>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,maxWidth:440,margin:'0 auto'}}>
          {CATS.map(cat=>(
            <div key={cat.id} onClick={()=>setSelectedCat(selectedCat===cat.id?null:cat.id)} style={{...card,cursor:'pointer',textAlign:'center',border:selectedCat===cat.id?`2px solid ${cat.color}`:`1px solid ${C.border}`,transition:'all .2s'}}>
              <div style={{fontSize:28,marginBottom:8}}>{cat.icon}</div>
              <div style={{fontWeight:700,fontSize:14,marginBottom:4}}>{cat.name}</div>
              <div style={{fontSize:11,color:C.sub}}>{cat.services.length} services</div>
            </div>
          ))}
        </div>
        {selectedCat&&(()=>{const cat=CATS.find(c=>c.id===selectedCat);if(!cat)return null;return(
          <div style={{maxWidth:440,margin:'20px auto 0',background:C.card,borderRadius:16,overflow:'hidden',border:`1px solid ${cat.color}30`}}>
            <div style={{padding:'16px 20px',background:`${cat.color}10`,borderBottom:`1px solid ${cat.color}20`}}>
              <div style={{fontWeight:700,fontSize:16}}>{cat.icon} {cat.name}</div>
              <div style={{fontSize:12,color:C.sub,marginTop:2}}>{cat.desc}</div>
            </div>
            {cat.services.map((s,i)=>(
              <div key={i} style={{padding:'14px 20px',borderBottom:i<cat.services.length-1?`1px solid ${C.border}`:'none',...F('row','center','space-between')}}>
                <div><div style={{fontWeight:600,fontSize:14}}>{s.name}</div><div style={{fontSize:12,color:C.sub,marginTop:2}}>{s.desc}</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>ETA: {s.eta}</div></div>
                <div style={{fontWeight:700,fontSize:16,color:s.price==='Quote'?C.gold:C.accent,flexShrink:0,marginLeft:12}}>{s.price}</div>
              </div>
            ))}
          </div>
        );})()}
      </div>

      {/* Shield Plans */}
      <div style={{padding:'60px 24px',background:C.card}}>
        <div style={{textAlign:'center',marginBottom:40}}>
          <div style={{fontSize:11,letterSpacing:4,color:C.accent,fontWeight:800,marginBottom:8}}>SHIELD PLANS</div>
          <h2 style={{fontSize:28,fontWeight:800,margin:'0 0 8px'}}>Choose Your Protection</h2>
          <p style={{fontSize:14,color:C.sub,margin:0}}>Priority response, free tows, family coverage</p>
        </div>
        <div style={{...F('column','stretch','flex-start',16),maxWidth:440,margin:'0 auto'}}>
          {PLANS.map((p,i)=>(
            <div key={i} style={{...card,border:p.pop?`2px solid ${C.accent}`:`1px solid ${C.border}`,position:'relative'}}>
              {p.pop&&<div style={{position:'absolute',top:-10,right:16,background:C.accent,color:'#fff',fontSize:10,fontWeight:800,padding:'3px 10px',borderRadius:8,letterSpacing:1}}>POPULAR</div>}
              <div style={F('row','baseline','space-between')}>
                <div style={{fontWeight:700,fontSize:18,color:p.pop?C.accent:C.text}}>{p.name}</div>
                <div><span style={{fontWeight:800,fontSize:24}}>{p.price}</span><span style={{fontSize:12,color:C.sub}}>{p.per}</span></div>
              </div>
              <div style={{marginTop:12}}>
                {p.feats.map((f,j)=><div key={j} style={{fontSize:13,color:C.sub,padding:'4px 0',...F('row','center','flex-start',8)}}>
                  <span style={{color:C.green,fontSize:14}}>{'\u2713'}</span>{f}
                </div>)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Trust */}
      <div style={{padding:'60px 24px'}}>
        <div style={{textAlign:'center',marginBottom:32}}>
          <div style={{fontSize:11,letterSpacing:4,color:C.accent,fontWeight:800,marginBottom:8}}>YOUR SAFETY</div>
          <h2 style={{fontSize:28,fontWeight:800,margin:0}}>Verified Heroes Only</h2>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,maxWidth:440,margin:'0 auto'}}>
          {TRUST.map((t,i)=>(<div key={i} style={{...card,textAlign:'center'}}><div style={{fontSize:24,marginBottom:8}}>{t.icon}</div><div style={{fontWeight:700,fontSize:13,marginBottom:4}}>{t.label}</div><div style={{fontSize:11,color:C.sub}}>{t.desc}</div></div>))}
        </div>
      </div>

      {/* Testimonials */}
      <div style={{padding:'60px 24px',background:C.card}}>
        <div style={{textAlign:'center',marginBottom:32}}>
          <div style={{fontSize:11,letterSpacing:4,color:C.accent,fontWeight:800,marginBottom:8}}>WHAT CITIZENS SAY</div>
          <h2 style={{fontSize:28,fontWeight:800,margin:0}}>Real Rescue Stories</h2>
        </div>
        <div style={{...F('column','stretch','flex-start',16),maxWidth:440,margin:'0 auto'}}>
          {REVIEWS.map((r,i)=>(<div key={i} style={card}><div style={{fontSize:14,color:C.sub,lineHeight:1.6,fontStyle:'italic',marginBottom:12}}>"{r.text}"</div><div style={F('row','center','space-between')}><div><div style={{fontWeight:700,fontSize:14}}>{r.name}</div><div style={{fontSize:11,color:C.muted}}>{r.plan}</div></div><div style={{color:'#FFB347',fontSize:14}}>{'\u2605'.repeat(r.stars)}</div></div></div>))}
        </div>
      </div>

      {/* Final CTA */}
      <div style={{padding:'60px 24px',textAlign:'center'}}>
        <h2 style={{fontSize:28,fontWeight:800,margin:'0 0 12px'}}>Ready for Your <span style={{color:C.accent}}>Rescue</span>?</h2>
        <p style={{fontSize:14,color:C.sub,margin:'0 0 28px',maxWidth:300,marginLeft:'auto',marginRight:'auto'}}>Join thousands of citizens and heroes. Your safety net is one tap away.</p>
        <button onClick={()=>setScreen('auth')} style={btn(`linear-gradient(135deg,${C.accent},${C.accentDark})`,'#fff',{padding:'18px 48px',fontSize:17,borderRadius:16,width:'100%',maxWidth:320})}>Get Started Free</button>
      </div>
      <div style={{padding:'24px',textAlign:'center',borderTop:`1px solid ${C.border}`}}>
        <div style={{fontSize:11,color:C.muted}}>S.O.S {'\u2014'} Superheroes On Standby{'\u2122'} {'\u00B7'} The Kollective Hospitality Group</div>
      </div>
    </div>
  );

  /* ═══ AUTH ═══ */
  if(screen==='auth'){
    const validEmail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const canSubmit=validEmail&&pw.length>=8&&(authMode==='signin'||name.trim().length>=2);
    return(
    <div style={{...S,...F('column','center','flex-start'),padding:24}}>
      <div style={{width:'100%',maxWidth:400}}>
        <div style={{...F('row','center','space-between'),marginBottom:32}}>
          <button onClick={()=>setScreen('landing')} style={{background:'none',border:'none',color:C.sub,fontSize:14,cursor:'pointer',fontFamily:ff}}>{'\u2190'} Back</button>
          <div style={{fontWeight:900,fontSize:18}}>S.O.S</div>
          <div style={{width:50}}/>
        </div>
        <div style={{textAlign:'center',marginBottom:28}}>
          <div style={{width:60,height:60,borderRadius:16,background:`${authRole==='hero'?C.green:C.accent}15`,fontSize:28,...F('row','center','center'),margin:'0 auto 12px'}}>{authRole==='hero'?'\u{1F9B8}':'\u{1F198}'}</div>
          <h2 style={{fontSize:24,fontWeight:800,margin:'0 0 4px'}}>{authRole==='hero'?'Hero Portal':'Citizen Portal'}</h2>
          <p style={{fontSize:13,color:C.sub,margin:0}}>{authMode==='signup'?'Create your account':'Welcome back'}</p>
        </div>
        <div style={{...F('row','center','center',0),background:C.card2,borderRadius:12,padding:4,marginBottom:20}}>
          <button onClick={()=>setAuthRole('citizen')} style={{flex:1,padding:'10px',borderRadius:10,border:'none',cursor:'pointer',fontSize:13,fontWeight:700,fontFamily:ff,background:authRole==='citizen'?C.accent:'transparent',color:authRole==='citizen'?'#fff':C.sub}}>{'\u{1F198}'} Citizen</button>
          <button onClick={()=>setAuthRole('hero')} style={{flex:1,padding:'10px',borderRadius:10,border:'none',cursor:'pointer',fontSize:13,fontWeight:700,fontFamily:ff,background:authRole==='hero'?C.green:'transparent',color:authRole==='hero'?'#fff':C.sub}}>{'\u{1F9B8}'} Hero</button>
        </div>
        <div style={{...F('row','center','center',0),background:C.card2,borderRadius:12,padding:4,marginBottom:24}}>
          <button onClick={()=>{setAuthMode('signup');setErr('')}} style={{flex:1,padding:'10px',borderRadius:10,border:'none',cursor:'pointer',fontSize:13,fontWeight:700,fontFamily:ff,background:authMode==='signup'?C.card:'transparent',color:authMode==='signup'?C.text:C.sub}}>Sign Up</button>
          <button onClick={()=>{setAuthMode('signin');setErr('')}} style={{flex:1,padding:'10px',borderRadius:10,border:'none',cursor:'pointer',fontSize:13,fontWeight:700,fontFamily:ff,background:authMode==='signin'?C.card:'transparent',color:authMode==='signin'?C.text:C.sub}}>Sign In</button>
        </div>
        {authMode==='signup'&&<div style={{marginBottom:14}}><label style={{fontSize:12,color:C.sub,display:'block',marginBottom:6}}>Full Name</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" style={inp}/></div>}
        <div style={{marginBottom:14}}><label style={{fontSize:12,color:C.sub,display:'block',marginBottom:6}}>Email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@email.com" style={inp}/></div>
        <div style={{marginBottom:20}}><label style={{fontSize:12,color:C.sub,display:'block',marginBottom:6}}>Password</label><input type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="Min 8 characters" style={inp}/></div>
        {err&&<div style={{padding:'12px',background:'rgba(239,68,68,0.12)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:12,marginBottom:16,fontSize:13,color:C.red,fontWeight:600}}>{err}</div>}
        <button onClick={doAuth} disabled={!canSubmit||loading} style={btn(canSubmit&&!loading?(authRole==='hero'?C.green:`linear-gradient(135deg,${C.accent},${C.accentDark})`):'rgba(255,255,255,0.08)',canSubmit?'#fff':C.muted,{width:'100%',padding:'16px',fontSize:16,borderRadius:14,cursor:canSubmit&&!loading?'pointer':'not-allowed'})}>{loading?'...':(authMode==='signup'?'Create Account':'Sign In')}</button>
      </div>
    </div>
  );}

  /* ═══ CITIZEN DASHBOARD ═══ */
  if(screen==='citizen')return(
    <div style={{...S,padding:24}}>
      <div style={{...F('row','center','space-between'),marginBottom:24}}>
        <div><div style={{fontWeight:900,fontSize:20}}>S.O.S</div><div style={{fontSize:11,color:C.sub}}>Hi {session?.user?.user_metadata?.full_name?.split(' ')[0]||'Citizen'} {'\u{1F44B}'}</div></div>
        <button onClick={signOut} style={{background:'none',border:`1px solid ${C.border}`,color:C.sub,borderRadius:10,padding:'6px 14px',fontSize:12,cursor:'pointer',fontFamily:ff}}>Sign Out</button>
      </div>
      <div style={{textAlign:'center',marginBottom:28}}>
        <div onClick={()=>requestService(QUICK[0])} style={{width:100,height:100,borderRadius:'50%',background:`linear-gradient(135deg,${C.accent},${C.accentDark})`,margin:'0 auto 12px',cursor:'pointer',...F('row','center','center'),boxShadow:`0 0 40px ${C.accent}40`,fontSize:28,fontWeight:900,color:'#fff'}}>SOS</div>
        <div style={{fontSize:12,color:C.sub}}>Tap for Emergency Rescue</div>
      </div>
      <div style={{marginBottom:28}}>
        <div style={{fontWeight:700,fontSize:16,marginBottom:12}}>Quick Rescue</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
          {QUICK.map((s,i)=>(<div key={i} onClick={()=>requestService(s)} style={{...card,textAlign:'center',cursor:'pointer',padding:14}}><div style={{fontSize:24,marginBottom:4}}>{s.emoji}</div><div style={{fontWeight:600,fontSize:12}}>{s.name}</div><div style={{fontSize:14,fontWeight:700,color:C.accent,marginTop:4}}>${s.price}</div></div>))}
        </div>
      </div>
      <div style={{marginBottom:28}}>
        <div style={{fontWeight:700,fontSize:16,marginBottom:12}}>All Services</div>
        {CATS.map(cat=>(<div key={cat.id} style={{marginBottom:12}}>
          <div onClick={()=>setSelectedCat(selectedCat===cat.id?null:cat.id)} style={{...card,cursor:'pointer',...F('row','center','space-between')}}>
            <div style={F('row','center','flex-start',12)}>
              <div style={{width:40,height:40,borderRadius:12,background:`${cat.color}15`,fontSize:20,...F('row','center','center')}}>{cat.icon}</div>
              <div><div style={{fontWeight:700,fontSize:14}}>{cat.name}</div><div style={{fontSize:11,color:C.sub}}>{cat.services.length} services</div></div>
            </div>
            <span style={{color:C.sub,fontSize:16}}>{selectedCat===cat.id?'\u25BE':'\u25B8'}</span>
          </div>
          {selectedCat===cat.id&&(<div style={{background:C.card2,borderRadius:12,marginTop:4,overflow:'hidden'}}>
            {cat.services.map((s,i)=>(<div key={i} onClick={()=>requestService(s)} style={{padding:'12px 16px',borderBottom:i<cat.services.length-1?`1px solid ${C.border}`:'none',cursor:'pointer',...F('row','center','space-between')}}><div><div style={{fontWeight:600,fontSize:13}}>{s.name}</div><div style={{fontSize:11,color:C.sub}}>{s.desc} {'\u00B7'} {s.eta}</div></div><div style={{fontWeight:700,fontSize:14,color:s.price==='Quote'?C.gold:C.accent,flexShrink:0}}>{s.price}</div></div>))}
          </div>)}
        </div>))}
      </div>

      {dispatchPhase&&(<div style={{position:'fixed',inset:0,background:C.overlay,zIndex:999,...F('column','center','center'),padding:24}}>
        {dispatchPhase==='confirm'&&(<div style={{...card,width:'100%',maxWidth:360,textAlign:'center'}}>
          <div style={{fontSize:20,fontWeight:800,marginBottom:8}}>Confirm Service</div>
          <div style={{fontSize:16,fontWeight:600,color:C.accent,marginBottom:4}}>{selectedService?.name}</div>
          <div style={{fontSize:13,color:C.sub,marginBottom:4}}>{selectedService?.desc}</div>
          <div style={{fontSize:28,fontWeight:800,color:C.accent,margin:'16px 0'}}>{typeof selectedService?.price==='number'?`$${selectedService.price}`:selectedService?.price}</div>
          <div style={{fontSize:12,color:C.sub,marginBottom:20}}>ETA: {selectedService?.eta}</div>
          <button onClick={confirmDispatch} style={btn(`linear-gradient(135deg,${C.accent},${C.accentDark})`,'#fff',{width:'100%',padding:'16px',fontSize:16,borderRadius:14})}>{'\u{1F198}'} Dispatch Hero</button>
          <button onClick={()=>{setDispatchPhase(null);setSelectedService(null)}} style={{background:'none',border:'none',color:C.sub,marginTop:12,cursor:'pointer',fontSize:13,fontFamily:ff}}>Cancel</button>
        </div>)}
        {dispatchPhase==='finding'&&(<div style={{textAlign:'center'}}><div style={{width:80,height:80,borderRadius:'50%',background:`${C.accent}20`,margin:'0 auto 16px',...F('row','center','center'),fontSize:36}}>{'\u{1F9B8}'}</div><div style={{fontSize:20,fontWeight:800,marginBottom:8}}>Finding Your Hero...</div><div style={{fontSize:14,color:C.sub}}>Locating verified Heroes nearby</div></div>)}
        {dispatchPhase==='matched'&&(<div style={{textAlign:'center'}}><div style={{width:80,height:80,borderRadius:'50%',background:`${C.green}20`,margin:'0 auto 16px',...F('row','center','center'),fontSize:36}}>{'\u2705'}</div><div style={{fontSize:20,fontWeight:800,marginBottom:8,color:C.green}}>Hero Found!</div><div style={{fontSize:14,color:C.sub}}>Your hero is preparing to depart</div></div>)}
        {dispatchPhase==='tracking'&&(<div style={{...card,width:'100%',maxWidth:360,textAlign:'center'}}>
          <div style={{fontSize:18,fontWeight:800,marginBottom:4}}>Hero En Route {'\u{1F9B8}'}</div>
          <div style={{fontSize:14,color:C.sub,marginBottom:16}}>{selectedService?.name}</div>
          <div style={{width:120,height:120,borderRadius:'50%',background:`linear-gradient(135deg,${C.accent}20,${C.green}20)`,margin:'0 auto 16px',...F('row','center','center')}}>
            <div><div style={{fontSize:32,fontWeight:900,color:C.accent}}>{eta}</div><div style={{fontSize:11,color:C.sub}}>min ETA</div></div>
          </div>
          <div style={{background:C.card2,borderRadius:12,padding:14,marginBottom:16}}>
            <div style={{...F('row','center','space-between'),marginBottom:8}}><span style={{fontSize:12,color:C.sub}}>Live GPS tracking</span><span style={{fontSize:12,color:C.green}}>{'\u25CF'} Active</span></div>
            <div style={{height:4,background:C.border,borderRadius:2,overflow:'hidden'}}><div style={{width:'65%',height:'100%',background:`linear-gradient(90deg,${C.accent},${C.green})`,borderRadius:2}}/></div>
          </div>
          <button onClick={()=>{setDispatchPhase(null);setSelectedService(null);setSelectedCat(null)}} style={btn(C.green,'#fff',{width:'100%',padding:'14px',fontSize:14,borderRadius:12})}>Mission Complete {'\u2705'}</button>
        </div>)}
      </div>)}
    </div>
  );

  /* ═══ HERO DASHBOARD ═══ */
  if(screen==='hero')return(
    <div style={{...S,padding:24}}>
      <div style={{...F('row','center','space-between'),marginBottom:24}}>
        <div><div style={{fontWeight:900,fontSize:20}}>{'\u{1F9B8}'} Hero Portal</div><div style={{fontSize:11,color:C.sub}}>{session?.user?.user_metadata?.full_name||'Hero'}</div></div>
        <button onClick={signOut} style={{background:'none',border:`1px solid ${C.border}`,color:C.sub,borderRadius:10,padding:'6px 14px',fontSize:12,cursor:'pointer',fontFamily:ff}}>Sign Out</button>
      </div>
      <div style={{...card,marginBottom:20,...F('row','center','space-between')}}>
        <div><div style={{fontWeight:700,fontSize:15}}>On Patrol</div><div style={{fontSize:12,color:heroOnPatrol?C.green:C.sub}}>{heroOnPatrol?'Accepting missions':'Off duty'}</div></div>
        <div onClick={()=>setHeroOnPatrol(!heroOnPatrol)} style={{width:52,height:28,borderRadius:14,background:heroOnPatrol?C.green:C.border,cursor:'pointer',padding:2,transition:'all .3s'}}><div style={{width:24,height:24,borderRadius:12,background:'#fff',transform:heroOnPatrol?'translateX(24px)':'translateX(0)',transition:'all .3s'}}/></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:20}}>
        {[{l:'Missions',v:'0',c:C.accent},{l:'Rating',v:'5.0',c:C.gold},{l:'Earned',v:'$0',c:C.green}].map((s,i)=>(<div key={i} style={{...card,textAlign:'center',padding:14}}><div style={{fontSize:20,fontWeight:800,color:s.c}}>{s.v}</div><div style={{fontSize:11,color:C.sub}}>{s.l}</div></div>))}
      </div>
      <div style={{...F('row','center','flex-start',8),marginBottom:20,flexWrap:'wrap'}}>
        {['dashboard','history','earnings','profile'].map(t=>(<button key={t} onClick={()=>setHeroTab(t)} style={{background:heroTab===t?`${C.accent}20`:'transparent',border:heroTab===t?`1px solid ${C.accent}40`:`1px solid ${C.border}`,color:heroTab===t?C.accent:C.sub,borderRadius:10,padding:'8px 14px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:ff,textTransform:'capitalize'}}>{t}</button>))}
      </div>
      {heroTab==='dashboard'&&(<div style={{...card,textAlign:'center',padding:32}}>{heroOnPatrol?<><div style={{fontSize:36,marginBottom:12}}>{'\u{1F4E1}'}</div><div style={{fontWeight:700,fontSize:16,marginBottom:8}}>Scanning for Missions</div><div style={{fontSize:13,color:C.sub}}>You'll be notified when a citizen needs help nearby</div></>:<><div style={{fontSize:36,marginBottom:12}}>{'\u{1F634}'}</div><div style={{fontWeight:700,fontSize:16,marginBottom:8}}>Off Patrol</div><div style={{fontSize:13,color:C.sub}}>Toggle "On Patrol" to start accepting missions</div></>}</div>)}
      {heroTab==='history'&&<div style={{...card,textAlign:'center',padding:32}}><div style={{fontSize:36,marginBottom:8}}>{'\u{1F4CB}'}</div><div style={{fontWeight:700,fontSize:15}}>Mission History</div><div style={{fontSize:13,color:C.sub,marginTop:4}}>Completed missions appear here</div></div>}
      {heroTab==='earnings'&&<div style={{...card,textAlign:'center',padding:32}}><div style={{fontSize:36,marginBottom:8}}>{'\u{1F4B0}'}</div><div style={{fontWeight:700,fontSize:15}}>Earnings</div><div style={{fontSize:13,color:C.sub,marginTop:4}}>Track your earnings and payouts</div></div>}
      {heroTab==='profile'&&<div style={{...card,textAlign:'center',padding:32}}><div style={{fontSize:36,marginBottom:8}}>{'\u{1F9B8}'}</div><div style={{fontWeight:700,fontSize:15}}>{session?.user?.user_metadata?.full_name||'Hero'}</div><div style={{fontSize:13,color:C.sub,marginTop:4}}>{session?.user?.email}</div></div>}
    </div>
  );

  return null;
}
