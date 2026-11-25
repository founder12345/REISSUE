CREATE TABLE campaign_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
  product_id bigint NOT NULL REFERENCES products,
  title text NOT NULL DEFAULT '', proposal text NOT NULL DEFAULT '', variants text NOT NULL DEFAULT '',
  context text NOT NULL DEFAULT '', target_price numeric(12,2) CHECK (target_price >= 0),
  submitted_campaign_id bigint UNIQUE REFERENCES campaigns ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX campaign_drafts_owner ON campaign_drafts(user_id,updated_at DESC);
ALTER TABLE campaigns ADD COLUMN rejected_at timestamptz;
ALTER TABLE campaigns ADD COLUMN rejection_reason text;
ALTER TABLE campaigns ADD COLUMN attestations_at timestamptz;
DROP INDEX active_campaign_per_product;
CREATE UNIQUE INDEX active_campaign_per_product ON campaigns(product_id)
WHERE rejected_at IS NULL AND status NOT IN ('Archived','Completed','Brand declined');
CREATE TABLE service_notices (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
  body text NOT NULL, path text NOT NULL CHECK (path LIKE '/%' AND path NOT LIKE '//%'),
  created_at timestamptz NOT NULL DEFAULT now(), read_at timestamptz
);
CREATE INDEX notices_owner ON service_notices(user_id,id DESC);
CREATE TABLE rights_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('access','rectification','erasure','portability','restriction','objection','consent','ip','appeal')),
  contact text, target text, statement text NOT NULL,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','reviewing','closed')),
  response text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (kind IN ('ip','appeal') OR contact IS NULL)
);
CREATE INDEX rights_cases_queue ON rights_cases(status,created_at);
CREATE INDEX rights_cases_owner ON rights_cases(user_id,created_at DESC);
ALTER TABLE profiles ADD COLUMN avatar_bytes bytea CHECK (octet_length(avatar_bytes)<=100000);

CREATE FUNCTION reissue_actor() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('reissue.actor',true),'')::uuid
$$;
CREATE FUNCTION reissue_is_admin() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id=reissue_actor() AND role='admin' AND disabled_at IS NULL)
$$;
ALTER TABLE rights_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE rights_cases FORCE ROW LEVEL SECURITY;
CREATE POLICY rights_read ON rights_cases FOR SELECT USING (user_id=reissue_actor() OR reissue_is_admin());
CREATE POLICY rights_file ON rights_cases FOR INSERT WITH CHECK (user_id=reissue_actor() OR (user_id IS NULL AND kind='ip'));
CREATE POLICY rights_review ON rights_cases FOR UPDATE USING (reissue_is_admin()) WITH CHECK (reissue_is_admin());
CREATE POLICY rights_erase ON rights_cases FOR DELETE USING (user_id=reissue_actor() OR reissue_is_admin());

ALTER TABLE campaign_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_drafts FORCE ROW LEVEL SECURITY;
CREATE POLICY drafts_owner ON campaign_drafts USING (user_id=reissue_actor()) WITH CHECK (user_id=reissue_actor());
