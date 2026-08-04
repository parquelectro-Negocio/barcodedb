-- =============================================
-- Replace the invented taxonomy with the user's REAL supplier taxonomy.
-- Broad sectors (top level, for the sector picker) + the real supplier sections
-- as child categories (their names match the import header first-segments, so
-- the import guard's category propagation lands 100%).
-- Apply: railway connect Postgres < database/006_taxonomy_real.sql
-- NOTE: nulls existing product categories — re-categorization runs in 007.
-- =============================================

BEGIN;

UPDATE products SET category_id = NULL WHERE category_id IS NOT NULL;
DELETE FROM category_attributes;
UPDATE categories SET parent_id = NULL;
DELETE FROM categories;

-- Sectors (top level).
INSERT INTO categories (name, slug) VALUES
  ('Computación', 'computacion'),
  ('Impresión',   'impresion'),
  ('Gaming',      'gaming')
ON CONFLICT (slug) DO NOTHING;

-- Categories (children) — real supplier sections + obvious additions.
INSERT INTO categories (name, slug, parent_id) VALUES
  ('Computadoras',      'computadoras',      (SELECT id FROM categories WHERE slug='computacion')),
  ('Notebooks',         'notebooks',         (SELECT id FROM categories WHERE slug='computacion')),
  ('Placas de Video',   'placas-de-video',   (SELECT id FROM categories WHERE slug='computacion')),
  ('Mothers',           'mothers',           (SELECT id FROM categories WHERE slug='computacion')),
  ('Microprocesadores', 'microprocesadores', (SELECT id FROM categories WHERE slug='computacion')),
  ('Memorias RAM',      'memorias-ram',      (SELECT id FROM categories WHERE slug='computacion')),
  ('Almacenamiento',    'almacenamiento',    (SELECT id FROM categories WHERE slug='computacion')),
  ('Coolers',           'coolers',           (SELECT id FROM categories WHERE slug='computacion')),
  ('Fuentes',           'fuentes',           (SELECT id FROM categories WHERE slug='computacion')),
  ('Gabinetes',         'gabinetes',         (SELECT id FROM categories WHERE slug='computacion')),
  ('Monitores',         'monitores',         (SELECT id FROM categories WHERE slug='computacion')),
  ('Periféricos',       'perifericos',       (SELECT id FROM categories WHERE slug='computacion')),
  ('Conectividad',      'conectividad',      (SELECT id FROM categories WHERE slug='computacion')),
  ('Energía',           'energia',           (SELECT id FROM categories WHERE slug='computacion')),
  ('Proyectores',       'proyectores',       (SELECT id FROM categories WHERE slug='computacion')),
  ('Pilas y Baterías',  'pilas-baterias',    (SELECT id FROM categories WHERE slug='computacion')),
  ('Accesorios',        'accesorios',        (SELECT id FROM categories WHERE slug='computacion')),
  ('Impresoras',        'impresoras',        (SELECT id FROM categories WHERE slug='impresion')),
  ('Consumibles',       'consumibles',       (SELECT id FROM categories WHERE slug='impresion')),
  ('Consolas',          'consolas',          (SELECT id FROM categories WHERE slug='gaming')),
  ('Joysticks',         'joysticks',         (SELECT id FROM categories WHERE slug='gaming'))
ON CONFLICT (slug) DO NOTHING;

COMMIT;
