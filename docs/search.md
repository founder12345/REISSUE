# Deterministic catalogue search

Search builds a normalised document from product names, identifiers, descriptions, dates, brands, brand aliases, categories, materials, colours and structured attributes. PostgreSQL triggers refresh the document after relevant edits. Full-text terms use the `simple` dictionary and accent folding. When a non-numeric token has no lexical match, trigram comparison considers approximate matches at the 0.50 word-similarity threshold. Short terms require lexical matching. Surround a complete query in double quotes to require a contiguous phrase.

The query combines exact identifiers and titles, prefix matching, synonym alternatives, whole-title trigram matching and a token overlap threshold. Queries of up to three useful terms require all of them unless a title, identifier or expanded lexical match applies. Longer queries require about two-thirds of their useful terms. Common wording such as “old” and “vintage” is treated as incidental. Search always returns stored catalogue records.

| Signal | Default weight |
| --- | --- |
| Exact model, reference or SKU | 1,000 |
| Model or reference prefix with at least four characters | 150 |
| Exact product title | 300 |
| Exact brand | 70 |
| Title similarity | 35 × similarity |
| Full-text rank | 55 × normalised rank |
| Contiguous phrase | 45 |
| Matched searchable tokens | 24 per token |
| Product or brand alias phrase | 16 |
| Verified record | 4 |
| Registered interest | 5 maximum |

The application reads these settings from `lib/ranking.ts`. Filters combine with AND across fields and OR within each field. Numeric price filters use original currency values, so a currency filter should accompany price comparisons. Result cursors encode the score and unique product ID. Pagination is stable for an unchanged index. Changes to records or interest totals between page loads can move results.

Use `/explore?q=A1238` for an exact demo reference, `/explore?q=walman` for a typo, `/explore?q=camera` for a synonym and `/explore?q=old+navy+arcteryx+jacket` for a multi-attribute demo sample. The browser suite exercises these cases, combined filters and cursor traversal.

GIN indexes support full text, identifiers and trigram candidate conditions. Query ranking works on candidate records, and image hydration happens after pagination. Broad lexical and fuzzy matches and exact result totals can still touch many rows. Profile with representative production data and use a bounded candidate query before marketing the service at archive scale.

## Evaluation

The human-curated corpus in `tests/search/queries.json` contains 118 reference, brand, prefix, typo, accent, attribute, quoted-phrase, synonym and no-match cases. It targets the six named demo records. Run `SEARCH_TEST_ORIGIN=http://localhost:3210 npm run test:search` against a running seeded app. Use `SEARCH_TEST_REPEATS` and `SEARCH_TEST_CONCURRENCY` for additional samples.

For volume checks, run `tests/search/load-fixtures.sql` against a disposable seeded database only. The generated rows exist solely to exercise index and selectivity behaviour. Their overlapping vocabulary can change result expectations. The benchmark uses the real autocomplete endpoint and reports end-to-end HTTP latency from the local test runner.
