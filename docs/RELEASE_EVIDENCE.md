# S.O.S. release evidence

## 2026-08-03 production candidate

- Web commit: `c2f37f5387751ff2ad18ba91320c8d3bfc065a1f`
- Vercel deployment: `dpl_G7Eky9EQpQPz7Z3JD9hTjyYgrEU7` (`READY`)
- Production aliases: `thesuperherosonstandby.com`, `superherosonstandby.com`, and `www` variants
- Supabase project: `cxdqkjvtpilvouwtbgdy`
- Rollback candidate: `dpl_GadoLinbXzqKoH8kHi1i2tegyjFW`

### Passed

- Next.js production build and static export.
- Node release-readiness suite.
- Production health contract identifies commit, environment, and dedicated data authority.
- Provider application submits through the protected Edge Function.
- Hero UI reads RLS-scoped profile, offers, assigned missions, and payments.
- Hero availability, location heartbeat, accept/decline, and mission transitions use controlled backend operations.
- Customer payment UI creates only a mission-specific checkout after Hero assignment and confirmed pricing.
- Production rollback-only database flow: customer → offer → Hero acceptance → confirmed price → payment initialization → en route → arrived → working → completed → rating. Completion marker: `SOS_QA_ROLLBACK_SUCCESS`.
- Payment schema compatibility verified for every state written by the Stripe functions.
- Stripe endpoints fail closed with HTTP 503 when secrets are absent.

### Open release gates

- Configure `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SIGNING_SECRET` as Supabase Edge Function secrets.
- Register `https://cxdqkjvtpilvouwtbgdy.supabase.co/functions/v1/stripe-webhook` in Stripe test mode.
- Execute and record a real Stripe test-mode authorization, capture, Connect transfer, refund, and duplicate-webhook replay.
- Install/select full Xcode and run the unsigned simulator build plus signed archive. Capacitor web export succeeds; this host currently selects Command Line Tools only.

S.O.S. must not be marked complete and the next brand must not begin until these open gates pass.
