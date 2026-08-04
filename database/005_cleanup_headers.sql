-- =============================================
-- One-time cleanup: remove supplier-list section HEADERS that were imported as
-- products (e.g. "Energía /UPS", "Periféricos /Mouse"). Signature: contains " /"
-- (space before slash), no barcode, and <= 4 words. Real products that use "/"
-- as an abbreviation ("c/funda", "8GB/512", "MB/s") are longer and preserved.
-- Apply: railway connect Postgres < database/005_cleanup_headers.sql
-- =============================================

BEGIN;

CREATE TEMP TABLE junk AS
  SELECT id FROM products
  WHERE name LIKE '% /%'
    AND (barcode = '' OR barcode IS NULL)
    AND array_length(string_to_array(trim(name), ' '), 1) <= 4;

DELETE FROM sale_items WHERE business_product_id IN (
  SELECT id FROM business_products WHERE product_id IN (SELECT id FROM junk));
DELETE FROM business_products WHERE product_id IN (SELECT id FROM junk);
DELETE FROM product_votes      WHERE product_id IN (SELECT id FROM junk);
DELETE FROM product_aliases    WHERE product_id IN (SELECT id FROM junk);
DELETE FROM product_variants   WHERE product_id IN (SELECT id FROM junk);
DELETE FROM duplicate_reports  WHERE reported_id IN (SELECT id FROM junk)
                                  OR target_id   IN (SELECT id FROM junk);
DELETE FROM products           WHERE id IN (SELECT id FROM junk);

DROP TABLE junk;
COMMIT;
