// A2P 10DLC compliance pages — SMS opt-in (/sms), Privacy (/privacy), Terms (/terms), SMS Terms (/sms-terms).
// Legal entity: Washington Parq LLC. Each brand keeps its own consumer-facing name.
// Consent submissions are logged to Supabase public.sms_optins (insert-only RLS).

const SUPABASE_URL = 'https://dzlmtvodpyhetvektfuo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ekvoOK6QQ05dUZuWgzQfUw_2RgbWPFR'; // publishable, insert-only via RLS
const ENTITY = 'Washington Parq LLC';
const ENTITY_ADDR = '2811 Washington Ave, Houston, TX 77007';
const SUPPORT_EMAIL = 'dr@doctordorsey.com';
const UPDATED = 'September 27, 2026';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function consentText(b) {
  return `By checking this box, I agree to receive recurring automated marketing and informational text messages from ${b.name}, operated by ${ENTITY}, at the mobile number provided. Consent is not a condition of purchase. Msg frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to cancel.`;
}

function links(b) {
  const p = b.base || '';
  return {
    sms: `${p}/sms`,
    privacy: b.privacyPath || `${p}/privacy`,
    terms: b.termsPath || `${p}/terms`,
    smsTerms: b.smsTermsPath || `${p}/sms-terms`,
  };
}

function shell(b, title, body) {
  const L = links(b);
  const accent = b.accent || '#c8a45a';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)} — ${esc(b.name)}</title>
