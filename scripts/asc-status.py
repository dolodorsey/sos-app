#!/usr/bin/env python3
"""Read-only App Store Connect status report for S.O.S.

Runs inside the iOS TestFlight workflow after the upload, using the App Store
Connect key the workflow already holds. It never changes anything in App Store
Connect. It prints what is done and what is still missing for the App Store
release, and writes the same report to the GitHub job summary.

Env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH. Optional: APP_BUNDLE_ID.
"""
import json, os, sys, time, urllib.parse, urllib.request

import jwt  # PyJWT, installed by the workflow step

BUNDLE = os.environ.get("APP_BUNDLE_ID", "com.superherosonstandby.app")
API = "https://api.appstoreconnect.apple.com"


def token():
    key = open(os.environ["ASC_KEY_PATH"]).read()
    now = int(time.time())
    return jwt.encode({"iss": os.environ["ASC_ISSUER_ID"], "iat": now, "exp": now + 900, "aud": "appstoreconnect-v1"},
                      key, algorithm="ES256", headers={"kid": os.environ["ASC_KEY_ID"], "typ": "JWT"})


TOKEN = token()


def get(path, **params):
    url = API + path + ("?" + urllib.parse.urlencode(params, safe="[],") if params else "")
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {TOKEN}"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")[:300]
        return {"error": f"{e.code} {body}", "data": []}


lines, missing = [], []
out = lambda s="": lines.append(s)

apps = get("/v1/apps", **{"filter[bundleId]": BUNDLE, "fields[apps]": "name,bundleId,sku,primaryLocale"})
if not apps.get("data"):
    out(f"App not found in App Store Connect for {BUNDLE}. {apps.get('error','')}")
    missing.append("App record for the bundle ID")
