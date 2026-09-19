'use client';

import { useEffect, useState } from 'react';
import SOSInstallAppPrompt from './SOSInstallAppPrompt';

export default function SOSInstallAppPromptClient() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  return <SOSInstallAppPrompt />;
}
