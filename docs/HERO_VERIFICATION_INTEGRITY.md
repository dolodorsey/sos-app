# Pending SOS verification integrity repair

The existing recompute can mark empty or incomplete checklists verified. The review RPC also skips recomputation for equipment, vehicle and service_skills, leaving stale verification status after passes or failures.

Pending migration 20261102135200 requires all nine initializer checks to be required and passed, and recomputes after every allowed operator review. Existing payout-manual-approval, waiver, operator authorization and review attribution rules remain. It does not recompute existing rows, backfill checks, change grants, or approve release.

Run `python3 tests/hero-verification-completeness.py` and `python3 tests/hero-verification-transitions.py` (local PostgreSQL 17 Homebrew binaries). Both load the actual migration into a disposable socket-only cluster. Fixtures use fresh November 2 function sources and October 30 verification table schema; synthetic auth/operator predicates and minimal Hero schema are not production authority or RLS proof.

Independent full-schema, concurrent-review, required-flag writer and expiration semantics review remain necessary before deployment. Existing data reconciliation needs separate scoped review; no live status changes are included.
