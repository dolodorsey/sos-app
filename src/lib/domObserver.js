'use client';

/*
 * Safe DOM observation for the S.O.S. host components.
 *
 * Several hosts patch the rendered app after React paints (badges, truthful
 * copy, icons). Raw MutationObservers that write to the DOM can wake each other
 * up forever: host A rewrites a node, host B's observer fires and rewrites it
 * back, A fires again... That spin runs in microtasks and freezes the page
 * ("Page Unresponsive"). Two rules prevent it:
 *
 *   1. Writes are idempotent — setText/setData/setAttr only touch the DOM when
 *      the value actually changes, so a settled page produces zero mutations.
 *   2. Callbacks are coalesced to one run per animation frame and the
 *      observer's own writes are discarded, so a host can never re-trigger
 *      itself and the browser always gets to paint between passes.
 */

export function observeBody(callback, options = { childList: true, subtree: true }) {
  if (typeof window === 'undefined' || !document.body) return () => {};
  let frame = 0;
  let stopped = false;
  let observer = null;

  const run = () => {
    frame = 0;
    if (stopped) return;
    try { callback(); } catch (error) { console.warn('[sos] DOM host pass failed', error); }
    // Drop records produced by our own writes so we do not wake ourselves.
    observer?.takeRecords();
  };

  const schedule = () => {
    if (stopped || frame) return;
    frame = window.requestAnimationFrame(run);
  };

  observer = new MutationObserver(schedule);
  observer.observe(document.body, options);
  run();

  return () => {
    stopped = true;
    if (frame) window.cancelAnimationFrame(frame);
    observer.disconnect();
  };
}

export function setText(element, value) {
  if (!element) return false;
  const next = String(value ?? '');
  if (element.textContent === next) return false;
  element.textContent = next;
  return true;
}

export function setData(element, key, value) {
  if (!element) return false;
  const next = String(value ?? '');
  if (element.dataset[key] === next) return false;
  element.dataset[key] = next;
  return true;
}

export function setAttr(element, name, value) {
  if (!element) return false;
  const next = String(value ?? '');
  if (element.getAttribute(name) === next) return false;
  element.setAttribute(name, next);
  return true;
}
