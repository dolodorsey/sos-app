# S.O.S. Web Launch Audit

Audited Nov 25, 2026 against the "Web App Launch & Dispatch System" plan. Evidence comes from the live S.O.S. database (project `cxdqkjvtpilvouwtbgdy`), the deployed edge functions and this repository.

**Bottom line:** most of the system is already built, but none of it has run a real rescue. The live database has 0 missions, 0 dispatch offers, 0 GPS points, 0 push subscriptions and 0 payments. S.O.S. is not ready to take public requests. The blockers are supply and field testing, not missing code.

## What is built

| Plan item | Status | Where |
|---|---|---|
| Customer request flow (service, location, vehicle, price, request) | Built, never used live | `/app`, `/request-roadside-help`, `request-customer-mission` |
| Five starting services | Built as subcategories of "Emergency Roadside": Towing, Lockout, Fuel Delivery, Flat Tire Help, Jump Start (plus Battery Replace, Tire Concierge, Winch Out) | `sos_subcategories` |
| Dispatch to nearby qualified Heroes | Built. Search radius widens 8 → 15 → 25 → 35 → 50 miles, checked every minute | `sos_dispatch_one_mission`, `sos_next_dispatch_radius`, cron `marketplace-dispatch-reliability` |
| First Hero to accept wins (no double assignment) | Built and atomic: the offer and the mission are both row-locked, and acceptance fails if a Hero is already assigned | `sos_accept_mission_offer` |
| Offers that expire | Built | `sos_mission_offers.expires_at` |
| Live GPS tracking | Built, never used live | `sos_mission_live_positions`, `/track` |
| Proof of service before completion | Built | `sos_proof_of_service` |
| Payments: hold at booking, charge at completion, 80% to the Hero | Built and deployed | `create-mission-checkout`, `hero-complete-mission`, `manage-mission-payment` |
| Cancellations, no-shows, refunds, disputes | Built | `sos-cancel-*`, `sos-customer-no-show`, `sos_disputes` |
| Promo and referral rewards | Live (code ATL SUPERHERO) | `sos_promo_codes`, `sos_customer_credits` |
| Ratings and support | Built | `sos_ratings`, `sos_citizen_reviews`, `/support` |
| Installable web app and push notifications | Built (manifest, service worker, push keys) | `public/manifest.json`, `public/sw.js`, `SOSPushSubscriptionHost` |
| Command center | Built | `/ops`, `sos_v_live_ops`, `sos_live_coverage` |
| Coverage by zone | Built: 10 Atlanta zones with minimum Hero targets | `sos_service_zones`, `sos_zone_supply_targets` |

## What is not ready

See `SOS_RELEASE_BLOCKERS.md`.

## Where the plan conflicts with current decisions

| Plan says | Current decision |
|---|---|
| n8n for reporting and follow-up | n8n is retired. Use Supabase cron and edge functions. |
| New FIRST_RESCUE promo | ATL SUPERHERO (1 free service through Dec 31) is already live, plus share and signup rewards. Not adding a second free-first-rescue promo unless Dolo asks. |
| Ranking: 55% drive time, 20% reliability, 15% rating, 10% fair share; waves at 3, 7 and 15 miles | Live dispatch ranks by distance with waves at 8, 15, 25, 35 and 50 miles. Moving to the plan's weights and waves is a tuning change, best made after the first field tests show real Hero density. |
| AGENTS.md: HighLevel is the primary outbound system | Dolo retired HighLevel (Nov 23). AGENTS.md needs updating. |
| Instagram handle | Resolved Nov 25: @superheros.onstandby (Dolo confirmed). Repo updated. |
