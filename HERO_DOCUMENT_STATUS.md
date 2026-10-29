# Hero document registration response

Pending migration `20261029151300_sos_document_response_status.sql` returns the actual updated application status. Previously, an approved application could remain approved in storage while its document-registration response reported documents_required or waitlisted. The existing UI reloads private status and does not consume that success field.

The migration checks the exact inspected function definition before replacement and fails on drift. It changes no permissions, approval transitions, credential counting or timestamp semantics. It requires the existing function and is not a fresh-schema bootstrap.

Run `python3 tests/hero-document-status.test.py` with PostgreSQL 17 binaries available through PGBIN (default Homebrew postgresql@17). The test uses a disposable socket-only cluster, actual migration, minimal tables and auth stub. It checks rejection/no partial writes, replay, completeness, ten preserved-lifecycle cases and migration drift refusal. It does not exercise production triggers, full constraints, HTTP tokens or external consumers.

Not deployed. Full-schema rehearsal and independent review remain required. Existing credential timestamp and null-type behavior are outside this response-only change.
