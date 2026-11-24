ALTER TABLE product_images ADD COLUMN object_key text UNIQUE;
ALTER TABLE product_images ADD COLUMN IF NOT EXISTS width integer CHECK (width > 0);
ALTER TABLE product_images ADD COLUMN IF NOT EXISTS height integer CHECK (height > 0);
