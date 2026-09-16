'use client';
import { useState } from 'react';

export default function LaunchUpdates() {
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  async function submit(event) {
    event.preventDefault();
    const form=event.currentTarget;
    if (busy) return;
    setBusy(true); setMessage('Submitting…');
    const body=Object.fromEntries(new FormData(form));
    body.brand_key='sos';
    body.email_consent=form.elements.email_consent.checked;
    const query=new URL(window.location.href).searchParams;
    body.utm_source=query.get('utm_source')||'launch-page';
    body.utm_campaign=query.get('utm_campaign')||'prelaunch-20260916';
    try {
      const response=await fetch('https://dzlmtvodpyhetvektfuo.supabase.co/functions/v1/app-launch-crm?brand=sos',{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)
      });
      const result=await response.json();
      if (!response.ok||!result.ok) throw new Error(result.error==='rate_limited'?'Please try again later.':'Your interest was not confirmed. Please retry.');
      setMessage('Received. Your S.O.S. interest receipt: '+result.receipt_id+'. No service has been requested.');
    } catch(error) { setMessage(error.message||'Connection failed. Please retry.'); }
    finally { setBusy(false); }
  }
  return <main className="sos-launch-intake">
    <style>{`.sos-launch-intake{max-width:720px;margin:0 auto;padding:48px 24px;background:#101010;color:#f8f6f1;font:17px/1.6 system-ui;min-height:100vh}.sos-launch-intake *{box-sizing:border-box}.sos-launch-intake a{color:inherit;text-decoration:underline}.sos-launch-intake h1{font-size:clamp(36px,7vw,60px);line-height:1.06;margin:24px 0}.sos-launch-intake label{display:block;margin-top:18px}.sos-launch-intake input,.sos-launch-intake select,.sos-launch-intake button{width:100%;padding:14px;border:1px solid #777;border-radius:6px;background:#191919;color:inherit;font:inherit}.sos-launch-intake button{background:#f8f6f1;color:#101010;font-weight:750;cursor:pointer;margin-top:24px}.sos-launch-intake .consent{display:flex;gap:12px}.sos-launch-intake .consent input{width:22px;min-width:22px;height:22px}.sos-launch-intake .fine{font-size:14px;color:#ccc}.sos-launch-intake button:disabled{opacity:.5}`}</style>
    <a href="/">S.O.S.</a><p>LAUNCH INTEREST</p><h1>Real skills. Real help.</h1>
    <p>Register customer launch interest or ask about becoming a Hero. This form does not request roadside service, establish coverage or approve a provider.</p>
    <p><strong>S.O.S. is not an emergency service. For an emergency, call 911.</strong></p>
    <form onSubmit={submit}>
      <label>I am interested in<select name="program_key"><option value="customer_marketing">Customer launch updates</option><option value="service_providers">Hero/provider onboarding information</option></select></label>
      <label>Name<input name="full_name" autoComplete="name" maxLength={120} required /></label>
      <label>Email<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
      <label>City<input name="city" defaultValue="Atlanta" maxLength={100} required /></label>
      <label>ZIP code<input name="postal_code" autoComplete="postal-code" maxLength={16} /></label>
      <label hidden aria-hidden="true" style={{display:'none'}}>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      <label className="consent"><input type="checkbox" name="email_consent" /><span>I agree to receive email launch and onboarding updates from S.O.S. I can unsubscribe at any time. This does not authorize SMS or messages from other brands.</span></label>
      <p className="fine">A provider inquiry is not approval or a promise of work. Complete the official <a href="/hero/apply/">Hero application</a> to begin review. Read our <a href="/privacy/">privacy policy</a>.</p>
      <button type="submit" disabled={busy}>{busy?'Submitting…':'Submit my interest'}</button>
      <p role="status" aria-live="polite">{message}</p>
    </form>
  </main>;
}
