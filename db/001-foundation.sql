CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE FUNCTION archive_fold(text) RETURNS text LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
AS $$ SELECT lower(public.unaccent('public.unaccent'::regdictionary, $1)) $$;

CREATE TABLE profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text UNIQUE NOT NULL,
  name text NOT NULL, password_hash text NOT NULL, role text NOT NULL DEFAULT 'member' CHECK (role IN ('member','admin')),
  search_history boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sessions (token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES profiles ON DELETE CASCADE, expires_at timestamptz NOT NULL);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE rate_limits (bucket text PRIMARY KEY, hits integer NOT NULL, expires_at timestamptz NOT NULL);
CREATE TABLE brands (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, slug text UNIQUE NOT NULL, name text UNIQUE NOT NULL, aliases text[] NOT NULL DEFAULT '{}');
CREATE TABLE categories (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, slug text UNIQUE NOT NULL, name text UNIQUE NOT NULL);
CREATE TABLE brand_members (brand_id bigint REFERENCES brands ON DELETE CASCADE, user_id uuid REFERENCES profiles ON DELETE CASCADE, PRIMARY KEY (brand_id,user_id));
CREATE TABLE brand_ownership_requests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, brand_id bigint NOT NULL REFERENCES brands, user_id uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
  evidence text NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined')), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX one_pending_brand_claim ON brand_ownership_requests(brand_id,user_id) WHERE status='pending';
