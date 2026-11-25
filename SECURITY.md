# REISSUE security and operations

## Implemented controls

- Account passwords use salted scrypt. Email verification requires both the one-time email link and the registration password. This prevents someone from completing an account with a victim's email by prompting them to click a link. Recovery responses are generic, reset tokens are hashed, and successful reset revokes all sessions and outstanding recovery links.
- Google authentication uses the OpenID Connect client, exact callbacks, PKCE, state, nonce, signed ID-token checking and a verified provider email. Transient state is single use. Account identity is bound to Google's stable subject. Existing accounts require their original sign-in method.
- Application sessions are opaque, hashed at rest and rotated on authentication. Cookies are HTTP-only and SameSite Lax, with Secure enabled on HTTPS. Write forms use exact origin checks. Account link pages use an origin-only referrer policy to keep tokens out of referrer URLs while supporting browser form submissions.
- Privileged actions recheck the verified brand relationship or administrator role on the server. Privacy cases and campaign drafts additionally apply forced PostgreSQL RLS to transaction-local actors. Role grants and moderation actions write audit rows. User-owned exports and uploads derive identity from the current session.
- PostgreSQL parameters and allowlisted identifiers handle user input. The core CSP restricts framed use and cross-origin resources. Production inline script allowance is needed by the current Next.js rendering setup. Image uploads enforce MIME, size and image decoder limits and re-encode still WebP without original metadata.
- Auth, autocomplete ingress on Vercel, notifications actions, rights reporting, uploads and exports have rate limits. Guest content reports use a honeypot and bounded payloads. Login throttles use Vercel's platform-forwarded IP only on Vercel.
- Brand dashboards use aggregate data and suppress small attribute groups. Demo demand is visibly labelled and excluded from commercial counts. The unique campaign-support key prevents duplicate support from a single account.

## Remaining review

Keep database network access private, use a separate non-superuser runtime principal, test effective grants and backups, and extend database RLS coverage beyond drafts and rights cases before a broader rollout. Other tables currently rely on foreign keys, unique constraints and scoped server queries. PostgreSQL superusers and roles with `BYPASSRLS` bypass row policies. Do not use these as Vercel runtime credentials. Audit each route with the exact deployment role and write a grants matrix before launch.

Verify application and provider logs redact query tokens and personal information. Restrict raw request log access and retention. Complete independent security review, administrator MFA, account-abuse handling, and a nonce-based CSP review. Rate limits mitigate individual source traffic. Aggregate pressure and distributed abuse still need Vercel-level controls and observability. Transactional mail runs with bounded timeouts and reports delivery failures without leaking recipient data. It does not have a durable retry queue. Browser verification is not a substitute for independent security review.
