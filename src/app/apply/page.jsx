"use client";
import { useState } from "react";

const SERVICES = [
  { cat: "Emergency Roadside", items: ["Jump Start","Flat Tire Change","Fuel Delivery","Lockout Service","Tow Truck Dispatch","Battery Replacement","Winch/Recovery"] },
  { cat: "Mobile Maintenance", items: ["Oil Change","Brake Inspection","Brake Pad Replace","Battery Test & Replace","Coolant Flush","Transmission Fluid","Air Filter Replace","Spark Plug Replace","Belt Inspection","Wiper Blade Install"] },
  { cat: "Glass & Body", items: ["Windshield Chip Repair","Window Tinting","Headlight Restoration","Minor Dent Repair (PDR)","Scratch/Paint Touch-Up"] },
  { cat: "Car Wash & Detailing", items: ["Basic Wash","Full Detail","Interior Only","Exterior Only","Engine Bay Cleaning","Ceramic Coating","Paint Correction"] },
  { cat: "Convenience", items: ["Mobile Notary","Vehicle Registration Runner","Parking Ticket Assistance"] },
  { cat: "Fleet Services", items: ["Fleet Maintenance","Fleet Detailing","Fleet Inspection"] },
];
const STATES = ["AL","AK","AZ","AR","CA","CO","CT","DC","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];
const WEBHOOK = "https://dorsey.app.n8n.cloud/webhook/provider-application";

export default function ApplyPage() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ first_name:"",last_name:"",email:"",phone:"",city:"",state:"",zip_code:"",services_requested:[],years_experience:"",experience_description:"",has_vehicle:false,vehicle_type:"",background_check_consent:false });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const u = (k,v) => setForm(p => ({...p,[k]:v}));
  const toggleSvc = s => setForm(p => ({...p, services_requested: p.services_requested.includes(s) ? p.services_requested.filter(x=>x!==s) : [...p.services_requested, s]}));

  const canNext = () => {
    if (step===0) return form.first_name && form.last_name && form.email && form.phone && form.city && form.state;
    if (step===1) return form.services_requested.length > 0;
    if (step===2) return form.years_experience && form.background_check_consent;
    return true;
  };

  const submit = async () => {
    setSubmitting(true); setError(null);
    try {
      const res = await fetch(WEBHOOK, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({...form, brand:"sos", state_code:form.state}) });
      const data = await res.json();
      if (data.success) { setResult(data); setStep(4); } else setError(data.error||"Failed");
    } catch(e) { setError("Network error"); }
    setSubmitting(false);
  };

  const inp = "w-full px-4 py-3 rounded-lg border border-gray-700 bg-[#0a0a0a] text-white text-sm focus:border-[#C41E3A] focus:ring-1 focus:ring-[#C41E3A] outline-none";
  const lbl = "block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5";

  return (
    <div style={{minHeight:"100vh",background:"#080808",color:"#fff",fontFamily:"DM Sans, sans-serif"}}>
      <div style={{background:"linear-gradient(135deg, #C41E3A 0%, #8B0000 100%)",padding:"32px 24px",textAlign:"center"}}>
        <div style={{fontSize:10,letterSpacing:"0.3em",color:"rgba(255,255,255,0.7)",marginBottom:8}}>SOS — SUPERHEROES ON STANDBY</div>
        <div style={{fontSize:28,fontWeight:700,fontFamily:"Cormorant Garamond, serif"}}>Become a Hero</div>
        <div style={{fontSize:14,color:"rgba(255,255,255,0.8)",marginTop:4}}>Join our network of automotive service providers</div>
      </div>
      {step < 4 && (
        <div style={{maxWidth:600,margin:"0 auto",padding:"12px 24px"}}>
          <div style={{display:"flex",gap:4}}>
            {["Info","Services","Experience","Review"].map((l,i) => (
              <div key={i} style={{flex:1}}>
                <div style={{height:4,borderRadius:4,background:i<=step?"#C41E3A":"#222",transition:"all 0.3s"}} />
                <div style={{fontSize:10,textAlign:"center",marginTop:4,color:i===step?"#fff":"#555"}}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{maxWidth:600,margin:"0 auto",padding:"24px"}}>
        {step===0 && (<div>
          <h2 style={{fontSize:22,fontWeight:700,marginBottom:16}}>Personal Information</h2>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><label className={lbl} style={{display:"block",fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em",color:"#888",marginBottom:6}}>First Name *</label><input className={inp} style={{width:"100%",padding:"10px 14px",borderRadius:8,border:"1px solid #333",background:"#0a0a0a",color:"#fff",fontSize:14}} value={form.first_name} onChange={e=>u("first_name",e.target.value)} /></div>
            <div><label style={{display:"block",fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em",color:"#888",marginBottom:6}}>Last Name *</label><input style={{width:"100%",padding:"10px 14px",borderRadius:8,border:"1px solid #333",background:"#0a0a0a",color:"#fff",fontSize:14}} value={form.last_name} onChange={e=>u("last_name",e.target.value)} /></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginTop:12}}>
            <div><label style={{display:"block",fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em",color:"#888",marginBottom:6}}>Email *</label><input type="email" style={{width:"100%",padding:"10px 14px",borderRadius:8,border:"1px solid #333",background:"#0a0a0a",color:"#fff",fontSize:14}} value={form.email} onChange={e=>u("email",e.target.value)} /></div>
            <div><label style={{display:"block",fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em",color:"#888",marginBottom:6}}>Phone *</label><input type="tel" style={{width:"100%",padding:"10px 14px",borderRadius:8,border:"1px solid #333",background:"#0a0a0a",color:"#fff",fontSize:14}} value={form.phone} onChange={e=>u("phone",e.target.value)} /></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:12,marginTop:12}}>
            <div><label style={{display:"block",fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em",color:"#888",marginBottom:6}}>City *</label><input style={{width:"100%",padding:"10px 14px",borderRadius:8,border:"1px solid #333",background:"#0a0a0a",color:"#fff",fontSize:14}} value={form.city} onChange={e=>u("city",e.target.value)} /></div>
            <div><label style={{display:"block",fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em",color:"#888",marginBottom:6}}>State *</label><select style={{width:"100%",padding:"10px 14px",borderRadius:8,border:"1px solid #333",background:"#0a0a0a",color:"#fff",fontSize:14}} value={form.state} onChange={e=>u("state",e.target.value)}><option value="">--</option>{STATES.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
            <div><label style={{display:"block",fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em",color:"#888",marginBottom:6}}>Zip</label><input style={{width:"100%",padding:"10px 14px",borderRadius:8,border:"1px solid #333",background:"#0a0a0a",color:"#fff",fontSize:14}} value={form.zip_code} onChange={e=>u("zip_code",e.target.value)} /></div>
          </div>
        </div>)}

        {step===1 && (<div>
          <h2 style={{fontSize:22,fontWeight:700,marginBottom:4}}>Select Your Services</h2>
          <p style={{fontSize:13,color:"#888",marginBottom:16}}>{form.services_requested.length} selected</p>
          {SERVICES.map(cat => (
            <div key={cat.cat} style={{marginBottom:20}}>
              <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",color:"#555",marginBottom:8}}>{cat.cat}</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {cat.items.map(s => (
                  <button key={s} onClick={()=>toggleSvc(s)} style={{padding:"6px 14px",borderRadius:20,fontSize:12,fontWeight:500,border:form.services_requested.includes(s)?"1px solid #C41E3A":"1px solid #333",background:form.services_requested.includes(s)?"#C41E3A":"transparent",color:form.services_requested.includes(s)?"#fff":"#ccc",cursor:"pointer",transition:"all 0.2s"}}>{form.services_requested.includes(s)?"✓ ":""}{s}</button>
                ))}
              </div>
            </div>
          ))}
        </div>)}

        {step===2 && (<div>
          <h2 style={{fontSize:22,fontWeight:700,marginBottom:16}}>Experience & Background</h2>
          <div><label style={{display:"block",fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em",color:"#888",marginBottom:6}}>Years of Experience *</label><select style={{width:"100%",padding:"10px 14px",borderRadius:8,border:"1px solid #333",background:"#0a0a0a",color:"#fff",fontSize:14}} value={form.years_experience} onChange={e=>u("years_experience",e.target.value)}><option value="">Select</option><option value="0">Less than 1</option><option value="1">1-2 years</option><option value="3">3-5 years</option><option value="5">5-10 years</option><option value="10">10+ years</option></select></div>
          <div style={{marginTop:12}}><label style={{display:"block",fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em",color:"#888",marginBottom:6}}>Experience Description</label><textarea style={{width:"100%",padding:"10px 14px",borderRadius:8,border:"1px solid #333",background:"#0a0a0a",color:"#fff",fontSize:14,height:80,resize:"none"}} value={form.experience_description} onChange={e=>u("experience_description",e.target.value)} /></div>
          <div style={{marginTop:12,display:"flex",alignItems:"center",gap:8}}><input type="checkbox" checked={form.has_vehicle} onChange={e=>u("has_vehicle",e.target.checked)} /><span style={{fontSize:14}}>I have a vehicle for mobile service</span></div>
          {form.has_vehicle && <div style={{marginTop:8}}><input placeholder="Vehicle (e.g. 2022 Ford Transit)" style={{width:"100%",padding:"10px 14px",borderRadius:8,border:"1px solid #333",background:"#0a0a0a",color:"#fff",fontSize:14}} value={form.vehicle_type} onChange={e=>u("vehicle_type",e.target.value)} /></div>}
          <div style={{marginTop:20,padding:16,background:"#111",borderRadius:12,border:"1px solid #222"}}>
            <div style={{display:"flex",alignItems:"flex-start",gap:10}}><input type="checkbox" checked={form.background_check_consent} onChange={e=>u("background_check_consent",e.target.checked)} style={{marginTop:3}} /><div><div style={{fontSize:14,fontWeight:600}}>Background Check Consent *</div><div style={{fontSize:12,color:"#888",marginTop:4}}>I authorize The Kollective Hospitality Group to conduct a background check including criminal history and driving record verification.</div></div></div>
          </div>
        </div>)}

        {step===3 && (<div>
          <h2 style={{fontSize:22,fontWeight:700,marginBottom:16}}>Review & Submit</h2>
          <div style={{background:"#111",borderRadius:12,padding:16,marginBottom:12,border:"1px solid #222"}}><div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",color:"#555",marginBottom:6}}>Personal</div><div style={{fontWeight:600}}>{form.first_name} {form.last_name}</div><div style={{fontSize:13,color:"#888"}}>{form.email} · {form.phone}</div><div style={{fontSize:13,color:"#888"}}>{form.city}, {form.state} {form.zip_code}</div></div>
          <div style={{background:"#111",borderRadius:12,padding:16,marginBottom:12,border:"1px solid #222"}}><div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",color:"#555",marginBottom:6}}>Services ({form.services_requested.length})</div><div style={{display:"flex",flexWrap:"wrap",gap:4}}>{form.services_requested.map(s=><span key={s} style={{padding:"3px 10px",background:"#1a1a1a",borderRadius:12,fontSize:11,color:"#ccc"}}>{s}</span>)}</div></div>
          <div style={{background:"#111",borderRadius:12,padding:16,border:"1px solid #222"}}><div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",color:"#555",marginBottom:6}}>Experience</div><div style={{fontSize:14}}>{form.years_experience}+ years · {form.has_vehicle?"Has vehicle":"No vehicle"}</div></div>
          {error && <div style={{marginTop:12,padding:12,background:"#2a0a0a",border:"1px solid #C41E3A",borderRadius:8,fontSize:13,color:"#ff6666"}}>{error}</div>}
        </div>)}

        {step===4 && result && (<div style={{textAlign:"center",padding:"60px 0"}}>
          <div style={{fontSize:64,marginBottom:16}}>🦸</div>
          <h2 style={{fontSize:28,fontWeight:700,fontFamily:"Cormorant Garamond, serif",marginBottom:8}}>Application Submitted!</h2>
          <div style={{display:"inline-block",padding:"8px 20px",background:"#C41E3A",borderRadius:8,fontFamily:"monospace",fontSize:18,marginBottom:16}}>{result.application_number}</div>
          <p style={{color:"#888",maxWidth:400,margin:"0 auto",fontSize:14}}>Our team will review your application within 2-3 business days. Check your email for confirmation.</p>
        </div>)}

        {step < 4 && (
          <div style={{display:"flex",justifyContent:"space-between",marginTop:32,paddingTop:20,borderTop:"1px solid #222"}}>
            {step>0 ? <button onClick={()=>setStep(s=>s-1)} style={{padding:"10px 24px",fontSize:14,color:"#888",background:"none",border:"none",cursor:"pointer"}}>← Back</button> : <div/>}
            {step<3 ? <button onClick={()=>canNext()&&setStep(s=>s+1)} disabled={!canNext()} style={{padding:"10px 28px",borderRadius:8,fontSize:14,fontWeight:600,background:canNext()?"#C41E3A":"#222",color:canNext()?"#fff":"#555",border:"none",cursor:canNext()?"pointer":"not-allowed"}}>Continue →</button>
            : <button onClick={submit} disabled={submitting} style={{padding:"10px 28px",borderRadius:8,fontSize:14,fontWeight:600,background:"#D4B87A",color:"#080604",border:"none",cursor:"pointer"}}>{submitting?"Submitting...":"Submit Application"}</button>}
          </div>
        )}
      </div>
    </div>
  );
}
