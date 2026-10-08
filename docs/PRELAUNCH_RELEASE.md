# S.O.S. pre-launch release — landing, provider early registration, marketplace lock

GitHub issue #103. Founder directive 2026-10-08: show what S.O.S. will deliver, recruit the
providers needed to deliver it, and keep the marketplace closed until coverage is verified.

## What changed

| Surface | Before | After |
|---|---|---|
| `/` (web + Capacitor) | Re-exported the customer app; native shell forced `/` → `/app/` | Ten-section pre-launch landing (`SOSPrelaunchLanding`); native redirect removed |
| `/become-a-hero` | Redirect to full credentialed application | Four-screen early registration (A intro · B info · C services/zones · D receipt) |
| `/apply`, `/provider`, `/become-a-provider` | → `/hero/apply` or `/hero` | → `/become-a-hero/` |
| `/app`, `/hero`, `/ops`, `/ops/heroes`, `/track`, `/request-roadside-help`, `/login`, `/download` | Public | `SOSPrelaunchGate` — server-checked internal access only |
| `/hero/apply` | Public full application | Invitation notice; DB rejects un-invited emails |
| `/ops/recruitment` | — | Operator recruitment command: 10 zones × 40 services supply matrix + early-interest workbench |

## Server-side enforcement (the real lock)

`supabase/migrations/20261008030000_sos_prelaunch_marketplace_gate.sql`

BEFORE triggers (`private.sos_prelaunch_guard`) on `sos_missions`, `sos_payments`,
`sos_subscriptions`, `sos_mission_offers` (insert / accept), `sos_heroes` (on-duty / on-duty insert),
`sos_hero_shift_sessions`, `sos_hero_applications` (invite-only). They check the **row owner**, so they
hold for PostgREST, SECURITY DEFINER RPCs, Edge Functions running as service_role, and native builds
already in the field. Violations raise SQLSTATE `42501` (HTTP 403 via PostgREST) and are logged to
`private.sos_prelaunch_denials`.

Allowed while pre-launch is on: active `private.marketplace_operators`, and accounts explicitly granted in
`private.sos_prelaunch_access` (`qa_tester` / `qa_operator`, optional expiry).

### Grant internal QA access (SQL editor, service role)

```sql
insert into private.sos_prelaunch_access(auth_id, access_role, granted_by, note, expires_at)
select id, 'qa_tester', 'founder', 'Pre-launch QA', now() + interval '30 days'
from auth.users where email = 'tester@example.com';
```

### Invite a screened provider to the full application

Use `/ops/recruitment` → stage **Invited to apply** (requires Contact verified → Screening first). This
writes `private.sos_prelaunch_application_invites`. No message is sent — Muse owns approved sends.

### Reopen / rollback

* Reopen marketplace (keeps audit + grants):
  `update private.sos_prelaunch_state set prelaunch_enabled=false, reason='<why>', changed_by='<who>', changed_at=now() where id;`
  The web/native gate reads `sos_prelaunch_public_state()` and opens automatically.
* Remove the gate entirely: `supabase/rollbacks/20261008030000_sos_prelaunch_marketplace_gate.rollback.sql`.
* Front-end rollback: Vercel "Instant Rollback" / promote the previous production deployment.

## Early-interest data model

`supabase/migrations/20261008031000_sos_provider_early_interest_intake.sql`,
`supabase/migrations/20261008032000_sos_ops_recruitment_command.sql`,
Edge Function `supabase/functions/sos-provider-early-interest` (verify_jwt = false).

* `sos_recruiting_candidates` stays the candidate master. New registrants get
  `candidate_source = 'early_interest_web'`, `pipeline_stage = 'prospect'`, `outreach_status = 'not_queued'`.
* `sos_provider_early_interest` — separate truth dimension: `interested → contact_verified → screening → invited_to_apply`
  (+ `not_a_fit`, `withdrawn`), opt-ins with timestamps, owner, Muse review tag.
* `sos_provider_interest_receipts` — append-only receipt per submission (idempotency key, consent snapshot,
  terms/privacy versions, hashed IP). Only an operator privacy erasure may redact it.
* `sos_candidate_service_interests` — canonical subcategory ids (self-reported until operator-verified).
* Zones → `sos_recruiting_candidate_zone_coverage` as `source_claimed`, `verified_at` NULL; existing rows untouched.
* `sos_service_label_map` — legacy prospect labels (`towing`, `flat_tire`, `jump_start` …) → canonical ids,
  without rewriting source data. Unmapped labels stay unmapped.
* Dedupe: normalized email → phone → dedupe_key → company+ZIP (company/fleet only). Matched and new
  submissions return an identical response, so the form never reveals whether a contact exists.
* Test signups (`@example.com/.org/.net`, `@sos-qa.test`) are stored as `is_demo/is_test` and excluded
  from every real count.
* No email, SMS, DM or GHL send is triggered anywhere in this release.

## Assets (vetted manifest)

| Use | File in repo | Source | Notes |
|---|---|---|---|
| Logo (hero, header, gate, footer) | `public/brand/prelaunch/sos-shield-{720,360}.webp`, `sos-shield-200.png` | Founder-supplied new logo 2026-10-08 (same file as BOH `brand-assets/_shared/logos/APPs/SOS LOGO.png`, 1,969,580 B) | Cropped to ring + cape + S.O.S. (rows 0–652). The source art spells **"SUPERHEROES"** in the band below; that band is excluded and the wordmark is rendered as live text "SUPERHEROS ON STANDBY". Original untouched. Replaces the earlier tire app-icon mark. |
| Hero texture | `public/brand/prelaunch/sos-bg-ribbon.webp` | BOH `website-graphics/sos-graphics/chatgpt-image-jul-30-2026-04_19_47-am-4-.png`, crop x0–800 | Logo with misspelling cropped out. |
| Network + final CTA sky | `public/brand/prelaunch/sos-bg-beacon-sky.webp` | `…04_19_49-am-9-.png`, crop x880–1672, y0–500 | S.O.S. beacon only; city skyline cropped out. |
| Feature card | `public/brand/prelaunch/sos-bg-signal-sky.webp` | `…04_19_47-am-3-.png`, crop x760–1672, y0–370 | Signal ring only; skyline cropped out. |

**Not used, with reason**

* All ten `website-graphics/sos-graphics/*.png` in full: each has the logo baked in as **"SUPERHEROES"**
  (brand violation). Several also show Manhattan landmarks (Empire State Building), police/ambulance/helicopter
  imagery implying emergency service, and fabricated dashboard stats ("Active Heroes 128", response times).
* `animations/sos-ani.mp4`, `sos-ani2.mp4`: same "SUPERHEROES" logo throughout, fake stats, emergency vehicles.
  (`sos-ani2.mp4` is still referenced by the preserved operational app via `SOSUIUpgradeHost` from project
  `woqlhjodiedyqfvzweoe`.) Needs a corrected re-render before public use.
* `brand-assets/_shared/logos/*` and `_shared/decks/SOS MAIN/*` (private bucket): not fetched — no signed
  access from this environment; bucket left private as required.
* `public/brand/sos-logo.webp` and the base64 inside `public/sos-logo-*.svg`: **truncated/corrupt** (RIFF header
  declares ~187 KB, file is 4.7 KB). Left unchanged per "do not overwrite logos"; needs the original re-exported.
