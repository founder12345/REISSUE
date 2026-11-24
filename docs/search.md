# Deterministic catalogue search

Search builds a normalised document from product names, identifiers, descriptions, dates, brands, brand aliases, categories, materials, colours and structured attributes. PostgreSQL triggers refresh the document after relevant edits. Full-text terms use the `simple` dictionary and accent folding. Trigram comparison treats an approximate token as matched at or above 0.50 word similarity. Short terms require lexical matching. Surround a complete query in double quotes to require a contiguous phrase.

The query combines exact identifiers and titles, prefix matching, synonym alternatives, whole-title trigram matching and a token overlap threshold. Most multi-word inputs require roughly two-thirds of their useful terms. Common wording such as “old” and “vintage” is treated as incidental. Search always returns stored catalogue records.

| Signal | Default weight |
| --- | --- |
| Exact model, reference or SKU | 1,000 |
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

GIN indexes support full text, identifiers and trigram candidate conditions. The fuzzy token fallback, dynamic facets and exact result counts can still scan many rows. Profile with representative production data and use a bounded candidate query before marketing the service at archive scale.
