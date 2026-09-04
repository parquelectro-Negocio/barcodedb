// Mapping tests for the ELIT connector. Pure — no network, no DB.
// Run: npx tsx backend/elit.test.ts
//
// The point of this suite is the DATA FRONTIER: prove that mapElitProduct keeps
// product identity and can never leak a price or stock field into the global base.

import { mapElitProduct, normalizeEan, type ElitRawProduct } from './src/lib/elit';

let passed = 0;
let failed = 0;
function check(label: string, cond: boolean) {
  if (cond) { passed++; console.log(`  ok  ${label}`); }
  else { failed++; console.error(`FAIL  ${label}`); }
}

// A fully-populated ELIT product, including every price/stock field we must drop.
const rich: ElitRawProduct = {
  id: 12345,
  codigo_alfa: 'ELT-ABC',
  codigo_producto: 'LEN-IP3-14',
  nombre: 'Notebook Lenovo IdeaPad 3',
  marca: 'Lenovo',
  categoria: 'Notebooks',
  sub_categoria: 'Consumo',
  ean: '7798109012345',
  peso: 1.6,
  garantia: '12 meses',
  imagenes: ['https://img.elit.com.ar/a.jpg', 'https://img.elit.com.ar/b.jpg'],
  miniaturas: ['https://img.elit.com.ar/a-thumb.jpg'],
  atributos: [{ nombre: 'RAM', valor: '8GB' }, { nombre: 'Almacenamiento', valor: '256GB SSD' }],
  link: 'https://elit.com.ar/producto/12345',
  gamer: false,
  creado: '2025-01-10 09:00',
  actualizado: '2026-08-30 14:30',
  // Price/stock — MUST NOT appear anywhere in the mapped output:
  ...( { precio: 500000, iva: 21, impuesto_interno: 0, moneda: 1, cotizacion: 1530,
         pvp_usd: 680, pvp_ars: 850000, markup: 35, nivel_stock: 'alto',
         stock_total: 14, stock_deposito_cliente: 3, stock_deposito_cd: 11 } as any ),
};

const m = mapElitProduct(rich)!;
check('maps EAN -> barcode', m.barcode === '7798109012345');
check('maps nombre -> name', m.name === 'Notebook Lenovo IdeaPad 3');
check('maps marca -> brand', m.brand === 'Lenovo');
check('maps codigo_producto -> sku', m.sku === 'LEN-IP3-14');
check('takes first image', m.imageUrl === 'https://img.elit.com.ar/a.jpg');
check('peso -> attributes.peso', m.attributes.peso === '1.6 kg');
check('garantia -> attributes', m.attributes.garantia === '12 meses');
check('atributos[] -> attributes', m.attributes.RAM === '8GB' && m.attributes.Almacenamiento === '256GB SSD');
check('provenance sourceId', m.sourceId === '12345');
check('provenance sourceSku (codigo_alfa)', m.sourceSku === 'ELT-ABC');
check('provenance sourceUrl', m.sourceUrl === 'https://elit.com.ar/producto/12345');
check('provenance sourceUpdatedAt parsed', m.sourceUpdatedAt instanceof Date && !isNaN(m.sourceUpdatedAt.getTime()));

// THE FRONTIER GUARANTEE: no price/stock key or value survives mapping.
const serialized = JSON.stringify(m).toLowerCase();
const forbiddenKeys = ['precio', 'iva', 'impuesto', 'moneda', 'cotizacion', 'pvp', 'markup', 'stock', 'nivel_stock', 'deposito'];
check('no pricing/stock KEY leaks', forbiddenKeys.every((k) => !serialized.includes(k)));
check('no pricing/stock VALUE leaks', !/(500000|850000|"14"|:14\b|1530)/.test(JSON.stringify(m)));
check('mapped object has exactly the identity+provenance keys', JSON.stringify(Object.keys(m).sort()) ===
  JSON.stringify(['attributes','barcode','brand','imageUrl','name','source','sourceId','sourceSku','sourceUpdatedAt','sourceUrl','sku'].sort()));

// Edge cases
check('no name -> null', mapElitProduct({ nombre: '' }) === null);
check('missing name -> null', mapElitProduct({} as ElitRawProduct) === null);
const noEan = mapElitProduct({ nombre: 'Cable HDMI 2m', marca: 'Genérico' })!;
check('no EAN -> empty barcode (caller skips)', noEan.barcode === '' && noEan.name === 'Cable HDMI 2m');
check('peso 0 is ignored', mapElitProduct({ nombre: 'X', peso: 0 })!.attributes.peso === undefined);

check('normalizeEan strips non-digits', normalizeEan(' 7798-109 012345 ') === '7798109012345');
check('normalizeEan rejects too short', normalizeEan('123') === '');
check('normalizeEan handles null', normalizeEan(null) === '');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
