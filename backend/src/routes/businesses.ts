import { Hono } from 'hono';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, and } from 'drizzle-orm';

export const businessesRouter = new Hono();

const addProductSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullable().optional(),
  sku: z.string().optional().default(''),
  stock: z.number().int().min(0).optional().default(0),
  cost: z.number().min(0).optional().default(0),
  price: z.number().min(0),
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
