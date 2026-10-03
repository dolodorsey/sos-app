# Hero application consent source sync

The deployed SOS intake function v9 rejects every required attestation unless it is the JSON boolean true. This change brings the repository in line with that deployed guard so a later deployment cannot restore truthy coercion.

The normal Hero application checkbox payload already uses booleans. No authentication, CORS, tracking, bridge, database policy or approval behavior changes here.

Run `node --test tests/hero-application-consent-types.test.mjs` with Node 22.13+ (uses stripTypeScriptTypes). The tests execute the real handler with a synthetic existing application and a database double; outbound fetch throws. They establish validation behavior, not successful new application persistence, delivery, activation or business QA.

Live v9 deployment and its negative HTTP422 verification were completed separately on October 1, 2026. This PR does not merge itself or authorize website promotion, outreach or company certification.