CREATE TABLE products (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, slug text UNIQUE NOT NULL, name text NOT NULL,
  brand_id bigint NOT NULL REFERENCES brands, category_id bigint NOT NULL REFERENCES categories, subcategory text,
  model text, reference_number text, sku text, description text NOT NULL, history text,
  release_year int CHECK (release_year BETWEEN 1000 AND 2100), discontinued_year int CHECK (discontinued_year BETWEEN 1000 AND 2100),
  CHECK (discontinued_year IS NULL OR release_year IS NULL OR discontinued_year >= release_year),
  retail_price numeric(12,2) CHECK (retail_price >= 0), currency char(3), CHECK ((retail_price IS NULL) = (currency IS NULL)),
  colours text[] NOT NULL DEFAULT '{}', materials text[] NOT NULL DEFAULT '{}', country text,
  availability text NOT NULL DEFAULT 'unknown' CHECK (availability IN ('unknown','discontinued')),
  verification text NOT NULL DEFAULT 'unverified' CHECK (verification IN ('unverified','verified')),
  demo boolean NOT NULL DEFAULT false, deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX products_brand ON products(brand_id);
CREATE INDEX products_category_year ON products(category_id,release_year);
CREATE INDEX products_recent ON products(created_at DESC,id DESC) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX products_identity ON products(brand_id,archive_fold(name),archive_fold(coalesce(model,'')));
CREATE TABLE product_aliases (product_id bigint REFERENCES products ON DELETE CASCADE, alias text, PRIMARY KEY(product_id,alias));
CREATE TABLE product_images (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, product_id bigint NOT NULL REFERENCES products ON DELETE CASCADE, path text NOT NULL, attribution text NOT NULL, alt text NOT NULL);
CREATE TABLE product_sources (product_id bigint REFERENCES products ON DELETE CASCADE, url text, label text NOT NULL, PRIMARY KEY(product_id,url));
CREATE TABLE product_attributes (product_id bigint REFERENCES products ON DELETE CASCADE, name text, value text NOT NULL, PRIMARY KEY(product_id,name));
CREATE TABLE search_synonyms (term text PRIMARY KEY, replacement text NOT NULL);
CREATE TABLE product_search (
  product_id bigint PRIMARY KEY REFERENCES products ON DELETE CASCADE,
  title text NOT NULL, identifiers text[] NOT NULL, brand text NOT NULL, aliases text NOT NULL, document text NOT NULL,
  vector tsvector GENERATED ALWAYS AS (to_tsvector('simple',document)) STORED
);
CREATE INDEX search_vector ON product_search USING gin(vector);
CREATE INDEX search_title ON product_search USING gin(title gin_trgm_ops);
CREATE INDEX search_document ON product_search USING gin(document gin_trgm_ops);
CREATE INDEX search_identifiers ON product_search USING gin(identifiers);
CREATE FUNCTION rebuild_product_search(target bigint DEFAULT NULL) RETURNS void LANGUAGE sql AS $$
INSERT INTO product_search(product_id,title,identifiers,brand,aliases,document)
SELECT p.id,archive_fold(p.name),ARRAY(SELECT archive_fold(i) FROM unnest(ARRAY[p.model,p.reference_number,p.sku]) i WHERE i IS NOT NULL),
archive_fold(b.name),archive_fold(concat_ws(' ',array_to_string(b.aliases,' '),a.names)),
archive_fold(concat_ws(' ',p.name,p.model,p.reference_number,p.sku,b.name,array_to_string(b.aliases,' '),c.name,p.subcategory,
p.description,p.history,p.release_year,p.discontinued_year,array_to_string(p.colours,' '),array_to_string(p.materials,' '),p.country,a.names,x.specs))
FROM products p JOIN brands b ON b.id=p.brand_id JOIN categories c ON c.id=p.category_id
LEFT JOIN LATERAL (SELECT string_agg(alias,' ') names FROM product_aliases WHERE product_id=p.id) a ON true
LEFT JOIN LATERAL (SELECT string_agg(name || ' ' || value,' ') specs FROM product_attributes WHERE product_id=p.id) x ON true
WHERE target IS NULL OR p.id=target
ON CONFLICT(product_id) DO UPDATE SET title=excluded.title,identifiers=excluded.identifiers,brand=excluded.brand,aliases=excluded.aliases,document=excluded.document
$$;
CREATE FUNCTION sync_product_search() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME='products' THEN PERFORM rebuild_product_search(NEW.id);
  ELSE
    IF TG_OP<>'DELETE' THEN PERFORM rebuild_product_search(NEW.product_id); END IF;
    IF TG_OP='DELETE' THEN PERFORM rebuild_product_search(OLD.product_id); END IF;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER search_products AFTER INSERT OR UPDATE ON products FOR EACH ROW EXECUTE FUNCTION sync_product_search();
CREATE TRIGGER search_aliases AFTER INSERT OR UPDATE OR DELETE ON product_aliases FOR EACH ROW EXECUTE FUNCTION sync_product_search();
CREATE TRIGGER search_attributes AFTER INSERT OR UPDATE OR DELETE ON product_attributes FOR EACH ROW EXECUTE FUNCTION sync_product_search();
CREATE FUNCTION refresh_catalogue_search() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM rebuild_product_search(); RETURN NULL; END $$;
CREATE TRIGGER search_brands AFTER UPDATE ON brands FOR EACH STATEMENT EXECUTE FUNCTION refresh_catalogue_search();
CREATE TRIGGER search_categories AFTER UPDATE ON categories FOR EACH STATEMENT EXECUTE FUNCTION refresh_catalogue_search();

CREATE TABLE campaigns (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, product_id bigint NOT NULL REFERENCES products, author_id uuid REFERENCES profiles ON DELETE SET NULL,
  title text NOT NULL, description text NOT NULL, details jsonb NOT NULL DEFAULT '{}', target int NOT NULL DEFAULT 100 CHECK (target > 0),
  status text NOT NULL DEFAULT 'Under moderation' CHECK (status IN ('Gathering interest','Under moderation','Ready for brand outreach','Brand contacted','Under brand review','Brand approved','Brand declined','Completed','Archived')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX active_campaign_per_product ON campaigns(product_id) WHERE status NOT IN ('Archived','Completed','Brand declined');
CREATE TABLE campaign_supporters (
  campaign_id bigint REFERENCES campaigns ON DELETE CASCADE, user_id uuid REFERENCES profiles ON DELETE CASCADE,
  price numeric(12,2) CHECK (price >= 0), quantity int CHECK (quantity BETWEEN 1 AND 100),
  variant text, country char(2), likelihood int CHECK (likelihood BETWEEN 1 AND 5), created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(campaign_id,user_id)
);
CREATE TABLE campaign_follows (campaign_id bigint REFERENCES campaigns ON DELETE CASCADE, user_id uuid REFERENCES profiles ON DELETE CASCADE, PRIMARY KEY(campaign_id,user_id));
CREATE TABLE campaign_updates (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, campaign_id bigint NOT NULL REFERENCES campaigns ON DELETE CASCADE,
  author_id uuid REFERENCES profiles ON DELETE SET NULL, body text NOT NULL, official boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX campaign_updates_timeline ON campaign_updates(campaign_id,id DESC);
CREATE TABLE campaign_comments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, campaign_id bigint NOT NULL REFERENCES campaigns ON DELETE CASCADE,
  user_id uuid REFERENCES profiles ON DELETE SET NULL, body text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
CREATE INDEX campaign_comments_timeline ON campaign_comments(campaign_id,id DESC);
CREATE TABLE collections (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, user_id uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
  title text NOT NULL, description text NOT NULL DEFAULT '', published boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE collection_items (collection_id bigint REFERENCES collections ON DELETE CASCADE, product_id bigint REFERENCES products ON DELETE CASCADE, PRIMARY KEY(collection_id,product_id));
CREATE TABLE saved_products (user_id uuid REFERENCES profiles ON DELETE CASCADE, product_id bigint REFERENCES products ON DELETE CASCADE, PRIMARY KEY(user_id,product_id));
CREATE TABLE brand_follows (user_id uuid REFERENCES profiles ON DELETE CASCADE, brand_id bigint REFERENCES brands ON DELETE CASCADE, PRIMARY KEY(user_id,brand_id));
CREATE TABLE notifications (user_id uuid REFERENCES profiles ON DELETE CASCADE, update_id bigint REFERENCES campaign_updates ON DELETE CASCADE, read_at timestamptz, PRIMARY KEY(user_id,update_id));
CREATE TABLE product_submissions (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, user_id uuid REFERENCES profiles ON DELETE SET NULL, data jsonb NOT NULL, status text NOT NULL DEFAULT 'pending', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE correction_requests (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, product_id bigint NOT NULL REFERENCES products, user_id uuid REFERENCES profiles ON DELETE SET NULL, suggestion text NOT NULL, status text NOT NULL DEFAULT 'pending');
CREATE TABLE moderation_reports (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, user_id uuid REFERENCES profiles ON DELETE SET NULL, campaign_id bigint REFERENCES campaigns, comment_id bigint REFERENCES campaign_comments, reason text NOT NULL, status text NOT NULL DEFAULT 'pending', CHECK (num_nonnulls(campaign_id,comment_id)=1));
CREATE TABLE import_jobs (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, user_id uuid REFERENCES profiles ON DELETE SET NULL, brand_id bigint REFERENCES brands, data jsonb NOT NULL, errors jsonb NOT NULL, status text NOT NULL DEFAULT 'preview', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE search_events (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, kind text NOT NULL CHECK (kind IN ('search','product','campaign')), query text, result_count int, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX search_events_recent ON search_events(created_at);
CREATE TABLE search_history (user_id uuid REFERENCES profiles ON DELETE CASCADE, query text NOT NULL, used_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,query));
CREATE TABLE audit_logs (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, actor_id uuid REFERENCES profiles ON DELETE SET NULL, action text NOT NULL, target text NOT NULL, details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
