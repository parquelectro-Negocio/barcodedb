import { Hono } from 'hono';
import { db, schema } from '../db';
import { like, or, and, sql, eq } from 'drizzle-orm';

export const searchRouter = new Hono();

searchRouter.get('/', async (c) => {
  const q = c.req.query('q')?.trim();
  const brand = c.req.query('brand')?.trim();
  const category = c.req.query('category')?.trim();
  const page = Math.max(1, parseInt(c.req.query('page') ?? '1'));
  const limit = Math.min(Math.max(1, parseInt(c.req.query('limit') ?? '20')), 100);
  const offset = (page - 1) * limit;

  const conditions = [];

  if (q) {
    conditions.push(
      or(
        like(schema.products.name, `%${q}%`),
        like(schema.products.brand, `%${q}%`),
        like(schema.products.barcode, `%${q}%`),
        sql`to_tsvector('spanish', ${schema.products.name}) @@ plainto_tsquery('spanish', ${q})`,
        sql`EXISTS (SELECT 1 FROM business_products bp WHERE bp.product_id = products.id AND bp.sku ILIKE ${'%' + q.toLowerCase() + '%'})`,
      ),
    );
  }

  if (brand) {
    conditions.push(eq(schema.products.brand, brand));
  }

  if (category) {
    conditions.push(eq(schema.products.categoryId, category));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const results = await db.query.products.findMany({
    where,
    limit, offset,
    orderBy: (p, { desc }) => desc(p.verificationScore),
    with: { category: true },
  });

  const countResult: any = await db.execute(
    sql`SELECT COUNT(*) as total FROM products WHERE ${where ? sql`${where}` : sql`TRUE`}`,
  );
  const total = parseInt((Array.isArray(countResult) ? countResult[0] : countResult.rows?.[0])?.total ?? '0');

  return c.json({ data: results, total, page, limit, query: q, brand, category });
});

searchRouter.get('/brands', async (c) => {
  const q = c.req.query('q')?.trim() ?? '';
  const results: any = await db.execute(
    sql`SELECT DISTINCT brand FROM products WHERE brand ILIKE ${`${q}%`} ORDER BY brand LIMIT 20`,
  );
  return c.json(asRows(results).map((r: any) => r.brand));
});

type MatchItem = { name?: string; barcode?: string; brand?: string; price?: number; stock?: number };

function asRows(r: any): any[] {
  return Array.isArray(r) ? r : (r?.rows ?? []);
}

async function matchByName(trimmed: string): Promise<any> {
  // 1. Alias match
  const aliasResult: any = await db.execute(
    sql`
      SELECT p.id, p.name, p.brand, p.barcode, p.image_url, p.verification_score, p.status
      FROM products p
      JOIN product_aliases pa ON pa.product_id = p.id
      WHERE LOWER(pa.alias) = LOWER(${trimmed})
      LIMIT 1
    `,
  );
  let found = asRows(aliasResult);
  if (found.length > 0) return found[0];

  // 2. Name exact match
  const nameResult: any = await db.execute(
    sql`
      SELECT id, name, brand, barcode, image_url, verification_score, status
      FROM products WHERE LOWER(name) = LOWER(${trimmed}) LIMIT 1
    `,
  );
  found = asRows(nameResult);
  if (found.length > 0) return found[0];

  // 3. Name + brand fuzzy
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    const brandNames: any = await db.execute(
      sql`
        WITH possible_brands AS (
          SELECT DISTINCT brand FROM products
          WHERE LOWER(brand) = LOWER(${parts[0]}) OR LOWER(brand) = LOWER(${parts[1]})
        )
        SELECT p.id, p.name, p.brand, p.barcode, p.image_url, p.verification_score, p.status
        FROM products p
        WHERE p.brand IN (SELECT brand FROM possible_brands)
          AND (${sql.join(parts.map(p => sql`LOWER(p.name) LIKE ${'%' + p.toLowerCase() + '%'}`), sql` AND `)})
        LIMIT 1
      `,
    );
    found = asRows(brandNames);
    if (found.length > 0) return found[0];
  }

  // 4. ILIKE fallback
  const ilikeResult: any = await db.execute(
    sql`
      SELECT id, name, brand, barcode, image_url, verification_score, status
      FROM products WHERE LOWER(name) LIKE ${'%' + trimmed.toLowerCase() + '%'} LIMIT 1
    `,
  );
  found = asRows(ilikeResult);
  return found.length > 0 ? found[0] : null;
}

// Import matching: takes names[] or items[], returns { matches, unmatched, items }
searchRouter.post('/match', async (c) => {
  const body = await c.req.json() as { names?: string[]; items?: MatchItem[] };
  const items: MatchItem[] = body.items ?? body.names?.map(n => ({ name: n })) ?? [];
  if (!items.length) return c.json({ matches: [], unmatched: [] });

  const matchedIds = new Set<string>();
  const matches: { match: any; item: MatchItem; index: number }[] = [];
  const unmatched: { item: MatchItem; index: number }[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    let found: any = null;

    // Try barcode match first
    if (item.barcode) {
      const barResult: any = await db.execute(
        sql`SELECT id, name, brand, barcode, image_url, verification_score, status FROM products WHERE barcode = ${item.barcode} LIMIT 1`,
      );
      found = asRows(barResult)[0];
    }

    // Fall back to name match
    if (!found && item.name) {
      found = await matchByName(item.name.trim());
    }

    if (found) {
      matchedIds.add(found.id);
      matches.push({ match: found, item, index: i });
    } else {
      unmatched.push({ item, index: i });
    }
  }

  return c.json({
    matches: matches.map(m => ({ ...m.match, _itemIndex: m.index })),
    unmatched: unmatched.map(u => u.item.name ?? u.item.barcode ?? ''),
    items: items,
  });
});
