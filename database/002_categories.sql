-- =============================================
-- One-time category reset + rubro taxonomy (computación / gaming / impresión).
-- Apply with:  railway connect Postgres < database/002_categories.sql
-- Safe for real products: only nulls the ~18 demo products' categories; the
-- 2800 imported products have no category and are untouched.
-- =============================================

-- Clean the old, wrong tree (Celulares/Snacks/Bebidas...) and its noise attributes.
UPDATE products SET category_id = NULL WHERE category_id IS NOT NULL;
DELETE FROM category_attributes;
UPDATE categories SET parent_id = NULL;
DELETE FROM categories;

-- Sectors (top level).
INSERT INTO categories (name, slug) VALUES
  ('Computación',   'computacion'),
  ('Gaming',        'gaming'),
  ('Impresión',     'impresion'),
  ('Audio y Video', 'audio-video'),
  ('Seguridad',     'seguridad'),
  ('Energía',       'energia'),
  ('Conectividad',  'conectividad')
ON CONFLICT (slug) DO NOTHING;

-- Categories under each sector.
INSERT INTO categories (name, slug, parent_id) VALUES
  ('Componentes',           'componentes',        (SELECT id FROM categories WHERE slug='computacion')),
  ('Almacenamiento',        'almacenamiento',     (SELECT id FROM categories WHERE slug='computacion')),
  ('Periféricos',           'perifericos',        (SELECT id FROM categories WHERE slug='computacion')),
  ('Monitores',             'monitores',          (SELECT id FROM categories WHERE slug='computacion')),
  ('Notebooks y PC',        'notebooks-pc',       (SELECT id FROM categories WHERE slug='computacion')),
  ('Redes',                 'redes',              (SELECT id FROM categories WHERE slug='computacion')),
  ('Consolas',              'consolas',           (SELECT id FROM categories WHERE slug='gaming')),
  ('Juegos',                'juegos',             (SELECT id FROM categories WHERE slug='gaming')),
  ('Controles y Joysticks', 'joysticks',          (SELECT id FROM categories WHERE slug='gaming')),
  ('Accesorios gamer',      'accesorios-gamer',   (SELECT id FROM categories WHERE slug='gaming')),
  ('Impresoras',            'impresoras',         (SELECT id FROM categories WHERE slug='impresion')),
  ('Cartuchos y Toners',    'cartuchos-toners',   (SELECT id FROM categories WHERE slug='impresion')),
  ('Parlantes',             'parlantes',          (SELECT id FROM categories WHERE slug='audio-video')),
  ('Auriculares',           'auriculares',        (SELECT id FROM categories WHERE slug='audio-video')),
  ('Cables AV',             'cables-av',          (SELECT id FROM categories WHERE slug='audio-video')),
  ('Cámaras',               'camaras',            (SELECT id FROM categories WHERE slug='seguridad')),
  ('Accesorios de seguridad','accesorios-seguridad',(SELECT id FROM categories WHERE slug='seguridad')),
  ('UPS y Estabilizadores', 'ups-estabilizadores',(SELECT id FROM categories WHERE slug='energia')),
  ('Cables y Adaptadores',  'cables-adaptadores', (SELECT id FROM categories WHERE slug='conectividad'))
ON CONFLICT (slug) DO NOTHING;
