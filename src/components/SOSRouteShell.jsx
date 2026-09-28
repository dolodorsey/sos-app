'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';

const ROOT_ROUTES = new Set(['/', '/app', '/hero', '/ops']);
const AUTHORITY_ROUTES = new Set([
  '/superheros',
  '/why-superheros',
  '/about-superheros-on-standby',
  '/superheros-network',
  '/brand',
  '/press',
  '/media-kit',
  '/history',
]);

const fallbackFor = (pathname) => {
  if (pathname.startsWith('/hero/')) return '/hero';
  if (pathname.startsWith('/ops/')) return '/ops';
  if (pathname.startsWith('/auth/')) return '/login';
  if (pathname === '/login') return '/';
  if (pathname === '/privacy' || pathname === '/terms' || pathname === '/legal') return '/';
  if (pathname === '/support' || pathname === '/track') return '/app';
  if (AUTHORITY_ROUTES.has(pathname)) return '/superheros';
  return '/';
};

export default function SOSRouteShell({ children }) {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const currentPath = useRef(pathname);
  const previousAppPath = useRef(null);
  const authority = AUTHORITY_ROUTES.has(pathname);
  const hasRouteHeader = !ROOT_ROUTES.has(pathname) && !authority;

  useEffect(() => {
    if (currentPath.current !== pathname) {
      previousAppPath.current = currentPath.current;
      currentPath.current = pathname;
    }
  }, [pathname]);

  const goBack = () => {
    const fallback = fallbackFor(pathname);
    const sameOriginReferrer = (() => {
      try { return document.referrer && new URL(document.referrer).origin === window.location.origin; }
      catch { return false; }
    })();

    if (window.history.length > 1 && (previousAppPath.current || sameOriginReferrer)) {
      router.back();
      return;
    }
    router.replace(fallback);
  };

  if (authority) {
    return <div className="sos-authority-shell">{children}</div>;
  }

  return (
    <div className={hasRouteHeader ? 'sos-route-frame has-route-header' : 'sos-route-frame'}>
      {hasRouteHeader && (
        <header className="sos-route-header">
          <button type="button" onClick={goBack} aria-label="Go back">
            <span aria-hidden="true">‹</span>
            Back
          </button>
          <a href="/" className="sos-route-brand" aria-label="S.O.S. home">
            <img src="/brand/sos-logo.webp" alt="" />
            <span><strong>S.O.S.</strong><small>Superheros On Standby</small></span>
          </a>
          <span className="sos-route-balance" aria-hidden="true" />
        </header>
      )}
      <div className="app-shell sos-premium" data-app="sos">{children}</div>
    </div>
  );
}
