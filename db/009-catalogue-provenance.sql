CREATE TABLE catalogue_sources (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('brand','licensed_dataset','authorized_api','historical_catalogue','manual_research')),
  source_url text NOT NULL UNIQUE,
  permission text NOT NULL,
  restrictions text NOT NULL,
  retrieved_on date NOT NULL,
  registered_by uuid REFERENCES profiles ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE products ADD COLUMN lifecycle_status text NOT NULL DEFAULT 'unknown'
  CHECK (lifecycle_status IN ('unknown','discontinued','reissued'));
ALTER TABLE products ADD COLUMN discontinuation_date date;
ALTER TABLE products ADD COLUMN verification_level text NOT NULL DEFAULT 'unverified'
  CHECK (verification_level IN ('unverified','source_supported','historical','brand_confirmed'));
ALTER TABLE products ADD COLUMN verified_at timestamptz;
ALTER TABLE products ADD COLUMN variants text[] NOT NULL DEFAULT '{}';
UPDATE products SET verification_level='historical' WHERE verification='verified' AND NOT demo;
CREATE INDEX reviewed_products_recent ON products(verified_at DESC NULLS LAST,id DESC)
  WHERE deleted_at IS NULL AND NOT demo AND verification='verified';
CREATE INDEX products_live_brand ON products(brand_id,id DESC) WHERE deleted_at IS NULL;
CREATE INDEX products_live_category ON products(category_id,id DESC) WHERE deleted_at IS NULL;

ALTER TABLE product_sources ADD COLUMN catalogue_source_id bigint REFERENCES catalogue_sources;
CREATE TABLE product_evidence_decisions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id bigint NOT NULL REFERENCES products ON DELETE CASCADE,
  actor_id uuid REFERENCES profiles ON DELETE SET NULL,
  source_url text NOT NULL,
  rationale text NOT NULL,
  verification_level text NOT NULL,
  lifecycle_status text NOT NULL,
  discontinuation_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX product_evidence_timeline ON product_evidence_decisions(product_id,id DESC);

ALTER TABLE import_jobs ADD COLUMN mode text NOT NULL DEFAULT 'create' CHECK (mode IN ('create','sources'));
ALTER TABLE import_jobs ADD COLUMN source_id bigint REFERENCES catalogue_sources;
ALTER TABLE import_jobs ADD COLUMN next_row integer NOT NULL DEFAULT 0 CHECK (next_row>=0);
ALTER TABLE import_jobs ADD COLUMN last_error text;
CREATE TABLE import_created_products (
  import_id bigint NOT NULL REFERENCES import_jobs ON DELETE CASCADE,
  product_id bigint NOT NULL REFERENCES products ON DELETE CASCADE,
  PRIMARY KEY(import_id,product_id), UNIQUE(product_id)
);
ALTER TABLE products ADD COLUMN merged_into_id bigint REFERENCES products;

-- Let archive search match reviewed lifecycle and curated variant names.
CREATE OR REPLACE VIEW archive_search_input(product_id,title,identifiers,brand,aliases,document) AS
SELECT p.id,archive_fold(p.name),
 ARRAY(SELECT archive_fold(i) FROM unnest(ARRAY[p.model,p.reference_number,p.sku]) i WHERE i IS NOT NULL),
 archive_fold(b.name),archive_fold(concat_ws(' ',array_to_string(b.aliases,' '),a.names)),
 archive_fold(concat_ws(' ',p.name,p.model,p.reference_number,p.sku,b.name,array_to_string(b.aliases,' '),c.name,p.subcategory,
 p.description,p.history,p.release_year,p.discontinued_year,array_to_string(p.colours,' '),array_to_string(p.materials,' '),
 p.country,a.names,x.specs,array_to_string(p.variants,' '),nullif(p.lifecycle_status,'unknown')))
FROM products p JOIN brands b ON b.id=p.brand_id JOIN categories c ON c.id=p.category_id
LEFT JOIN LATERAL (SELECT string_agg(alias,' ') names FROM product_aliases WHERE product_id=p.id) a ON true
LEFT JOIN LATERAL (SELECT string_agg(name || ' ' || value,' ') specs FROM product_attributes WHERE product_id=p.id) x ON true;
