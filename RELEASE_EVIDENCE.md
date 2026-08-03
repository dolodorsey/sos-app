# S.O.S. release evidence

## Product boundary

- Brand: S.O.S. — Superheroes on Standby, kept separate from ON CALL and every other KHG brand.
- Scope: non-emergency roadside and mobile-vehicle service marketplace. The safety gate directs emergencies to 911.
- Uses the approved S.O.S. graphics and rescue-noir visual system from the portfolio graphics library.

## Verified production foundation

- S.O.S. data and functions use the `sos_*` namespace in Supabase project `cxdqkjvtpilvouwtbgdy`; unrelated legacy brand tables in that project are outside this release.
- Customer requests persist as real missions and never fabricate assignment, Hero identity, GPS movement, or ETA.
- Operator dispatch creates expiring address-safe offers; Hero acceptance is atomic.
- Hero portal reads real offers, accepted missions, job states, presence, location heartbeat, payment states, and recorded earnings.
- Provider application submission is validated and server-controlled.
- Confirmed mission pricing is server-controlled and locks when payment authorization begins.
- Mission-specific Stripe Connect functions support manual authorization, completion-gated capture, held-for-release status, transfer, cancellation, refund, dispute events, and idempotent webhook processing.
- Completed mission ratings are ownership-checked and update the Hero aggregate.

## Integrity corrections in this release

- Next.js upgraded from vulnerable 14.2.5 to 16.2.12; React upgraded to 19.2.8 and Supabase JS to 2.112.0.
- Production dependency audit reports zero known vulnerabilities.
- Removed unsupported five-minute ETA and guaranteed-availability language from the public landing page.
- Starting prices are labeled as estimates; assignment, timing, and final pricing remain explicitly unconfirmed until review.
- Removed 24 orphan, non-authenticated Hero profiles from on-duty dispatch eligibility.
- Nearby-Hero selection now requires a real active authenticated user, verified Hero status, current on-duty state, recent GPS heartbeat, supported service, and matching radius.

## Verification

- Next.js production build: passed.
- TypeScript: passed as part of the production build.
- Webhook endpoint fails closed with HTTP 503 while Stripe is unconfigured; once configured, its raw-body signature verification rejects invalid signatures.
- Protected payment functions require a valid JWT.
- Database currently contains zero missions, offers, payments, or ratings, so no fabricated end-to-end production success is claimed.
- Capacitor and all native plugins are upgraded to the 8.5 release line; the CLI is development-only and production dependencies remain at zero vulnerabilities.
- Added the previously missing complete Android project and synchronized the production web bundle plus Browser, Geolocation, Haptics, Share, Splash, and Status Bar plugins.
- Replaced the broken hybrid CocoaPods/Swift Package Manager iOS shell with a clean Capacitor 8.5 Swift Package Manager project while preserving the approved S.O.S. icon and splash artwork, `com.superherosonstandby.app` identity, and fastlane files.
- Added the required iOS foreground-location disclosure and verified the complete iOS Simulator build (`** BUILD SUCCEEDED **`).

## Remaining release gates

- Rotate the Stripe secret previously exposed in chat, configure the new live secret plus webhook signing secret, and verify the production webhook endpoint in Stripe.
- Approve and authenticate at least one real Hero account; there are currently zero dispatch-eligible authenticated Heroes.
- Run a controlled customer → operator offer → Hero acceptance → confirmed price → authorization → job states → capture → transfer → rating test.
- Compile Android on a release machine with Java 21 and the Android SDK, then complete signed iOS/Android archives and store-review checks.
