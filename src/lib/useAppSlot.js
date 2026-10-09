'use client';

import { useEffect, useState } from 'react';
import { observeBody } from './domObserver';

/*
 * Named mount points inside the customer app chrome, so host components can
 * place their UI *in* the app (top bar, status area, profile menu) instead of
 * floating fixed-position pills over it.
 *
 *   top-actions  → inside .sos2-topbar (inbox, live status)
 *   status       → first child of .sos2-content (network / payment notices)
 *   profile      → end of .sos2-profile-menu (alerts, account & privacy)
 *
 * Returns the slot element, or null while that part of the app isn't rendered.
 */
const SLOTS = {
  'top-actions': { container: '.sos2-topbar', where: 'append' },
  status: { container: '.sos2-content', where: 'prepend' },
  profile: { container: '.sos2-profile-menu', where: 'append' },
  'hero-top': { container: '.shc-top-right', where: 'prepend' },
};

function ensureSlot(name) {
  const spec = SLOTS[name];
  const container = spec && document.querySelector(spec.container);
  if (!container) return null;
  let slot = container.querySelector(`:scope > [data-sos-slot="${name}"]`);
  if (!slot) {
    slot = document.createElement('div');
    slot.dataset.sosSlot = name;
    slot.className = `sos-slot sos-slot-${name}`;
    if (spec.where === 'prepend') container.prepend(slot);
    else container.appendChild(slot);
  } else if (spec.where === 'prepend' && container.firstElementChild !== slot) {
    container.prepend(slot);
  }
  return slot;
}

export function useAppSlot(name) {
  const [slot, setSlot] = useState(null);
  useEffect(() => observeBody(() => {
    const next = ensureSlot(name);
    setSlot((current) => (current === next ? current : next));
  }), [name]);
  return slot;
}

export function isCustomerAppRoute() {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  return path === '/' || path === '/app';
}
