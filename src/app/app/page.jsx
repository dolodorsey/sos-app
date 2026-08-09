'use client';

import dynamic from 'next/dynamic';
import SOSCustomerOperationsHost from '@/components/SOSCustomerOperationsHost';
import SOSCustomerCancellationHost from '@/components/SOSCustomerCancellationHost';
import SOSPaymentReadinessHost from '@/components/SOSPaymentReadinessHost';

const SOSCustomerMobilityApp = dynamic(() => import('@/components/SOSCustomerMobilityApp'), {
  ssr: false,
  loading: () => null,
});

export default function AppPage() {
  return <><SOSPaymentReadinessHost audience="customer"/><SOSCustomerMobilityApp/><SOSCustomerOperationsHost/><SOSCustomerCancellationHost/></>;
}
