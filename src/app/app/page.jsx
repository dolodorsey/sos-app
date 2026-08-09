'use client';

import dynamic from 'next/dynamic';
import SOSCustomerOperationsHost from '@/components/SOSCustomerOperationsHost';
import SOSCustomerCancellationHost from '@/components/SOSCustomerCancellationHost';
import SOSSettlementReviewHost from '@/components/SOSSettlementReviewHost';
import SOSPaymentReadinessHost from '@/components/SOSPaymentReadinessHost';
import SOSMissionChatHost from '@/components/SOSMissionChatHost';
import SOSMembershipHost from '@/components/SOSMembershipHost';
import SOSProfileToolsHost from '@/components/SOSProfileToolsHost';
import SOSPushRegistrationHost from '@/components/SOSPushRegistrationHost';
import SOSRecoveryHost from '@/components/SOSRecoveryHost';

const SOSCustomerRealtimeShell = dynamic(() => import('@/components/SOSCustomerRealtimeShell'), {
  ssr: false,
  loading: () => null,
});

export default function AppPage() {
  return <><SOSPaymentReadinessHost audience="customer"/><SOSRecoveryHost audience="customer"/><SOSPushRegistrationHost/><SOSCustomerRealtimeShell/><SOSCustomerOperationsHost/><SOSCustomerCancellationHost/><SOSSettlementReviewHost/><SOSMissionChatHost/><SOSMembershipHost/><SOSProfileToolsHost/></>;
}
