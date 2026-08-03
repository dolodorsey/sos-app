'use client';

import dynamic from 'next/dynamic';
import SOSLoading from '@/components/SOSLoading';

const SOSApp = dynamic(() => import('@/components/SOSApp'), {
  ssr: false,
  loading: () => <SOSLoading label="Opening the SOS response network" />,
});

export default function Home() {
  return <SOSApp />;
}
