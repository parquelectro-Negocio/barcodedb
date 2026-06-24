-- =============================================
-- BarcodeDB - Global Product Database Schema
-- =============================================

-- Categories tree (flexible, self-referencing)
CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  parent_id   UUID REFERENCES categories(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Attributes template per category (e.g. "Electrónica" -> voltaje, conectividad)
CREATE TABLE category_attributes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id   UUID NOT NULL REFERENCES categories(id),
  name          TEXT NOT NULL,      -- e.g. "voltage", "connectivity"
  label         TEXT NOT NULL,      -- e.g. "Voltaje", "Conectividad"
  type          TEXT NOT NULL DEFAULT 'text',  -- text | number | boolean | select
  options       JSONB,             -- for select type: ["hdmi","usb-c","displayport"]
  required      BOOLEAN NOT NULL DEFAULT false,
  sort_order    INT NOT NULL DEFAULT 0
);

-- Global products (multiple entries per barcode allowed - conflicts exist in the real world)
CREATE TABLE products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode         TEXT NOT NULL,
  name            TEXT NOT NULL,
  brand           TEXT NOT NULL DEFAULT '',
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
CREATE TABLE product_variants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID NOT NULL REFERENCES products(id),
  name          TEXT NOT NULL,
  barcode       TEXT,               -- may differ from parent
  attributes    JSONB NOT NULL DEFAULT '{}',
  sort_order    INT NOT NULL DEFAULT 0
);

-- Businesses (comercios)
CREATE TABLE businesses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  plan          TEXT NOT NULL DEFAULT 'free',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Business product catalog (stock, prices)
CREATE TABLE business_products (
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
  UNIQUE(business_id, product_id, variant_id)
);

-- Contributors / users
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE,
  display_name  TEXT NOT NULL DEFAULT '',
  reputation    INT NOT NULL DEFAULT 0,  -- score based on accepted contributions
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Contributions (who added/modified what)
CREATE TABLE contributions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id),
  product_id    UUID REFERENCES products(id),
  field         TEXT NOT NULL,      -- 'name', 'brand', 'attributes', 'image'
  old_value     JSONB,
  new_value     JSONB NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending', -- pending | accepted | rejected
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Votes/confirmations on product data
CREATE TABLE product_votes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id),
  product_id    UUID REFERENCES products(id),
  vote          TEXT NOT NULL DEFAULT 'confirm', -- confirm | flag
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);

-- Product aliases for import/AI matching
CREATE TABLE product_aliases (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID NOT NULL REFERENCES products(id),
  alias         TEXT NOT NULL,       -- e.g. "Samsung A16" -> product
  source        TEXT NOT NULL DEFAULT 'manual', -- manual | import | ai
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sales (simple POS, Phase 2)
CREATE TABLE sales (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   UUID NOT NULL REFERENCES businesses(id),
  total         NUMERIC(12,2) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sale_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id       UUID NOT NULL REFERENCES sales(id),
  business_product_id UUID NOT NULL REFERENCES business_products(id),
  quantity      INT NOT NULL DEFAULT 1,
  unit_price    NUMERIC(12,2) NOT NULL,
  total         NUMERIC(12,2) NOT NULL
);

-- Indexes
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_brand ON products(brand);
CREATE INDEX idx_products_name ON products USING gin(to_tsvector('spanish', name));
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_business_products_business ON business_products(business_id);
CREATE INDEX idx_product_aliases_alias ON product_aliases(alias);
CREATE INDEX idx_contributions_product ON contributions(product_id);
CREATE INDEX idx_contributions_status ON contributions(status);
