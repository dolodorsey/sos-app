'use client';

import dynamic from 'next/dynamic';
import SOSMembershipHost from '@/components/SOSMembershipHost';
import SOSCustomerLiveHost from '@/components/SOSCustomerLiveHost';

const SOSCustomerMobilityApp = dynamic(() => import('@/components/SOSCustomerMobilityApp'), {
  ssr: false,
  loading: () => null,
});

export default function Home() {
  return <><SOSCustomerMobilityApp/><SOSMembershipHost/><SOSCustomerLiveHost/></>;
}
