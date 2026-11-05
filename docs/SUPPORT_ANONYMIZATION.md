# Support-ticket anonymization constraint repair

The current anonymization routine replaces a support-ticket description with an empty string. Existing support constraints require 5–3000 characters, so an account with a ticket cannot complete anonymization: the entire transaction rolls back.

Pending migration `20261105214300` replaces only that literal with `Account deleted.`. It preserves constraints, permissions, locking, and the routine's other behavior. It compares the complete canonical function definition against the November 5 source snapshot and rejects changed source, including replay. A fresh or changed database must be reviewed before application; this is not an unconditional bootstrap migration.

Run `python3 tests/support-anonymization.py` with PostgreSQL 17 tools available (`PG_BIN` overrides the local Homebrew default). The test creates a disposable socket-only cluster, loads the complete original routine and actual support constraints, reproduces the failure with exact four-table rollback comparison, applies the actual pending migration, and verifies successful anonymization, check deletion, neutral retained ticket, repeat no-op, and changed-source rejection. All fixtures are removed.

Six checks passed on PostgreSQL 17.11. Other tables are simplified and mostly empty; other constraints/triggers, RLS, HTTP authorization, and full production data are not covered. This repair is not deployed. Independent review and release approval remain required. PR99's separate verification concurrency and deletion-race blockers remain unresolved by this change; local serialization/status proposals are not included here.
