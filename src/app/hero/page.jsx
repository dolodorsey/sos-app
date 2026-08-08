'use client';

import dynamic from 'next/dynamic';

const SOSHeroMobilityApp = dynamic(() => import('@/components/SOSHeroMobilityApp'), {
  ssr: false,
  loading: () => null,
});

export default function HeroPortalPage() {
  return <SOSHeroMobilityApp />;
}
