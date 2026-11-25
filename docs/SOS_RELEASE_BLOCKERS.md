# S.O.S. Release Blockers

Updated Nov 25, 2026. A blocker is closed only with evidence: request ID, assignment ID, timestamps, screenshots and database records.

| # | Blocker | Why it blocks launch | Next step | Owner |
|---|---|---|---|---|
| 1 | **No real dispatch-ready Heroes.** All 25 Hero profiles are legacy demo records. 0 have a live payout account. Every Atlanta zone shows 0 verified and 0 live Heroes. | Dispatch has no one to send. The supply guard correctly blocks customer requests until coverage exists. | Activate real Heroes from the 2,128 sourced prospects and the /drive sign-ups: verification, payout account, notification test, GPS test, practice rescue. Target: 3 verified and 1 live per zone. | Tay, Omar |
| 2 | **No rescue has ever run.** 0 missions, 0 offers, 0 GPS points, 0 payments in the live database. | Nothing in the plan's 38-item checklist has passed. | Two-device test in a controlled setting: Battery Jump first (customer phone, Hero phone, competing Hero or operator), then the other four services. | Duet with two teammates |
| 3 | **Push delivery is switched off.** The push keys exist, but the `marketplace-push-delivery` job is inactive and 0 phones are subscribed. | Heroes won't get incoming rescue alerts unless the app is open. | Find why the job was paused, turn it on, and pass the "offer received on a real Hero phone" test. | Duet |
| 4 | **No text-message or email fallback for rescue updates.** HighLevel and Twilio are retired, and AWS messaging is not verified. | The plan requires an SMS fallback for incoming rescues and customer updates. | Decide the transactional sender (AWS SMS once verified, or a free alternative), separate from marketing. | Dolo to decide, Duet to build |
| 5 | **Customer request needs a promo or card on a real phone.** Checkout and ATL SUPERHERO are live, but not tested end to end on Safari (iPhone) and Chrome (Android). | Payments must be proven with zero duplicate charges. | Run the payment, refund and duplicate-charge tests during blocker 2. | Duet |
| 6 | **Dispatch tuning differs from the plan** (radius waves 8–50 miles, distance-only ranking). | Not a hard blocker, but it can send far-away Heroes in dense areas. | Tune after field tests, using real density. | Duet |
