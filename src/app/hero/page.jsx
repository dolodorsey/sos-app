'use client';

import dynamic from 'next/dynamic';
import SOSHeroAlertsHost from '@/components/SOSHeroAlertsHost';
import SOSHeroIssueHost from '@/components/SOSHeroIssueHost';

const SOSHeroMobilityApp = dynamic(() => import('@/components/SOSHeroMobilityApp'), {
  ssr: false,
  loading: () => null,
});

export default function HeroPortalPage() {
  return <><SOSHeroMobilityApp/><SOSHeroAlertsHost/><SOSHeroIssueHost/></>;
}
