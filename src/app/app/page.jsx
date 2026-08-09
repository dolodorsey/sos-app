'use client';

import dynamic from 'next/dynamic';
import SOSCustomerOperationsHost from '@/components/SOSCustomerOperationsHost';
import SOSCustomerCancellationHost from '@/components/SOSCustomerCancellationHost';
import SOSCustomerCoverageStatusHost from '@/components/SOSCustomerCoverageStatusHost';
import SOSCustomerReceiptHost from '@/components/SOSCustomerReceiptHost';
import SOSNotificationInboxHost from '@/components/SOSNotificationInboxHost';
import SOSShareTrackingHost from '@/components/SOSShareTrackingHost';
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
  return <><SOSPaymentReadinessHost audience="customer"/><SOSRecoveryHost audience="customer"/><SOSPushRegistrationHost/><SOSNotificationInboxHost/><SOSCustomerRealtimeShell/><SOSCustomerCoverageStatusHost/><SOSCustomerOperationsHost/><SOSCustomerCancellationHost/><SOSSettlementReviewHost/><SOSMissionChatHost/><SOSMembershipHost/><SOSProfileToolsHost/><SOSCustomerReceiptHost/><SOSShareTrackingHost/></>;
}
