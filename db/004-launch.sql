CREATE INDEX search_title_exact ON product_search(title);
CREATE INDEX campaigns_product_visibility ON campaigns(product_id,id DESC);
CREATE INDEX products_verified_public ON products(id) WHERE NOT demo AND deleted_at IS NULL AND verification='verified';
CREATE TABLE launch_inquiries (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('brand','feedback')),
  email text, company text, website text, body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), reviewed_at timestamptz,
  CHECK (kind <> 'brand' OR (email IS NOT NULL AND company IS NOT NULL AND website IS NOT NULL))
);
CREATE INDEX launch_inquiries_queue ON launch_inquiries(id) WHERE reviewed_at IS NULL;
CREATE UNIQUE INDEX launch_inquiries_pending_brand ON launch_inquiries(email,company) WHERE kind='brand' AND reviewed_at IS NULL;
ALTER TABLE product_images ADD COLUMN source_url text;
ALTER TABLE product_images ADD COLUMN license_url text;
DELETE FROM product_images i USING products p
WHERE i.product_id=p.id AND p.demo AND p.slug='walkman-tps-l2' AND i.path='/archive-hero.webp';
