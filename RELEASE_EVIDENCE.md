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
- **0 real Hero applications.**
- **0 real recruiting candidates.**
- 25 historical recruiting records are explicitly classified as **demo fixtures** and paused/excluded from the real activation pipeline.
- 0 real Hero verification-check rows because no real Hero has been approved yet.
- 0 dispatch-eligible real Heroes.
- 0 on-duty dispatch-eligible real Heroes.
- 0 real missions.
- 0 mission payments.
- 0 subscriptions.
- 0 disputes.
- 0 ratings.
- 0 Hero earnings rows.

Demo users/candidates are excluded at the database layer from Hero ranking, direct mission offers, candidate claiming, and the real S.O.S. Operations Command queue. Those zero real-supply and transaction counts are **market activation state**, not evidence that the software lifecycle is absent.

## Real Hero supply funnel

The real supply path is now explicit and separate from demo fixtures:

1. `/hero/apply` collects a real application with contact details, services, equipment, vehicle, experience, and verification consent.
2. `/ops/heroes` is operator-only and reviews real applications.
3. Approval creates a real non-demo claim-ready Hero/candidate record but **does not mark that Hero verified**.
4. `/hero/claim` links authentication only when the signed-in email matches the existing approved candidate identity.
5. Approved real Heroes automatically receive a 9-check verification ledger.
6. Heroes submit private evidence inside Hero Command; uploads move checks to `submitted`, not `passed`.
7. Operators inspect submitted private evidence through short-lived signed links in `/ops/heroes` and review the non-Stripe checks.
8. Stripe alone controls the payout-account verification check.
9. Hero Command shows the same 9/9 readiness state enforced by patrol.
10. Patrol remains blocked until every required check is `passed`.

The nine required checks are:

- identity;
- background;
- license;
- insurance;
- equipment;
- vehicle;
- service skills;
- test mission;
- payout account.

Required Hero checks cannot be waived. `payout_account` cannot be manually passed by an operator; `hero-payouts` synchronizes that row from live Stripe transfer capability.

## Private verification documents

Hero verification documents no longer require an off-platform email/document handoff.

- Supabase Storage bucket: `marketplace-verification`.
- Bucket is private (`public = false`).
- Maximum file size: 10 MB.
- Allowed types: PDF, JPEG, PNG, WebP, HEIC, HEIF.
- Heroes may upload only into their own authenticated path: `sos/<auth-user>/<hero>/<check>/...`.
- Demo Heroes are not eligible for this real verification path.
- Other Heroes cannot browse submitted evidence.
- Active marketplace operators may read evidence through authenticated Storage policy only.
- `/ops/heroes` creates **5-minute signed URLs** when an operator opens evidence; no permanent/public verification URL is exposed.
- Uploaded paths are attached to the corresponding Hero verification ledger row.
- Uploading evidence changes an unfinished check to `submitted`; it **never automatically passes** a check.
- `payout_account` does not accept uploaded evidence because Stripe owns that verification state.
- Heroes do not receive update/delete permissions on evidence objects, preserving the review audit trail.

The bucket configuration, policies, file restrictions, and authenticated-only evidence RPC grants were verified directly in production.

## Verification/patrol proof without fabricating supply

A disposable authenticated real-Hero database simulation was run inside a transaction and rolled back afterward. It proved:

1. A new non-demo Hero receives exactly 9 required checks.
2. Initial overall verification status is `pending`.
3. Passing the eight operator-managed checks while payout remains pending leaves overall verification `pending`.
4. Calling the real `sos_set_hero_presence(... on_duty=true ...)` at 8/9 is rejected.
5. Marking the payout check passed for the database-only gate test causes overall status to become `verified`.
6. The same authenticated Hero can then start patrol at 9/9.
7. Rollback cleanup left zero QA auth users, S.O.S. users, Heroes, or verification rows.

No Stripe call was made in that simulation. It proves the verification/patrol contract, not a live payout transaction.

## Marketplace lifecycle proven without fabricating customer history

A separate disposable database marketplace simulation was executed without calling Stripe and without preserving QA rows. It proved:

1. A request can enter dispatch.
2. A qualified eligible Hero offer can be created.
3. Offer acceptance atomically assigns the mission.
4. Starting travel without customer payment authorization is rejected.
5. An authorized payment state unlocks `en_route`.
6. QA fixture cleanup is verified afterward.

Historical QA proof is not counted as real mission activity and does not convert quarantined demo records into supply.

## Marketplace controls currently implemented

