'use client';

import dynamic from 'next/dynamic';
import SOSHeroAlertsHost from '@/components/SOSHeroAlertsHost';
import SOSHeroIssueHost from '@/components/SOSHeroIssueHost';
import SOSHeroNoShowHost from '@/components/SOSHeroNoShowHost';

const SOSHeroMobilityApp = dynamic(() => import('@/components/SOSHeroMobilityApp'), {
  ssr: false,
  loading: () => null,
});

export default function HeroPortalPage() {
  return <><SOSHeroMobilityApp/><SOSHeroAlertsHost/><SOSHeroIssueHost/><SOSHeroNoShowHost/></>;
}
