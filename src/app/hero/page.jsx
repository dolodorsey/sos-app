'use client';

import dynamic from 'next/dynamic';
import SOSHeroAlertsHost from '@/components/SOSHeroAlertsHost';
import SOSHeroCitizenTrustHost from '@/components/SOSHeroCitizenTrustHost';
import SOSHeroIssueHost from '@/components/SOSHeroIssueHost';
import SOSHeroNoShowHost from '@/components/SOSHeroNoShowHost';
import SOSHeroReliabilityHost from '@/components/SOSHeroReliabilityHost';
import SOSNotificationInboxHost from '@/components/SOSNotificationInboxHost';
import SOSPaymentReadinessHost from '@/components/SOSPaymentReadinessHost';
import SOSMissionChatHost from '@/components/SOSMissionChatHost';
import SOSHeroClaimAccess from '@/components/SOSHeroClaimAccess';
import SOSPushRegistrationHost from '@/components/SOSPushRegistrationHost';
import SOSHeroVerificationReadinessHost from '@/components/SOSHeroVerificationReadinessHost';
import SOSRecoveryHost from '@/components/SOSRecoveryHost';

const SOSHeroRealtimeShell = dynamic(() => import('@/components/SOSHeroRealtimeShell'), {
  ssr: false,
  loading: () => null,
});

export default function HeroPortalPage() {
  return <><SOSPaymentReadinessHost audience="hero"/><SOSRecoveryHost audience="hero"/><SOSPushRegistrationHost/><SOSNotificationInboxHost/><SOSHeroRealtimeShell/><SOSHeroVerificationReadinessHost/><SOSHeroAlertsHost/><SOSHeroIssueHost/><SOSHeroNoShowHost/><SOSHeroReliabilityHost/><SOSHeroCitizenTrustHost/><SOSMissionChatHost/><SOSHeroClaimAccess/></>;
}
