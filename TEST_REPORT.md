# Phase 3 functionality matrix

Tested with the Next.js production build, PostgreSQL 17 and Chromium in an isolated environment. The local mail receiver captures only `example.test` messages. It makes no outbound requests.

| Surface | Before Phase 3 | Current result |
| --- | --- | --- |
| Email signup, verification, terms, recovery | Password signup without verification or recovery | Browser flow exercises signup, verification, persisted changes, logout and reset. Single-use credentials and session revocation tested. |
| Google OAuth | Absent | Implemented with PKCE, state, nonce and stable provider identity. Missing configuration and invalid-flow redirects tested. Live sign-in blocked by missing Google credentials and a test account. |
| Account settings | Saved products, collections and notifications | Added username, private avatar, saved searches and campaigns, created and supported campaigns, account export and privacy settings. Browser tests cover persisted edits, avatar, saved search, export and erasure. |
| Campaign creation and support | Inline submit and basic interest | Guided draft, record review, proposal, attestations and transactional moderation. Browser tests cover draft ownership, author submission, moderator publication, genuine supporter counts, duplicate suppression and withdrawal. |
| Catalogue and search | Existing reviewed archive engine | Search and pagination browser regressions pass. Missing-product submissions now store a rights attestation. User-supplied images remain an administrator-mediated workflow. |
| Brand application and access | Existing application, claims and reports | Application and claims are stored and administrator review is tested. A verified representative can use its authorised dashboard and publish an official update. |
| Cookie choices | Analytics environment switch only | Optional events require a versioned choice. Browser storage, database records and network requests were checked across rejection, acceptance and withdrawal. No advertising scripts were added. |
| Rights and IP requests | Feedback and basic moderation | Private tracking, account-scoped export and an administrator queue are implemented. The public IP report and private review journeys have browser coverage. Operator action remains necessary for restrictions, legal removal, and replies to anonymous reporters. |
| Transactional mail | Absent | Account links are tested using the isolated receiver. Service receipts and moderation emails use the configured provider. Followed campaign updates are in-app. A live sender and guaranteed delivery retry infrastructure remain pending. |
| Privilege checks | Scoped server queries | Server permissions plus forced row policies on drafts and rights cases. Separate non-superuser SQL test confirmed isolation. Other legacy tables still use scoped server queries and database constraints. |
| Deployment | Vercel-ready repository without verified live instance | Local build passed. No REISSUE project was found in the connected Vercel team. Live callbacks, mail, storage and domain remain unverified. |

## Migration and test notes

- Migrations 006–008 add verified-account state, terms acceptances, token and OAuth state, saved searches, drafts, privacy cases, notifications, profile avatars, saved campaigns, price ranges and contributor rights attestations.
- Existing catalogue records were retained when migrations ran against the internal database. Existing password accounts are not retroactively labelled email-verified.
- Chromium initially failed email verification because a full referrer suppression policy prevented an exact-origin form check. An origin-only policy fixed the flow without exposing the URL or its token in the referrer.
- The dependency audit reported zero known vulnerabilities at the time of testing. This is a dependency check, not a penetration test or compliance certification.
- For the deployment setup and blockers, see [DEPLOYMENT.md](DEPLOYMENT.md), [SECURITY.md](SECURITY.md) and [LEGAL_CHECKLIST.md](LEGAL_CHECKLIST.md).

## Final run

- ESLint, TypeScript, the production build and all 3 unit tests passed.
- All 13 Chromium browser tests passed with a non-superuser, non-`BYPASSRLS` PostgreSQL runtime role.
- All 118 expected search cases passed against the migrated internal catalogue. Local autocomplete p95 was 20.2 ms and maximum was 125.2 ms. These times exclude Vercel and remote database latency.
- The non-superuser SQL isolation probe and the maintenance dry run passed. The internal homepage returned HTTP 200.

## Next phase

Set up a protected Vercel pilot using a separate PostgreSQL database, a verified sender and a Google test client. Verify each external boundary with the exact deployment role. Confirm the operator disclosures and product moderation process before enabling public registration, then prioritise administrator MFA, broader database row policies, request workflow automation and a durable transactional email queue.
