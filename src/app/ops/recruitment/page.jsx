'use client';

import SOSPrelaunchGate from '@/components/prelaunch/SOSPrelaunchGate';
import SOSRecruitmentCommand from '@/components/prelaunch/SOSRecruitmentCommand';

// Internal recruitment command (issue #103 §8). Operator-only data via SECURITY DEFINER RPCs.
export default function RecruitmentCommandPage() {
  return <SOSPrelaunchGate area="ops"><SOSRecruitmentCommand /></SOSPrelaunchGate>;
}
