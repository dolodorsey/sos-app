# S.O.S. release readiness

This file records the current software-only launch gates separately from live Hero supply.

- Web production deployment must match `main`.
- Quality Gate must pass.
- TestFlight upload must pass on current `main`.
- Payment server runtime and signed webhook must be healthy.
- Hosted Stripe mission checkout must gate Hero travel until authorization.
- Session refresh must propagate into mounted customer/Hero clients and realtime connections.
- Account recovery, deletion, legal/support routes, notifications, receipts, tracking, cancellation, ratings, membership, Hero verification, payout onboarding, and ops surfaces must be mounted.
- Public service availability must be driven by verified Hero coverage, never by catalog presence alone.
- Live Hero supply and a real-money controlled acceptance transaction are tracked separately and are not prerequisites for software completeness.
