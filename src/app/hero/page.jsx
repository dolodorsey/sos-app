'use client';

import dynamic from 'next/dynamic';
import SOSHeroAlertsHost from '@/components/SOSHeroAlertsHost';
import SOSHeroIssueHost from '@/components/SOSHeroIssueHost';
import SOSHeroNoShowHost from '@/components/SOSHeroNoShowHost';
import SOSHeroReliabilityHost from '@/components/SOSHeroReliabilityHost';
import SOSPaymentReadinessHost from '@/components/SOSPaymentReadinessHost';
import SOSMissionChatHost from '@/components/SOSMissionChatHost';
import SOSHeroClaimAccess from '@/components/SOSHeroClaimAccess';
import SOSPushRegistrationHost from '@/components/SOSPushRegistrationHost';

const SOSHeroRealtimeShell = dynamic(() => import('@/components/SOSHeroRealtimeShell'), {
  ssr: false,
  loading: () => null,
});

export default function HeroPortalPage() {
  return <><SOSPaymentReadinessHost audience="hero"/><SOSPushRegistrationHost/><SOSHeroRealtimeShell/><SOSHeroAlertsHost/><SOSHeroIssueHost/><SOSHeroNoShowHost/><SOSHeroReliabilityHost/><SOSMissionChatHost/><SOSHeroClaimAccess/></>;
}
