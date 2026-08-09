# S.O.S. Release Evidence

## Product boundary

- Public product: **S.O.S. — Superheroes On Standby**.
- Repository: `dolodorsey/sos-app`.
- Primary domain: `https://thesuperherosonstandby.com`.
- Production Supabase project: `cxdqkjvtpilvouwtbgdy`.
- Product database namespace: `sos_*` only. Shared infrastructure with ON CALL does not merge product ownership or public branding.
- Scope: non-emergency roadside and mobile-vehicle service marketplace; emergency copy directs users to 911.

## Current production truth — August 9, 2026

- 28 S.O.S. user records total.
- **0 real Hero records currently available as supply.**
- 25 historical Hero records are explicitly classified as **demo fixtures** because their linked identities use the `@sos-demo.atl` demo domain.
- **0 real recruiting candidates.**
- 25 historical recruiting records are explicitly classified as **demo fixtures** and are paused/excluded from the real activation pipeline.
- 0 dispatch-eligible real Heroes.
- 0 on-duty dispatch-eligible real Heroes.
- 0 real missions.
- 0 mission payments.
- 0 subscriptions.
- 0 disputes.
- 0 ratings.
- 0 Hero earnings rows.

The `sos-network-readiness` endpoint now returns real supply and demo fixtures separately. Demo users/candidates are also excluded at the database layer from Hero ranking, direct mission offers, candidate claiming, and the real S.O.S. Operations Command queue.

Those zero real-supply and transaction counts are reported as **market activation state**, not as evidence that the software lifecycle is absent.

## Software lifecycle proven without fabricating customer history

A disposable database marketplace simulation was executed against the production schema without calling Stripe and without preserving QA rows. It proved the lifecycle state machine and payment gate. That historical QA proof is not counted as real mission activity and does not convert the quarantined demo records into real supply.

The proven contract is:

1. A request can enter dispatch.
2. A qualified eligible Hero offer can be created.
3. Offer acceptance atomically assigns the mission.
4. Starting travel without customer payment authorization is rejected.
5. An authorized payment state unlocks `en_route`.
6. QA fixture cleanup is verified after the simulation.

## Marketplace controls currently implemented

- Customer account and live service catalog.
- GPS-required mission request flow.
- Ranked Hero dispatch with expiring offers and radius expansion.
- **Dispatch excludes demo identities and requires verified + active authenticated real Heroes.**
- Hero presence/location heartbeat and participant-safe customer tracking.
- Customer tracker follows live Hero GPS through Realtime with polling fallback.
- Hero accept/decline and automatic offer expiry/recovery.
- Hero-owned final-price confirmation before travel.
- Customer payment authorization required before route start.
- Server-enforced mission transitions and proof-based completion.
- Stripe capture/transfer lifecycle and Hero payout readiness logic.
- Customer/Hero mission chat and persistent notification infrastructure.
- Customer and Hero portals are Realtime-first for mission/payment/offer changes, with polling retained as resilience fallback.
- Background Web Push registration is mounted on both customer and Hero portals.
- VAPID-backed push delivery uses a service worker and the shared push delivery worker.
- Push delivery fallback runs every 10 seconds rather than once per minute so urgent offer windows are not missed.
- Customer cancellation quote/settlement and timed customer no-show settlement.
- Hero release/rematching, start watchdog, stale-GPS warning/escalation, safety/reliability review, and customer fee-review workflows.
- Completed mission rating contract.
- Shield membership is a mounted live plan experience with live plans, current-plan state, Stripe subscription checkout contract, return verification, and explicit payment-health gating.
- Customer profile tools are functional for Vehicles, payment state, Shield, and Safety & Support.
- `/support` creates real S.O.S. support cases.
- `/hero/claim` exists for future **real qualified candidates only**; demo candidates are rejected server-side.
- `/ops` is an operator-only Operations Command for real candidate activation, verification review, and support queues.

## Automated verification

The release gate runs all repository tests plus production build/dependency checks. Regression coverage includes:

- marketplace request/offer/accept/payment-gate lifecycle contracts;
- Hero and customer Realtime contracts;
- participant-safe live Hero GPS tracking;
- background push registration and service-worker delivery contracts;
- customer/Hero portal mounts;
- payment-gated travel;
- cancellation/no-show settlement source;
- desktop shell and desktop readability regressions;
- Shield enrollment contracts;
- fail-closed payment behavior;
- direct profile/account controls;
- secure S.O.S. Operations Command access;
- secure qualified-candidate claim rules;
- **demo fixture quarantine from readiness, claim, ranking, direct offers, and operations supply**;
- SSR/localStorage regressions.

## UI verification

- The final desktop rescue stylesheet breaks customer/Hero products out of legacy phone width at ≥900px.
- Desktop card/service/mission typography was increased so desktop no longer relies on phone-scale copy.
- `/app`, `/hero`, `/hero/claim`, `/support`, and `/ops` are production routes.
- The customer and Hero portals expose Realtime connection/fallback state.
- `marketplace-sw.js` is served from the production custom domain as JavaScript.
- Shield is mounted into `/app` with responsive membership styling and live plan state.

## Shared-backend isolation

The server-only namespace audit reports:

- zero `sos_* ↔ oc_*` foreign keys;
- zero public S.O.S./ON CALL product tables with RLS disabled;
- zero anonymous/public direct INSERT, UPDATE, DELETE, or TRUNCATE grants on product tables;
- zero authenticated TRUNCATE grants on product tables;
- zero cross-prefix database-function references.

## Release hygiene

- QA fixture users/addresses and `example.invalid` records are checked separately and old `qa-share-*` rows were removed.
- Demo product fixtures are no longer allowed to masquerade as supply: `@sos-demo.atl` identities are explicitly classified with `is_demo=true` and excluded from real readiness/dispatch.

## Payment/runtime truth

The public `marketplace-payments-health` endpoint currently reports **HTTP 503** with:

- `ready: false`
- `stripe_server_credential: false`
- `webhook_signature_secret: true`
- Stripe credential source: missing
- webhook credential source: Vault

Therefore live charges, captures, transfers, payout onboarding, and Shield enrollment remain intentionally fail-closed before Stripe is called. The connected Stripe account exists, but the authorized Stripe secret required by production Edge Functions is not available through the current connector.

## Not claimed

- S.O.S. is **not market-proven** yet.
- The 25 historical Hero/candidate records are **demo fixtures, not supply**.
- There are currently **zero real Hero records and zero real recruiting candidates** in production.
- No fake mission, payout, rating, user, candidate, or Stripe transaction is counted to make the marketplace appear active.
- Real market validation begins only after real Heroes are recruited, verified, authenticated, payout-enabled, and actual customer missions complete.
