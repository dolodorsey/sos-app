'use client';

import SOSPrelaunchGate from '@/components/prelaunch/SOSPrelaunchGate';

import dynamic from 'next/dynamic';

const SOSOperationsCommand=dynamic(()=>import('@/components/SOSOperationsCommand'),{ssr:false,loading:()=>null});

function SOSOperationsPage(){return <SOSOperationsCommand/>;}

// Pre-launch: preserved for authorized internal QA only. Server-side triggers enforce the closure.
export default function GatedSOSOperationsPage(){
  return <SOSPrelaunchGate area="ops"><SOSOperationsPage /></SOSPrelaunchGate>;
}
