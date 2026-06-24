import { Hono } from 'hono';
import { db, schema } from '../db';
import { like, or, and, sql, eq } from 'drizzle-orm';

export const searchRouter = new Hono();

searchRouter.get('/', async (c) => {
  const q = c.req.query('q')?.trim();
  const brand = c.req.query('brand')?.trim();
  const category = c.req.query('category')?.trim();
  const page = parseInt(c.req.query('page') ?? '1');
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20'), 100);
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

// Distinct brands for autocomplete
searchRouter.get('/brands', async (c) => {
  const q = c.req.query('q')?.trim() ?? '';
  const results = await db.execute(
    sql`SELECT DISTINCT brand FROM products WHERE brand ILIKE ${`${q}%`} ORDER BY brand LIMIT 20`,
  );
  return c.json(results.rows.map((r: any) => r.brand));
});

// Import matching: takes an array of product names, returns matches
searchRouter.post('/match', async (c) => {
  const { names } = await c.req.json() as { names: string[] };
  if (!names?.length) return c.json({ matches: [] });

  // Try to match by alias first, then by name similarity
  const placeholders = names.map((_, i) => `$${i + 1}`).join(', ');
  const results = await db.execute(
    sql`
      SELECT p.*, pa.alias as matched_alias
      FROM products p
      JOIN product_aliases pa ON pa.product_id = p.id
      WHERE LOWER(pa.alias) IN (${sql.join(names.map(n => n.toLowerCase()), sql`, `)})
      OR LOWER(p.name) IN (${sql.join(names.map(n => n.toLowerCase()), sql`, `)})
    `,
  );

  return c.json({ matches: results.rows });
});
