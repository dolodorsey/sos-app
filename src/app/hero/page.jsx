'use client';

import dynamic from 'next/dynamic';
import SOSHeroAlertsHost from '@/components/SOSHeroAlertsHost';
import SOSHeroIssueHost from '@/components/SOSHeroIssueHost';
import SOSHeroNoShowHost from '@/components/SOSHeroNoShowHost';
import SOSPaymentReadinessHost from '@/components/SOSPaymentReadinessHost';

const SOSHeroMobilityApp = dynamic(() => import('@/components/SOSHeroMobilityApp'), {
  ssr: false,
  loading: () => null,
});

export default function HeroPortalPage() {
  return <><SOSPaymentReadinessHost audience="hero"/><SOSHeroMobilityApp/><SOSHeroAlertsHost/><SOSHeroIssueHost/><SOSHeroNoShowHost/></>;
}
