# AGENTS.md — S.O.S. Operating Contract

This is the mandatory source-of-truth entry point for coding, marketing, CRM, social and operating agents working on S.O.S.

## Identity — non-negotiable

- Canonical company name: **S.O.S. — Superheros On Standby**
- Canonical branded spelling: **SUPERHEROS** — intentionally spelled without the second "e" in "heroes".
- **Never auto-correct SUPERHEROS to SUPERHEROES** when referring to the S.O.S. brand, network, provider identity, branded category, metadata, structured data, press language or public-facing naming.
- Canonical Instagram: **@superheros.onstandby**
- Canonical current entity: **S.O.S.**
- Approved aliases for entity resolution: **S.O.S.**, **SOS**, **Superheros On Standby**, **SUPERHEROS**.
- Prior identities attached to the underlying Instagram account are retired from current operations.
- Historical provider/audit evidence may preserve old provider values, but no retired identity may be used for current publishing, scheduling, routing, tagging, reporting, engagement, DMs, comments or approvals.
- Before social publish, the provider-returned live username must match `superheros.onstandby`.

## Brand authority — canonical definition

Use this definition consistently unless a specific channel requires a shorter version:

> **SUPERHEROS** are S.O.S. roadside assistance providers who help motorists with vehicle-related difficulties, including towing, jump-starts, tire changes, fuel delivery, and vehicle lockout services.

Singular: **SUPERHERO**. Plural: **SUPERHEROS** (never with an E before the S). The text lives in `src/content/sosLexicon.js` (`OFFICIAL_DEFINITION`) and Supabase `public.sos_brand_content` (`kind = definition`); change it in both through a reviewed PR. `npm test` runs `tests/brand-spelling.test.mjs`, which fails on the conventional plural outside `config/brand-spelling-allowlist.json`.

Public authority pages and structured data live under the canonical web entity at `https://superherosonstandby.com` — definition at `/superheros/`, S.O.S. Knowledge Hub at `/wiki/`.

For media authority, trademark-reference, Wikipedia-readiness and media pipeline execution, agents must also read [`docs/SUPERHEROS_AUTHORITY_OPERATIONS.md`](./docs/SUPERHEROS_AUTHORITY_OPERATIONS.md).

## Outbound — current rules

- HighLevel (GHL) is retired. The founder confirmed on Nov 23, 2026: nothing routes through it.
- Provider recruitment email goes out from S.O.S.'s own mailbox (hero@sosatl.com). The main S.O.S. inbox is help@superherosonstandby.com.
- Team members text the sign-up link (www.SOSatl.com) from their own phones, only after the person agrees on the call.
- Central phone for listings, temporary: (470) 809-2222 (Supabase `sos_system_config.central_phone`).
- Each company sends from its own mailbox. S.O.S. contacts, audiences and reporting stay separate from every other Kollective entity.

## Provider recruitment truth

- Outreach is not provider activation.
- Application is not approval.
- Approval is not dispatch readiness.
- A provider is launch-ready only after required verification and exact operational readiness gates pass.

## Proof law

- Built/configured/queued/scheduled is not sent.
- Email/SMS requires provider delivery evidence.
- Social requires provider post ID + permalink.
- Website changes require production deployment plus live verification.
- Do not claim coverage, response times, provider availability, earnings or guaranteed work without current evidence.

## Brand isolation

S.O.S. is a separate company. Do not merge its contacts, audiences, campaigns, social identity, GHL location, pipelines, workflows, knowledge base, sender routes, analytics, approvals or reporting with another Kollective entity.
