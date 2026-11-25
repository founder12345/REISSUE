# Operating cost estimates

Illustrative monthly planning budgets in USD, excluding taxes, legal review, manual data acquisition and staff time. They are allowances rather than provider quotes or activated services.

| Item | Closed beta allowance | Early growth allowance | Cost driver |
| --- | ---: | ---: | --- |
| Commercial-capable Vercel hosting | $20–40 | $40–120 | Seats, function compute, requests, bandwidth and image optimisation |
| Managed PostgreSQL | $15–35 | $35–120 | Compute, storage, backups, connection pooling and region |
| S3-compatible media | $0–5 | $5–25 | Stored GB, GET/PUT requests and egress |
| Search engine | $0 incremental | $0–40 incremental | Shared PostgreSQL until indexing and concurrency justify a larger instance |
| Transactional email | $0–20 | $15–40 | Verification and recovery plus service notices |
| **Indicative total** | **$35–100** | **$95–345** | Validate allowances against actual provider terms and usage |

At 1,000 records, measure storage and page latencies before adding dedicated infrastructure. At 10,000, review query plans, pool wait and actual image bytes. At 100,000, measure concurrent app and import traffic with realistic distributions, plus index size, reindex duration and database CPU. For seven-figure archives, validate search and taxonomy index plans and asynchronous bulk throughput before sizing anything. Keep all services on approved plans that permit the intended commercial use.

The existing repository uses PostgreSQL search and controlled batch requests. Costs for a managed queue, background processing and external feeds are future choices. [Vercel pricing](https://vercel.com/pricing) · [Supabase pricing](https://supabase.com/pricing) · [Resend pricing](https://resend.com/pricing) · [AWS S3 pricing](https://aws.amazon.com/s3/pricing/)
