# SOS — Audit Report

**Branch:** `audit/sos-ios-release`
**Date:** 2026-07-13
**Auditor:** Claude Code (Opus 4.8)
**Repo:** dolodorsey/sos-app · **Vercel:** sos-app-website · **Plan:** SOS_Claude_Code_Execution_Plan

---

## 1. Baseline (Phase 0)

| Item | State |
|---|---|
| Stack | Next.js 14.2.5 · React 18 · Capacitor 8 · @supabase/supabase-js 2.97 · @capacitor/geolocation |
| Entry | `src/app/page.jsx` → `src/components/SOSApp.jsx` (460 lines) |
| Build | `npm run build` — **PASS** (static export in `out/`) |
| Supabase | `cxdqkjvtpilvouwtbgdy.supabase.co` (dedicated SOS project, matches plan). Tables: `sos_users`, `sos_missions`. |
| Secrets | No `service_role`/private keys in source or `out/` bundle. |
| Product note | This app is **"S.O.S — Superheroes On Standby," a roadside-assistance marketplace** (towing, tires, oil, car wash), NOT the personal-safety/emergency platform the SOS execution plan describes. **Scope mismatch — confirm intended product** before Apple metadata/privacy work. |

## 2. Findings & remediation

### FIXED on this branch (reversible commits)

| # | Sev | Finding | Fix |
|---|-----|---------|-----|
| 1 | **Sev-1** | **Fabricated dispatch.** `confirmReq()` inserted a mission row, then used hardcoded `setTimeout`s to show "Hero Found!" (3s) → "Hero En Route", "GPS Tracking ● Live", fixed "7 min" ETA (5.5s). No real matching; the Hero portal never receives these requests. | Replaced with a truthful "Request Received / Pending assignment" state, plus an honest network-error path that directs life-threatening emergencies to **911** (commit `50fdd9a`). Mission is still recorded server-side. |

### OUTSTANDING (documented — needs owner/backend/approval)

| # | Sev | Finding | Required action |
|---|-----|---------|-----------------|
| 2 | **Sev-1 (creds)** | **Leaked GitHub PAT.** The git remote in `.git/config` embeds a plaintext `github_pat_…` token. It is exposed to anyone with repo/file access. | **Rotate this PAT now** (GitHub → Settings → Developer settings → Fine-grained tokens → revoke), then set the remote to a token-less HTTPS/SSH URL and use a credential helper. Not auto-changed to avoid breaking your push auth. |
| 3 | **High (Apple)** | No in-app **account deletion** (Guideline 5.1.1(v)). | Add delete-account flow + server-side deletion. |
| 4 | Med | **No-op controls.** "Subscribe Now" (Shield plans) and Profile rows (Payment Methods, Safety Settings, Notifications, Help & Support) are buttons/divs with no handler. | Wire to real screens or remove; no dead controls in a release build. |
| 5 | Med | No real Hero matching/dispatch or payments/subscriptions backend. | Build dispatch + Stripe/subscription server flows before re-introducing live states. |
| 6 | Low | Anon key hardcoded fallback in `src/lib/supabase.js` and `SOSApp.jsx`; session (incl. access_token) stored in `localStorage`. | Move keys to env; acceptable for Supabase but review XSS surface. |
| 7 | Info | Terms/Privacy reference sibling brands (Good Times, On Call, Help 911) inside SOS. Confirm intended. |

## 3. Gated / cannot-do-here
- PAT rotation (yours to do in GitHub).
- TestFlight upload & App Store submission.
- Vercel production deploy; any Supabase schema change.

## 4. Verification
- `npm run build` passes after the fix.
- `grep` confirms no `Hero Found` / `Hero En Route` / fake `GPS Tracking` states remain.
