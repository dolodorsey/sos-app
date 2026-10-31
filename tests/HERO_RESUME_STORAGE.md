# Verified-email resume storage failures

The existing authenticated resume path now keeps the successful session and recovered application in memory before attempting browser persistence. A storage error displays keep-tab-open/sign-in-again guidance instead of preventing resume. Authentication failures, unconfirmed accounts, missing applications and denied resume responses do not create a receipt. No email-based bypass or new tracking token is added.

`node --test tests/hero-resume-storage.test.mjs tests/hero-receipt-storage.test.mjs`

Seven resume checks execute the actual component functions with mocked authentication, RPC and private data loads. Both storage-failure tests fail against the prior source; all seven pass with the repair, alongside five existing submission checks. These are isolated tests, not real authentication or production recovery proof. Type-check passed. Browser testing of these newly changed paths and independent review remain pending; the earlier browser evidence covers submission storage failures only.
