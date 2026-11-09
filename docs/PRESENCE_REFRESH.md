# Patrol refresh failure handling

A successful presence write followed by a failed profile refresh previously produced an error alongside a new success notice. The patrol toggle now opts into load error propagation so it does not publish that notice after a failed refresh. Other load callers keep existing behavior. Successful start acknowledges a status update without claiming eligibility for mission offers; off-duty success copy remains unchanged.

Run `node tests/presence-refresh.test.mjs`. Six checks execute actual request/rpc/edge/load/toggle bodies with mocked fetch, GPS, setters and useCallback: three refresh read failures, successful start, successful stop and checklist rejection. The original defect was separately reproduced before this change. No real operations occur.

This does not repair silent heartbeat rejection, stale cached state after a committed write, prior notice retention or duplicate submissions. React/browser QA, independent review and exact release approval remain pending. The separate SQL complete-check guard is not included or deployed by this change. STOP ALL SENDS remains in force.
