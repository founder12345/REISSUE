# Closed beta launch checklist

- Use the intended REISSUE Vercel project. The connected team was checked during Phase 4. Live deployment remained unavailable. Confirm the approved team, domain, commercial plan and owners. [Deployment guide](DEPLOYMENT.md)
- Provision managed PostgreSQL and run migrations `009`–`011` after a staged backup and migration test. Keep preview credentials and data isolated. Configure runtime connection pooling, least-privilege grants and production monitoring.
- Verify Google callback, transactional sender, email verification and recovery, and private object storage against the real deployment. Test consent and privacy requests in a protected preview before opening access.
- Confirm approved source agreements and image rights. Acquire and independently review the first real product cohort. The checked internal catalogue has zero verified non-demo records.
- Process a representative authorised import through preview, staging, completion and rollback. Verify the release's archive and sitemap behaviour with approved records. Confirm pilot contacts and disclosure rules with each participating brand.
- Review legal copy, controller details, data processors, retention, user age considerations, reporting policy and privacy request handling before enabling public registration. Confirm commercial, archival and data reuse terms. [Legal checklist](LEGAL_CHECKLIST.md)
- Review admin permissions, stored rights evidence, audit retention and analytics consent. Arrange production security review, administrator MFA, operational email retries and tested backups. [Security review](SECURITY.md)
- Watch actual closed-beta search success, query latency and support accuracy before expanding invitations. Use reproducible load tests with isolated fixtures and a separate database. [Search measurements](SEARCH_BENCHMARKS.md)
