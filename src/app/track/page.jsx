'use client';

import SOSPrelaunchGate from '@/components/prelaunch/SOSPrelaunchGate';

import dynamic from 'next/dynamic';

const SOSApp = dynamic(() => import('../../components/SOSApp'), { ssr: false });

function MissionTrackingPage() {
  return <SOSApp />;
}

// Pre-launch: preserved for authorized internal QA only. Server-side triggers enforce the closure.
export default function GatedMissionTrackingPage(){
  return <SOSPrelaunchGate area="app"><MissionTrackingPage /></SOSPrelaunchGate>;
}
