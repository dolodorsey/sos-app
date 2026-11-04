# Hero readiness refresh isolation

Readiness is cleared when the current refresh fails or no session remains. Request sequencing prevents older successes or failures from overwriting newer results. Responses from a replaced session are discarded and clear the old state; effect cleanup invalidates pending work on unmount.

Validation: 12 actual component-loader/effect VM tests pass with mocked fetch and hooks; repository TypeScript check passes. No production requests or records are involved. These checks do not prove browser rendering or production readiness. Sign-out after a settled response is detected at the next existing 12-second poll, not immediately. Server verification, presence authorization, and database concurrency remain separate requirements. No approval or payout behavior changes.

Run `node --test tests/hero-readiness-refresh.test.mjs`.

Unknown readiness now retains the false dispatch marker instead of removing it. This keeps the existing CSS suppression of Start Patrol in place if the separate base app retains stale verified/payout state. Only a current Hero response with dispatch readiness enables the marker; End Patrol remains excluded from suppression. Unmount removes both owned markers.

Validation: eight actual-effect VM/selector regression checks plus the existing twelve loader tests. These use mocked hooks and DOM data, not a browser or server authorization test. Browser coexistence, initial paint, unknown-status presentation, and independent review remain pending. This change does not resolve the separate SQL concurrency blocker or authorize deployment.
