'use client';

import dynamic from 'next/dynamic';

const SOSOperationsCommand=dynamic(()=>import('@/components/SOSOperationsCommand'),{ssr:false,loading:()=>null});

export default function SOSOperationsPage(){return <SOSOperationsCommand/>;}
