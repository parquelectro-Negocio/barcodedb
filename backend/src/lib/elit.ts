// ELIT supplier catalog (https://clientes.elit.com.ar/v1/api/productos).
//
// The data frontier lives HERE: mapElitProduct extracts product IDENTITY only
// (EAN, name, brand, sku, image, technical specs) and DROPS every price and
// stock field. Prices/stock are per-merchant and never enter the global base.
// Keep that guarantee — the mapping test asserts no pricing field can leak.

// Raw shape returned by ELIT (only the fields we read are typed; the rest —
// precio, iva, pvp_ars, stock_total, etc. — are intentionally ignored).
export interface ElitRawProduct {
  id?: number | string;
  codigo_alfa?: string;
  codigo_producto?: string; // manufacturer SKU
  nombre?: string;
  marca?: string;
  categoria?: string;
  sub_categoria?: string;
  ean?: string;
  peso?: number | string;
  garantia?: string;
  imagenes?: string[];
  miniaturas?: string[];
  atributos?: { nombre?: string; valor?: string }[];
  link?: string;
  gamer?: boolean;
  creado?: string;
  actualizado?: string;
}

// Identity-only projection of an ELIT product. This is all that reaches the
// global `products` table (plus provenance). No prices, no stock.
export interface MappedProduct {
  barcode: string;                     // ean, normalized ('' when the source has none)
  name: string;
  brand: string;
  sku: string;                         // codigo_producto (manufacturer SKU)
  imageUrl: string;                    // imagenes[0]
  attributes: Record<string, string>;  // peso, garantia, atributos[] specs
  // Provenance (-> product_sources)
  source: 'elit';
  sourceId: string;                    // ELIT id
  sourceSku: string;                   // codigo_alfa
  sourceUrl: string;                   // link
  sourceUpdatedAt: Date | null;        // actualizado
}

function str(v: unknown): string {
  return v == null ? '' : String(v).trim();
}

// Normalize an EAN to digits only. Returns '' when there is no plausible code,
// so the caller can decide to skip it (barcode-less items are never merged by
// name — see the ingest). Does not validate the checksum; presence is enough.
export function normalizeEan(raw: unknown): string {
  const digits = str(raw).replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 14 ? digits : '';
}

function parseDate(v: unknown): Date | null {
  const s = str(v);
  if (!s) return null;
  const d = new Date(s.replace(' ', 'T'));
  return isNaN(d.getTime()) ? null : d;
}

// Map one raw ELIT product to identity + provenance. Returns null when there is
// no usable name (a product row requires one). PRICE/STOCK ARE NEVER READ.
export function mapElitProduct(raw: ElitRawProduct): MappedProduct | null {
  const name = str(raw?.nombre);
  if (!name) return null;

  const attributes: Record<string, string> = {};
  const peso = str(raw?.peso);
  if (peso && peso !== '0') attributes.peso = `${peso} kg`;
  const garantia = str(raw?.garantia);
  if (garantia) attributes.garantia = garantia;
  for (const a of Array.isArray(raw?.atributos) ? raw!.atributos! : []) {
    const key = str(a?.nombre);
    const val = str(a?.valor);
    if (key && val && attributes[key] == null) attributes[key] = val;
  }

  const imagenes = Array.isArray(raw?.imagenes) ? raw!.imagenes! : [];
  const imageUrl = str(imagenes.find((u) => str(u)));

  return {
    barcode: normalizeEan(raw?.ean),
    name,
    brand: str(raw?.marca),
    sku: str(raw?.codigo_producto),
    imageUrl,
    attributes,
    source: 'elit',
    sourceId: str(raw?.id),
    sourceSku: str(raw?.codigo_alfa),
    sourceUrl: str(raw?.link),
    sourceUpdatedAt: parseDate(raw?.actualizado),
  };
}

const ELIT_ENDPOINT = 'https://clientes.elit.com.ar/v1/api/productos';

export interface ElitFetchOptions {
  limit?: number;   // max 100 per ELIT
  offset?: number;
  since?: string;   // 'YYYY-MM-DD HH:MM' -> only products modified since (actualizacion)
  store?: string;   // all | cd | suc | cordoba | cba
}

export interface ElitPage {
  total: number;
  limit: number;
  offset: number;
  resultado: ElitRawProduct[];
}

// Fetch one page of the ELIT catalog. Credentials come from the environment
// (ELIT_USER_ID / ELIT_TOKEN) — never hard-coded, never logged.
export async function fetchElitPage(opts: ElitFetchOptions = {}): Promise<ElitPage> {
  const userId = process.env.ELIT_USER_ID;
  const token = process.env.ELIT_TOKEN;
  if (!userId || !token) {
    throw new Error('ELIT_USER_ID / ELIT_TOKEN not set in the environment');
  }

  const params = new URLSearchParams();
  params.set('limit', String(Math.min(Math.max(1, opts.limit ?? 100), 100)));
  // ELIT rejects offset=0 ("must be >= 1"); omitting it starts at the first
  // product (its own docs omit offset and echo offset 0). So only send it when
  // paging past the first page. Paging stays 0-based: 0 (omitted), 100, 200, ...
  const offset = Math.max(0, opts.offset ?? 0);
  if (offset >= 1) params.set('offset', String(offset));
  if (opts.since) params.set('actualizacion', opts.since);
  if (opts.store) params.set('store', opts.store);

  const res = await fetch(`${ELIT_ENDPOINT}?${params.toString()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: Number(userId), token }),
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 300);
    throw new Error(`ELIT API HTTP ${res.status}: ${detail}`);
  }

  const data: any = await res.json();
  const pag = data?.paginador ?? {};
  return {
    total: Number(pag.total ?? 0),
    limit: Number(pag.limit ?? opts.limit ?? 100),
    offset: Number(pag.offset ?? opts.offset ?? 0),
    resultado: Array.isArray(data?.resultado) ? data.resultado : [],
  };
}
