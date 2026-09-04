// Mapping tests for the INVID connector. Pure — no network, no DB.
// Run: npx tsx backend/invid.test.ts
//
// Asserts the DATA FRONTIER (no price/stock leaks) and cross-provider EAN
// canonicalization (INVID's 14-digit GTIN -> same key as ELIT's 11-digit UPC).

import { mapInvidProduct, type InvidArticulo } from './src/lib/invid';
import { toCanonicalEan } from './src/lib/ean';

let passed = 0;
let failed = 0;
function check(label: string, cond: boolean) {
  if (cond) { passed++; console.log(`  ok  ${label}`); }
  else { failed++; console.error(`FAIL  ${label}`); }
}

const rich: InvidArticulo = {
  ID: 9001,
  TITLE: 'Motherboard ASUS ROG STRIX B650-A',
  PART_NUMBER: 'ROG-STRIX-B650-A',
  EAN: '07798137713858',                 // 14-digit GTIN with leading zero
  BRAND: 'ASUS',
  DESCRIPTION: 'Mother AM5',
  IMAGE_URL: 'https://invidcomputers.com/img/9001.jpg',
  CATEGORY: 'Motherboards',
  WEIGHT: 1.2, WEIGHT_UNIT: 'kg',
  HEIGHT: 24, WIDTH: 30, LENGTH: 5, DIMENSIONS_UNIT: 'cm',
  // Price/stock — MUST NOT appear anywhere in the mapped output:
  ...( { PRICE: 300000, CURRENCY: 'ARS', FINAL_PRICE: 363000, IVA_PERCENT: 21,
         IVA_VALUE: 63000, INTERNAL_TAX_PERCENT: 0, INTERNAL_TAX_VALUE: 0,
         STOCK: 7, STOCK_STATUS: 'alto' } as any ),
};

const m = mapInvidProduct(rich)!;
check('TITLE -> name', m.name === 'Motherboard ASUS ROG STRIX B650-A');
check('BRAND -> brand', m.brand === 'ASUS');
check('PART_NUMBER -> sku', m.sku === 'ROG-STRIX-B650-A');
check('IMAGE_URL -> imageUrl', m.imageUrl === 'https://invidcomputers.com/img/9001.jpg');
check('WEIGHT -> attributes.peso', m.attributes.peso === '1.2 kg');
check('dimensions -> attributes', m.attributes.alto === '24 cm' && m.attributes.ancho === '30 cm' && m.attributes.largo === '5 cm');
check('provenance source', m.source === 'invid');
check('provenance sourceId', m.sourceId === '9001');

// Cross-provider EAN: INVID's 14-digit GTIN canonicalizes to the same key as
// ELIT's 13-digit form of the same product (leading zero stripped).
check('EAN canonicalized (strip leading zero)', m.barcode === '7798137713858');
check('matches ELIT encoding of same product', m.barcode === toCanonicalEan('7798137713858'));

// Frontier guarantee: no price/stock key or value survives mapping.
const serialized = JSON.stringify(m).toLowerCase();
const forbiddenKeys = ['price', 'currency', 'iva', 'tax', 'stock', 'final_price'];
check('no pricing/stock KEY leaks', forbiddenKeys.every((k) => !serialized.includes(k)));
check('no pricing/stock VALUE leaks', !/(300000|363000|63000|"7"|:7\b)/.test(JSON.stringify(m)));
check('mapped keys are identity+provenance only', JSON.stringify(Object.keys(m).sort()) ===
  JSON.stringify(['attributes','barcode','brand','imageUrl','name','source','sourceId','sourceSku','sourceUpdatedAt','sourceUrl','sku'].sort()));

// Edge cases
check('no title -> null', mapInvidProduct({ TITLE: '' }) === null);
check('missing title -> null', mapInvidProduct({} as InvidArticulo) === null);
const noEan = mapInvidProduct({ TITLE: 'Cable HDMI', EAN: '' })!;
check('empty EAN -> empty barcode', noEan.barcode === '' && noEan.name === 'Cable HDMI');
check('weight 0 ignored', mapInvidProduct({ TITLE: 'X', WEIGHT: 0 })!.attributes.peso === undefined);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
