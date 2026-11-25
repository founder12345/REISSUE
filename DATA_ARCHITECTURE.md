# Catalogue architecture

Phase 4 extends the existing Next.js and PostgreSQL catalogue. Migrations `009-catalogue-provenance.sql` and `010-intelligence.sql` add evidence decisions, a permission registry, staged imports, merge redirects, variants, private pilots, and consented analytics. Migration `011-discovery-taxonomy.sql` adds the lifestyle archive category. Existing IDs and catalogue data are retained.

## Catalogue and search

| Area | Storage and rules |
| --- | --- |
| Identity | Canonical slug plus normalized brand/name/model identity. Alternate names, model numbers, manufacturer references and SKUs are distinct search signals. |
| Attributes | Product specification keys and values are category-independent. Optional variant labels, colour, material, dates and history can be left unknown. |
| Source rights | A source registry records owner-supplied permission or licence, retrieval date, URL and restrictions. Per-product references can point back to that registry. Image licence and attribution remain separate. |
| Review | A reviewer selects a product source, records a rationale, and reviews verification and lifecycle separately. Discontinuation can remain unknown even for a verified historical product. Existing imported availability claims never set a reviewed lifecycle. |
| Indexing | PostgreSQL full-text and trigram indexes, deterministic parsing, structured facets and cursor pagination. Brand/category indexes cover live records. Only verified, non-demo records and qualifying archive landing pages appear in the sitemap. |

## Import lifecycle

1. Register the approved external source when applicable. Preview CSV or JSON against the reference brand and category lists.
2. Normalize headers, map names/aliases to canonical slugs, normalize currency codes, validate fields and URLs, and surface missing items or identity conflicts. The preview performs no catalogue mutation.
3. Each continue action locks the job and stages up to 20 new products. A failed batch is rolled back with a saved error. Earlier staged rows remain hidden and the cursor persists.
4. The final successful batch publishes all staged rows together. Pending jobs can be rolled back before publication. This clears their hidden products and releases their reserved slugs.
5. Source-update jobs append evidence URLs to the exact existing product for the same brand. Source appends commit atomically and do not overwrite identities, historical fields, imagery or verification.

Job ownership and verified brand membership are checked on every route. Imports are capped at 200 rows and 55,000 characters. There is no permanent worker. Larger licensed loads should be chunked with the same staging rules or moved to an asynchronous job runner after capacity testing. Published jobs cannot be rolled back as a batch. Corrections to published products use the moderation tools.

## Verification methodology

- **Unverified** means no source has been accepted as sufficient.
- **Source-supported** indicates the reviewer accepted a recorded reference. It remains excluded from verified catalogue and indexation counts.
- **Verified historical** requires a moderator’s decision and a recorded product source.
- **Brand-confirmed** requires the reviewing account to hold verified membership of the product’s brand. Brand confirmation alone leaves the lifecycle decision unchanged.
- **Unconfirmed**, **confirmed discontinued**, and **confirmed reissued** refer to a separate evidence-based lifecycle decision by a moderator. Missing stock, page removal, or the end of one colourway does not establish a model-wide discontinuation.

The decision log stores the actor, rationale, chosen source and decision timestamp. Editing catalogue facts resets current confidence and lifecycle to unconfirmed while keeping history for review. A same-brand merge creates a permanent redirect for the old product slug. Public search and reports exclude staged and deleted records.
