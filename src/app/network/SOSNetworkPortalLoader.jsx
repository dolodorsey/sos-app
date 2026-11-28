'use client';

import dynamic from 'next/dynamic';

const SOSNetworkPortal = dynamic(() => import('@/components/SOSNetworkPortal'), { ssr: false, loading: () => null });

export default function SOSNetworkPortalLoader() {
  return <SOSNetworkPortal />;
}
