# REISSUE launch audit

## Scope and workflow checks

| Surface | Coverage |
| --- | --- |
| Home, archive, search dialog, product details | Browser navigation, keyboard selection, responsive shell, real catalogue photography, missing-record request, attribution, exact references, fuzzy matches, multi-facets and cursor pagination |
| Comeback list and detail, save and account notifications | Browser journey covering discovery, joining, duplicate interest registration, official brand updates and withdrawal |
| Account and collections | Session creation, private collection isolation, publishing, account deletion and protected route status |
| Brand directory and verified dashboard | Brand claim, admin verification, permission rejection, campaign response, aggregate demand and unrelated-brand boundaries in server queries |
| Catalogue editor, submissions and imports | Validated CSV preview and commit, correction review, merge, ownership checks and source/licence fields. Full browser tests cover import, submission and campaign moderation boundaries |
| Partner application, feedback and policy drafts | Mobile forms, persisted moderation queue, same-origin enforcement and server-side throttling |
| Sitemap, robots and social metadata | Verified records only in paginated sitemap, demo record noindex, public social cards and draft legal page noindex |
| Media | Administrator-only re-encoding and private object storage. Commons media fetches verify the expected licence against the file API. User-uploaded photos retain source and licence links when supplied |

## Findings and changes

- Search formerly evaluated per-record fuzzy token scoring across the catalogue. It now uses indexed candidate selection and exact verification of candidate terms. Exact codes and partial identifiers retain their priority. Multiword input no longer drops a third important term. Missing results link to a prefilled archive request.
- Hyphenated references previously split into generic fragments. Numeric fragments could also fuzzily match unrelated years. Search now keeps hyphenated identifiers together and applies typo matching only to non-numeric terms.
- Facet values were recomputed on each page visit. The catalogue-wide facet list is now cached briefly. Search results and supporter counts still read the database.
- The original homepage used an illustration. The homepage and seed catalogue now use reviewed Commons photos. The connector accepts a reviewed manifest, verifies the allowed origin and expected licence, caps download and pixel size, and outputs optimised WebP files.
- Demo activity was eligible for homepage momentum. Demo records are now excluded from the public demand and momentum strips and from commercial dashboard totals.
- Unrecognised mutation names formerly created separate rate-limit rows. Member limits now share a bounded per-member bucket, with a stricter comment bucket. Vercel autocomplete uses a platform-forwarded IP bucket. Inquiry forms use an origin check, per-action ingress limits, a honeypot, and an admin-only review queue. Account deletion removes submitted inquiries that carry the account email.
- Import preview checked each row individually. It now validates category, brand and identity in one set-based query. Commit still revalidates brand scope and applies all rows atomically.
- Metadata, crawl policy, a sharded verified-record sitemap, social cards, custom unavailable/error screens and legal drafts now cover launch navigation.

## Database and launch boundaries

Search indexes support the candidate stage. Large result sets still incur real query work for ordering, exact totals and per-campaign metrics. Anonymous broad-search abuse requires deployment-level throttling alongside application controls. Public applications and feedback need a retention policy, a monitored review inbox and an operational response process. The application does not send email automatically.

The published fixture contains six labelled demo records. A separate 100,000-row synthetic benchmark fixture exercises volume. It must only be loaded into a disposable database and contains no users, partnerships or demand. The Commons integration supplies media for explicitly reviewed files. It does not decide product lifecycle facts or import a comprehensive production catalogue.

Use a manually reviewed early-access deployment first. Before unrestricted registration, prioritise email verification and password recovery, administrator MFA, backup and restore exercises, brand verification/revocation operations, legal review, and a sourced production catalogue. Confirm Vercel production and preview origins, database access, database region and media credentials in the actual deployment.

## Measured search performance

Production Next.js build, PostgreSQL 17 on the same machine, 118 serial HTTP requests to `/api/suggest` after one warm-up. Response time includes local HTTP, suggestion groups and PostgreSQL work. No Vercel cold starts or cross-region database latency are represented.

| Dataset | Expected first result or correct no-match | p50 | p95 | p99 | Maximum |
| --- | ---: | ---: | ---: | ---: | ---: |
| Six curated demo records | 118/118 | 11.1 ms | 15.3 ms | 34.5 ms | 39.5 ms |
| Six demo plus 100,000 synthetic load rows | 109/118 | 12.8 ms | 124.1 ms | 226.7 ms | 355.6 ms |

The load run uses the seed-catalogue gold labels for comparison. The nine differences include legitimate synthetic matches to broad text or category queries, so this is a latency stress test rather than a production relevance measurement. The loaded run meets 300 ms at p95 and p99 and exceeds it at maximum. The previous loaded implementation measured 2,016.4 ms at p95. The main changes were lexical-first token matching, reuse of candidate hits and deferring product image joins until the page has been ranked. The fixture load also exposed a single-record search refresh path that could scan the catalogue under a generic query plan. Migration 005 separates keyed refreshes from rebuilds.

## Lighthouse and release verification

Local Lighthouse 13.6.0 in mobile mode with Chromium 156, against the production build and seeded database. These are lab measurements on the test host.

| Page | Performance | Accessibility | SEO | Largest contentful paint |
| --- | ---: | ---: | ---: | ---: |
| Home | 88 | 100 | 100 | 2.7 s |
| Archive search with `walkman` | 97 | 100 | 100 | 2.3 s |
| Walkman demo product | 78 | 100 | 69 | 2.7 s |

Archive search passed the 90 performance target. Home and the demo product did not. The product SEO score reflects the intentional exclusion of demo products from indexing. Automated accessibility scores do not replace manual assistive-technology testing. Profile client JavaScript and cold image optimisation on the deployed homepage and product routes before public launch.

The TypeScript check, ESLint and production build passed. All 3 unit tests and 7 Chromium browser tests passed. The browser suite exercised the brand application and review workflow, feedback submission, archive addition request, and sitemap and robots metadata alongside the original core journeys. The package audit reported zero known vulnerabilities. A local S3-compatible upload and retrieval test verified that media source and licence URLs persisted with optimised WebP output. The deployment was not part of the local verification.
