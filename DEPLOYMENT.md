# Deploy REISSUE on Vercel

## Status

The connected Vercel account was checked. Its available team had no REISSUE project. A live REISSUE deployment, production database, mail sender and Google credentials were unavailable for testing this change.

## Production and preview

1. Import `founder12345/REISSUE` into the intended Vercel team as a Next.js application. Select Node.js 24, the repository root and the default Next.js build. Confirm your Vercel and provider plans permit the intended usage before launching commercially or activating billable resources.
2. Provision managed PostgreSQL with `unaccent`, `pg_trgm`, TLS and a pooled serverless runtime connection. Supabase PostgreSQL is an option if already provisioned. The application uses PostgreSQL sessions and the OpenID Connect client for identity. It does not require Supabase Auth or a Supabase service-role key. Use a restricted runtime role with table and sequence DML, not a database administrator or a role with `BYPASSRLS`. Run migrations separately with a migration owner.
3. Apply numbered migrations with `DATABASE_URL=<direct migration connection> npm run db:migrate`. Migrations 006–008 add accounts, workflow and engagement records. Test against a backup or staging copy before migrating existing production data. The current schema retains existing catalogue and account IDs. Use the demo seed only on isolated internal or preview databases.
4. In Vercel Production set `DATABASE_URL` to the pooled runtime URL and `APP_ORIGIN` to the exact HTTPS origin, such as `https://archive.example.com`. In Preview set `PREVIEW_DATABASE_URL` to a separate database and runtime principal. Protect the preview through Vercel access settings and do not copy production credentials into Preview. The preview process refuses to start with a missing preview URL or one equal to a supplied production URL.
5. For transactional email, verify a sending domain in Resend. Set `MAIL_API_KEY` and `MAIL_FROM` to a verified sender, then test verified email registration and recovery using an address you control. Mail receipts for signed-in verified applicants and privacy and campaign workflows use the same sender. The test receiver is localhost-only and ignored on Vercel.
6. Configure optional S3-compatible private storage with `S3_BUCKET`, `S3_REGION`, and credentials restricted to the `products/` prefix. Use a separate bucket for preview data. Avatars are small, private WebP values stored in PostgreSQL. Validate product uploads and downloads with the selected provider.
7. Review [legal launch requirements](LEGAL_CHECKLIST.md) before setting `LEGAL_APPROVED=true`, `LEGAL_OPERATOR`, `LEGAL_ADDRESS`, `LEGAL_CONTACT_EMAIL` and a distinct `TERMS_VERSION`. Registration and publication of draft legal copy are held back on Vercel Production until the gate is satisfied. Keep optional `SEARCH_ANALYTICS` off until retention and consent language have been approved.
8. Smoke test the real HTTPS domain, public catalogue, account setup and recovery, OAuth callbacks, protected admin/brand dashboards, a reversible campaign action, upload and media retrieval. Remove pilot test records in accordance with the retention procedure. Configure monitoring, backups and restore tests before broad launch.

## Google OAuth

1. In Google Cloud, enable the OAuth consent screen for the intended audience, fill in the approved app name and support contact, and add a test account while the app is in Testing. Select basic `openid`, `email` and `profile` access only.
2. Create a **Web application** OAuth client. Add the exact authorised redirect URIs:
   - Development: `http://localhost:3000/api/auth/google/callback`
   - Production: `https://<approved-production-domain>/api/auth/google/callback`
   - Preview: use a fixed approved HTTPS preview alias and its own OAuth client. Register `https://<fixed-preview-domain>/api/auth/google/callback` and set `APP_ORIGIN` to that alias. Set `GOOGLE_PREVIEW_ENABLED=true` only in the matching preview scope. Leave Google off on ephemeral preview origins.
3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` only in server environment variables. Redeploy, run new-profile onboarding, then log out and sign in as the same Google identity. A matching email alone never links Google to an existing password account. A secure linking flow is a separate feature.

## Maintenance

Run `npm run db:maintenance` to preview eligible rows. After checking environment and retention policy, use `npm run db:maintenance -- --apply` to remove expired sessions, OAuth flows, account links and rate buckets, plus old unverified accounts and consented search events. The script does not purge active moderation or rights cases. Use the runbook approved by the operator for those records.
