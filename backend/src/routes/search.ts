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

  return c.json({ data: results, page, limit, query: q, brand, category });
});

searchRouter.get('/brands', async (c) => {
  const q = c.req.query('q')?.trim() ?? '';
  const results: any = await db.execute(
    sql`SELECT DISTINCT brand FROM products WHERE brand ILIKE ${`${q}%`} ORDER BY brand LIMIT 20`,
  );
  return c.json(results.rows.map((r: any) => r.brand));
});

// Import matching: takes names[], returns { matches, unmatched }
searchRouter.post('/match', async (c) => {
  const { names } = await c.req.json() as { names: string[] };
  if (!names?.length) return c.json({ matches: [], unmatched: [] });

  const matchedIds = new Set<string>();
  const matches: any[] = [];

  // Try exact match via aliases first, then ILIKE on name+brand
  for (const name of names) {
    const trimmed = name.trim();
    if (!trimmed) continue;

    let found: any[];

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
    found = aliasResult.rows ?? [];
    if (found.length > 0) {
      matchedIds.add(found[0].id);
      matches.push(found[0]);
      continue;
    }

    // 2. Name exact match (case-insensitive)
    const nameResult: any = await db.execute(
      sql`
        SELECT id, name, brand, barcode, image_url, verification_score, status
        FROM products
        WHERE LOWER(name) = LOWER(${trimmed})
        LIMIT 1
      `,
    );
    found = nameResult.rows ?? [];
    if (found.length > 0) {
      matchedIds.add(found[0].id);
      matches.push(found[0]);
      continue;
    }

    // 3. Name + brand fuzzy (contains both)
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) {
      const brandNames: any = await db.execute(
        sql`
          WITH possible_brands AS (
            SELECT DISTINCT brand FROM products
            WHERE LOWER(brand) = LOWER(${parts[0]})
            OR LOWER(brand) = LOWER(${parts[1]})
          )
          SELECT p.id, p.name, p.brand, p.barcode, p.image_url, p.verification_score, p.status
          FROM products p
          WHERE p.brand IN (SELECT brand FROM possible_brands)
            AND (${sql.join(parts.map(p => sql`LOWER(p.name) LIKE ${'%' + p.toLowerCase() + '%'}`), sql` AND `)})
          LIMIT 1
        `,
      );
      found = brandNames.rows ?? [];
      if (found.length > 0) {
        matchedIds.add(found[0].id);
        matches.push(found[0]);
        continue;
      }
    }

    // 4. ILIKE fallback (any part of name matches)
    const ilikeResult: any = await db.execute(
      sql`
        SELECT id, name, brand, barcode, image_url, verification_score, status
        FROM products
        WHERE LOWER(name) LIKE ${'%' + trimmed.toLowerCase() + '%'}
        LIMIT 1
      `,
    );
    found = ilikeResult.rows ?? [];
    if (found.length > 0) {
      matchedIds.add(found[0].id);
      matches.push(found[0]);
      continue;
    }
  }

  // Track which original names were matched
  const matchedLower = new Set(matches.map((m: any) => m.name?.toLowerCase()).filter(Boolean));
  const unmatched = names.filter(n => {
    const t = n.trim().toLowerCase();
    return t.length > 0 && !matchedLower.has(t);
  });

  return c.json({ matches, unmatched });
});
