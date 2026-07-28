-- =============================================
-- BarcodeDB - Global Product Database Schema
-- =============================================

-- Categories tree (flexible, self-referencing)
CREATE TABLE IF NOT EXISTS categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  parent_id   UUID REFERENCES categories(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Attributes template per category (e.g. "Electrónica" -> voltaje, conectividad)
CREATE TABLE IF NOT EXISTS category_attributes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id   UUID NOT NULL REFERENCES categories(id),
  name          TEXT NOT NULL,      -- e.g. "voltage", "connectivity"
  label         TEXT NOT NULL,      -- e.g. "Voltaje", "Conectividad"
  type          TEXT NOT NULL DEFAULT 'text',  -- text | number | boolean | select
  options       JSONB,             -- for select type: ["hdmi","usb-c","displayport"]
  required      BOOLEAN NOT NULL DEFAULT false,
  sort_order    INT NOT NULL DEFAULT 0
);

-- Global products (multiple entries per barcode allowed — conflicts exist in the real world)
CREATE TABLE IF NOT EXISTS products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode         TEXT NOT NULL,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL DEFAULT '',
  brand           TEXT NOT NULL DEFAULT '',
  sku             TEXT NOT NULL DEFAULT '',
  color           TEXT NOT NULL DEFAULT '',
  description     TEXT NOT NULL DEFAULT '',
  category_id     UUID REFERENCES categories(id),
  image_url       TEXT NOT NULL DEFAULT '',
  unit            TEXT NOT NULL DEFAULT 'unidad',
  attributes      JSONB NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'pending',
  verification_score INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Product variants (same barcode, different spec: color, size, etc.)
CREATE TABLE IF NOT EXISTS product_variants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID NOT NULL REFERENCES products(id),
  name          TEXT NOT NULL,
  barcode       TEXT,               -- may differ from parent
  attributes    JSONB NOT NULL DEFAULT '{}',
  sort_order    INT NOT NULL DEFAULT 0
);

-- Businesses (comercios)
CREATE TABLE IF NOT EXISTS businesses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  plan          TEXT NOT NULL DEFAULT 'free',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Business product catalog (stock, prices)
CREATE TABLE IF NOT EXISTS business_products (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   UUID NOT NULL REFERENCES businesses(id),
  product_id    UUID NOT NULL REFERENCES products(id),
  variant_id    UUID REFERENCES product_variants(id),
  sku           TEXT NOT NULL DEFAULT '',
  stock         INT NOT NULL DEFAULT 0,
  cost          NUMERIC(12,2) NOT NULL DEFAULT 0,
  price         NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(business_id, product_id)
);

-- Votes/confirmations on product data (no FK to users — anonymous voting)
CREATE TABLE IF NOT EXISTS product_votes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL,
  product_id    UUID REFERENCES products(id),
  vote          TEXT NOT NULL DEFAULT 'confirm', -- confirm | flag
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);

-- Product aliases for import/AI matching
CREATE TABLE IF NOT EXISTS product_aliases (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID NOT NULL REFERENCES products(id),
  alias         TEXT NOT NULL,       -- e.g. "Samsung A16" -> product
  source        TEXT NOT NULL DEFAULT 'manual', -- manual | import | ai
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sales (POS)
CREATE TABLE IF NOT EXISTS sales (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     UUID NOT NULL REFERENCES businesses(id),
  total           NUMERIC(12,2) NOT NULL,
  payment_method  TEXT,           -- efectivo | transferencia | otro
  amount_tendered NUMERIC(12,2),  -- con cuánto pagó (solo efectivo)
  change          NUMERIC(12,2),  -- vuelto (solo efectivo)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sale_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id       UUID NOT NULL REFERENCES sales(id),
  business_product_id UUID NOT NULL REFERENCES business_products(id),
  quantity      INT NOT NULL DEFAULT 1,
  unit_price    NUMERIC(12,2) NOT NULL,
  total         NUMERIC(12,2) NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
CREATE INDEX IF NOT EXISTS idx_products_name ON products USING gin(to_tsvector('spanish', name));
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_business_products_business ON business_products(business_id);
CREATE INDEX IF NOT EXISTS idx_product_aliases_alias ON product_aliases(alias);
CREATE INDEX IF NOT EXISTS idx_sales_business ON sales(business_id);
CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at);

-- Migration: add sku column to products (idempotent)
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku TEXT NOT NULL DEFAULT '';
-- Migration: add color column to products (idempotent)
ALTER TABLE products ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT '';
-- Migration: add payment fields to sales (idempotent)
ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS amount_tendered NUMERIC(12,2);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS change NUMERIC(12,2);

-- Migration: drop FKs referencing users, drop old users table, recreate with auth
ALTER TABLE product_votes DROP CONSTRAINT IF EXISTS product_votes_user_id_fkey;
ALTER TABLE IF EXISTS businesses DROP CONSTRAINT IF EXISTS businesses_owner_id_fkey;
ALTER TABLE IF EXISTS products DROP CONSTRAINT IF EXISTS products_created_by_fkey;
ALTER TABLE IF EXISTS duplicate_reports DROP CONSTRAINT IF EXISTS duplicate_reports_reported_by_fkey;
ALTER TABLE IF EXISTS duplicate_reports DROP CONSTRAINT IF EXISTS duplicate_reports_resolved_by_fkey;
ALTER TABLE IF EXISTS product_votes DROP CONSTRAINT IF EXISTS product_votes_user_id_fkey;
DROP TABLE IF EXISTS contributions;
DROP TABLE IF EXISTS users;

-- Migration: replace (business_id, product_id, variant_id) unique with (business_id, product_id)
-- variant_id is typically NULL and PG treats NULLs as distinct, allowing duplicates
ALTER TABLE business_products DROP CONSTRAINT IF EXISTS business_products_business_id_product_id_variant_id_key;
ALTER TABLE business_products DROP CONSTRAINT IF EXISTS business_products_business_id_product_id_key;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'business_products_unique') THEN
    ALTER TABLE business_products ADD CONSTRAINT business_products_unique UNIQUE(business_id, product_id);
  END IF;
END $$;

-- Migration: re-create users table (was dropped earlier, now with auth)
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL DEFAULT '',
  avatar_url    TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Migration: add owner_id to businesses
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id);

-- Migration: add created_by to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);

-- Migration: add slug to products (for barcode-less matching)
ALTER TABLE products ADD COLUMN IF NOT EXISTS slug TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);

-- Migration: link product_votes.user_id -> users (FK was dropped earlier)
-- Use DO block to handle existing data that may reference non-existent users
DO $$ BEGIN
  DELETE FROM product_votes pv WHERE pv.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = pv.user_id);
  ALTER TABLE product_votes ADD CONSTRAINT product_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Could not add product_votes FK (non-critical): %', SQLERRM;
END $$;

-- Migration: duplicate reports for collaborative moderation
CREATE TABLE IF NOT EXISTS duplicate_reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reported_id   UUID NOT NULL REFERENCES products(id),
  target_id     UUID NOT NULL REFERENCES products(id),
  reported_by   UUID NOT NULL REFERENCES users(id),
  status        TEXT NOT NULL DEFAULT 'pending', -- pending | confirmed | rejected | merged
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at   TIMESTAMPTZ,
  resolved_by   UUID REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_duplicate_reports_status ON duplicate_reports(status);
CREATE INDEX IF NOT EXISTS idx_duplicate_reports_reported ON duplicate_reports(reported_id);
