ALTER TABLE campaign_supporters ADD COLUMN preferred_colour text;
CREATE TABLE brand_pilots (
  brand_id bigint NOT NULL REFERENCES brands ON DELETE CASCADE,
  campaign_id bigint NOT NULL REFERENCES campaigns ON DELETE CASCADE,
  stage text NOT NULL CHECK (stage IN ('exploring','feasibility','closed')),
  contact_preference text NOT NULL CHECK (contact_preference IN ('portal','email','none')),
  notes text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(brand_id,campaign_id)
);
ALTER TABLE search_events ADD COLUMN journey_id uuid UNIQUE;
ALTER TABLE search_events ADD COLUMN journey_campaign_id bigint REFERENCES campaigns ON DELETE SET NULL;
ALTER TABLE search_events ADD COLUMN journey_viewed_at timestamptz;
ALTER TABLE search_events ADD COLUMN journey_supported_at timestamptz;
CREATE TABLE member_activity_days (
  user_id uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
  observed_on date NOT NULL DEFAULT ((now() AT TIME ZONE 'UTC')::date),
  PRIMARY KEY(user_id,observed_on)
);
CREATE INDEX activity_by_observed_date ON member_activity_days(observed_on,user_id);
