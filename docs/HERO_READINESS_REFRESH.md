# Hero readiness refresh isolation

Readiness is cleared when the current refresh fails or no session remains. Request sequencing prevents older successes or failures from overwriting newer results. Responses from a replaced session are discarded and clear the old state; effect cleanup invalidates pending work on unmount.

Validation: 12 actual component-loader/effect VM tests pass with mocked fetch and hooks; repository TypeScript check passes. No production requests or records are involved. These checks do not prove browser rendering or production readiness. Sign-out after a settled response is detected at the next existing 12-second poll, not immediately. Server verification, presence authorization, and database concurrency remain separate requirements. No approval or payout behavior changes.

Run `node --test tests/hero-readiness-refresh.test.mjs`.
