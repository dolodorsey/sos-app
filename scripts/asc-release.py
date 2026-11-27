#!/usr/bin/env python3
"""App Store release step for S.O.S., driven by ios/app-store-release.json.

Runs inside the iOS TestFlight workflow (main branch only) with the App Store
Connect key the workflow already holds. What it does is set by the request file:

  attach_latest_build  put the newest processed (VALID) build on the version
  submit_for_review    send the version to App Review (resubmits an
                       UNRESOLVED_ISSUES submission, or opens a new one)

It also prints everything the API exposes about the last review submission,
since Apple's written rejection reason lives on the App Review page.
It is safe to run again: a version already waiting for or in review is left alone.
Env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH.
"""
import json, os, sys, time, urllib.error, urllib.parse, urllib.request

import jwt

REQ_PATH = os.path.join(os.path.dirname(__file__), "..", "ios", "app-store-release.json")
REQ = json.load(open(REQ_PATH))
BUNDLE = REQ.get("bundle_id", "com.superherosonstandby.app")
VERSION = REQ.get("version", "1.0")
API = "https://api.appstoreconnect.apple.com"


def token():
    now = int(time.time())
    return jwt.encode({"iss": os.environ["ASC_ISSUER_ID"], "iat": now, "exp": now + 900, "aud": "appstoreconnect-v1"},
                      open(os.environ["ASC_KEY_PATH"]).read(), algorithm="ES256",
                      headers={"kid": os.environ["ASC_KEY_ID"], "typ": "JWT"})


TOKEN = token()
lines = []


import re as _re
_SECRET_KEYS = ("demoAccountPassword", "demoAccountName", "contactPhone", "contactEmail", "contactFirstName", "contactLastName")


def redact(text):
    """Never let sign-in details or contact info reach the (public) workflow log."""
    for k in _SECRET_KEYS:
        text = _re.sub(r'("%s"\s*:\s*)"[^"]*"?' % k, r'\1"[hidden]"', text)
        text = _re.sub(r"('%s'\s*:\s*)'[^']*'?" % k, r"\1'[hidden]'", text)
    return text


def say(s=""):
    s = redact(str(s))
    print(s); lines.append(s)


def call(method, path, body=None, **params):
    url = API + path + ("?" + urllib.parse.urlencode(params, safe="[],") if params else "")
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method,
                                 headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read()
            return r.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as e:
        raw = e.read().decode(errors="replace")
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"raw": raw[:500]}


def errs(b):
    return "; ".join(f"{x.get('code')}: {x.get('detail') or x.get('title')}" for x in b.get("errors", [])) or json.dumps(b)[:400]


say("## App Store release step")
st, apps = call("GET", "/v1/apps", **{"filter[bundleId]": BUNDLE})
if st != 200 or not apps.get("data"):
    say(f"App not found ({st}): {errs(apps)}"); sys.exit(0)
aid = apps["data"][0]["id"]

st, vers = call("GET", f"/v1/apps/{aid}/appStoreVersions", **{"filter[versionString]": VERSION, "filter[platform]": "IOS",
                 "fields[appStoreVersions]": "versionString,appStoreState,appVersionState"})
if not vers.get("data"):
    say(f"Version {VERSION} not found: {errs(vers)}"); sys.exit(0)
ver = vers["data"][0]; vid = ver["id"]
state = ver["attributes"].get("appVersionState") or ver["attributes"].get("appStoreState")
say(f"Version {VERSION} state: {state}")

# Everything the API exposes about the last review submission
st, subs = call("GET", "/v1/reviewSubmissions", **{"filter[app]": aid, "filter[platform]": "IOS", "limit": "5",
                "include": "items,appStoreVersionForReview"})
open_sub = None
for s in subs.get("data", []):
    a = s["attributes"]
    say(f"Review submission {s['id']}: {a.get('state')} (submitted {a.get('submittedDate')})")
    if a.get("state") in ("UNRESOLVED_ISSUES", "READY_FOR_REVIEW", "WAITING_FOR_REVIEW") and not open_sub:
        open_sub = s
for inc in subs.get("included", []):
    if inc.get("type") == "reviewSubmissionItems":
        say(f"- item {inc['id']}: {json.dumps(inc.get('attributes'))}")
if open_sub:
    for path in (f"/v1/reviewSubmissions/{open_sub['id']}/items", f"/v1/appStoreVersions/{vid}/appStoreVersionSubmission",
                 f"/v1/appStoreVersions/{vid}/appStoreReviewDetail"):
        st, b = call("GET", path)
        say(f"- GET {path.split('/v1/')[1]} -> {st}: {json.dumps(b.get('data', b))[:600]}")

if state in ("WAITING_FOR_REVIEW", "IN_REVIEW", "PENDING_DEVELOPER_RELEASE", "READY_FOR_SALE", "READY_FOR_DISTRIBUTION",
             "PROCESSING_FOR_DISTRIBUTION", "ACCEPTED", "PENDING_APPLE_RELEASE"):
    say("Version is already with Apple or approved. Nothing to do.")
