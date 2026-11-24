# REISSUE

REISSUE is a searchable archive of discontinued products and a marketplace for non-binding comeback interest. It is a Conditra Studio project.

## Run locally

Use Node.js 24, npm and Docker Compose. You can substitute a PostgreSQL database with the `unaccent` and `pg_trgm` extensions.

```sh
npm ci
cp .env.example .env.local
docker compose up -d
npm run db:migrate
npm run db:seed
npm run dev
```

Open [localhost:3000](http://localhost:3000). The optional seed creates six labelled demo products and one demo campaign with zero initial supporters. New accounts have regular member access. Use the admin bootstrap command with a unique password to review submissions and verify brand claims.

```sh
ADMIN_EMAIL=moderator@example.test ADMIN_PASSWORD='<a unique password of 12 or more characters>' \
  node --env-file-if-exists=.env.local scripts/db.mjs admin
```

## Try the workflows

- **Consumers** can browse or filter the archive, search by reference such as `A1238`, register interest in the demo campaign, save products, create private or public collections, and receive in-app campaign updates.
- **Brands** sign in with a member account, request access from the brand directory and submit evidence. A moderator reviews the evidence in `/admin`. Verified representatives can review their own brand's campaigns, export aggregate data, import historical records and publish responses.
- **Moderators** can manage catalogue submissions, claims, campaigns, reports, corrections, imports, synonyms and categories. Catalogue entries can be edited, verified, hidden, restored or merged. The admin area also provides member suspension, a submissions toggle and audit logs.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

The end-to-end suite uses Chromium, a disposable migrated and seeded PostgreSQL database and a pre-created administrator. Export the test database URL in both the shell and the test app environment by setting `DATABASE_URL` before invoking Playwright. The suite creates test accounts, submissions, campaign updates and catalogue records. Never point it at a shared or production database.

```sh
npx playwright install chromium
TEST_ADMIN_EMAIL=moderator@example.test TEST_ADMIN_PASSWORD='<test password>' npm run test:e2e
```

Set `CHROMIUM_PATH` to use an already installed Chromium binary.

## Deployment

1. Provision PostgreSQL and enable `pg_trgm` and `unaccent`. Run migrations once per release from a trusted environment using a schema owner. Give the runtime a separate restricted database account and a TLS connection. Prefer a pooled endpoint on a serverless host.
2. Import this repository into Vercel or deploy the Next.js Node server. Set `DATABASE_URL` and `APP_ORIGIN` to the application’s exact HTTPS origin without a trailing slash. Give preview deployments their own origin and database. The repository does not configure DNS or hosting automatically.
3. Bootstrap an administrator on the target environment. Add sourced records through `/admin`; reserve the demo seed for development and demonstrations.
4. To enable image uploads, configure a private S3-compatible bucket and pass the optional storage variables listed in [.env.example](.env.example). Restrict the service credential to operations on the `products/` prefix. The app serves sanitised image files through its own media route after checking that the catalogue record is visible.
5. Configure backups, log redaction, database cleanup and production-edge abuse controls. Review the launch checks in [security and limitations](docs/security-and-limitations.md).

## Documentation

- [Original product brief](docs/product-brief.md)
- [Architecture and data flows](docs/architecture.md)
- [Search and ranking](docs/search.md)
- [Security, limitations and launch checklist](docs/security-and-limitations.md)
- [Future AI integration roadmap](docs/future-ai.md)

## Vercel launch checks

Run all migrations against the target database before promotion and use a separate seeded database for a private preview. Keep `APP_ORIGIN` aligned with the exact origin used by each environment. Verify `/robots.txt`, `/sitemap.xml`, sign-in, a catalogue query and a reversible campaign interest registration after deployment. If upgrading an existing local demo database, rerun `npm run db:seed` to load the five attributed replacement photographs.

Run `npm run test:search` against a running seeded app to check the 118-case search corpus. The [launch audit](docs/launch-audit.md) documents implementation changes, local measurements and remaining production work. Review the [privacy](app/privacy/page.tsx) and [terms](app/terms/page.tsx) drafts before opening registration.
