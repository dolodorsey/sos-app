import SOSPrelaunchLanding from '@/components/prelaunch/SOSPrelaunchLanding';

// Pre-launch public homescreen (issue #103). The operational customer app is preserved at
// /app behind the internal-access gate; it is no longer the public entry point.
export const metadata = {
  title: 'S.O.S. — Superheros On Standby | Coming to Atlanta · Providers wanted',
  description: 'S.O.S. — Superheros On Standby is pre-launch and recruiting verified roadside and mobile vehicle-service providers across Atlanta. Not accepting service requests yet. Not 911.',
  alternates: { canonical: '/' },
};

// Public pages allow pinch-zoom (accessibility); the preserved operational app keeps its own viewport.
export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', userScalable: true, themeColor: '#070e1a' };

export default function HomePage() {
  return <SOSPrelaunchLanding />;
}
