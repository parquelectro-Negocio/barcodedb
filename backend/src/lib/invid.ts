// INVID Computers catalog (invidcomputers.com/api). Auth is a 2-step JWT flow:
// POST autenticacion/login.php {username, password} -> token, then send it as a
// Bearer header to the articulos endpoint (paginated). Credentials come from the
// environment (INVID_USERNAME / INVID_PASSWORD) — never hard-coded, never logged.
//
// Same data frontier as ELIT: mapInvidProduct keeps identity only and DROPS every
// price/stock field (PRICE, FINAL_PRICE, IVA_*, INTERNAL_TAX_*, STOCK, STOCK_STATUS).
// The mapping test asserts nothing priced can leak.

import { toCanonicalEan } from './ean';
import type { MappedProduct } from './elit';

// Raw INVID article. Only the fields we read are typed; the price/stock fields
// are intentionally omitted from the type so they can never be mapped.
export interface InvidArticulo {
  ID?: number | string;
  TITLE?: string;
  PART_NUMBER?: string;      // manufacturer SKU
  EAN?: string;              // '' when the article has no barcode
  BRAND?: string;
  DESCRIPTION?: string;
  LONG_DESCRIPTION?: string;
  IMAGE_URL?: string;
  CATEGORY?: string;
  CATEGORY_ID?: number | string;
  WEIGHT?: number | string;
  WEIGHT_UNIT?: string;
  HEIGHT?: number | string;
  WIDTH?: number | string;
  LENGTH?: number | string;
  DIMENSIONS_UNIT?: string;
}

function str(v: unknown): string {
  return v == null ? '' : String(v).trim();
}

// Map one raw INVID article to identity + provenance. Returns null when there is
// no usable title (a product row requires a name). PRICE/STOCK ARE NEVER READ.
export function mapInvidProduct(raw: InvidArticulo): MappedProduct | null {
  const name = str(raw?.TITLE);
  if (!name) return null;

  const attributes: Record<string, string> = {};
  const weight = str(raw?.WEIGHT);
  if (weight && weight !== '0') attributes.peso = `${weight} ${str(raw?.WEIGHT_UNIT) || 'kg'}`.trim();
  const dimU = str(raw?.DIMENSIONS_UNIT) || 'cm';
  for (const [key, val] of [['alto', raw?.HEIGHT], ['ancho', raw?.WIDTH], ['largo', raw?.LENGTH]] as const) {
    const v = str(val);
    if (v && v !== '0') attributes[key] = `${v} ${dimU}`.trim();
  }

  return {
    barcode: toCanonicalEan(raw?.EAN),
    name,
    brand: str(raw?.BRAND),
    sku: str(raw?.PART_NUMBER),
    imageUrl: str(raw?.IMAGE_URL),
    attributes,
    source: 'invid',
    sourceId: str(raw?.ID),
    sourceSku: str(raw?.PART_NUMBER),
    sourceUrl: '',
    sourceUpdatedAt: null,
  };
}
