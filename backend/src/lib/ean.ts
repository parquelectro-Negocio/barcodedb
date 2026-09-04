// Canonical EAN/GTIN for CROSS-PROVIDER matching. Suppliers encode the same
// product's barcode at different widths: ELIT sends 11-digit UPC (97855165428),
// INVID sends 13/14-digit GTIN with leading zeros (07791234567890). Leading zeros
// are never significant in a GTIN, so stripping non-digits and leading zeros
// collapses both encodings of one product to a single comparable key.
//
// Returns '' when there is no plausible code, so callers skip it (barcode-less
// products are matched by provider id instead, never merged by name).
export function toCanonicalEan(raw: unknown): string {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 14) return '';
  const stripped = digits.replace(/^0+/, '');
  return stripped.length >= 7 ? stripped : '';
}
