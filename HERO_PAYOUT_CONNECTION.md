# Preserve payout connections during lookup failures

A failed Stripe account lookup previously cleared the saved account ID and reset payout verification. The handler now returns 503 with verification_unavailable and retains the saved connection without database writes or an automatic retry. No connected/disconnected or payout-ready claim is made on this failure path. This includes 404: the current credential context alone cannot establish that the saved account should be erased.

Run `node tests/hero-payout-connection.test.mjs` (Node 22.13+). Eight actual-handler VM cases cover HTTP 503/429/401/404, network failure, successful status, authenticated creation metadata, and authentication rejection. Auth/database/Stripe are mocked; zero external requests or real accounts. The prior source fails the no-write failure regression.

This source change is pending independent review and deployment. Successful-path profile write errors/recompute errors, metadata and test/live mode verification, concurrency and atomic webhook integration remain separate unresolved work. The local database reconciliation prototypes are not included or deployed by this change. No authorization, money movement, account creation policy, dispatch or overall verification criteria changed.
