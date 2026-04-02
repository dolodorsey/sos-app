'use client';
import dynamic from 'next/dynamic';
const SOSApp = dynamic(() => import('@/components/SOSApp'), { ssr: false });
export default function Home() { return <SOSApp />; }
