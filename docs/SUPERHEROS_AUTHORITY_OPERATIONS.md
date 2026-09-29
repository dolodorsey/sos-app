# SUPERHEROS Authority Operations

This runbook governs the S.O.S. authority, media, trademark-reference and CRM execution system.

## Canonical identity

- Company: **S.O.S. — Superheros On Standby**
- Brand term: **SUPERHEROS**
- Instagram: **@SUPERHERO.ONSTANDBY**
- Canonical web entity: `https://thesuperherosonstandby.com`
- HighLevel location: `jz8geHs33Iqyruo2q2oO`
- HighLevel media pipeline: **SOS | MEDIA AUTHORITY**
- Pipeline ID: `4tc0h7lSbFYwozn652H1`

Never auto-correct current brand usage from SUPERHEROS to SUPERHEROES.

## Authority data

Authoritative S.O.S. database: Supabase project `cxdqkjvtpilvouwtbgdy`.

### Tables

- `public.sos_authority_sources` — media, database, directory and knowledge-graph targets.
- `public.sos_authority_outreach` — contact route, pitch copy, editorial stage and GHL identifiers.
- `public.sos_trademark_clearance` — research ledger for candidate marks and relevant third-party marks.

These tables are internal. Anonymous/authenticated client access is denied; trusted server paths own writes.

## GHL media pipeline

Stages, in order:

1. Research Contact
2. Pitch Ready
3. Ready to Send
4. Pitched
5. Follow-Up
6. Interested
7. Interview
8. Coverage Pending
9. Published
10. Indexed
11. Wikipedia-Grade

Do not skip evidence gates merely to advance a card.

### Stage proof

**Research Contact**
- Target is relevant.
- No verified editorial route yet.

**Pitch Ready**
- Publicly verifiable contact route exists.
- Outlet-specific pitch exists.
- No send is implied.

**Ready to Send**
- Exact S.O.S. sender has passed current QA.
- Pitch has been reviewed against current company truth.
- Recipient route is still current.

**Pitched**
- Provider evidence proves the message was actually accepted/sent.
- Store provider/message receipt and sent timestamp.

**Follow-Up**
- Prior pitch proof exists and follow-up timing is due.

**Interested**
- Actual reply or equivalent editorial response exists.

**Interview**
- Interview/call is explicitly scheduled or completed.

**Coverage Pending**
- Editorial team indicates coverage is in production or awaiting publication.

**Published**
- Public article/video/audio URL resolves.
- Exact publication and date are stored.

**Indexed**
- Published item is discoverable through the relevant search/index surface.

**Wikipedia-Grade**
- Human review confirms the source is independent, reliable, secondary and substantively covers S.O.S.; routine mentions, directories and press-release syndication do not qualify.

## CRM synchronization

S.O.S. source worker:

`private.sos_sync_authority_to_crm_v1(20)`

Cron:

`sos-authority-crm-sync-v1` — every five minutes.

Gateway function:

`sos-authority-crm-bridge-v1`

Gateway project:

`dzlmtvodpyhetvektfuo`

The bridge:
- requires a signed HMAC payload from S.O.S.
- forces the exact S.O.S. location.
- upserts the contact.
- applies authority tags.
- creates or moves the opportunity.
- reads the contact back from HighLevel.
- writes an internal provider receipt.
- is idempotent.
- **does not send external messages**.

A ChatGPT-facing HighLevel IAM error is not evidence the server-side S.O.S. private integration is unavailable.

## Sender gate

Current required media sender:

`reply@mail.superherosonstandby.com`

Sender name:

**S.O.S. — Superheros On Standby**

Configuration truth:

`public.sos_system_config.media_authority_sender_policy`

Outbound must remain fail-closed until all of the following are proven:

- exact required sender is accepted by the S.O.S. HighLevel location.
- an approved internal QA message is sent from the exact sender.
- provider/delivery evidence is stored.
- no personal Gmail fallback is used.
- S.O.S. location timezone is correct for Atlanta operations.

Do not treat contact/opportunity sync as sender certification.

## Known GHL account-level blockers

At the last verified read:
- location timezone reported `America/Cancun`, not `America/New_York`.
- location general email still reflected the old Kollective Gmail.
- `defaultEmailService` was blank.
- ChatGPT-facing HighLevel connector returned an IAM 401.
- the working private-integration token is a sub-account token.

HighLevel's location-update endpoint requires an Agency Token with `locations.write`; do not force account-level location changes with the wrong token type.

Tracked in GitHub issue #95.

## Editorial-contact law

Only store an email as verified when it is publicly supported by a current first-party page or a sufficiently current, attributable publication/profile.

Do not:
- infer an email from a naming pattern.
- scrape or buy private personal addresses.
- send to advertising, subscription or corporate PR contacts as if they were editorial when the source says otherwise.
- claim a form-only outlet has an email route.
- confuse press-distribution services with independent coverage.

## Pitch law

Pitches must:
- be outlet-specific.
- preserve SUPERHEROS spelling.
- state current operating truth.
- avoid invented revenue, user, valuation, response-time, coverage or provider-volume metrics.
- offer access/evidence, not prewritten editorial conclusions.
- preserve editorial independence.

## Wikipedia / Wikidata

Wikipedia is downstream of real notability.

Do not create or force a Wikipedia article merely because:
- the website is live.
- directories exist.
- press releases were syndicated.
- company profiles were claimed.
- social profiles exist.

Proceed only when multiple strong independent secondary sources provide substantive coverage. Then build a neutral source dossier and use disclosed conflict-of-interest procedures.

Wikidata should use reliable identifiers/references and the aliases:
- Superheros On Standby
- S.O.S.
- SOS
- SUPERHEROS

## Trademark research

The trademark table is a research ledger, not legal clearance.

High-priority issues already identified include:
- CARHERO — live federal Class 39 roadside/towing registration.
- Superhero Roadside — common-law market use in directly overlapping roadside services.

Do not file or claim exclusive nationwide rights based solely on internal research. Attorney-grade federal/state/common-law clearance and correct applicant/use facts are required.

## Proof rules

- Drafted is not sent.
- Synced is not sent.
- Scheduled is not sent.
- Sent is not delivered.
- Published is not indexed.
- Indexed is not Wikipedia-grade.
- Owned content is not independent editorial coverage.
- Trademark research is not trademark registration.

Every status change must be supported by the corresponding provider or public evidence.
