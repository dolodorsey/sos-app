'use client';

import dynamic from 'next/dynamic';
import SOSMembershipHost from '@/components/SOSMembershipHost';

const SOSCustomerMobilityApp = dynamic(() => import('@/components/SOSCustomerMobilityApp'), {
  ssr: false,
  loading: () => null,
});

export default function Home() {
  return <><SOSCustomerMobilityApp/><SOSMembershipHost/></>;
}