- Customer account and live service catalog.
- GPS-required mission request flow.
- Ranked Hero dispatch with expiring offers and radius expansion.
- Dispatch excludes demo identities and requires verified + active authenticated real Heroes.
- Real Hero application, operator approval, secure same-email claim, 9-check verification, private evidence submission/review, and patrol-readiness pipeline.
- Hero presence/location heartbeat and participant-safe customer tracking.
- Customer tracker follows live Hero GPS through Realtime with polling fallback.
- Hero accept/decline and automatic offer expiry/recovery.
- Hero-owned final-price confirmation before travel.
- Customer payment authorization required before route start.
- Server-enforced mission transitions and proof-based completion.
- Stripe capture/transfer lifecycle and Hero payout readiness logic.
- Stripe Accounts v2 Hero payout onboarding source with transfer-capability synchronization into `payout_account` verification.
- Customer/Hero mission chat and persistent notification infrastructure.
- Customer and Hero portals are Realtime-first for mission/payment/offer changes, with polling retained as resilience fallback.
- Background Web Push registration is mounted on both customer and Hero portals.
- VAPID-backed push delivery uses a service worker and the shared push delivery worker.
- Customer cancellation quote/settlement and timed customer no-show settlement.
- Hero release/rematching, start watchdog, stale-GPS warning/escalation, safety/reliability review, and customer fee-review workflows.
- Completed mission rating contract.
- Shield membership is a mounted live plan experience with current-plan state, Stripe subscription checkout contract, return verification, and explicit payment-health gating.
- Customer profile tools are functional for Vehicles, payment state, Shield, and Safety & Support.
- `/support` creates real S.O.S. support cases.

## Automated verification

The release gate runs repository tests plus production build/dependency checks. Regression coverage includes:

- marketplace request/offer/accept/payment-gate lifecycle contracts;
- real Hero application/claim funnel;
- demo fixture quarantine;
- nine-check Hero verification initialization;
- required-check no-waiver rule;
- Stripe-owned payout verification;
- exact 9/9 verification/patrol alignment;
- private verification Storage/privacy/path contracts;
- Hero evidence upload can only submit, never auto-pass;
- short-lived operator signed evidence links;
- operator and Hero verification UIs;
- Hero/customer Realtime contracts;
- participant-safe live Hero GPS tracking;
- background push registration and service-worker delivery contracts;
- customer/Hero portal mounts;
- payment-gated travel;
- cancellation/no-show settlement source;
- desktop shell/readability regressions;
- Shield enrollment contracts;
- fail-closed payment behavior;
- secure S.O.S. Operations Command access;
- SSR/localStorage regressions.

## Production route/runtime verification

Current custom-domain route checks return HTTP 200 on the production application for:

- `/hero`
- `/hero/apply`
- `/hero/claim`
- `/ops/heroes`

The current production Vercel build is READY and the checked production deployment has no error/fatal runtime logs in the one-hour validation window.

## Shared-backend isolation

The server-only namespace audit currently reports:

- zero `sos_* ↔ oc_*` foreign keys;
- zero public S.O.S./ON CALL product tables with RLS disabled;
- zero anonymous/public direct INSERT, UPDATE, DELETE, or TRUNCATE grants on product tables;
- zero authenticated TRUNCATE grants on product tables;
- zero cross-prefix database-function references.

## Release hygiene

- QA fixture users/addresses and `example.invalid` records are checked separately. Current result: **zero QA fixtures**.
- Demo product fixtures are explicitly marked `is_demo=true` and excluded from real readiness/dispatch/claim/operations.

## Payment/runtime truth

The public `marketplace-payments-health` endpoint currently reports **HTTP 503** with:

- `ready: false`
- `stripe_server_credential: false`
- `webhook_signature_secret: true`
- Stripe credential source: missing
- webhook credential source: Vault

Therefore live charges, captures, transfers, Hero payout onboarding, and Shield enrollment remain intentionally fail-closed before Stripe is called. The connected Stripe account exists, but the authorized Stripe secret required by production Edge Functions is not available through the current connector.

## Not claimed

- S.O.S. is **not market-proven** yet.
- The 25 historical Hero/candidate records are **demo fixtures, not supply**.
- There are currently **zero real Hero applications, zero real Hero records, zero real recruiting candidates, and zero dispatch-eligible real Heroes** in production.
- No fake mission, payout, rating, user, application, candidate, verification, or Stripe transaction is counted to make the marketplace appear active.
- Real market validation begins only after real Heroes apply, are approved, claim their identity, submit evidence, pass 9/9 verification, become payout-enabled, and actual customer missions complete.
