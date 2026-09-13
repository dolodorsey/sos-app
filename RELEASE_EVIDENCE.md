# S.O.S. Release Evidence

## Product boundary

- Public product: **S.O.S. — Superheroes On Standby**.
- Repository: `dolodorsey/sos-app`.
- Primary domain: `https://thesuperherosonstandby.com`.
- Production Supabase project: `cxdqkjvtpilvouwtbgdy`.
- Product data remains isolated to the `sos_*` namespace even though infrastructure is shared with ON CALL and LUXE.
- Scope: non-emergency roadside and mobile-vehicle service marketplace. Emergency copy directs users to 911.

## Current production truth — September 12, 2026

Direct production counts:

- 32 S.O.S. user records.
- **0 non-demo Hero records available as supply.**
- **0 non-demo Hero applications.**
- **47 non-demo recruiting candidates.**
- **0 verified + payout-ready non-demo Heroes.**
- 0 missions.
- 0 mission payments.
- 0 subscriptions.
- 0 disputes.
- 0 ratings.
- 0 Hero earnings rows.

The recruiting engine is therefore sourcing real candidate leads, but those leads are **not** counted as marketplace supply. A candidate becomes usable supply only after the real application/approval/claim/verification/payout sequence is complete.

Demo users, Heroes and candidates remain quarantined from real dispatch, ranking, candidate claiming and launch-readiness metrics.

## Hero activation standard

A real Hero is not launch-ready until all of the following are true:

1. A real application exists.
2. An operator approves the application.
3. The approved identity is claimed by the matching authenticated user.
4. The Hero completes the required verification ledger.
5. Private verification evidence is reviewed where required.
6. Stripe confirms the payout-account requirement.
7. All nine required checks are passed.
8. The Hero is verified and eligible to start patrol.

Required checks:

- identity;
- background;
- license;
- insurance;
- equipment;
- vehicle;
- service skills;
- test mission;
- payout account.

The payout-account check remains Stripe-owned and cannot be manually passed by an operator.

## Private verification evidence

- Storage bucket: `marketplace-verification`.
- Bucket is private.
- Heroes upload only to their authenticated S.O.S. path.
- Uploading evidence moves a check into review; it never auto-passes verification.
- Operators access evidence through short-lived signed URLs.
- Heroes do not receive delete/update access that would erase the verification audit trail.
- Demo Heroes are excluded from the real verification path.

## Marketplace controls implemented

Current source and production backend include:

- customer accounts and service catalog;
- GPS-required service requests;
- ranked Hero dispatch with expiring offers and radius expansion;
- demo-identity exclusion from real dispatch;
- real Hero application, approval, claim and nine-check verification;
- private evidence submission and operator review;
- Hero presence/location heartbeat;
- participant-safe live tracking;
- Realtime mission/payment/offer updates with polling fallback;
- Hero accept/decline and offer expiry/recovery;
- Hero final-price confirmation;
- payment authorization before route start;
- server-enforced mission state transitions;
- proof-based completion;
- Stripe capture and Hero transfer lifecycle;
- Stripe Connect payout onboarding/readiness synchronization;
- customer/Hero mission chat and notifications;
- Web Push infrastructure;
- cancellation and no-show settlement;
- rematching, start watchdog and stale-GPS escalation;
- ratings contract;
- Shield membership checkout/return/payment-health gating;
- support-case creation;
- operator-only S.O.S. Operations Command.

## Payment/runtime truth

The previous August release evidence incorrectly reported the Stripe server credential as unavailable. That is no longer true.

Current production verification shows:

- `STRIPE_SECRET_KEY` resolves through the production runtime secret resolver.
- `sos_stripe_webhook_secret` resolves through the production runtime secret resolver.
- `sos-payments-health` is ACTIVE and performs a bounded live request to Stripe `/v1/balance`; it returns healthy only when the server key, S.O.S. webhook signing secret and Stripe authorization are all valid.
- The connected **live-mode** Kollective Stripe account successfully authorizes `GET /v1/balance`.
- The current live Stripe balance response is valid and live-mode, with no funds currently available or pending.

The payment rail is therefore **configured and reachable**. It remains intentionally unused for fabricated QA history: there are still zero real S.O.S. mission payments.

## Production hardening completed September 12

- Added a covering index for `sos_crm_outbox.user_id`.
- Optimized the Hero application-notification RLS policy so `auth.uid()` is initialized once rather than reevaluated per row.
- Added covering indexes for:
  - `sos_hero_application_notifications.application_id`;
  - `sos_recruiting_candidate_zone_coverage.zone_id`;
  - `sos_recruiting_source_records.candidate_id`.
- Re-ran the Supabase performance advisor; the targeted S.O.S. foreign-key and Hero notification auth-initplan warnings were cleared.

## Automated production proof

Current source commit before this evidence refresh: `7a64f1ca54814b223fb18a63929c6f28c3388c19`.

Verified against that commit:

- Vercel deployment status: **success**.
- Scheduled **SOS Production Smoke** run #240: **success** on September 12, 2026.
- The production-smoke workflow has also passed repeatedly on the same source state.

The repository regression suite covers marketplace lifecycle, payment gating, Hero application/claim, demo quarantine, verification initialization, payout ownership, private evidence, Realtime, live GPS, push delivery, cancellation/no-show settlement, Shield, operations access and SSR/browser regressions.

## Release status

**Software/payment rail:** production-capable and fail-closed where required.

**Market activation:** not launch-proven yet.

The current operational bottleneck is supply conversion, not a missing Stripe credential or missing marketplace architecture:

- 47 non-demo recruiting candidates are present;
- 0 have become real Hero applications;
- 0 have become non-demo Heroes;
- 0 are verified + payout-ready;
- 0 customer missions have been completed.

## Not claimed

- S.O.S. is **not market-proven** yet.
- Recruiting candidates are **not** counted as available Heroes.
- Demo fixtures are **not** counted as real supply.
- No fake mission, payment, payout, rating, application, verification or transaction is counted to make the marketplace appear active.
- Real market validation begins only after real Heroes progress through application, approval, claim, 9/9 verification, payout readiness and actual customer mission completion.
