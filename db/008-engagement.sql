CREATE TABLE saved_campaigns (
  user_id uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
  campaign_id bigint NOT NULL REFERENCES campaigns ON DELETE CASCADE,
  PRIMARY KEY(user_id,campaign_id)
);
ALTER TABLE campaign_supporters ADD COLUMN price_max numeric(12,2);
ALTER TABLE campaign_supporters ADD CHECK (price_max IS NULL OR (price IS NOT NULL AND price_max>=price));
ALTER TABLE product_submissions ADD COLUMN rights_attested_at timestamptz;
INSERT INTO categories(slug,name) VALUES
('fashion','Fashion'),('footwear','Footwear'),('technology','Technology'),('audio','Audio'),('watches','Watches'),
('accessories','Accessories'),('furniture','Furniture'),('design-objects','Design objects'),('photography','Photography'),
('outdoor','Outdoor equipment'),('collectibles','Collectibles') ON CONFLICT DO NOTHING;
