(() => {
  'use strict';
  if (window.__SOS_SAFETY_GUARD_ACTIVE__) return;
  window.__SOS_SAFETY_GUARD_ACTIVE__ = true;

  const SERVICES = {
    'Towing': ['roadside', 'tow'],
    'Flat Tire Help': ['roadside', 'flat'],
    'Flat Tire': ['roadside', 'flat'],
    'Tire Concierge': ['roadside', 'tire_con'],
    'Jump Start': ['roadside', 'jump'],
    'Battery Replace': ['roadside', 'battery'],
    'Battery': ['roadside', 'battery'],
    'Fuel Delivery': ['roadside', 'fuel'],
    'Fuel': ['roadside', 'fuel'],
    'Lockout': ['roadside', 'lockout'],
    'Winch Out & Recovery': ['roadside', 'winch'],
    'Oil Change': ['maintenance', 'oil'],
    'Fluids / Top-ups': ['maintenance', 'fluids'],
    'OBD Scan + Report': ['maintenance', 'obd'],
    'Bulb Replacement': ['maintenance', 'bulb'],
    'Belt/Hose Swap': ['maintenance', 'belt'],
    'Brake Pads': ['maintenance', 'brakes'],
    'Windshield Repair': ['glass', 'ws_repair'],
    'Windshield Replace': ['glass', 'ws_replace', true],
    'Paintless Dent Repair': ['glass', 'dent', true],
    'Scratch Buff': ['glass', 'scratch'],
    'Express Wash': ['wash', 'express'],
    'Interior Detail': ['wash', 'interior'],
    'Full Detail': ['wash', 'full_detail'],
    'Ceramic Coating': ['wash', 'ceramic', true],
    'Odor / Sanitization': ['wash', 'odor'],
    'Errand Assist': ['convenience', 'errand'],
    'Accessory Install': ['convenience', 'dashcam'],
    'Safety Kit Delivery': ['convenience', 'safety_kit'],
    'Wiper Blade Install': ['convenience', 'wiper'],
    'Key/Fob Support': ['convenience', 'key_fob', true],
    'Fleet Jump/Lockout': ['fleet', 'fleet_jump'],
    'Fleet Fuel': ['fleet', 'fleet_fuel'],
    'Fleet Wash': ['fleet', 'fleet_wash'],
    'Fleet Inspections': ['fleet', 'fleet_inspect'],
    'Winter Prep': ['seasonal', 'winter'],
    'Summer Prep': ['seasonal', 'summer'],
    'Seasonal Tire Swap': ['seasonal', 'tire_swap'],
    'Storm Cleanup': ['seasonal', 'storm', true],
    'Valet Fuel + Wash': ['premium', 'valet_fuel'],
    'Pickup/Return Mechanic': ['premium', 'pickup_mech', true],
    'Tire/Rim Upgrade': ['premium', 'tire_upgrade', true],
    'VIP Roadside Priority': ['premium', 'vip'],
  };

  const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  const nativeFetch = window.fetch.bind(window);

  const selectedServiceFromText = (text) => {
    const normalized = normalize(text);
    const names = Object.keys(SERVICES).sort((a, b) => b.length - a.length);
    const name = names.find((candidate) => normalized.includes(candidate));
    if (!name) return null;
    const [categoryId, subcategoryId, quoteRequired = false] = SERVICES[name];
    const canonicalName = name === 'Flat Tire' ? 'Flat Tire Help'
      : name === 'Battery' ? 'Battery Replace'
      : name === 'Fuel' ? 'Fuel Delivery'
      : name;
    return { name: canonicalName, categoryId, subcategoryId, quoteRequired };
  };

  const rememberService = (element) => {
    const service = selectedServiceFromText(element?.parentElement?.textContent || element?.textContent);
    if (!service) return;
    try { sessionStorage.setItem('sos_selected_service', JSON.stringify(service)); } catch {}
  };

  const readService = () => {
    try {
      const parsed = JSON.parse(sessionStorage.getItem('sos_selected_service') || 'null');
      return parsed && parsed.name && parsed.subcategoryId ? parsed : null;
    } catch {
      return null;
    }
  };

  window.fetch = (input, init = {}) => {
    const rawUrl = typeof input === 'string' ? input : input?.url;
    const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (!rawUrl || method !== 'POST') return nativeFetch(input, init);

    let url;
    try { url = new URL(rawUrl, location.href); } catch { return nativeFetch(input, init); }
    if (url.hostname !== 'cxdqkjvtpilvouwtbgdy.supabase.co' || url.pathname !== '/rest/v1/sos_missions') {
      return nativeFetch(input, init);
    }

    try {
      const payload = typeof init.body === 'string' ? JSON.parse(init.body) : null;
      if (!payload || Array.isArray(payload)) return nativeFetch(input, init);
      const service = readService();
      if (service) {
        payload.requested_service_name = service.name;
        payload.category_id = service.categoryId;
        payload.subcategory_id = service.subcategoryId;
        payload.request_type = service.quoteRequired ? 'quote' : (payload.request_type || 'now');
        payload.intake_payload = {
          ...(payload.intake_payload || {}),
          source: 'sos-app',
          selected_service: service.name,
          selected_subcategory_id: service.subcategoryId,
        };
      }
      const coordinateMatch = String(payload.pickup_address || '').match(/^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
      if (coordinateMatch) {
        const latitude = Number(coordinateMatch[1]);
        const longitude = Number(coordinateMatch[2]);
        if (latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180) {
          payload.pickup_lat = latitude;
          payload.pickup_lng = longitude;
        }
      }
      return nativeFetch(input, { ...init, body: JSON.stringify(payload) });
    } catch {
      return nativeFetch(input, init);
    }
  };

  const isGenericPaymentTarget = (value) => {
    try { return new URL(value, location.href).hostname === 'buy.stripe.com'; }
    catch { return false; }
  };

  const disableGenericPayment = (element) => {
    if (!element || element.dataset.sosPaymentDisabled === 'true') return;
    element.dataset.sosPaymentDisabled = 'true';
    element.setAttribute('aria-disabled', 'true');
    element.setAttribute('title', 'Payment becomes available only after assignment and final price confirmation.');
    element.textContent = 'Payment available after assignment';
    if ('disabled' in element) element.disabled = true;
    element.style.opacity = '0.62';
    element.style.cursor = 'not-allowed';
  };

  const replaceLeafText = (element, value) => {
    if (!element || element.children.length !== 0 || element.textContent === value) return;
    element.textContent = value;
  };

  const protectApp = () => {
    const buttons = [...document.querySelectorAll('button')];
    const links = [...document.querySelectorAll('a[href]')];
    for (const link of links) if (isGenericPaymentTarget(link.href)) disableGenericPayment(link);

    for (const button of buttons) {
      const label = normalize(button.textContent);
      if (label === 'Pay with Card') disableGenericPayment(button);
      if (label === 'Dispatch Hero') replaceLeafText(button, 'Submit Support Request');
      if (/Hero$/i.test(label)) {
        const siblingLabels = button.parentElement
          ? [...button.parentElement.querySelectorAll(':scope > button')].map((item) => normalize(item.textContent))
          : [];
        if (siblingLabels.some((item) => /Citizen$/i.test(item))) {
          button.dataset.sosHeroApplication = 'true';
          replaceLeafText(button, '🦸 Apply as Hero');
        }
      }
    }

    const leaves = [...document.querySelectorAll('div,span,p')].filter((element) => element.children.length === 0);
    for (const element of leaves) {
      const label = normalize(element.textContent);
      if (label === 'Tap for Emergency Rescue') replaceLeafText(element, 'Tap to Request Roadside Help');
      else if (/^ETA:\s*/i.test(label)) replaceLeafText(element, 'Timing confirmed after assignment');
      else if (/^(5-10 min|10-20 min|20-40 min)$/i.test(label)) replaceLeafText(element, 'Timing pending');
      else if (/\s·\s(5-10 min|10-20 min|20-40 min)$/i.test(label)) replaceLeafText(element, label.replace(/\s·\s(5-10 min|10-20 min|20-40 min)$/i, ' · timing confirmed after assignment'));
      else if (label.includes('A verified Hero will be assigned and our team will contact you to confirm.')) {
        replaceLeafText(element, label.replace('A verified Hero will be assigned and our team will contact you to confirm.', 'Assignment and timing are not confirmed until an approved Hero or the operations team accepts the request.'));
      }
    }
  };

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('button,a,[role="button"]') : null;
    if (!target) return;
    const label = normalize(target.textContent);
    if (label === 'Submit Support Request' || label === 'Dispatch Hero') rememberService(target);

    if (target.dataset.sosHeroApplication === 'true') {
      event.preventDefault();
      event.stopImmediatePropagation();
      location.assign('/become-a-hero/');
      return;
    }
    if (target.dataset.sosPaymentDisabled === 'true' || (target instanceof HTMLAnchorElement && isGenericPaymentTarget(target.href))) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = event.target instanceof Element ? event.target.closest('button,a') : null;
    if (!target) return;
    if (target.dataset.sosHeroApplication === 'true') {
      event.preventDefault();
      event.stopImmediatePropagation();
      location.assign('/become-a-hero/');
    } else if (target.dataset.sosPaymentDisabled === 'true') {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; protectApp(); });
  };
  const start = () => {
    protectApp();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
