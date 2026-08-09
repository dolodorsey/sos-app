# S.O.S. shared-backend boundary

S.O.S. currently shares Supabase project `cxdqkjvtpilvouwtbgdy` with ON CALL as an infrastructure decision only.

## Product ownership

- Public product: **S.O.S. — Superheroes On Standby**
- Repository: `dolodorsey/sos-app`
- Primary domain: `thesuperherosonstandby.com`
- Product database namespace: **`sos_*` only**
- ON CALL product namespace: `oc_*` — not S.O.S. data
- Shared Auth/Stripe/runtime infrastructure does not imply shared public branding or product ownership.

## Isolation requirements

The production database must preserve all of these invariants:

1. No foreign keys between `sos_*` and `oc_*` tables.
2. RLS remains enabled on all public `sos_*` and `oc_*` product tables.
3. `anon` and `PUBLIC` receive no direct INSERT, UPDATE, DELETE, or TRUNCATE grants on product tables.
4. S.O.S. database functions must not reference `oc_*` product tables, and ON CALL functions must not reference `sos_*` product tables.
5. Cross-product access is limited to deliberately shared infrastructure such as Auth, Vault/runtime secret retrieval, and platform-level payment/webhook infrastructure.

Production stores this ownership mapping in the private `marketplace_product_registry` table and validates the boundary with the service-role-only function `private.marketplace_namespace_isolation_audit()`.

A passing audit returns `ok: true` with empty arrays for cross-namespace foreign keys, RLS-disabled product tables, anonymous/public write grants, and cross-prefix function references.
