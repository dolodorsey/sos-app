'use client';

import dynamic from 'next/dynamic';

const SOSNetworkCommand = dynamic(() => import('@/components/SOSNetworkCommand'), { ssr: false, loading: () => null });

export default function SOSNetworkCommandPage() { return <SOSNetworkCommand />; }
