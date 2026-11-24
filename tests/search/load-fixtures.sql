-- Use only with a disposable evaluation database. These are synthetic load rows, not a catalogue.
BEGIN;
ALTER TABLE products DISABLE TRIGGER search_products;
INSERT INTO brands(slug,name) VALUES('reissue-load-fixture','REISSUE internal performance fixture') ON CONFLICT DO NOTHING;
WITH words AS (
  SELECT ARRAY['cassette','camera','calculator','outdoor','music','pocket','digital','film','silver','player','watch','nylon','metal','black','blue','sport','lens','rangefinder','shell','aluminium'] AS value
), categories_numbered AS (
  SELECT id,row_number() OVER (ORDER BY id) AS ordinal FROM categories
)
INSERT INTO products(slug,name,brand_id,category_id,description,release_year,reference_number,demo)
SELECT 'perf-fixture-'||n,'Load fixture '||n||'-'||substr(md5(n::text),1,8),b.id,c.id,
       concat_ws(' ',words.value[1+n%20],words.value[1+n/11%20],words.value[1+n/29%20],'synthetic load record'),
       1970+n%55,'LOAD-'||n,true
FROM generate_series(1,100000) n CROSS JOIN words
JOIN brands b ON b.slug='reissue-load-fixture'
JOIN categories_numbered c ON c.ordinal=1+n%(SELECT count(*) FROM categories_numbered);
ALTER TABLE products ENABLE TRIGGER search_products;
SELECT rebuild_product_search();
COMMIT;
ANALYZE products;
ANALYZE product_search;
