# S.O.S Marketplace Upgrade Handoff

**Product:** S.O.S - Real-Time Roadside Assistance  
**Canonical repository:** `dolodorsey/sos-app`  
**Upgrade branch:** `upgrade/marketplace-foundation-2026-07`  
**Canonical Supabase project:** `SOS` (`cxdqkjvtpilvouwtbgdy`)  
**Canonical Vercel project:** `sos-app-website`  
**Prepared:** July 10, 2026

## 1. Product Boundary

S.O.S is an independent roadside-assistance marketplace. It must not share customer, provider, mission, payment, safety or dispatch data with On Call or Luxe On Demand.

Core operating object: **mission**  
Provider role: **Hero**

## 2. Upgrade Delivered

### Database security

File:

```text
supabase/migrations/20260710_marketplace_security_and_dispatch.sql
```

The migration:

- Enables RLS on exposed operational tables.
- Protects push tokens, trip shares, certifications, equipment, fleet records, earnings, disputes, proof of service and safety events.
- Replaces broad direct access with customer, Hero and mission-participant policies.
- Converts operational views to security-invoker behavior and removes client access.
- Removes direct execution access from trigger-only functions.
- Stops automatic email confirmation inside the auth trigger.
- Sets explicit function search paths.

### Real dispatch

The migration adds:

- `sos_dispatch_mission`
- `sos_accept_mission_offer`
- `sos_decline_mission_offer`

Offer acceptance locks both the offer and mission rows before assignment. This prevents two Heroes from accepting the same mission.

### Client integration module

File:

```text
src/lib/dispatch.js
```

Exports:

- `dispatchMission`
- `acceptMissionOffer`
- `declineMissionOffer`
- `getOpenHeroOffers`
- `updateHeroLocation`
- `getMissionTimeline`
- `subscribeToMission`

## 3. Required Environment Variables

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Do not commit project keys, service-role keys, Stripe secrets or provider credentials.

## 4. Required Application Integration

The current visual matching sequence must be replaced with database-driven state.

### Customer flow

```text
Create mission
-> call sos_dispatch_mission
-> subscribe to sos_missions and sos_mission_events
-> show matching state until an offer is accepted
-> show assigned Hero and live ETA from database state
```

### Hero flow

```text
Go on duty
-> continuously update location
-> query active offers
-> accept or decline through RPC
-> advance mission status through controlled server actions
-> submit proof of service
```

## 5. Payment Upgrade Required

The static Stripe payment link must be removed from mission history.

Required server-controlled flow:

```text
Mission estimate
-> Stripe PaymentIntent authorization
-> final price calculation
-> capture after proof/completion
-> platform fee
-> Stripe Connect transfer
-> payout record
-> refund/dispute support
```

No Stripe secret may be used in browser code.

## 6. Migration Procedure

1. Create a Supabase development branch from the `SOS` project.
2. Apply `20260710_marketplace_security_and_dispatch.sql`.
3. Run Supabase security and performance advisors.
4. Generate fresh TypeScript types.
5. Test customer, Hero and service-role access separately.
6. Confirm existing mission creation still works.
7. Confirm direct anonymous table access is denied.
8. Confirm two simultaneous offer acceptances produce one winner.
9. Deploy the GitHub branch to a Vercel preview environment.
10. Complete mobile and web regression tests before production merge.

## 7. QA Gate

### Security

- [ ] Anonymous users cannot read operational mission data.
- [ ] Customers only see their own missions and participant records.
- [ ] Heroes only see their offers, assigned missions and owned records.
- [ ] Push tokens are only visible to their owner and backend service role.
- [ ] Trigger functions cannot be called through REST RPC.
- [ ] Leaked-password protection is enabled in Supabase Auth.

### Dispatch

- [ ] Only on-duty, verified, active Heroes are offered missions.
- [ ] Service eligibility is enforced.
- [ ] Expired offers cannot be accepted.
- [ ] One mission cannot be assigned twice.
- [ ] Realtime mission events update both customer and Hero clients.

### Mobile

- [ ] Background/foreground location behavior is tested.
- [ ] Location permission denial is handled.
- [ ] Offline/reconnect behavior does not duplicate mission events.
- [ ] Push notifications deep-link to the correct mission.

## 8. Rollback

Do not manually reverse individual policies in production.

Rollback method:

1. Keep the previous production deployment available in Vercel.
2. Restore the pre-migration database branch or apply a reviewed rollback migration.
3. Disable dispatch RPC calls through a feature flag.
4. Return mission intake to maintenance mode if assignment integrity is uncertain.

## 9. Ownership

- **Product owner:** Dr. Dolo Dorsey
- **Application repository:** `dolodorsey/sos-app`
- **Database owner:** Dedicated S.O.S Supabase project
- **Enterprise visibility:** App Command Center receives health and summarized operational metrics only.
- **Forbidden:** Cross-brand writes into On Call or Luxe databases.

## 10. Definition of Done

S.O.S is production-ready only when:

- Security advisors show no externally exposed operational tables without RLS.
- Matching is driven by real offers and acceptance, not timers.
- Mission payments are mission-specific.
- Live location and ETA are real.
- Proof, completion, dispute and payout paths are tested.
- Command Center health reporting is operational.
