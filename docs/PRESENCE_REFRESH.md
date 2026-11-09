# Patrol refresh failure handling

A successful presence write followed by a failed profile refresh previously produced an error alongside a new success notice. The patrol toggle now opts into load error propagation so it does not publish that notice after a failed refresh. Other load callers keep existing behavior. Successful start acknowledges a status update without claiming eligibility for mission offers; off-duty success copy remains unchanged.

Run `node tests/presence-refresh.test.mjs`. Six checks execute actual request/rpc/edge/load/toggle bodies with mocked fetch, GPS, setters and useCallback: three refresh read failures, successful start, successful stop and checklist rejection. The original defect was separately reproduced before this change. No real operations occur.

This does not repair silent heartbeat rejection, stale cached state after a committed write, prior notice retention or duplicate submissions. React/browser QA, independent review and exact release approval remain pending. The separate SQL complete-check guard is not included or deployed by this change. STOP ALL SENDS remains in force.


November 9 recovery guidance: after a successful presence RPC, failed refresh now explicitly reports that the update was accepted, the display may be stale, and the user should refresh the page before changing patrol again. Each manual toggle clears an older success notice. Checklist/RPC rejection retains its original error; no automatic write retry is added.

This is guidance only: cached duty display and controls remain unchanged after a failed refresh. It does not enforce a retry lock or resolve heartbeat, network-ambiguous write outcomes, polling races or cross-tab behavior. Eight extracted-function checks cover the guidance, prior-notice clearing, rejection and successful start/stop with mocked fetch. New browser verification and independent review remain pending.