else:
    app = apps["data"][0]
    aid, a = app["id"], app["attributes"]
    out(f"## App Store Connect status: {a.get('name')} ({BUNDLE})")
    out(f"App ID {aid}, primary language {a.get('primaryLocale')}")

    # Versions
    vers = get(f"/v1/apps/{aid}/appStoreVersions", **{"fields[appStoreVersions]": "versionString,appStoreState,appVersionState,platform,createdDate,releaseType", "limit": "10"})
    out("\n### App Store versions")
    if not vers.get("data"):
        out("None yet."); missing.append("An App Store version (1.0) to submit")
    for v in vers.get("data", []):
        va = v["attributes"]
        out(f"- {va.get('platform')} {va.get('versionString')}: {va.get('appVersionState') or va.get('appStoreState')} (release: {va.get('releaseType')}, created {str(va.get('createdDate'))[:10]})")

    # Review submissions
    subs = get("/v1/reviewSubmissions", **{"filter[app]": aid, "limit": "5", "fields[reviewSubmissions]": "state,submittedDate,platform"})
    out("\n### Review submissions")
    if not subs.get("data"):
        out("None. The app has never been sent to Apple review.")
    for s in subs.get("data", []):
        sa = s["attributes"]
        out(f"- {sa.get('platform')}: {sa.get('state')} (submitted {str(sa.get('submittedDate'))[:16]})")

    # Builds
    builds = get("/v1/builds", **{"filter[app]": aid, "sort": "-uploadedDate", "limit": "5", "fields[builds]": "version,processingState,uploadedDate,expired,minOsVersion"})
    out("\n### Latest builds")
    for b in builds.get("data", []):
        ba = b["attributes"]
        out(f"- build {ba.get('version')}: {ba.get('processingState')}, uploaded {str(ba.get('uploadedDate'))[:16]}{', expired' if ba.get('expired') else ''}")

    groups = get(f"/v1/apps/{aid}/betaGroups", **{"fields[betaGroups]": "name,isInternalGroup,publicLinkEnabled,publicLink", "limit": "20"})
    out("\n### TestFlight groups")
    if not groups.get("data"):
        out("None."); missing.append("A TestFlight tester group")
    for g in groups.get("data", []):
        ga = g["attributes"]
        link = ga.get("publicLink") if ga.get("publicLinkEnabled") else "no public link"
        out(f"- {ga.get('name')} ({'internal' if ga.get('isInternalGroup') else 'external'}): {link}")

    # The version still being prepared: what is filled in
    editable = [v for v in vers.get("data", []) if (v["attributes"].get("appVersionState") or v["attributes"].get("appStoreState")) in
                ("PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "REJECTED", "METADATA_REJECTED", "INVALID_BINARY", "READY_FOR_REVIEW")]
    if editable:
        v = editable[0]; vid = v["id"]
        out(f"\n### Checklist for version {v['attributes'].get('versionString')}")
        bld = get(f"/v1/appStoreVersions/{vid}/build", **{"fields[builds]": "version"})
        has_build = bool(bld.get("data"))
        out(f"- Build attached: {'yes (' + bld['data']['attributes']['version'] + ')' if has_build else 'NO'}")
        if not has_build: missing.append("Attach a build to the version")
        locs = get(f"/v1/appStoreVersions/{vid}/appStoreVersionLocalizations", **{"fields[appStoreVersionLocalizations]": "locale,description,keywords,supportUrl,marketingUrl,promotionalText,whatsNew"})
        for l in locs.get("data", []):
            la = l["attributes"]
            for f in ("description", "keywords", "supportUrl"):
                ok = bool((la.get(f) or "").strip())
                out(f"- {la.get('locale')} {f}: {'yes' if ok else 'MISSING'}")
                if not ok: missing.append(f"{la.get('locale')} {f}")
            sets = get(f"/v1/appStoreVersionLocalizations/{l['id']}/appScreenshotSets", **{"fields[appScreenshotSets]": "screenshotDisplayType", "include": "appScreenshots", "limit": "20"})
            kinds = [s["attributes"]["screenshotDisplayType"] for s in sets.get("data", [])]
            count = len([i for i in sets.get("included", []) if i.get("type") == "appScreenshots"])
            out(f"- {la.get('locale')} screenshots: {count} across {', '.join(kinds) or 'no sizes'}")
            if count == 0: missing.append(f"{la.get('locale')} screenshots")
        rd = get(f"/v1/appStoreVersions/{vid}/appStoreReviewDetail", **{"fields[appStoreReviewDetails]": "contactFirstName,contactEmail,contactPhone,demoAccountRequired,demoAccountName,notes"})
        r = (rd.get("data") or {}).get("attributes") or {}
        has_contact = bool(r.get("contactEmail") and r.get("contactPhone"))
        out(f"- Review contact: {'yes' if has_contact else 'MISSING'}; demo account required: {r.get('demoAccountRequired')}; demo account set: {'yes' if r.get('demoAccountName') else 'no'}")
        if not has_contact: missing.append("App Review contact (name, email, phone)")
        if r.get("demoAccountRequired") and not r.get("demoAccountName"): missing.append("App Review demo sign-in")

    infos = get(f"/v1/apps/{aid}/appInfos", **{"fields[appInfos]": "appStoreState,appStoreAgeRating", "limit": "5"})
    for i in infos.get("data", []):
        ia = i["attributes"]
        out(f"\nApp info: state {ia.get('appStoreState')}, age rating {ia.get('appStoreAgeRating') or 'NOT SET'}")
        if not ia.get("appStoreAgeRating"): missing.append("Age rating questionnaire")
        il = get(f"/v1/appInfos/{i['id']}/appInfoLocalizations", **{"fields[appInfoLocalizations]": "locale,name,subtitle,privacyPolicyUrl"})
        for l in il.get("data", []):
            la = l["attributes"]
            out(f"- {la.get('locale')} name '{la.get('name')}', subtitle '{la.get('subtitle') or ''}', privacy policy URL: {'yes' if la.get('privacyPolicyUrl') else 'MISSING'}")
            if not la.get("privacyPolicyUrl"): missing.append(f"{la.get('locale')} privacy policy URL")
        break

out("\n### Still missing before App Store submission")
out("\n".join(f"- {m}" for m in missing) if missing else "- Nothing detected by this check.")

report = "\n".join(lines)
print(report)
summary = os.environ.get("GITHUB_STEP_SUMMARY")
if summary:
    with open(summary, "a", encoding="utf-8") as f:
        f.write(report + "\n")
