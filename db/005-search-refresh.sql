-- Keep single-record updates on the primary-key path, even with a generic plan.
CREATE VIEW archive_search_input(product_id,title,identifiers,brand,aliases,document) AS
SELECT p.id,archive_fold(p.name),ARRAY(SELECT archive_fold(i) FROM unnest(ARRAY[p.model,p.reference_number,p.sku]) i WHERE i IS NOT NULL),
archive_fold(b.name),archive_fold(concat_ws(' ',array_to_string(b.aliases,' '),a.names)),
archive_fold(concat_ws(' ',p.name,p.model,p.reference_number,p.sku,b.name,array_to_string(b.aliases,' '),c.name,p.subcategory,
p.description,p.history,p.release_year,p.discontinued_year,array_to_string(p.colours,' '),array_to_string(p.materials,' '),p.country,a.names,x.specs))
FROM products p JOIN brands b ON b.id=p.brand_id JOIN categories c ON c.id=p.category_id
LEFT JOIN LATERAL (SELECT string_agg(alias,' ') names FROM product_aliases WHERE product_id=p.id) a ON true
LEFT JOIN LATERAL (SELECT string_agg(name || ' ' || value,' ') specs FROM product_attributes WHERE product_id=p.id) x ON true;

CREATE OR REPLACE FUNCTION rebuild_product_search(target bigint DEFAULT NULL) RETURNS void LANGUAGE sql AS $$
INSERT INTO product_search(product_id,title,identifiers,brand,aliases,document)
SELECT * FROM archive_search_input WHERE product_id=target
UNION ALL SELECT * FROM archive_search_input WHERE target IS NULL
ON CONFLICT(product_id) DO UPDATE SET title=excluded.title,identifiers=excluded.identifiers,brand=excluded.brand,aliases=excluded.aliases,document=excluded.document
$$;
