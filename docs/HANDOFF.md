# S.O.S. Release Handoff

## Canonical identity

- Repository: `dolodorsey/sos-app`
- Production: `https://superherosonstandby.com`
- Current operational authority: MCP Gateway `public.sos_*`
- Dedicated SOS Supabase `cxdqkjvtpilvouwtbgdy`: controlled cutover target only

## Release rule

S.O.S. is blocked from unrestricted release until the dedicated database's grants, policies, RLS, and customer/provider/admin isolation are proven. A successful Vercel deployment is not sufficient.

## Required checks

1. Run `npm ci`.
2. Run `node --test tests/*.test.mjs`.
3. Run `npm run build`.
4. Confirm `/health.json` returns the expected app and authority.
5. Validate customer request, provider offer/accept, dispatch, live location, messaging, payment, notification, cancellation, refund, support, and failure recovery.
6. Confirm one customer cannot read another customer's records and one provider cannot read another provider's records.
7. Record evidence in the Enterprise System Control release gates.

## Data rules

- MCP `sos_missions` and `sos_heroes` remain authoritative.
- No dual write without an idempotency key, reconciliation report, and rollback procedure.
- Do not migrate production traffic to the dedicated database until the security gate passes.
- Never expose service-role credentials to client code.

## Rollback

Revert to the previous verified Vercel deployment, stop migration or dual-write workers, preserve MCP mission IDs, block the release gate, and reconcile every affected request before resuming.
