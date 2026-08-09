# S.O.S. Release Evidence

## Product boundary

- Public product: **S.O.S. — Superheroes On Standby**.
- Repository: `dolodorsey/sos-app`.
- Primary domain: `https://thesuperherosonstandby.com`.
- Production Supabase project: `cxdqkjvtpilvouwtbgdy`.
- Product database namespace: `sos_*` only. Shared infrastructure with ON CALL does not merge product ownership or public branding.
- Scope: non-emergency roadside and mobile-vehicle service marketplace; emergency copy directs users to 911.

## Current production data — August 9, 2026

- 28 S.O.S. user records.
- 25 stored Hero records.
- **0 currently dispatch-eligible Heroes** under the live rule: verified Hero + active authenticated user.
- 0 on-duty dispatch-eligible Heroes.
- 0 missions.
- 0 mission payments.
- 0 subscriptions.
- 0 disputes.
- 0 ratings.
- 0 Hero earnings rows.

The current `sos-network-readiness` endpoint returns the stored-Hero count separately from dispatch-eligible supply so the customer UI cannot misrepresent stored records as launch-ready Heroes.

Those zero transaction counts are reported as **market activation state**, not as proof that the software lifecycle is absent.

## Software lifecycle proven without fabricating customer history

A disposable database marketplace simulation was executed against the production schema without calling Stripe and without preserving QA rows. It proved:

1. A pending S.O.S. mission entered ranked dispatch.
2. Dispatch created exactly one Hero offer.
3. The offered Hero accepted atomically and the mission became `assigned`.
4. Starting the route without customer payment authorization was rejected.
5. Adding an authorized payment state unlocked `en_route`.
6. QA fixture cleanup was verified after the simulation.

This evidence is recorded separately in the private release-evidence ledger and is **not** counted as real mission activity.

## Marketplace controls currently implemented

- Customer account and live service catalog.
- GPS-required mission request flow.
- Ranked verified-Hero dispatch with expiring offers and radius expansion.
- Hero presence/location heartbeat and participant-safe customer tracking.
- Hero accept/decline and automatic offer expiry/recovery.
- Hero-owned final-price confirmation before travel.
- Customer payment authorization required before route start.
- Server-enforced mission transitions and proof-based completion.
- Stripe capture/transfer lifecycle and Hero payout readiness logic.
- Customer/Hero mission chat, persistent notifications, realtime updates, and background alert infrastructure.
- Customer cancellation quote/settlement and timed customer no-show settlement.
- Hero release/rematching, start watchdog, stale-GPS warning/escalation, safety/reliability review, and customer fee-review workflows.
- Completed mission rating contract.
- Shield membership is now a mounted live plan experience: live plans, current-plan state, Stripe subscription checkout contract, return verification, and explicit payment-health gating. The old visible “coming next” behavior is intercepted/replaced.

## Automated verification

S.O.S. now has three dedicated Node test files rather than the previous single test file:

- `tests/release-readiness.test.mjs`
- `tests/layout-regression.test.mjs`
- `tests/marketplace-loop-contract.test.mjs`

The quality gate validates production build/dependency integrity plus marketplace-loop contracts, customer/Hero portal mounts, payment-gated travel, cancellation/no-show settlement source, desktop shell regressions, desktop readability, Shield enrollment contracts, truthful Hero eligibility, fail-closed payment behavior, and the SSR/localStorage regression that previously broke deployment.

## UI verification

- The underlying S.O.S. shell still contains legacy phone-width styling, but the final stylesheet is deliberately loaded last and breaks customer/Hero products out to true desktop width at ≥900px.
- The production bundle contains explicit `max-width:none !important` overrides for `.app-shell.sos-premium`, `.sos2-app`, and the Hero Command shell.
- Desktop card/service/mission typography was increased so desktop no longer relies on phone-scale 7–11px copy.
- `/app` and `/hero` return HTTP 200 on the custom production domain.
- The exact CSS bundle served by the production deployment was fetched and contains the final width/readability overrides.
- Shield is mounted into `/app` with responsive membership styling and live plan state.

A full external Chromium screenshot session is not claimed here because outbound browser networking is unavailable in the current verification environment. Bundle-level production verification, HTTP route checks, CI, database lifecycle tests, and runtime logging are used instead.

## Shared-backend isolation

The server-only namespace audit currently reports:

- zero `sos_* ↔ oc_*` foreign keys;
- zero public S.O.S./ON CALL product tables with RLS disabled;
- zero anonymous/public direct INSERT, UPDATE, DELETE, or TRUNCATE grants on product tables;
- zero cross-prefix database-function references.

## Release hygiene

A private release-hygiene audit fails if QA fixture users, QA addresses, or `example.invalid` records remain in the S.O.S./ON CALL marketplace tables. Old `qa-share-*` rows discovered during this repair were removed. Current hygiene result: zero QA fixtures.

## Payment/runtime truth

The public `marketplace-payments-health` endpoint was called from inside the production Supabase project and returned **HTTP 503** with:

- `ready: false`
- `stripe_server_credential: false`
- `webhook_signature_secret: true`
- `credential_sources.stripe: "missing"`
- `credential_sources.webhook: "vault"`

Therefore:

- webhook signature verification is configured;
- the Stripe server credential is not currently available to production Edge Functions;
- live charges, captures, transfers, payout onboarding, and Shield enrollment are intentionally fail-closed before Stripe is called;
- Shield still shows the real plans, but enrollment buttons report payment runtime offline while this credential is missing.

The connected Stripe account is available through the authorized Stripe connector, but that connector does not expose or create the secret API key needed by Supabase Edge Functions. Restoring that secret is an authorized account/key-management step, not a missing application-code implementation.

## Not claimed

- S.O.S. is **not yet market-proven**: there are no completed real missions, payment history, subscriptions, disputes, ratings, or earnings in production.
- The 25 stored Hero records are not described as launch-ready supply because none currently satisfies the verified/authenticated dispatch gate.
- No fake mission, payout, rating, or Stripe transaction is retained to make the marketplace look active.
- Store distribution status is separate from web/software readiness and should be evaluated from the current native release workflows rather than inferred from web deployment status.
