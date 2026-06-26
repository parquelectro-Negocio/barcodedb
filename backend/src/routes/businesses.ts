import { Hono } from 'hono';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, and, sql, gte, lte, desc } from 'drizzle-orm';

export const businessesRouter = new Hono();

const addProductSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullable().optional(),
  sku: z.string().optional().default(''),
  stock: z.number().int().min(0).optional().default(0),
  cost: z.number().min(0).optional().default(0),
  price: z.number().min(0),
});

businessesRouter.post('/', async (c) => {
  const { slug, name, pin, pinHint } = await c.req.json();
  if (!slug || typeof slug !== 'string') return c.json({ error: 'slug_required' }, 400);
  const [biz] = await db.insert(schema.businesses).values({ slug, name: name || slug, pin: pin || null, pinHint: pinHint || null }).returning();
  return c.json(biz, 201);
});

businessesRouter.post('/:slug/verify-pin', async (c) => {
  const { slug } = c.req.param();
  const { pin } = await c.req.json();
  const business = await db.query.businesses.findFirst({ where: eq(schema.businesses.slug, slug) });
  if (!business) return c.json({ error: 'not_found' }, 404);
  if (!business.pin) return c.json({ ok: true });
  if (business.pin !== pin) return c.json({ error: 'pin_incorrecto', hint: business.pinHint || null }, 403);
  return c.json({ ok: true });
});

businessesRouter.get('/:slug/stats', async (c) => {
  const { slug } = c.req.param();
  const business = await db.query.businesses.findFirst({
    where: eq(schema.businesses.slug, slug),
  });
  if (!business) return c.json({ error: 'not_found' }, 404);

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(today);
  monthAgo.setMonth(monthAgo.getMonth() - 1);

  const bizId = business.id;

  const [todayAgg] = await db.execute(
    sql`SELECT COUNT(*)::int as count, COALESCE(SUM(total)::numeric, 0) as total FROM sales WHERE business_id = ${bizId} AND created_at >= ${today}`
  );
  const [weekAgg] = await db.execute(
    sql`SELECT COUNT(*)::int as count, COALESCE(SUM(total)::numeric, 0) as total FROM sales WHERE business_id = ${bizId} AND created_at >= ${weekAgo}`
  );
  const [monthAgg] = await db.execute(
    sql`SELECT COUNT(*)::int as count, COALESCE(SUM(total)::numeric, 0) as total FROM sales WHERE business_id = ${bizId} AND created_at >= ${monthAgo}`
  );

  const lowStock = await db.query.businessProducts.findMany({
    where: and(
      eq(schema.businessProducts.businessId, bizId),
      sql`stock > 0 AND stock <= 5`,
    ),
    with: { product: true },
    orderBy: [sql`stock ASC`],
    limit: 10,
  });

  const [totalProducts] = await db.execute(
    sql`SELECT COUNT(*)::int as count FROM business_products WHERE business_id = ${bizId}`
  );

  return c.json({
    today: todayAgg,
    week: weekAgg,
    month: monthAgg,
    lowStock: lowStock.map((bp: any) => ({
      id: bp.id,
      productName: bp.product.name,
      productId: bp.productId,
      barcode: bp.product.barcode,
      stock: bp.stock,
      price: bp.price,
    })),
    totalProducts: totalProducts.count,
  });
});

businessesRouter.get('/:slug', async (c) => {
  const { slug } = c.req.param();
  const business = await db.query.businesses.findFirst({
    where: eq(schema.businesses.slug, slug),
  });
  if (!business) return c.json({ error: 'not_found' }, 404);
  return c.json(business);
});

businessesRouter.get('/:slug/products', async (c) => {
  const { slug } = c.req.param();
  const business = await db.query.businesses.findFirst({
    where: eq(schema.businesses.slug, slug),
  });
  if (!business) return c.json({ error: 'not_found' }, 404);

  const products = await db.query.businessProducts.findMany({
    where: eq(schema.businessProducts.businessId, business.id),
    with: { product: { with: { category: true } } },
  });
  return c.json(products);
});

businessesRouter.post('/:slug/products', async (c) => {
  const { slug } = c.req.param();
  const raw = await c.req.json();
  const parsed = addProductSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: 'validation_error', details: parsed.error.flatten() }, 400);
  }

  const business = await db.query.businesses.findFirst({
    where: eq(schema.businesses.slug, slug),
  });
  if (!business) return c.json({ error: 'business_not_found' }, 404);

  const body = parsed.data;

  // Upsert: if product already exists for this business, update price/stock
  const existing = await db.query.businessProducts.findFirst({
    where: and(
      eq(schema.businessProducts.businessId, business.id),
      eq(schema.businessProducts.productId, body.productId),
    ),
  });

  if (existing) {
    const [bp] = await db.update(schema.businessProducts)
      .set({
        price: String(body.price),
        stock: body.stock,
        cost: String(body.cost),
        updatedAt: new Date(),
      })
      .where(eq(schema.businessProducts.id, existing.id))
      .returning();
    return c.json(bp);
  }

  const [bp] = await db.insert(schema.businessProducts).values({
    businessId: business.id,
    productId: body.productId,
    variantId: body.variantId ?? null,
    sku: body.sku,
    stock: body.stock,
    cost: String(body.cost),
    price: String(body.price),
  }).returning();

  return c.json(bp, 201);
});

businessesRouter.patch('/:slug/products/:id', async (c) => {
  const { slug, id } = c.req.param();
  const body = await c.req.json();

  const business = await db.query.businesses.findFirst({
    where: eq(schema.businesses.slug, slug),
  });
  if (!business) return c.json({ error: 'business_not_found' }, 404);

  const [updated] = await db.update(schema.businessProducts)
    .set(body)
    .where(
      and(
        eq(schema.businessProducts.id, id),
        eq(schema.businessProducts.businessId, business.id),
      ),
    )
    .returning();
  return c.json(updated);
});