else:
    # Attach newest processed build
    if REQ.get("attach_latest_build"):
        st, builds = call("GET", "/v1/builds", **{"filter[app]": aid, "filter[processingState]": "VALID", "filter[expired]": "false",
                          "filter[preReleaseVersion.version]": VERSION, "sort": "-uploadedDate", "limit": "1",
                          "fields[builds]": "version,uploadedDate,usesNonExemptEncryption"})
        if not builds.get("data"):
            say(f"No processed build for {VERSION}: {errs(builds)}")
        else:
            b = builds["data"][0]
            if b["attributes"].get("usesNonExemptEncryption") is None:
                st, r = call("PATCH", f"/v1/builds/{b['id']}", {"data": {"type": "builds", "id": b["id"], "attributes": {"usesNonExemptEncryption": False}}})
                say(f"Export compliance set on build {b['attributes']['version']}: {st}")
            st, r = call("PATCH", f"/v1/appStoreVersions/{vid}/relationships/build", {"data": {"type": "builds", "id": b["id"]}})
            say(f"Attach build {b['attributes']['version']} to version {VERSION}: {'done' if st in (200, 204) else f'{st} ' + errs(r)}")

    if REQ.get("submit_for_review"):
        note = REQ.get("review_notes")
        if note:
            st, rd = call("GET", f"/v1/appStoreVersions/{vid}/appStoreReviewDetail")
            if rd.get("data"):
                st, r = call("PATCH", f"/v1/appStoreReviewDetails/{rd['data']['id']}",
                             {"data": {"type": "appStoreReviewDetails", "id": rd["data"]["id"], "attributes": {"notes": note}}})
                say(f"Review notes updated: {st}")
        def add_item(sid):
            it = {}
            for attempt in range(6):
                st, it = call("POST", "/v1/reviewSubmissionItems", {"data": {"type": "reviewSubmissionItems",
                              "relationships": {"reviewSubmission": {"data": {"type": "reviewSubmissions", "id": sid}},
                                                "appStoreVersion": {"data": {"type": "appStoreVersions", "id": vid}}}}})
                if st in (200, 201):
                    say("Version added to submission."); return True
                time.sleep(20)
            say(f"Add version to submission failed ({st}). Apple's full answer:")
            say(json.dumps(it)[:1500])
            for x in it.get("errors", []):
                for ae in ((x.get("meta") or {}).get("associatedErrors") or {}).values():
                    for e in ae:
                        say(f"- blocking: {e.get('code')}: {e.get('detail') or e.get('title')}")
            return False

        def submit(sid):
            st, r = call("PATCH", f"/v1/reviewSubmissions/{sid}",
                         {"data": {"type": "reviewSubmissions", "id": sid, "attributes": {"submitted": True}}})
            say(f"Submit for review: {'DONE' if st == 200 else f'{st} ' + errs(r)}")
            return st == 200

        done = False
        if open_sub:
            sid = open_sub["id"]
            st, items = call("GET", f"/v1/reviewSubmissions/{sid}/items")
            has_items = bool(items.get("data"))
            say(f"Reusing open submission {sid} (has items: {has_items})")
            if has_items or add_item(sid):
                done = submit(sid)
            if not done:
                st, r = call("PATCH", f"/v1/reviewSubmissions/{sid}",
                             {"data": {"type": "reviewSubmissions", "id": sid, "attributes": {"canceled": True}}})
                say(f"Cancel submission {sid}: {st} {'' if st == 200 else errs(r)}")
                for _ in range(12):
                    time.sleep(10)
                    st, v = call("GET", f"/v1/appStoreVersions/{vid}", **{"fields[appStoreVersions]": "appStoreState,appVersionState"})
                    a = v.get("data", {}).get("attributes", {})
                    if (a.get("appVersionState") or a.get("appStoreState")) in ("PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "READY_FOR_REVIEW"):
                        break
        if not done:
            st, ns = call("POST", "/v1/reviewSubmissions", {"data": {"type": "reviewSubmissions", "attributes": {"platform": "IOS"},
                          "relationships": {"app": {"data": {"type": "apps", "id": aid}}}}})
            if st not in (200, 201):
                say(f"Open new submission failed: {st} {errs(ns)}")
            else:
                sid = ns["data"]["id"]
                say(f"Opened new submission {sid}")
                if add_item(sid):
                    submit(sid)

    st, v2 = call("GET", f"/v1/appStoreVersions/{vid}", **{"fields[appStoreVersions]": "appStoreState,appVersionState"})
    a = v2.get("data", {}).get("attributes", {})
    say(f"Version {VERSION} state now: {a.get('appVersionState') or a.get('appStoreState')}")

summary = os.environ.get("GITHUB_STEP_SUMMARY")
if summary:
    open(summary, "a", encoding="utf-8").write("\n".join(lines) + "\n")
