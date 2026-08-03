(() => {
  'use strict';
  if (window.__SOS_SAFETY_GUARD_ACTIVE__) return;
  window.__SOS_SAFETY_GUARD_ACTIVE__ = true;

  const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  const isGenericPaymentTarget = (value) => {
    try {
      return new URL(value, location.href).hostname === 'buy.stripe.com';
    } catch {
      return false;
    }
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

    for (const link of links) {
      if (isGenericPaymentTarget(link.href)) disableGenericPayment(link);
    }

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
      if (label === 'Tap for Emergency Rescue') {
        replaceLeafText(element, 'Tap to Request Roadside Help');
      } else if (/^ETA:\s*/i.test(label)) {
        replaceLeafText(element, 'Timing confirmed after assignment');
      } else if (/^(5-10 min|10-20 min|20-40 min)$/i.test(label)) {
        replaceLeafText(element, 'Timing pending');
      } else if (/\s·\s(5-10 min|10-20 min|20-40 min)$/i.test(label)) {
        replaceLeafText(element, label.replace(/\s·\s(5-10 min|10-20 min|20-40 min)$/i, ' · timing confirmed after assignment'));
      } else if (label.includes('A verified Hero will be assigned and our team will contact you to confirm.')) {
        replaceLeafText(
          element,
          label.replace(
            'A verified Hero will be assigned and our team will contact you to confirm.',
            'Assignment and timing are not confirmed until an approved Hero or the operations team accepts the request.'
          )
        );
      }
    }
  };

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('button,a') : null;
    if (!target) return;

    if (target.dataset.sosHeroApplication === 'true') {
      event.preventDefault();
      event.stopImmediatePropagation();
      location.assign('/become-a-hero/');
      return;
    }

    if (
      target.dataset.sosPaymentDisabled === 'true' ||
      (target instanceof HTMLAnchorElement && isGenericPaymentTarget(target.href))
    ) {
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
    requestAnimationFrame(() => {
      scheduled = false;
      protectApp();
    });
  };

  const start = () => {
    protectApp();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
