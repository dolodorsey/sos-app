# S.O.S. Release Blockers

Updated Nov 25, 2026 (3 AM pass). A blocker is closed only with evidence: request ID, assignment ID, timestamps, screenshots and database records.

| # | Blocker | Why it blocks launch | Next step | Owner |
|---|---|---|---|---|
| 1 | **No real dispatch-ready Heroes.** All 25 Hero profiles are legacy demo records. 0 have a live payout account. Every Atlanta zone shows 0 verified and 0 live Heroes. | Dispatch has no one to send. The supply guard correctly blocks customer requests until coverage exists. | Activate real Heroes from the 2,128 sourced prospects and the /drive sign-ups: verification, payout account, notification test, GPS test, practice rescue. Target: 3 verified and 1 live per zone. | Tay, Omar |
| 2 | **No rescue has ever run.** 0 missions, 0 offers, 0 GPS points, 0 payments in the live database. | Nothing in the plan's 38-item checklist has passed. | Two-device test in a controlled setting: Battery Jump first (customer phone, Hero phone, competing Hero or operator), then the other four services. | Duet with two teammates |
| 3 | **Rescue alerts: on, waiting on a real-phone test.** Fixed Nov 25: alerts were stopped by the Oct 7 "stop all sends" order; S.O.S. alerts are back on behind the switch `sos_system_config.rescue_alerts` (On Call stays stopped). The backup sweep runs every minute. Two service workers were replacing each other on every page, so a Hero phone could lose alerts; now one worker (`/sw.js`). 0 phones subscribed so far. App Store build can't receive web alerts yet (needs Apple notification setup). | Heroes won't get incoming rescue alerts unless the app is open. | One teammate opens superherosonstandby.com/hero on an iPhone, adds it to the Home Screen, turns on alerts, and receives a test rescue alert. | Duet with a teammate |
| 4 | **No text-message or email fallback for rescue updates.** HighLevel and Twilio are retired, and AWS messaging is not verified. | The plan requires an SMS fallback for incoming rescues and customer updates. | Decide the transactional sender (AWS SMS once verified, or a free alternative), separate from marketing. | Dolo to decide, Duet to build |
| 5 | **Customer request needs a promo or card on a real phone.** Checkout and ATL SUPERHERO are live, but not tested end to end on Safari (iPhone) and Chrome (Android). | Payments must be proven with zero duplicate charges. | Run the payment, refund and duplicate-charge tests during blocker 2. | Duet |
| 6 | **Dispatch tuning differs from the plan** (radius waves 8–50 miles, distance-only ranking). | Not a hard blocker, but it can send far-away Heroes in dense areas. | Tune after field tests, using real density. | Duet |

## Fixed Nov 25, 2026 (found by the end-to-end rescue test)

| Fix | What was broken | Evidence |
|---|---|---|
| One service vocabulary | Customers order `jump`, Hero applications saved "Jump Start", older profiles saved `jump_start`. Dispatch and public coverage never matched an approved Hero to Jump Start, Tow, Flat Tire or Fuel (Lockout only). | Migration `20261125080000`; all Hero services now stored as the order id. |
| Payment update crash | The shared cancellation guard read an On Call field, so **every** update to an S.O.S. payment failed (Hero accept on a paid rescue, capture, payout, refund). Never hit because there were 0 payments. | Migration `20261125090000`. |
| Payment default | `escrow_status` defaulted to a value its own rule rejects. | Same migration. |
| Hero payout choice | Heroes can pick direct deposit (Stripe) or mailed check. Check payouts go to an operator queue; operations confirms the W-9 and marks each check mailed. No tax ID is stored in S.O.S. | Migration `20261125100000`; 14 payout checks passed under rollback. |
| Apple Pay | Confirmed on at checkout from the Stripe account (`sos-payments-health` now reports it). Google Pay is off. | Live health check. |

**End-to-end rescue test (database, rolled back):** signup → Hero services saved as `jump` → Tow without coverage refused → Jump Start request at $45 → 2 offers at $36 payout → 2 Hero alerts → Hero A accepts, price locked → Hero B blocked → en route, on site, working → completion without proof refused → authorized, captured, paid out: $9 to S.O.S., $36 to Hero A → 8 timeline events, 4 customer updates.
