# THE SIGNAL — staging rollout

Scope: S.O.S. only. Existing production dispatch, customer rewards, provider invites, n8n, payment, and outbound pathways are untouched. This candidate is isolated under /network-staging/index.html and is not a production release.

## Setup (blocked pending Supabase branch cost approval)
1. Create a development branch of SOS (production ref cxdqkjvtpilvouwtbgdy). Do not seed or copy real customer data.
2. Confirm target ref differs from production, inspect schema and migration history, run the reviewed staging-schema.sql in a transaction on the branch only. This is deliberately in ops/network, not automatic production migrations. Generate the formal migration with the Supabase CLI once validated.
3. Run database advisors. Provision two synthetic members and one reviewer via the branch Auth dashboard, with no invitation emails. Grant reviewer by inserting the synthetic reviewer's auth user ID into public.sos_network_admins using a privileged branch session only.
4. Update config.json on this feature branch with enabled:true, projectRef equal to the exact branch ref, url https://<branch-ref>.supabase.co and its publishable key. Never put a secret/service-role key in the browser. The client rejects the production ref and non-publishable keys.
5. Inspect the protected Vercel preview, test sign-in and all acceptance gates. Keep config disabled if any gate fails. Do not merge or promote until separately approved.

## Acceptance gates
- Anonymous requests cannot read/write network tables.
- Member A cannot read B's member records, evidence, referrals, or admin grant; cannot approve missions, update points or spoof user IDs.
- Reviewer can read queue, approve/reject others only; database computes catalog points, duplicate submissions rejected; second approval cannot change points.
- Member B activates from A's invitation; referred_by resolves to A, no self-referral, invalid invite rejected.
- Verify customer/provider introductions are only submitted/verified references; no credit, dispatch, payment, or outreach side effects.
- On expired session/sign-out, portal clears the token and hides protected views; authentication is memory-only.
- Verify mobile layout, keyboard access, contrast, input validation and DOM escaping; verify preview remains protected.
- Compare source diff to main and verify existing website and native builds unaffected.

## Referral integration boundary
Network member invitations are attributed directly on activation. Customer/provider introductions are reviewable references, not verified app installs or completed services. Before production, integrate with existing SOS customer referral/reward and provider invite APIs via reviewed server-side event contracts, idempotent conversion keys and consent. Do not duplicate or issue existing credits automatically. The pilot's one-submission-per-mission rule is deliberate; recurring campaign instances, asset vault, merchandise, secret-agent workflows and automations need subsequent implementation.

## Rollback
Do not promote. Disable config, revert the candidate branch commits if necessary. Retain staging audit records until the approved retention window; do not drop live tables. No live outbound.
