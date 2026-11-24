INSERT INTO categories(slug,name) VALUES
('fashion','Fashion'),('footwear','Footwear'),('technology','Technology'),('audio','Audio'),('watches','Watches'),('accessories','Accessories'),
('furniture','Furniture'),('design-objects','Design objects'),('photography','Photography'),('outdoor','Outdoor equipment'),('collectibles','Collectibles')
ON CONFLICT DO NOTHING;
INSERT INTO brands(slug,name,aliases) VALUES
('apple','Apple','{}'),('sony','Sony','{}'),('olympus','Olympus','{}'),('braun','Braun','{}'),('casio','Casio','{}'),('arcteryx','Arc’teryx',ARRAY['arcteryx','arc teryx'])
ON CONFLICT DO NOTHING;
INSERT INTO products(slug,name,brand_id,category_id,description,history,release_year,model,reference_number,subcategory,colours,materials,demo)
SELECT v.slug,v.name,b.id,c.id,v.description,v.history,v.year,v.model,v.ref,v.subcategory,v.colours,v.materials,true
FROM (VALUES
('ipod-classic','iPod Classic','apple','technology','A pocket music player built around a tactile click wheel and a dedicated library.','The Classic name appeared in 2007, continuing the original full-size iPod line.',2007,'iPod Classic','A1238','Music players',ARRAY['Silver','Black'],ARRAY['Aluminium']),
('walkman-tps-l2','Walkman TPS-L2','sony','audio','A compact blue and silver cassette player with two headphone outputs.','Sony introduced the TPS-L2 in Japan in 1979, helping define portable personal listening.',1979,'Walkman','TPS-L2','Cassette players',ARRAY['Blue','Silver'],ARRAY['Metal']),
('olympus-xa','Olympus XA','olympus','photography','A pocketable 35 mm rangefinder with a sliding lens cover.','The XA combined a compact clamshell body with rangefinder focusing.',1979,'XA','XA 35','Film cameras',ARRAY['Black'],ARRAY['Plastic']),
('braun-et66','Braun ET66','braun','design-objects','A pocket calculator with circular keys and a distinctive yellow equals button.','The ET66 belongs to Braun’s calculator programme from the 1980s.',1987,'ET66','ET-66','Calculators',ARRAY['Black','Yellow'],ARRAY['Plastic']),
('casio-f-100','Casio F-100','casio','watches','A digital watch with distinctive front-mounted controls.','Its front-button layout made this model recognisable among early digital watches.',1978,'F-100','F100','Digital watches',ARRAY['Black'],ARRAY['Resin']),
('alpha-sv-archive','Alpha SV archive sample','arcteryx','outdoor','Illustrative vintage navy shell catalogue record for testing attribute and alias searches.','This demo record does not identify a verified historical variant.',1998,'Alpha SV','DEMO-ASV','Shell jackets',ARRAY['Navy'],ARRAY['Nylon'])
) AS v(slug,name,brand,category,description,history,year,model,ref,subcategory,colours,materials)
JOIN brands b ON b.slug=v.brand JOIN categories c ON c.slug=v.category
ON CONFLICT DO NOTHING;
INSERT INTO search_synonyms(term,replacement) VALUES('camera','photography'),('headphones','audio'),('sneakers','footwear') ON CONFLICT DO NOTHING;
INSERT INTO product_aliases(product_id,alias) SELECT id,'click wheel iPod' FROM products WHERE slug='ipod-classic' ON CONFLICT DO NOTHING;
INSERT INTO campaigns(product_id,title,description,status)
SELECT id,'Bring back the iPod Classic','An illustrative campaign for a dedicated music player with physical controls. This sample starts with zero supporters.','Gathering interest'
FROM products WHERE slug='ipod-classic' AND demo
ON CONFLICT DO NOTHING;
INSERT INTO product_images(product_id,path,attribution,alt,source_url,license_url)
SELECT p.id,'/archive/'||i.slug||'.webp',i.credit,i.alt,i.source,i.license
FROM (VALUES
  ('walkman-tps-l2','Anna Gerdén · CC BY-SA 3.0 · resized and converted to WebP','Blue and silver Sony Walkman TPS-L2 cassette player','https://commons.wikimedia.org/wiki/File:Walkman_TPS-L2.jpg','https://creativecommons.org/licenses/by-sa/3.0/'),
  ('ipod-classic','Evan-Amos · Public domain · resized and converted to WebP','Sixth-generation iPod Classic','https://commons.wikimedia.org/wiki/File:Ipod-classic-6th-gen.jpg','https://creativecommons.org/publicdomain/mark/1.0/'),
  ('olympus-xa','D. Meyer · CC BY-SA 3.0 · resized and converted to WebP','Olympus XA camera with a roll of film','https://commons.wikimedia.org/wiki/File:Olympus_XA_camera_and_film.jpg','https://creativecommons.org/licenses/by-sa/3.0/'),
  ('braun-et66','Pinot Dita · CC BY-SA 2.0 · resized and converted to WebP','Braun ET66 calculator','https://commons.wikimedia.org/wiki/File:1987_Braun_calculator_ET66_by_Dieter_Rams_%2813964223413%29.jpg','https://creativecommons.org/licenses/by-sa/2.0/'),
  ('casio-f-100','Kaktis788 · CC BY-SA 4.0 · resized and converted to WebP','Casio 52-F-100 digital watch','https://commons.wikimedia.org/wiki/File:RARE_%D0%95LIEN_CASIO_CHRONOGRAPH_52-F-100.jpg','https://creativecommons.org/licenses/by-sa/4.0/')
) i(slug,credit,alt,source,license) JOIN products p ON p.slug=i.slug AND p.demo
WHERE NOT EXISTS(SELECT 1 FROM product_images x WHERE x.product_id=p.id AND x.path='/archive/'||i.slug||'.webp');
