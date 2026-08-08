'use client';

import dynamic from 'next/dynamic';

const SOSCustomerMobilityApp = dynamic(() => import('@/components/SOSCustomerMobilityApp'), {
  ssr: false,
  loading: () => null,
});

export default function AppPage() {
  return <SOSCustomerMobilityApp />;
}
