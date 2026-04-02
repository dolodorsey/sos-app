'use client';
import { useState, useEffect, useCallback } from 'react';

/* ─── Supabase direct (avoid import issues with Next.js client) ─── */
const SB_URL = 'https://bpnaqrjhxsompkdskepi.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwbmFxcmpoeHNvbXBrZHNrZXBpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5OTkxNDUsImV4cCI6MjA4NzU3NTE0NX0.H16WVF7Vbu6SUQ3h7s1xdARvSj7PIyNGz5dDSGhRlQg';
const N8N = 'https://dorsey.app.n8n.cloud/webhook';

const sbAuth = async (endpoint, body) => {
  const r = await fetch(`${SB_URL}/auth/v1/${endpoint}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
    body: JSON.stringify(body),
  });
  const d = await r.json(); if (d.error || d.msg) throw new Error(d.error_description || d.msg || d.error || 'Auth failed'); return d;
};

const doSignUp = async (email, pw, name, role) => {
  const d = await sbAuth('signup', { email, password: pw, data: { full_name: name, role, app: 'sos' } });
  fetch(`${N8N}/sos-new-user`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, full_name: name, role, app: 'sos' }) }).catch(() => {});
  return d;
};
const doSignIn = async (email, pw) => sbAuth('token?grant_type=password', { email, password: pw });
const getStoredSession = () => {
  try { const s = localStorage.getItem('sos_session'); return s ? JSON.parse(s) : null; } catch { return null; }
};
const storeSession = (s) => { try { localStorage.setItem('sos_session', JSON.stringify(s)); } catch {} };
const clearSession = () => { try { localStorage.removeItem('sos_session'); } catch {} };

const createBooking = async (b, token) => {
  const r = await fetch(`${SB_URL}/rest/v1/bookings`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SB_KEY, Authorization: `Bearer ${token || SB_KEY}`, Prefer: 'return=representation' },
    body: JSON.stringify({ customer_id: b.customer_id, status: 'pending', address: b.address || 'GPS', total_price: b.total_price || 0 }),
  });
  fetch(`${N8N}/sos-service-request`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...b, app: 'sos' }) }).catch(() => {});
  return r.ok;
};

/* ─── SOS Dark Palette ─── */
const C = {
  bg:'#0a0a0a',card:'#141414',card2:'#1a1a1a',primary:'#FF6B35',red:'#ef4444',
  green:'#10b981',yellow:'#facc15',white:'#fff',text:'#f0f0f0',muted:'#666',
  gray:'#8a8a8a',grayLight:'#555',grayLighter:'#2a2a2a',border:'#222',teal:'#14b8a6',
};
const F = (d='row',a='center',j='center',g=0) => ({ display:'flex',flexDirection:d,alignItems:a,justifyContent:j,gap:g });
const btn = (bg,c='#fff',x) => ({ background:bg,color:c,border:'none',borderRadius:14,padding:'14px 28px',fontSize:16,fontWeight:700,cursor:'pointer',transition:'all .2s',fontFamily:'inherit',...x });
const card = { background:C.card,borderRadius:16,padding:20,border:`1px solid ${C.border}` };
const inp = { width:'100%',padding:'14px 16px',background:C.card2,border:`1px solid ${C.border}`,borderRadius:12,color:C.text,fontSize:14,outline:'none',boxSizing:'border-box',fontFamily:'inherit' };

/* ─── Services ─── */
const QUICK = [
  {name:'Flat Tire',emoji:'🛞',price:75,eta:'25 min',desc:'Tire change or patch'},
  {name:'Jump Start',emoji:'🔋',price:55,eta:'20 min',desc:'Dead battery jump'},
  {name:'Lockout',emoji:'🔑',price:65,eta:'20 min',desc:'Locked out of vehicle'},
  {name:'Tow Truck',emoji:'🚛',price:125,eta:'35 min',desc:'Vehicle towing'},
  {name:'Gas Delivery',emoji:'⛽',price:45,eta:'20 min',desc:'Emergency fuel'},
  {name:'Overheating',emoji:'🌡️',price:85,eta:'30 min',desc:'Coolant & diagnostics'},
];

const CATS = [
  { id:'roadside',name:'Roadside Emergency',icon:'🚨',color:'#FF6B35',services:[
    {name:'Flat Tire Change',desc:'Spare tire mount or patch',price:'$75',eta:'20-30 min'},
    {name:'Jump Start',desc:'Battery jump or replacement',price:'$55',eta:'15-25 min'},
    {name:'Lockout Service',desc:'Unlock your vehicle',price:'$65',eta:'15-25 min'},
    {name:'Tow Truck',desc:'Local or long-distance tow',price:'$125+',eta:'25-40 min'},
    {name:'Gas Delivery',desc:'Emergency fuel drop-off',price:'$45',eta:'15-25 min'},
    {name:'Overheating',desc:'Coolant top-off & diagnostics',price:'$85',eta:'25-35 min'},
    {name:'Stuck Vehicle',desc:'Winch out from mud/snow/ditch',price:'$95',eta:'30-45 min'},
  ]},
  { id:'maintenance',name:'Maintenance',icon:'🔧',color:'#14b8a6',services:[
    {name:'Oil Change',desc:'Full synthetic oil change',price:'$65',eta:'30-45 min'},
    {name:'Brake Inspection',desc:'Pad check & fluid top-off',price:'$45',eta:'20-30 min'},
    {name:'Battery Replace',desc:'New battery install',price:'$120',eta:'20-30 min'},
    {name:'Tire Rotation',desc:'All 4 tires rotated',price:'$40',eta:'25-35 min'},
    {name:'Fluid Top-Off',desc:'All fluids checked & filled',price:'$35',eta:'15-20 min'},
    {name:'Wiper Blades',desc:'New wiper blades installed',price:'$30',eta:'10-15 min'},
  ]},
  { id:'detailing',name:'Detailing',icon:'✨',color:'#8b5cf6',services:[
    {name:'Express Wash',desc:'Exterior wash & dry',price:'$35',eta:'30 min'},
    {name:'Interior Detail',desc:'Vacuum, wipe, freshen',price:'$75',eta:'45-60 min'},
    {name:'Full Detail',desc:'Complete in + out',price:'$150',eta:'90-120 min'},
    {name:'Ceramic Coating',desc:'Paint protection',price:'$250',eta:'2-3 hrs'},
    {name:'Headlight Restore',desc:'Clear yellowed lights',price:'$55',eta:'30-45 min'},
  ]},
  { id:'inspection',name:'Inspection',icon:'🔍',color:'#f59e0b',services:[
    {name:'Pre-Purchase',desc:'Full vehicle inspection',price:'$95',eta:'45-60 min'},
    {name:'Check Engine',desc:'OBD2 scan & diagnosis',price:'$55',eta:'20-30 min'},
    {name:'Emissions',desc:'Smog check prep',price:'$45',eta:'30-45 min'},
    {name:'AC Diagnostics',desc:'AC system check',price:'$75',eta:'30-45 min'},
    {name:'Tire Pressure',desc:'TPMS check & inflate',price:'$20',eta:'10-15 min'},
  ]},
  { id:'specialty',name:'Specialty',icon:'🏎️',color:'#ef4444',services:[
    {name:'Motorcycle Tow',desc:'Motorcycle transport',price:'$95',eta:'30-45 min'},
    {name:'RV/Trailer',desc:'Large vehicle service',price:'$175+',eta:'45-60 min'},
    {name:'Fleet Service',desc:'Multi-vehicle dispatch',price:'Quote',eta:'Scheduled'},
    {name:'Exotic Transport',desc:'Enclosed trailer',price:'$250+',eta:'Scheduled'},
  ]},
];

const PLANS = [
  {name:'Basic',price:'$0',per:'forever',feats:['Pay-as-you-go','Standard dispatch','GPS tracking','Email support'],pop:false},
  {name:'SOS+',price:'$7.99',per:'/mo',feats:['2 free assists/mo','Priority dispatch','Live GPS','24/7 line','15% off services'],pop:true},
  {name:'Unlimited',price:'$14.99',per:'/mo',feats:['Unlimited assists','VIP dispatch','GPS + ETA alerts','24/7 concierge','25% off all','Family (3 vehicles)','Free annual inspection'],pop:false},
];

const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const pwStr = p => { if(p.length<8)return{l:'Too short',c:C.red,w:20};let s=0;if(/[a-z]/.test(p))s++;if(/[A-Z]/.test(p))s++;if(/[0-9]/.test(p))s++;if(/[^a-zA-Z0-9]/.test(p))s++;return s<=1?{l:'Weak',c:'#f59e0b',w:40}:s===2?{l:'Fair',c:'#facc15',w:60}:s===3?{l:'Good',c:C.primary,w:80}:{l:'Strong',c:C.green,w:100}; };

/* ═══ MAIN ═══ */
export default function SOSApp() {
  const [screen,setScreen] = useState('landing');
  const [fade,setFade] = useState(true);
  const [userName,setUserName] = useState('');
  const [userId,setUserId] = useState('');
  const [token,setToken] = useState('');

  useEffect(() => {
    const s = getStoredSession();
    if (s?.access_token && s?.user) {
      setUserName(s.user.user_metadata?.full_name || s.user.email?.split('@')[0] || 'Driver');
      setUserId(s.user.id); setToken(s.access_token);
      setScreen(s.user.user_metadata?.role === 'provider' ? 'hero' : 'driver');
    }
  }, []);

  const nav = useCallback(s => { setFade(false); setTimeout(() => { setScreen(s); setFade(true); window.scrollTo(0,0); }, 200); }, []);

  const handleSignOut = () => { clearSession(); setUserName(''); setUserId(''); setToken(''); nav('landing'); };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,700;9..40,800;9..40,900&family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
        @keyframes rise{0%{opacity:0;transform:translateY(24px)}100%{opacity:1;transform:translateY(0)}}
        @keyframes pop{0%{opacity:0;transform:scale(.85)}100%{opacity:1;transform:scale(1)}}
        @keyframes slideUp{0%{opacity:0;transform:translateY(40px)}100%{opacity:1;transform:translateY(0)}}
        @keyframes pulseGlow{0%,100%{box-shadow:0 0 20px rgba(255,107,53,0.3)}50%{box-shadow:0 0 40px rgba(255,107,53,0.6)}}
        @keyframes pulseRing{0%{transform:scale(1);opacity:1}100%{transform:scale(1.5);opacity:0}}
        @keyframes bounceIn{0%{transform:scale(0)}50%{transform:scale(1.2)}100%{transform:scale(1)}}
        .rise{animation:rise .5s ease-out both}.pop{animation:pop .4s cubic-bezier(.34,1.56,.64,1) both}.slideUp{animation:slideUp .6s ease-out both}
        body{margin:0;background:#0a0a0a}*{box-sizing:border-box}::-webkit-scrollbar{display:none}
      `}</style>
      <div style={{ maxWidth:430,margin:'0 auto',minHeight:'100dvh',background:C.bg,fontFamily:"'DM Sans',sans-serif",color:C.text,position:'relative',overflow:'hidden',opacity:fade?1:0,transition:'opacity .2s' }}>
        {screen==='landing' && <Landing onHelp={()=>nav('auth-driver')} onHero={()=>nav('auth-hero')} />}
        {screen==='auth-driver' && <Auth role="driver" onBack={()=>nav('landing')} onOk={(n,id,tk)=>{ setUserName(n);setUserId(id);setToken(tk);nav('driver'); }} />}
        {screen==='auth-hero' && <Auth role="hero" onBack={()=>nav('landing')} onOk={(n,id,tk)=>{ setUserName(n);setUserId(id);setToken(tk);nav('hero'); }} />}
        {screen==='driver' && <DriverApp userName={userName} userId={userId} token={token} onBack={handleSignOut} />}
        {screen==='hero' && <HeroDash userName={userName} onBack={handleSignOut} />}
      </div>
    </>
  );
}

