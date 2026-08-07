'use client';

import dynamic from 'next/dynamic';
import SOSLoading from '@/components/SOSLoading';

const SOSHeroMobilityApp = dynamic(() => import('@/components/SOSHeroMobilityApp'), {
  ssr: false,
  loading: () => <SOSLoading label="Opening Hero Command" />,
});

export default function HeroPortalPage() {
  return <SOSHeroMobilityApp />;
}
