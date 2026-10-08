import SOSProviderEarlyRegistration from '@/components/prelaunch/SOSProviderEarlyRegistration';

// Canonical provider early-registration route. Interest only — not the full Hero
// application (preserved separately, invitation-only).
export const metadata = {
  title: 'Join the SUPERHEROS network | S.O.S. provider early registration',
  description: 'Register early interest as an S.O.S. roadside or mobile vehicle-service provider in Atlanta. About a minute, no documents, not an application or a guarantee of work.',
  alternates: { canonical: '/become-a-hero/' },
};

// Public pages allow pinch-zoom (accessibility); the preserved operational app keeps its own viewport.
export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', userScalable: true, themeColor: '#070e1a' };

export default function BecomeAHeroPage() {
  return <SOSProviderEarlyRegistration />;
}
