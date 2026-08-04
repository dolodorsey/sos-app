'use client';

import dynamic from 'next/dynamic';
import SOSLoading from '@/components/SOSLoading';

const SOSCustomerMobilityApp = dynamic(() => import('@/components/SOSCustomerMobilityApp'), {
  ssr: false,
  loading: () => <SOSLoading label="Opening the SOS mobility network" />,
});

export default function AppPage() {
  return <SOSCustomerMobilityApp />;
}
