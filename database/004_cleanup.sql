-- =============================================
-- One-time cleanup. Apply with: railway connect Postgres < database/004_cleanup.sql
--  1. Recover real products whose `name` was lost but the slug preserved it.
--  2. Remove the 13 fake seed/demo products and all their references.
-- Atomic (BEGIN/COMMIT) — all or nothing.
-- =============================================

BEGIN;

-- 1. Reconstruct the name from the slug for name-less products.
UPDATE products
  SET name = upper(replace(slug, '-', ' ')), updated_at = now()
  WHERE (name = '' OR name IS NULL) AND slug <> '';

-- 2. Delete the demo products (barcodes 77900409296xx) and their FK children first.
DELETE FROM sale_items WHERE business_product_id IN (
  SELECT id FROM business_products WHERE product_id IN (
    SELECT id FROM products WHERE barcode LIKE '77900409296%'));
DELETE FROM business_products WHERE product_id IN (
  SELECT id FROM products WHERE barcode LIKE '77900409296%');
DELETE FROM product_votes WHERE product_id IN (
  SELECT id FROM products WHERE barcode LIKE '77900409296%');
DELETE FROM product_aliases WHERE product_id IN (
  SELECT id FROM products WHERE barcode LIKE '77900409296%');
DELETE FROM product_variants WHERE product_id IN (
  SELECT id FROM products WHERE barcode LIKE '77900409296%');
DELETE FROM duplicate_reports
  WHERE reported_id IN (SELECT id FROM products WHERE barcode LIKE '77900409296%')
     OR target_id   IN (SELECT id FROM products WHERE barcode LIKE '77900409296%');
DELETE FROM products WHERE barcode LIKE '77900409296%';

COMMIT;
