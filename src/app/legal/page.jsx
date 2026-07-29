'use client';
import dynamic from 'next/dynamic';

/* Full not-911 / liability disclaimer, on its own page.
   Reachable from the site footer — never shown as a gate on the web. */
const NotNineOneOneGate = dynamic(() => import('@/components/NotNineOneOneGate'), { ssr: false });

export default function LegalPage() {
  const goHome = () => { window.location.href = '/'; };
  return <NotNineOneOneGate forceShow onAccept={goHome} onDismiss={goHome} />;
}