<meta name="robots" content="index,follow">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root{--bg:#0d0c0b;--fg:#f3efe7;--mut:#b9b2a5;--line:#2c2925;--card:#161412;--acc:${accent}}
@media (prefers-color-scheme: light){:root{--bg:#f6f3ee;--fg:#191715;--mut:#5d574f;--line:#ddd6cb;--card:#fff}}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--fg)}
body{font:16px/1.65 Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom)}
.wrap{max-width:760px;margin:0 auto;padding:40px 22px 64px}
header{display:flex;justify-content:space-between;align-items:baseline;gap:16px;border-bottom:1px solid var(--line);padding-bottom:18px;margin-bottom:34px;flex-wrap:wrap}
.mark{font-family:"Cormorant Garamond",Georgia,serif;font-size:30px;letter-spacing:.14em;text-transform:uppercase;color:var(--fg);text-decoration:none}
nav a{color:var(--mut);text-decoration:none;font-size:13px;letter-spacing:.06em;text-transform:uppercase;margin-left:16px}nav a:hover{color:var(--acc)}
h1{font-family:"Cormorant Garamond",Georgia,serif;font-weight:600;font-size:clamp(34px,6vw,48px);line-height:1.08;margin:0 0 14px}
h2{font-family:"Cormorant Garamond",Georgia,serif;font-weight:600;font-size:24px;margin:34px 0 8px}
p,li{color:var(--mut)}strong{color:var(--fg)}a{color:var(--acc)}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:26px}
label.f{display:block;font-size:13px;letter-spacing:.05em;text-transform:uppercase;color:var(--mut);margin:16px 0 6px}
input[type=tel],input[type=text],input[type=email]{width:100%;padding:13px 14px;border-radius:10px;border:1px solid var(--line);background:var(--bg);color:var(--fg);font:inherit}
.consent{display:flex;gap:12px;align-items:flex-start;margin:20px 0;font-size:14px;line-height:1.55;color:var(--mut)}
.consent input{margin-top:4px;width:20px;height:20px;flex:0 0 auto;accent-color:var(--acc)}
button{width:100%;padding:15px;border:0;border-radius:10px;background:var(--acc);color:#111;font:600 15px Inter,sans-serif;letter-spacing:.04em;text-transform:uppercase;cursor:pointer}
button[disabled]{opacity:.5;cursor:not-allowed}
.fine{font-size:13px;color:var(--mut)}.msg{margin-top:14px;font-size:14px}
footer{margin-top:48px;border-top:1px solid var(--line);padding-top:18px;font-size:13px;color:var(--mut)}
footer a{color:var(--mut);margin-right:14px}
</style></head><body><div class="wrap">
<header><a class="mark" href="${esc(b.home || '/')}">${esc(b.name)}</a>
<nav><a href="${L.sms}">Text Updates</a><a href="${L.privacy}">Privacy</a><a href="${L.terms}">Terms</a></nav></header>
${body}
<footer>${esc(b.name)} is operated by ${ENTITY}, ${ENTITY_ADDR}. Contact: <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a><br>
<a href="${L.sms}">SMS Sign-Up</a><a href="${L.smsTerms}">SMS Terms</a><a href="${L.privacy}">Privacy Policy</a><a href="${L.terms}">Terms &amp; Conditions</a></footer>
</div></body></html>`;
}

function smsPage(b, mode) {
  const L = links(b);
  const ct = consentText(b);
  const endpoint = mode === 'client' ? `${SUPABASE_URL}/rest/v1/sms_optins` : L.sms;
  return shell(b, 'Text Updates', `
<h1>Get ${esc(b.name)} text updates</h1>
<p>${esc(b.programDescription)}</p>
<div class="card"><form id="optin" novalidate>
<label class="f" for="first_name">First name</label><input id="first_name" name="first_name" type="text" autocomplete="given-name">
<label class="f" for="phone">Mobile number *</label><input id="phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" required placeholder="(555) 555-5555">
<label class="f" for="email">Email (optional)</label><input id="email" name="email" type="email" autocomplete="email">
<label class="consent"><input id="consent" name="consent" type="checkbox" value="yes"><span>${esc(ct)} View our <a href="${L.privacy}">Privacy Policy</a> and <a href="${L.smsTerms}">SMS Terms</a>.</span></label>
${b.ageGate21?`<label class="consent"><input id="age" name="age" type="checkbox" value="yes"><span>I confirm I am 21 years of age or older.</span></label>`:''}
<button id="go" type="submit">Sign up for texts</button>
<p class="msg" id="msg" role="status" aria-live="polite"></p>
</form></div>
<h2>About this program</h2>
<p><strong>What you’ll receive:</strong> ${esc(b.messageTypes)}</p>
<p><strong>Frequency:</strong> Message frequency varies. <strong>Cost:</strong> Message and data rates may apply.</p>
<p><strong>Opt out:</strong> Reply <strong>STOP</strong> at any time to unsubscribe; you’ll get one confirmation and no further messages. <strong>Help:</strong> Reply <strong>HELP</strong> or email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>
<p class="fine">Consent to receive text messages is not a condition of any purchase. Mobile numbers and SMS opt-in consent are never sold or shared with third parties or affiliates for their marketing purposes. Carriers are not liable for delayed or undelivered messages.</p>
<script>
(function(){var f=document.getElementById('optin'),m=document.getElementById('msg'),g=document.getElementById('go');
var CT=${JSON.stringify(ct)};
f.addEventListener('submit',function(e){e.preventDefault();m.textContent='';
var raw=(f.phone.value||'').replace(/[^0-9+]/g,''),d=raw.replace(/\\D/g,'');
if(d.length===10)raw='+1'+d;else if(d.length===11&&d[0]==='1')raw='+'+d;
if(!/^\\+\\d{10,15}$/.test(raw)){m.textContent='Please enter a valid mobile number.';return}
if(f.age&&!f.age.checked){m.textContent='You must be 21 or older to sign up.';return}
if(!f.consent.checked){m.textContent='Please check the box to agree to receive text messages.';return}
g.disabled=true;
var payload={brand_key:${JSON.stringify(b.key)},brand_name:${JSON.stringify(b.name)},phone:raw,first_name:f.first_name.value||null,email:f.email.value||null,consent:true,consent_text:CT,page_url:location.href,user_agent:navigator.userAgent};
var opts=${mode === 'client'
      ? `{method:'POST',headers:{'Content-Type':'application/json','apikey':${JSON.stringify(SUPABASE_KEY)},'Prefer':'return=minimal'},body:JSON.stringify(payload)}`
      : `{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}`};
fetch(${JSON.stringify(endpoint)},opts).then(function(r){if(!r.ok)throw 0;f.reset();m.textContent='You’re subscribed to ${esc(b.name)} texts. Reply STOP to opt out at any time.'}).catch(function(){m.textContent='Something went wrong. Please try again.'}).finally(function(){g.disabled=false})});})();
</script>`);
}

function smsTermsBlock(b) {
  return `
<p>${esc(b.name)} (“we”, “us”) is operated by ${ENTITY}. By opting in to the ${esc(b.name)} text messaging program, you agree to these SMS Terms.</p>
<p><strong>Program.</strong> ${esc(b.messageTypes)}</p>
<p><strong>How you opt in.</strong> You opt in by entering your mobile number and checking the unchecked consent box on our sign-up form at <a href="${links(b).sms}">${esc(b.domain || '')}${links(b).sms}</a>. Consent is not a condition of purchase.</p>
<p><strong>Frequency and cost.</strong> Message frequency varies. Message and data rates may apply according to your mobile plan.</p>
<p><strong>Opting out.</strong> Text <strong>STOP</strong> to cancel at any time. You will receive one message confirming your opt-out, and no further messages unless you opt in again.</p>
<p><strong>Help.</strong> Text <strong>HELP</strong> for assistance, or email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>
<p><strong>Carriers.</strong> Carriers are not liable for delayed or undelivered messages.</p>
<p><strong>Privacy.</strong> See our <a href="${links(b).privacy}">Privacy Policy</a>. We do not sell, rent, or share mobile numbers or SMS opt-in consent with third parties or affiliates for their marketing purposes.</p>`;
}

function smsTermsPage(b) {
  return shell(b, 'SMS Terms', `<h1>SMS Terms</h1><p class="fine">Last updated ${UPDATED}</p>${smsTermsBlock(b)}`);
}

function privacyPage(b) {
  return shell(b, 'Privacy Policy', `<h1>Privacy Policy</h1><p class="fine">Last updated ${UPDATED}</p>
<p>This Privacy Policy explains how ${esc(b.name)}, operated by ${ENTITY} (${ENTITY_ADDR}), collects, uses, and protects personal information when you visit our website, make a purchase, or sign up for our communications.</p>
<h2>Information we collect</h2>
<p>Information you give us, such as your name, email address, mobile number, shipping or billing details, and messages you send us; information from your purchases or bookings; and basic technical information collected automatically, such as device type, browser, pages visited, and approximate location derived from your IP address.</p>
<h2>How we use information</h2>
<p>To provide and deliver our products and services, process orders and payments, respond to you, send the communications you have requested (including text messages you have opted in to), improve our website, prevent fraud, and comply with the law.</p>
<h2>Text messaging (SMS)</h2>
<p>If you opt in to text messages, we use your mobile number to send the messages described in our <a href="${links(b).smsTerms}">SMS Terms</a>. <strong>We do not sell, rent, or share mobile numbers or text messaging opt-in data and consent with any third parties or affiliates for their marketing purposes.</strong> Mobile information is shared only with service providers that help us deliver messages (such as our messaging platform and carriers), and only for that purpose. Reply STOP to opt out at any time.</p>
<h2>How we share information</h2>
<p>We share personal information only with service providers acting on our behalf (for example payment processing, hosting, order fulfillment, and messaging), when required by law or to protect rights and safety, or in connection with a business transfer. We do not sell personal information.</p>
<h2>Your choices</h2>
<p>You can unsubscribe from marketing emails using the link in any email, opt out of texts by replying STOP, and request access to, correction of, or deletion of your personal information by emailing <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>
<h2>Security and retention</h2>
<p>We use reasonable safeguards to protect personal information and keep it only as long as needed for the purposes above or as required by law.</p>
<h2>Children</h2>
<p>Our services are not directed to children under 13, and we do not knowingly collect their personal information.</p>
<h2>Changes and contact</h2>
<p>We may update this policy and will post the new version here. Questions: <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>, ${ENTITY}, ${ENTITY_ADDR}.</p>`);
}

function termsPage(b) {
  return shell(b, 'Terms & Conditions', `<h1>Terms &amp; Conditions</h1><p class="fine">Last updated ${UPDATED}</p>
<p>These Terms govern your use of the ${esc(b.name)} website and services. ${esc(b.name)} is operated by ${ENTITY}, ${ENTITY_ADDR}. By using this website you agree to these Terms.</p>
<h2>Use of the website</h2>
<p>You agree to use this website only for lawful purposes and not to interfere with its operation or security.</p>
<h2>Purchases, bookings, and events</h2>
<p>Prices, availability, and event details may change without notice. Additional terms shown at checkout or on a ticket, booking, or product page apply to that transaction.</p>
<h2>Intellectual property</h2>
<p>All content on this website, including names, logos, text, and images, belongs to ${ENTITY} or its licensors and may not be used without permission.</p>
<h2>Text messaging program</h2>${smsTermsBlock(b)}
<h2>Disclaimers and limitation of liability</h2>
<p>This website and our services are provided “as is.” To the fullest extent permitted by law, ${ENTITY} is not liable for indirect, incidental, or consequential damages arising from your use of the website or services.</p>
<h2>Governing law</h2>
<p>These Terms are governed by the laws of the State of Texas, without regard to conflict-of-laws rules.</p>
<h2>Contact</h2>
<p><a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>`);
}

export function renderPage(kind, brand, mode = 'server') {
  if (kind === 'sms') return smsPage(brand, mode);
  if (kind === 'privacy') return privacyPage(brand);
  if (kind === 'terms') return termsPage(brand);
  if (kind === 'sms-terms') return smsTermsPage(brand);
  throw new Error('unknown kind ' + kind);
}

export function htmlResponse(html) {
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' } });
}

// Server-side POST handler for Next.js route handlers: validates and logs consent with the caller's IP.
export async function handleOptin(request, brand) {
  let body;
  try { body = await request.json(); } catch { return Response.json({ ok: false }, { status: 400 }); }
  const phone = String(body.phone || '');
  if (!/^\+\d{10,15}$/.test(phone) || body.consent !== true) return Response.json({ ok: false }, { status: 400 });
  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || null;
  const row = {
    brand_key: brand.key, brand_name: brand.name, phone,
    first_name: body.first_name ? String(body.first_name).slice(0, 80) : null,
    email: body.email ? String(body.email).slice(0, 160) : null,
    consent: true, consent_text: consentText(brand),
    page_url: body.page_url ? String(body.page_url).slice(0, 500) : null,
    ip, user_agent: (request.headers.get('user-agent') || '').slice(0, 400),
  };
  const r = await fetch(`${SUPABASE_URL}/rest/v1/sms_optins`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Prefer: 'return=minimal' },
    body: JSON.stringify(row),
  });
  return Response.json({ ok: r.ok }, { status: r.ok ? 200 : 502 });
}
