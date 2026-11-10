# Patrol refresh failure handling

A successful presence write followed by a failed profile refresh previously produced an error alongside a new success notice. The patrol toggle now opts into load error propagation so it does not publish that notice after a failed refresh. Other load callers keep existing behavior. Successful start acknowledges a status update without claiming eligibility for mission offers; off-duty success copy remains unchanged.

Run `node tests/presence-refresh.test.mjs`. Six checks execute actual request/rpc/edge/load/toggle bodies with mocked fetch, GPS, setters and useCallback: three refresh read failures, successful start, successful stop and checklist rejection. The original defect was separately reproduced before this change. No real operations occur.

This does not repair silent heartbeat rejection, stale cached state after a committed write, prior notice retention or duplicate submissions. React/browser QA, independent review and exact release approval remain pending. The separate SQL complete-check guard is not included or deployed by this change. STOP ALL SENDS remains in force.


November 9 recovery guidance: after a successful presence RPC, failed refresh now explicitly reports that the update was accepted, the display may be stale, and the user should refresh the page before changing patrol again. Each manual toggle clears an older success notice. Checklist/RPC rejection retains its original error; no automatic write retry is added.

This is guidance only: cached duty display and controls remain unchanged after a failed refresh. It does not enforce a retry lock or resolve heartbeat, network-ambiguous write outcomes, polling races or cross-tab behavior. Eight extracted-function checks cover the guidance, prior-notice clearing, rejection and successful start/stop with mocked fetch. New browser verification and independent review remain pending.

November 10 refresh ordering: loads now use a monotonically increasing generation and an accepted session reference. Only the latest load for that session may commit data/errors or redirect. Superseded ordinary loads return an explicit status; throwOnError loads reject so patrol cannot report successful refresh. Boot/login establish the accepted session; logout invalidates before awaiting its presence request, and effect cleanup invalidates on unmount. Old-session producers cannot start reads while logged out or after credentials/user change.

Run `node tests/refresh-order.test.mjs` (nine actual extracted load/logout/effect checks) and `node tests/presence-refresh.test.mjs` (eight patrol checks). Dependencies are mocked; no real presence updates occur. This does not cancel already-started HTTP requests, make reads a database snapshot, prevent stale operational writes, or fully isolate all other async action handlers. Reuse of identical credentials across logout/login is not an epoch-bound producer guarantee. A background refresh may supersede manual refresh and conservatively show recovery guidance. Browser/build verification for this new source, independent review, guarded recovery UI and exact release approval remain pending. STOP ALL SENDS remains in force.
