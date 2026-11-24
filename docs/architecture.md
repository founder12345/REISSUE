# Architecture

Next.js App Router renders discovery, archive and account routes on the server. Client-side components handle keyboard autocomplete and link sharing. PostgreSQL is the source of truth for catalogue data, search documents, community interactions, moderation and sessions. Deployment uses a Node runtime and requires no paid external service for the core search or campaign flows.

| Layer | Location | Responsibility |
| --- | --- | --- |
| Authentication | `lib/auth.ts` | Password derivation, session lifecycle and persisted rate limits |
| Catalogue and ingestion | `lib/ingestion.ts`, `db/` | Normalised records, source metadata, validation, import previews and merge |
| Search | `lib/search.ts`, `lib/ranking.ts` | Deterministic query interpretation, relevance, filters and pagination |
| Mutations | `app/api/action/route.ts` | Validated form writes, per-user and per-brand authorisation, transactions |
| Media | `lib/storage.ts`, `app/api/image-upload`, `app/media` | Private object storage, attributed sanitised uploads and public catalogue delivery |
| Updates | `campaign_updates`, `notifications` | Campaign updates and persistence of personalised in-app notifications |
| Analytics | `search_events`, `search_history` | Optional aggregate events and separate opt-in personal history |

Campaign creation starts in moderation. Campaign status changes, response publication and notification fan-out commit in a single transaction. Uniqueness constraints enforce one active campaign per product and one registration per user and campaign. Preference distributions suppress buckets with fewer than five responses. Brand exports omit demo campaigns and carry status and counts only. Brand claims require administrator approval before membership is granted.

Import previews retain validated rows and error messages. Commit checks the requesting account, brand scope and job state under a lock, then inserts the entire batch in one transaction. Concurrent catalogue duplicates are enforced by uniqueness constraints. The merge operation keeps a canonical archival record and moves eligible relationships before hiding the duplicate.

Future commerce can attach a revival agreement to a campaign and a verified brand, with separate terms, fulfilment and billing entities. Existing interest rows represent optional preferences and can never be treated as orders. There is no payments surface or billing provider.
