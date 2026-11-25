# Search evaluation and scale benchmarks

Measured on a local Next.js production build and PostgreSQL 17. One warm-up request was followed by 126 serial HTTP requests through `/api/suggest`. Reported times include PostgreSQL, application handling and loopback HTTP. They exclude Vercel cold starts, a remote database and regional network effects. The first series shared the test host with browser checks, so differences between scales are not a controlled comparison.

| Total records | Contents | p50 | p95 | p99 | Max |
| ---: | --- | ---: | ---: | ---: | ---: |
| 6 | Labelled demo catalogue | 11.5 ms | 31.9 ms | 46.0 ms | 53.6 ms |
| 1,000 | Demo plus 994 synthetic load rows | 21.0 ms | 79.2 ms | 147.4 ms | 166.4 ms |
| 10,000 | Demo plus 9,994 synthetic load rows | 45.7 ms | 413.5 ms | 731.1 ms | 893.6 ms |
| 100,000 | Demo plus 99,994 synthetic load rows | 40.0 ms | 174.8 ms | 374.6 ms | 622.3 ms |

The 100,000-record disposable database measured 201 MB including tables and indexes, with no media objects. The 10,000-row p95 and the 100,000-row p99 exceeded 300 ms. A larger catalogue, concurrent traffic, and Vercel network performance require separate measurement. Autocomplete operates on real catalogue matches and has no generated-result fallback.

## Relevance

All **126 of 126** expected top results or no-match outcomes passed against the demo catalogue. Eight new cases exercise date and lifecycle phrasing, including the examples in the brief. The six source records are demo-labelled and the evaluation does not establish production relevance. The expanded synthetic corpus intentionally contains overlapping vocabulary, so seed-specific rankings in that corpus are not a relevance judgment.

Natural search phrases with explicit release years and decades constrain structured facets. A leading “discontinued” requires a reviewed discontinuation. Explicit facet controls keep precedence and quoted phrases are preserved. Existing identifier, synonym, trigram, attribute and verification weights remain configurable. See [search internals](docs/search.md).

## Reproduce

Against a running seeded, disposable app:

```sh
SEARCH_TEST_ORIGIN=http://localhost:3014 node scripts/evaluate-search.mjs
```

Load isolated rows incrementally with `tests/search/load-fixtures.sql` and psql `-v from_n=...` / `-v to_n=...`. The initial six demos already count toward the target. For example, use bounds 1–994 for a total of 1,000. Run the evaluation script with `--latency-only` for synthetic loads. Use `SEARCH_TEST_REPEATS` and `SEARCH_TEST_CONCURRENCY` for sustained tests. The fixture script rebuilds search data and analyses both tables. Never point it at a customer or beta database.