/* ═══ AUTH ═══ */
function Auth({role,onBack,onOk}) {
  const [mode,setMode]=useState('signin');
  const [email,setEmail]=useState('');const [pw,setPw]=useState('');const [name,setName]=useState('');
  const [t,setT]=useState({});const [loading,setLoading]=useState(false);const [err,setErr]=useState('');
  const isDr=role==='driver'; const accent=isDr?C.primary:C.green;
  const eErr=t.email&&!validEmail(email)?'Enter valid email':'';
  const pErr=t.pw&&pw.length>0&&pw.length<8?'Min 8 characters':'';
  const nErr=t.name&&mode==='signup'&&name.trim().length<2?'Name required':'';
  const pi=pw.length>0?pwStr(pw):null;
  const ok=validEmail(email)&&pw.length>=8&&(mode==='signin'||name.trim().length>=2);

  const go = async () => {
    if(!ok||loading)return; setLoading(true); setErr('');
    try {
      if(mode==='signup') {
        await doSignUp(email,pw,name.trim(),isDr?'customer':'provider');
        const d = await doSignIn(email,pw);
        storeSession(d); onOk(name.trim()||email.split('@')[0], d.user?.id||'', d.access_token||'');
      } else {
        const d = await doSignIn(email,pw);
        storeSession(d); onOk(d.user?.user_metadata?.full_name||email.split('@')[0], d.user?.id||'', d.access_token||'');
      }
    } catch(e) {
      let m=e.message||'Failed';
      if(m.includes('Invalid login'))m='Invalid email or password';
      if(m.includes('already registered'))m='Email registered. Try signing in.';
      setErr(m);
    } finally { setLoading(false); }
  };

  return (
    <div style={{minHeight:'100dvh',background:C.bg,...F('column','stretch','flex-start')}}>
      <div style={{padding:'16px 20px',...F('row','center','space-between')}}>
        <button onClick={onBack} style={{background:'transparent',border:'none',color:C.gray,fontSize:14,cursor:'pointer',fontWeight:600,fontFamily:'inherit'}}>← Back</button>
        <div style={{fontWeight:900,fontSize:16,color:C.primary,letterSpacing:1,fontFamily:"'Outfit',sans-serif"}}>SOS</div>
        <div style={{width:50}}/>
      </div>
      <div style={{flex:1,...F('column','center','center'),padding:'40px 24px'}}>
        <div style={{width:80,height:80,borderRadius:20,background:`${accent}15`,...F('row','center','center'),fontSize:40,marginBottom:20}}>{isDr?'🚗':'🦸'}</div>
        <h1 style={{fontSize:24,fontWeight:800,color:C.text,margin:'0 0 4px'}}>{isDr?'Driver Account':'Hero Portal'}</h1>
        <p style={{fontSize:14,color:C.muted,margin:'0 0 32px'}}>{isDr?'Roadside help in minutes':'Join the SOS network'}</p>
        <div style={{...F('row','center','center',0),width:'100%',marginBottom:28,background:C.card2,borderRadius:12,padding:4,border:`1px solid ${C.border}`}}>
          {['signin','signup'].map(m=>(
            <button key={m} onClick={()=>{setMode(m);setT({});}} style={{flex:1,padding:'10px 0',borderRadius:10,border:'none',cursor:'pointer',fontSize:14,fontWeight:700,background:mode===m?accent:'transparent',color:mode===m?C.white:C.muted,transition:'all .2s',fontFamily:'inherit'}}>{m==='signin'?'Sign In':'Create Account'}</button>
          ))}
        </div>
        <div style={{width:'100%',maxWidth:360}}>
          {mode==='signup'&&<div style={{marginBottom:16}}><label style={{fontSize:12,color:C.gray,fontWeight:600,marginBottom:6,display:'block'}}>Full Name</label><input value={name} onChange={e=>setName(e.target.value)} onBlur={()=>setT(x=>({...x,name:true}))} placeholder="Your full name" style={{...inp,borderColor:nErr?C.red:C.border}}/>{nErr&&<div style={{fontSize:12,color:C.red,marginTop:4}}>{nErr}</div>}</div>}
          <div style={{marginBottom:16}}><label style={{fontSize:12,color:C.gray,fontWeight:600,marginBottom:6,display:'block'}}>Email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} onBlur={()=>setT(x=>({...x,email:true}))} placeholder="you@example.com" style={{...inp,borderColor:eErr?C.red:C.border}}/>{eErr&&<div style={{fontSize:12,color:C.red,marginTop:4}}>{eErr}</div>}</div>
          <div style={{marginBottom:8}}><label style={{fontSize:12,color:C.gray,fontWeight:600,marginBottom:6,display:'block'}}>Password</label><input type="password" value={pw} onChange={e=>setPw(e.target.value)} onBlur={()=>setT(x=>({...x,pw:true}))} placeholder="••••••••" style={{...inp,borderColor:pErr?C.red:C.border}}/>{pErr&&<div style={{fontSize:12,color:C.red,marginTop:4}}>{pErr}</div>}</div>
          {pi&&<div style={{marginBottom:20}}><div style={{height:4,background:C.grayLighter,borderRadius:2,overflow:'hidden',marginBottom:4}}><div style={{height:'100%',width:`${pi.w}%`,background:pi.c,borderRadius:2,transition:'all .3s'}}/></div><div style={{fontSize:11,color:pi.c,fontWeight:600}}>{pi.l}</div></div>}
          {!pi&&<div style={{height:16,marginBottom:8}}/>}
          {err&&<div style={{padding:'12px 16px',background:`${C.red}15`,border:`1px solid ${C.red}30`,borderRadius:12,marginBottom:16}}><div style={{fontSize:13,color:C.red,fontWeight:600}}>{err}</div></div>}
          <button onClick={go} disabled={!ok||loading} style={{...btn(accent),width:'100%',fontSize:16,marginBottom:16,opacity:(ok&&!loading)?1:0.4,cursor:(ok&&!loading)?'pointer':'not-allowed'}}>{loading?'...':mode==='signin'?'Sign In':'Create Account'}</button>
        </div>
        <div style={{...F('row','center','center',12),width:'100%',maxWidth:360,margin:'24px 0'}}><div style={{flex:1,height:1,background:C.border}}/><span style={{fontSize:12,color:C.muted}}>or continue with</span><div style={{flex:1,height:1,background:C.border}}/></div>
        <div style={{...F('row','center','center',12),width:'100%',maxWidth:360}}>
          {['Google','Apple'].map(p=><button key={p} onClick={()=>onOk(p+' User','','')} style={{flex:1,padding:'12px 0',background:C.card,border:`1px solid ${C.border}`,borderRadius:12,color:C.text,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>{p==='Google'?'🔵':'🍎'} {p}</button>)}
        </div>
        <p style={{fontSize:11,color:C.grayLight,marginTop:32,textAlign:'center',maxWidth:300}}>By continuing, you agree to SOS Terms of Service and Privacy Policy.</p>
      </div>
    </div>
  );
}

/* ═══ LANDING ═══ */
function Landing({onHelp,onHero}) {
  return (
    <div>
      <nav style={{position:'sticky',top:0,zIndex:50,background:'rgba(10,10,10,0.95)',backdropFilter:'blur(12px)',borderBottom:`1px solid ${C.border}`,padding:'12px 20px',...F('row','center','space-between')}}>
        <div style={F('row','center','flex-start',8)}>
          <div style={{width:36,height:36,borderRadius:10,background:`linear-gradient(135deg,${C.primary},${C.red})`,...F('row','center','center'),fontWeight:900,fontSize:11,color:C.white,fontFamily:"'Outfit',sans-serif"}}>SOS</div>
          <div><div style={{fontWeight:800,fontSize:16,color:C.text,fontFamily:"'Outfit',sans-serif"}}>SOS</div><div style={{fontSize:9,color:C.muted,letterSpacing:0.5}}>Superheroes On Standby</div></div>
        </div>
        <div style={F('row','center','flex-end',8)}>
          <button onClick={onHelp} style={{background:'transparent',border:`1px solid ${C.border}`,color:C.gray,borderRadius:10,padding:'8px 14px',fontSize:12,cursor:'pointer',fontWeight:600,fontFamily:'inherit'}}>Sign In</button>
          <button onClick={onHero} style={{background:C.card,border:`1px solid ${C.border}`,color:C.green,borderRadius:10,padding:'8px 14px',fontSize:12,cursor:'pointer',fontWeight:600,fontFamily:'inherit'}}>Hero Portal</button>
        </div>
      </nav>
      <section className="rise" style={{padding:'60px 24px 40px',textAlign:'center',background:`radial-gradient(ellipse at 50% 0%,rgba(255,107,53,0.08) 0%,transparent 60%)`}}>
        <div style={{display:'inline-block',fontSize:10,color:C.primary,fontWeight:700,letterSpacing:3,marginBottom:12,background:`${C.primary}12`,padding:'6px 16px',borderRadius:20}}>ROADSIDE ASSISTANCE SUPER APP</div>
        <h1 style={{fontSize:48,fontWeight:900,color:C.text,margin:'12px 0 0',letterSpacing:-1,lineHeight:1.05,fontFamily:"'Outfit',sans-serif"}}>SOS</h1>
        <p style={{fontSize:14,color:C.primary,margin:'4px 0',fontWeight:600,letterSpacing:2}}>SUPERHEROES ON STANDBY</p>
        <p style={{fontSize:15,color:C.muted,margin:'8px 0 32px'}}>Stranded? Locked out? One tap. Help arrives.</p>
        <div className="slideUp" style={{...F('column','center','center',12)}}>
          <button onClick={onHelp} style={{...btn(`linear-gradient(135deg,${C.primary},${C.red})`),width:'100%',maxWidth:280,fontSize:18,padding:'16px 32px',boxShadow:`0 8px 30px ${C.primary}30`,borderRadius:16,animation:'pulseGlow 3s ease-in-out infinite'}}>🚨 Get Help Now</button>
          <button onClick={onHero} style={{...btn('transparent',C.text,{border:`2px solid ${C.border}`,width:'100%',maxWidth:280,borderRadius:16})}}>🦸 Become a Hero</button>
        </div>
        <div style={{...F('row','center','center',20),marginTop:32,flexWrap:'wrap'}}>
          {[['⚡','Avg 22min'],['⭐','4.9 Rating'],['🛡️','Vetted Heroes']].map(([i,l])=><div key={l} style={{...F('row','center','center',6),fontSize:12,color:C.gray}}><span style={{color:C.green}}>{i}</span>{l}</div>)}
        </div>
      </section>
      <section style={{padding:'48px 24px',borderTop:`1px solid ${C.border}`}}>
        <h2 style={{fontSize:24,fontWeight:800,textAlign:'center',margin:'0 0 32px'}}>Roadside Services</h2>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          {QUICK.map((s,i)=><div key={s.name} className="pop" style={{...card,textAlign:'center',padding:20,animationDelay:`${i*.08}s`}}><div style={{fontSize:32,marginBottom:8}}>{s.emoji}</div><div style={{fontSize:14,fontWeight:700,marginBottom:2}}>{s.name}</div><div style={{fontSize:11,color:C.muted,marginBottom:6}}>{s.desc}</div><div style={{fontSize:18,fontWeight:800,color:C.primary}}>${s.price}</div><div style={{fontSize:11,color:C.muted,marginTop:4}}>~{s.eta}</div></div>)}
        </div>
      </section>
      <section style={{padding:'48px 24px',borderTop:`1px solid ${C.border}`}}>
        <h2 style={{fontSize:24,fontWeight:800,textAlign:'center',margin:'0 0 32px'}}>Plans</h2>
        {PLANS.map(p=><div key={p.name} style={{...card,marginBottom:16,border:`1px solid ${p.pop?C.primary:C.border}`,position:'relative',overflow:'hidden'}}>
          {p.pop&&<div style={{position:'absolute',top:12,right:-30,background:`linear-gradient(135deg,${C.primary},${C.red})`,color:C.white,fontSize:10,fontWeight:800,padding:'4px 36px',transform:'rotate(45deg)',letterSpacing:1}}>POPULAR</div>}
          <div style={{fontSize:18,fontWeight:800,marginBottom:4}}>{p.name}</div>
          <div style={{...F('row','baseline','flex-start',4),marginBottom:12}}><span style={{fontSize:32,fontWeight:900,color:p.pop?C.primary:C.text}}>{p.price}</span><span style={{fontSize:13,color:C.muted}}>{p.per}</span></div>
          {p.feats.map(f=><div key={f} style={{...F('row','center','flex-start',8),marginBottom:8}}><span style={{color:C.green,fontSize:14}}>✓</span><span style={{fontSize:13,color:C.gray}}>{f}</span></div>)}
          <button onClick={onHelp} style={{...btn(p.pop?`linear-gradient(135deg,${C.primary},${C.red})`:C.card2,p.pop?C.white:C.text,{width:'100%',marginTop:12,border:p.pop?'none':`1px solid ${C.border}`})}}>{p.price==='$0'?'Get Started Free':'Subscribe'}</button>
        </div>)}
      </section>
      <section style={{padding:'48px 24px',borderTop:`1px solid ${C.border}`,textAlign:'center',background:`radial-gradient(ellipse at 50% 100%,rgba(16,185,129,0.06) 0%,transparent 60%)`}}>
        <div style={{fontSize:48,marginBottom:16}}>🦸</div>
        <h2 style={{fontSize:24,fontWeight:800,margin:'0 0 8px'}}>Become an SOS Hero</h2>
        <p style={{fontSize:14,color:C.gray,margin:'0 0 24px',maxWidth:320,marginLeft:'auto',marginRight:'auto',lineHeight:1.6}}>Earn money helping stranded drivers. Flexible hours, instant payouts.</p>
        <button onClick={onHero} style={{...btn(C.green),fontSize:16,padding:'14px 40px',borderRadius:16}}>Apply Now</button>
      </section>
      <footer style={{padding:'32px 24px',borderTop:`1px solid ${C.border}`,textAlign:'center'}}>
        <div style={{fontWeight:900,fontSize:18,color:C.primary,fontFamily:"'Outfit',sans-serif"}}>SOS</div>
        <div style={{fontSize:11,color:C.muted,marginBottom:4}}>Superheroes On Standby</div>
        <div style={{fontSize:11,color:C.grayLight}}>© 2026 SOS · KHG</div>
      </footer>
    </div>
  );
}

/* ═══ DRIVER APP ═══ */
function DriverApp({userName,userId,token,onBack}) {
  const [tab,setTab]=useState('home');
  const [selSvc,setSelSvc]=useState(null);
  const [step,setStep]=useState(null);
  const [eta,setEta]=useState(1320);

  useEffect(()=>{if(step!=='tracking')return;const t=setInterval(()=>setEta(p=>Math.max(0,p-1)),1000);return()=>clearInterval(t);},[step]);

  const startReq=s=>{setSelSvc(s);setStep('confirm');};
  const dispatch=()=>{
    setStep('finding');
    if(userId&&selSvc)createBooking({customer_id:userId,service_name:selSvc.name,address:'GPS',total_price:selSvc.price||0},token).catch(()=>{});
    setTimeout(()=>setStep('found'),3000);
  };
  const track=()=>{setEta(1320);setStep('tracking');};
  const cancel=()=>{setStep(null);setSelSvc(null);};
  const fmtEta=s=>`${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;

  if(step==='confirm'&&selSvc)return(
    <div style={{minHeight:'100dvh',background:C.bg,...F('column','stretch','flex-start')}}>
      <div style={{padding:'16px 20px',...F('row','center','space-between')}}><button onClick={cancel} style={{background:'transparent',border:'none',color:C.gray,fontSize:14,cursor:'pointer',fontWeight:600,fontFamily:'inherit'}}>← Cancel</button><div style={{fontSize:14,fontWeight:700}}>Confirm</div><div style={{width:50}}/></div>
      <div style={{flex:1,...F('column','center','center'),padding:'40px 24px'}}>
        <div style={{fontSize:64,marginBottom:20}}>{selSvc.emoji}</div>
        <h2 style={{fontSize:28,fontWeight:900,margin:'0 0 8px'}}>{selSvc.name}</h2>
        <p style={{fontSize:13,color:C.muted,margin:'0 0 24px'}}>{selSvc.desc}</p>
        <div style={{...card,width:'100%',marginBottom:24}}>
          <div style={{...F('row','center','space-between'),marginBottom:12}}><span style={{color:C.gray}}>Price</span><span style={{fontSize:20,fontWeight:900,color:C.primary}}>${selSvc.price}</span></div>
          <div style={{...F('row','center','space-between'),marginBottom:12}}><span style={{color:C.gray}}>ETA</span><span style={{fontWeight:700}}>~{selSvc.eta}</span></div>
          <div style={{...F('row','center','space-between')}}><span style={{color:C.gray}}>Fee</span><span style={{color:C.muted}}>$0.00</span></div>
        </div>
        <div style={{width:'100%',padding:'16px 20px',background:`${C.primary}10`,borderRadius:14,marginBottom:24,...F('row','center','flex-start',10)}}><span style={{fontSize:18}}>📍</span><div><div style={{fontSize:13,fontWeight:600}}>Your location</div><div style={{fontSize:11,color:C.muted}}>GPS auto-detected</div></div></div>
        <button onClick={dispatch} style={{...btn(`linear-gradient(135deg,${C.primary},${C.red})`),width:'100%',fontSize:18,padding:'18px',boxShadow:`0 8px 30px ${C.primary}25`,borderRadius:16}}>🚨 Dispatch Hero</button>
      </div>
    </div>
  );

  if(step==='finding')return(
    <div style={{minHeight:'100dvh',background:C.bg,...F('column','center','center'),padding:40}}>
      <div style={{position:'relative',width:160,height:160,marginBottom:40}}>
        {[0,20,40].map((ins,i)=><div key={i} style={{position:'absolute',inset:ins,borderRadius:'50%',border:`2px solid ${C.primary}${30+i*20}`,animation:`pulseRing 2s ease-out infinite ${i*.5}s`}}/>)}
        <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',width:40,height:40,borderRadius:'50%',background:`linear-gradient(135deg,${C.primary},${C.red})`,boxShadow:`0 0 30px ${C.primary}40`,...F('row','center','center')}}><span style={{fontSize:20}}>🚨</span></div>
      </div>
      <div style={{fontSize:22,fontWeight:800,marginBottom:8}}>Dispatching Hero...</div>
      <div style={{fontSize:14,color:C.gray}}>Finding nearest roadside hero</div>
    </div>
  );

  if(step==='found')return(
    <div style={{minHeight:'100dvh',background:C.bg,...F('column','center','center'),padding:24}}>
      <div style={{fontSize:48,marginBottom:16,animation:'bounceIn .5s ease'}}>🦸</div>
      <h2 style={{fontSize:24,fontWeight:900,margin:'0 0 8px'}}>Hero Matched!</h2>
      <p style={{fontSize:14,color:C.gray,margin:'0 0 24px'}}>On the way to you</p>
      <div style={{...card,width:'100%',maxWidth:360}}>
        <div style={{...F('row','center','flex-start',16),marginBottom:20}}>
          <div style={{width:64,height:64,borderRadius:16,background:`${C.primary}15`,...F('row','center','center'),fontSize:32}}>🦸</div>
          <div><div style={{fontSize:20,fontWeight:800}}>Marcus T.</div><div style={{fontSize:13,color:C.yellow}}>⭐ 4.9 · 478 rescues</div></div>
        </div>
        {[['ETA','~22 min'],['Vehicle','Ford F-150 · White'],['Service',selSvc?.name]].map(([l,v])=><div key={l} style={{...F('row','center','space-between'),padding:'12px 0',borderTop:`1px solid ${C.border}`}}><span style={{fontSize:13,color:C.gray}}>{l}</span><span style={{fontSize:13,fontWeight:600}}>{v}</span></div>)}
      </div>
      <button onClick={track} style={{...btn(C.primary),width:'100%',maxWidth:360,fontSize:16,marginTop:24,borderRadius:16}}>Track My Hero →</button>
    </div>
  );

  if(step==='tracking')return(
    <div style={{minHeight:'100dvh',background:C.bg,...F('column','stretch','flex-start')}}>
      <div style={{padding:'16px 20px',...F('row','center','space-between')}}><button onClick={cancel} style={{background:'transparent',border:'none',color:C.gray,fontSize:14,cursor:'pointer',fontFamily:'inherit'}}>✕</button><div style={{fontSize:14,fontWeight:700,color:C.primary}}>Hero En Route</div><div style={{width:40}}/></div>
      <div style={{flex:1,minHeight:300,background:C.card,margin:'0 20px',borderRadius:20,position:'relative',overflow:'hidden',...F('column','center','center'),border:`1px solid ${C.border}`}}>
        <div style={{position:'absolute',inset:0,backgroundImage:`linear-gradient(${C.grayLighter} 1px,transparent 1px),linear-gradient(90deg,${C.grayLighter} 1px,transparent 1px)`,backgroundSize:'40px 40px',opacity:0.3}}/>
        <div style={{width:200,height:200,borderRadius:'50%',border:`2px dashed ${C.grayLighter}`,position:'absolute',...F('column','center','center')}}><div style={{width:120,height:120,borderRadius:'50%',border:`2px dashed ${C.grayLighter}`,position:'absolute',...F('column','center','center')}}><div style={{width:16,height:16,borderRadius:'50%',background:C.primary,boxShadow:`0 0 20px ${C.primary}60`}}/></div></div>
        <div style={{position:'absolute',top:20,right:20,width:12,height:12,borderRadius:'50%',background:C.green,boxShadow:`0 0 12px ${C.green}`}}/>
        <div style={{position:'absolute',bottom:16,left:16,background:'rgba(10,10,10,0.9)',borderRadius:10,padding:'8px 12px',fontSize:11,color:C.gray,border:`1px solid ${C.border}`}}>📍 Live GPS</div>
      </div>
      <div style={{padding:20}}>
        <div style={{...card,...F('row','center','space-between'),marginBottom:16}}>
          <div style={F('row','center','flex-start',12)}><div style={{width:48,height:48,borderRadius:14,background:`${C.primary}15`,...F('row','center','center'),fontSize:24}}>🦸</div><div><div style={{fontSize:16,fontWeight:700}}>Marcus T.</div><div style={{fontSize:12,color:C.muted}}>⭐ 4.9</div></div></div>
          <div style={{textAlign:'right'}}><div style={{fontSize:24,fontWeight:900,color:C.primary,fontVariantNumeric:'tabular-nums'}}>{fmtEta(eta)}</div><div style={{fontSize:10,color:C.muted}}>ETA</div></div>
        </div>
        <div style={F('row','center','center',12)}>
          <button style={{...btn(C.card,C.text,{flex:1,border:`1px solid ${C.border}`})}}>📞 Call</button>
          <button style={{...btn(C.card,C.text,{flex:1,border:`1px solid ${C.border}`})}}>💬 Msg</button>
          <button onClick={cancel} style={{...btn(C.card,C.red,{flex:1,border:`1px solid ${C.red}30`})}}>Cancel</button>
        </div>
      </div>
    </div>
  );

  /* ── Services drill-down ── */
  const Svcs=()=>{
    const[ac,setAc]=useState(null);const[ss,setSs]=useState(null);
    const ct=ac?CATS.find(c=>c.id===ac):null;
    if(ct)return(<div style={{padding:20}}><button onClick={()=>{setAc(null);setSs(null);}} style={{background:'none',border:'none',color:C.gray,cursor:'pointer',fontSize:14,fontFamily:'inherit',marginBottom:16}}>‹ All Services</button>
      <div style={{...F('row','center','flex-start',10),marginBottom:20}}><div style={{width:44,height:44,borderRadius:14,background:`${ct.color}15`,...F('row','center','center'),fontSize:24}}>{ct.icon}</div><div><div style={{fontSize:18,fontWeight:800}}>{ct.name}</div><div style={{fontSize:12,color:C.muted}}>{ct.services.length} services</div></div></div>
      {ct.services.map((s,i)=>{const sel=ss===s.name;return(
        <button key={s.name} onClick={()=>setSs(sel?null:s.name)} style={{...card,width:'100%',textAlign:'left',cursor:'pointer',border:sel?`2px solid ${ct.color}`:`1px solid ${C.border}`,marginBottom:10,fontFamily:'inherit',transition:'all .2s'}}>
          <div style={F('row','center','space-between')}><div style={{flex:1}}><div style={{fontSize:14,fontWeight:700}}>{s.name}</div><div style={{fontSize:12,color:C.muted,marginTop:2}}>{s.desc}</div></div><div style={{textAlign:'right',marginLeft:12}}><div style={{fontSize:14,fontWeight:800,color:s.price==='Quote'?'#f59e0b':C.primary}}>{s.price}</div><div style={{fontSize:11,color:C.muted}}>⏱ {s.eta}</div></div></div>
        </button>);})}
      {ss&&<button onClick={()=>{const svc=ct.services.find(x=>x.name===ss);startReq({name:svc.name,emoji:ct.icon,price:parseInt((svc.price||'0').replace(/\D/g,''))||0,eta:svc.eta,desc:svc.desc});}} style={{...btn(`linear-gradient(135deg,${C.primary},${C.red})`),width:'100%',marginTop:20,padding:'16px',fontSize:15,borderRadius:16,boxShadow:`0 8px 30px ${C.primary}25`}}>🚨 REQUEST NOW</button>}
    </div>);
    return(<div style={{padding:20}}><h2 style={{fontSize:20,fontWeight:800,marginBottom:4}}>All Services</h2><p style={{fontSize:13,color:C.muted,marginBottom:20}}>50+ roadside & car services</p>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        {CATS.map((c,i)=><button key={c.id} className="pop" onClick={()=>setAc(c.id)} style={{...card,textAlign:'left',cursor:'pointer',borderLeft:`3px solid ${c.color}`,animationDelay:`${i*.06}s`,fontFamily:'inherit'}}><div style={{fontSize:28,marginBottom:8}}>{c.icon}</div><div style={{fontSize:13,fontWeight:700}}>{c.name}</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>{c.services.length} services</div></button>)}
      </div>
    </div>);
  };

  return(
    <div style={{minHeight:'100dvh',background:C.bg,paddingBottom:80}}>
      <div style={{padding:'16px 20px',...F('row','center','space-between')}}>
        <div style={F('row','center','flex-start',10)}>
          <div style={{width:32,height:32,borderRadius:8,background:`linear-gradient(135deg,${C.primary},${C.red})`,...F('row','center','center'),fontWeight:900,fontSize:9,color:C.white,fontFamily:"'Outfit',sans-serif"}}>SOS</div>
          <div><div style={{fontSize:14,fontWeight:700}}>Hi, {userName||'Driver'} 👋</div><div style={{fontSize:11,color:C.muted}}>Basic Member</div></div>
        </div>
        <div style={{width:40,height:40,borderRadius:12,background:C.card,border:`1px solid ${C.border}`,...F('row','center','center'),fontSize:18}}>🔔</div>
      </div>

      {tab==='home'&&<div>
        <div style={{margin:'0 20px',height:200,background:C.card,borderRadius:20,position:'relative',overflow:'hidden',...F('column','center','center'),border:`1px solid ${C.border}`}}>
          <div style={{position:'absolute',inset:0,backgroundImage:`linear-gradient(${C.grayLighter} 1px,transparent 1px),linear-gradient(90deg,${C.grayLighter} 1px,transparent 1px)`,backgroundSize:'40px 40px',opacity:0.3}}/>
          <div style={{position:'relative',width:16,height:16,borderRadius:'50%',background:C.primary,boxShadow:`0 0 20px ${C.primary}60`}}/>
          <div style={{position:'absolute',bottom:12,left:12,background:'rgba(10,10,10,0.9)',borderRadius:10,padding:'6px 10px',fontSize:11,color:C.gray,border:`1px solid ${C.border}`}}>📍 Your location</div>
        </div>
        <div style={{...F('column','center','center'),padding:'20px 20px 12px'}}>
          <button onClick={()=>startReq(QUICK[0])} style={{width:140,height:140,borderRadius:'50%',background:`linear-gradient(135deg,${C.primary},${C.red})`,border:'none',color:C.white,fontSize:15,fontWeight:900,cursor:'pointer',boxShadow:`0 8px 40px ${C.primary}35`,animation:'pulseGlow 3s ease-in-out infinite',fontFamily:"'Outfit',sans-serif"}}>🚨<br/>SOS<br/><span style={{fontSize:11,fontWeight:600}}>Get Help</span></button>
        </div>
        <div style={{padding:'8px 20px'}}><div style={{fontSize:15,fontWeight:700,marginBottom:12}}>Quick Services</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
            {QUICK.map((s,i)=><button key={s.name} className="pop" onClick={()=>startReq(s)} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:'14px 8px',cursor:'pointer',textAlign:'center',animationDelay:`${i*.07}s`,fontFamily:'inherit'}}><div style={{fontSize:28,marginBottom:4}}>{s.emoji}</div><div style={{fontSize:11,fontWeight:600}}>{s.name}</div><div style={{fontSize:12,color:C.primary,fontWeight:800}}>${s.price}</div></button>)}
          </div>
        </div>
        <div style={{padding:'20px 20px 0'}}><div style={{fontSize:15,fontWeight:700,marginBottom:12}}>Recent</div>
          {[{s:'Jump Start',h:'Marcus T.',d:'Today',c:55},{s:'Flat Tire',h:'Darnell K.',d:'Mar 28',c:75}].map((x,i)=><div key={i} style={{...F('row','center','space-between'),padding:'12px 0',borderBottom:i<1?`1px solid ${C.border}`:'none'}}><div><div style={{fontSize:14,fontWeight:600}}>{x.s}</div><div style={{fontSize:11,color:C.muted}}>{x.h} · {x.d}</div></div><div style={{fontSize:14,fontWeight:700}}>${x.c}</div></div>)}
        </div>
      </div>}

      {tab==='services'&&<Svcs/>}

      {tab==='history'&&<div style={{padding:20}}><h2 style={{fontSize:20,fontWeight:800,marginBottom:16}}>History</h2>
        {[{s:'Jump Start',h:'Marcus T.',d:'Today',c:55},{s:'Flat Tire',h:'Darnell K.',d:'Mar 28',c:75},{s:'Lockout',h:'Keisha M.',d:'Mar 15',c:65}].map((x,i)=><div key={i} style={{...card,...F('row','center','space-between'),marginBottom:12}}><div><div style={{fontSize:15,fontWeight:700}}>{x.s}</div><div style={{fontSize:12,color:C.muted}}>{x.h} · {x.d}</div><div style={{fontSize:11,color:C.green,marginTop:4}}>✓ Completed</div></div><div style={{fontSize:18,fontWeight:800}}>${x.c}</div></div>)}
      </div>}

      {tab==='wallet'&&<div style={{padding:20}}><h2 style={{fontSize:20,fontWeight:800,marginBottom:16}}>Wallet</h2>
        <div style={{...card,textAlign:'center',marginBottom:20}}><div style={{fontSize:11,color:C.muted,marginBottom:4}}>Balance</div><div style={{fontSize:36,fontWeight:900,color:C.primary}}>$0.00</div></div>
        <div style={{...card,marginBottom:12}}><div style={{fontSize:14,fontWeight:700,marginBottom:12}}>Payment</div><div style={{...F('row','center','space-between'),padding:'12px 0',borderBottom:`1px solid ${C.border}`}}><span style={{color:C.gray}}>💳 •••• 4242</span><span style={{fontSize:12,color:C.green}}>Default</span></div><button style={{...btn('transparent',C.primary,{border:'none',padding:'12px 0',fontSize:13,fontWeight:600})}}>+ Add Method</button></div>
      </div>}

      {tab==='profile'&&<div style={{padding:20,...F('column','center','center'),minHeight:'60vh'}}>
        <div style={{width:80,height:80,borderRadius:20,background:C.card2,...F('row','center','center'),fontSize:36,marginBottom:16,border:`1px solid ${C.border}`}}>🚗</div>
        <div style={{fontSize:18,fontWeight:700,marginBottom:4}}>{userName||'Driver'}</div><div style={{fontSize:13,color:C.muted,marginBottom:24}}>Basic Member</div>
        {['My Profile','My Vehicles','SOS Plans','Payment Methods','Help & Support'].map(x=><div key={x} style={{...card,width:'100%',marginBottom:8,...F('row','center','space-between'),padding:'16px 20px',cursor:'pointer'}}><span>{x}</span><span style={{color:C.muted}}>→</span></div>)}
        <button onClick={onBack} style={{...btn('transparent',C.red,{border:'none',marginTop:16})}}>Sign Out</button>
      </div>}

      <div style={{position:'fixed',bottom:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:430,background:C.card,borderTop:`1px solid ${C.border}`,padding:'8px 0 env(safe-area-inset-bottom,8px)',...F('row','center','space-around'),zIndex:40}}>
        {[['home','🏠','Home'],['services','🔧','Services'],['history','📂','History'],['wallet','💳','Wallet'],['profile','👤','Profile']].map(([id,ic,l])=><button key={id} onClick={()=>setTab(id)} style={{background:'none',border:'none',cursor:'pointer',...F('column','center','center',2),padding:'6px 12px',fontFamily:'inherit'}}><span style={{fontSize:20}}>{ic}</span><span style={{fontSize:10,color:tab===id?C.primary:C.muted,fontWeight:tab===id?700:500}}>{l}</span></button>)}
      </div>
    </div>
  );
}

/* ═══ HERO DASHBOARD ═══ */
function HeroDash({userName,onBack}) {
  const [tab,setTab]=useState('dash');
  const [on,setOn]=useState(false);
  const [alert,setAlert]=useState(false);
  const [timer,setTimer]=useState(15);

  useEffect(()=>{if(!on)return;const t=setTimeout(()=>setAlert(true),3000);return()=>clearTimeout(t);},[on]);
  useEffect(()=>{if(!alert)return;setTimer(15);const t=setInterval(()=>setTimer(p=>{if(p<=1){setAlert(false);return 0;}return p-1;}),1000);return()=>clearInterval(t);},[alert]);

  return(
    <div style={{minHeight:'100dvh',background:C.bg,paddingBottom:80}}>
      <div style={{padding:'16px 20px',...F('row','center','space-between')}}>
        <div style={F('row','center','flex-start',10)}>
          <div style={{width:32,height:32,borderRadius:8,background:C.green,...F('row','center','center'),fontWeight:900,fontSize:9,color:C.white,fontFamily:"'Outfit',sans-serif"}}>SOS</div>
          <div><div style={{fontSize:14,fontWeight:700}}>{userName||'Hero'} 🦸</div><div style={{fontSize:11,color:on?C.green:C.muted}}>{on?'● On Patrol':'○ Off Duty'}</div></div>
        </div>
        <button onClick={()=>{setOn(!on);if(on)setAlert(false);}} style={{...F('row','center','center',8),background:on?`${C.green}10`:C.card2,border:`1px solid ${on?C.green:C.border}`,borderRadius:20,padding:'8px 16px',cursor:'pointer',fontFamily:'inherit'}}>
          <div style={{width:10,height:10,borderRadius:'50%',background:on?C.green:C.grayLight}}/><span style={{fontSize:12,fontWeight:700,color:on?C.green:C.gray}}>{on?'ON PATROL':'OFF DUTY'}</span>
        </button>
      </div>

      {alert&&<div style={{position:'fixed',inset:0,zIndex:60,background:'rgba(0,0,0,0.6)',backdropFilter:'blur(8px)',...F('column','center','center'),padding:20}}>
        <div style={{...card,width:'100%',maxWidth:380,border:`2px solid ${C.primary}`,position:'relative',boxShadow:`0 20px 60px rgba(255,107,53,0.2)`}}>
          <div style={{position:'absolute',top:12,right:12}}><div style={{width:44,height:44,borderRadius:'50%',border:`3px solid ${timer<=5?C.red:C.green}`,...F('row','center','center')}}><span style={{fontSize:18,fontWeight:900,color:timer<=5?C.red:C.green}}>{timer}</span></div></div>
          <div style={{fontSize:12,color:C.primary,fontWeight:700,letterSpacing:2,marginBottom:8}}>🚨 RESCUE REQUEST</div>
          <div style={{fontSize:20,fontWeight:800,marginBottom:4}}>Flat Tire Change</div>
          <div style={{fontSize:13,color:C.gray,marginBottom:16}}>Jasmine R. · 2019 Honda Civic</div>
          <div style={{...F('row','center','flex-start',8),marginBottom:8}}><span style={{color:C.primary}}>📍</span><span style={{fontSize:13,color:C.gray}}>I-285 Exit 42 · 2.3 mi</span></div>
          <div style={{...F('row','center','flex-start',8),marginBottom:16}}><span style={{color:C.green}}>💰</span><span style={{fontSize:20,fontWeight:900,color:C.green}}>$75.00</span></div>
          <div style={F('row','center','center',12)}>
            <button onClick={()=>setAlert(false)} style={{...btn(C.card2,C.gray,{flex:1,border:`1px solid ${C.border}`})}}>Decline</button>
            <button onClick={()=>{setAlert(false);setTab('rescues');}} style={{...btn(`linear-gradient(135deg,${C.primary},${C.red})`,C.white,{flex:2})}}>Accept Rescue</button>
          </div>
        </div>
      </div>}

      {tab==='dash'&&<div style={{padding:20}}>
        <div style={{...card,marginBottom:16}}><div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,textAlign:'center'}}>
          <div><div style={{fontSize:11,color:C.muted}}>Today</div><div style={{fontSize:24,fontWeight:900,color:C.green}}>$310</div></div>
          <div><div style={{fontSize:11,color:C.muted}}>Week</div><div style={{fontSize:24,fontWeight:900}}>$1,450</div></div>
          <div><div style={{fontSize:11,color:C.muted}}>Rating</div><div style={{fontSize:24,fontWeight:900,color:C.yellow}}>⭐4.9</div></div>
        </div></div>
        <div style={{...card,...F('row','center','space-between'),marginBottom:16,border:`1px solid ${on?`${C.green}40`:C.border}`}}>
          <div><div style={{fontSize:16,fontWeight:700}}>Patrol Status</div><div style={{fontSize:12,color:on?C.green:C.muted}}>{on?'Receiving rescue requests':'Go on patrol'}</div></div>
          <button onClick={()=>{setOn(!on);if(on)setAlert(false);}} style={{width:56,height:32,borderRadius:16,background:on?C.green:C.grayLighter,border:'none',cursor:'pointer',position:'relative',transition:'all .3s'}}><div style={{width:26,height:26,borderRadius:'50%',background:C.white,position:'absolute',top:3,left:on?27:3,transition:'left .3s',boxShadow:'0 2px 4px rgba(0,0,0,0.3)'}}/></button>
        </div>
        <div style={{height:200,background:C.card,borderRadius:20,marginBottom:16,position:'relative',overflow:'hidden',...F('column','center','center'),border:`1px solid ${C.border}`}}>
          <div style={{position:'absolute',inset:0,backgroundImage:`linear-gradient(${C.grayLighter} 1px,transparent 1px),linear-gradient(90deg,${C.grayLighter} 1px,transparent 1px)`,backgroundSize:'40px 40px',opacity:0.3}}/>
          <div style={{position:'relative',width:14,height:14,borderRadius:'50%',background:on?C.green:C.grayLight,boxShadow:on?`0 0 20px ${C.green}80`:'none'}}/>
          <div style={{position:'absolute',bottom:12,left:12,background:'rgba(10,10,10,0.9)',borderRadius:10,padding:'6px 10px',fontSize:11,color:C.gray,border:`1px solid ${C.border}`}}>{on?'🟢 On Patrol':'⚫ Off Duty'}</div>
        </div>
        <div style={card}><div style={{fontSize:14,fontWeight:700,marginBottom:12}}>Incoming</div>
          {!on?<div style={{textAlign:'center',padding:'20px 0'}}><div style={{fontSize:28,marginBottom:8}}>💤</div><div style={{fontSize:13,color:C.muted}}>Go on patrol for rescues</div></div>
          :<div style={{textAlign:'center',padding:'20px 0'}}><div style={{fontSize:28,marginBottom:8}}>📡</div><div style={{fontSize:13,color:C.green}}>Scanning for stranded drivers...</div></div>}
        </div>
      </div>}

      {tab==='rescues'&&<div style={{padding:20}}><h2 style={{fontSize:20,fontWeight:800,marginBottom:16}}>Recent Rescues</h2>
        {[{c:'Jasmine R.',s:'Flat Tire',e:75,t:'2:15 PM',r:5},{c:'Kevin D.',s:'Jump Start',e:55,t:'11:30 AM',r:5},{c:'Tanya W.',s:'Lockout',e:65,t:'9:45 AM',r:4},{c:'Andre P.',s:'Tow Truck',e:125,t:'Yesterday',r:5}].map((m,i)=><div key={i} style={{...card,...F('row','center','space-between'),marginBottom:12}}><div><div style={{fontSize:15,fontWeight:700}}>{m.s}</div><div style={{fontSize:12,color:C.muted}}>{m.c} · {m.t}</div><div style={{fontSize:11,color:C.yellow}}>{'⭐'.repeat(m.r)}</div></div><div style={{fontSize:20,fontWeight:800,color:C.green}}>+${m.e}</div></div>)}
      </div>}

      {tab==='earnings'&&<div style={{padding:20}}><h2 style={{fontSize:20,fontWeight:800,marginBottom:16}}>Earnings</h2>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:24}}>
          <div style={{...card,textAlign:'center'}}><div style={{fontSize:11,color:C.muted}}>Today</div><div style={{fontSize:32,fontWeight:900,color:C.green}}>$310</div></div>
          <div style={{...card,textAlign:'center'}}><div style={{fontSize:11,color:C.muted}}>Week</div><div style={{fontSize:32,fontWeight:900}}>$1,450</div></div>
        </div>
        <div style={card}>{[['Base','$1,220'],['Tips','$165'],['Bonuses','$85'],['Fee','-$122']].map(([l,v])=><div key={l} style={{...F('row','center','space-between'),padding:'10px 0',borderBottom:`1px solid ${C.border}`}}><span style={{color:C.gray}}>{l}</span><span style={{fontWeight:700,color:v.startsWith('-')?C.red:C.text}}>{v}</span></div>)}
          <div style={{...F('row','center','space-between'),padding:'12px 0 0'}}><span style={{fontSize:16,fontWeight:800}}>Net</span><span style={{fontSize:20,fontWeight:900,color:C.green}}>$1,348</span></div>
        </div>
      </div>}

      {tab==='profile'&&<div style={{padding:20,...F('column','center','center'),minHeight:'60vh'}}>
        <div style={{width:80,height:80,borderRadius:20,background:`${C.green}12`,...F('row','center','center'),fontSize:36,marginBottom:16}}>🦸</div>
        <div style={{fontSize:18,fontWeight:700,marginBottom:4}}>{userName||'Hero'}</div><div style={{fontSize:13,color:C.green,marginBottom:24}}>⭐ 4.9 · 478 Rescues</div>
        {['My Profile','Skills','My Vehicle','Documents','Payouts','Help'].map(x=><div key={x} style={{...card,width:'100%',marginBottom:8,...F('row','center','space-between'),padding:'16px 20px',cursor:'pointer'}}><span>{x}</span><span style={{color:C.muted}}>→</span></div>)}
        <button onClick={onBack} style={{...btn('transparent',C.red,{border:'none',marginTop:16})}}>Sign Out</button>
      </div>}

      <div style={{position:'fixed',bottom:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:430,background:C.card,borderTop:`1px solid ${C.border}`,padding:'8px 0 env(safe-area-inset-bottom,8px)',...F('row','center','space-around'),zIndex:40}}>
        {[['dash','📊','Dashboard'],['rescues','🚨','Rescues'],['earnings','💰','Earnings'],['profile','👤','Profile']].map(([id,ic,l])=><button key={id} onClick={()=>setTab(id)} style={{background:'none',border:'none',cursor:'pointer',...F('column','center','center',2),padding:'6px 12px',fontFamily:'inherit'}}><span style={{fontSize:20}}>{ic}</span><span style={{fontSize:10,color:tab===id?C.green:C.muted,fontWeight:tab===id?700:500}}>{l}</span></button>)}
      </div>
    </div>
  );
}
