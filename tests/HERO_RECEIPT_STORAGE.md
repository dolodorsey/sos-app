# Confirmed application receipt storage

The submit handler now retains a confirmed application receipt and status in React state before attempting browser persistence. If setItem or draft removal throws, the existing notice panel asks the applicant to keep this tab open and not resubmit. Successful persistence, known rejection and verified-email duplicate recovery remain unchanged.

Run node --test tests/hero-receipt-storage.test.mjs. Five tests execute the actual submit function with mocked fetch and storage; no external calls or real applications. Both storage-failure assertions fail against the prior code. These tests do not cover React rendering/effects, tab closure, authenticated resume or backend idempotency. Typecheck was attempted but tsc is not installed in the current checkout. Controlled browser QA and independent review remain required before release. This source change is not deployed.
