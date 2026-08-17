'use client';

import dynamic from 'next/dynamic';
import SOSMembershipHost from '@/components/SOSMembershipHost';
import SOSCustomerLiveHost from '@/components/SOSCustomerLiveHost';
import SOSProfileToolsHost from '@/components/SOSProfileToolsHost';

const SOSCustomerMobilityApp = dynamic(() => import('@/components/SOSCustomerMobilityApp'), {
  ssr: false,
  loading: () => null,
});

export default function Home() {
  return <><SOSCustomerMobilityApp/><SOSMembershipHost/><SOSProfileToolsHost/><SOSCustomerLiveHost/></>;
}
