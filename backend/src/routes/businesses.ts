import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '../middleware/zValidator';
import { db, schema } from '../db';
import { eq, and } from 'drizzle-orm';

export const businessesRouter = new Hono();

// Get business catalog
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

// Add product to business catalog
const addProductSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  sku: z.string().optional(),
  stock: z.number().int().min(0).optional(),
  cost: z.number().min(0).optional(),
  price: z.number().min(0),
});

businessesRouter.post('/:slug/products', zValidator('json', addProductSchema), async (c) => {
  const { slug } = c.req.param();
  const body = c.req.valid('json');
  const business = await db.query.businesses.findFirst({
    where: eq(schema.businesses.slug, slug),
  });
  if (!business) return c.json({ error: 'business_not_found' }, 404);

  const [bp] = await db.insert(schema.businessProducts).values({
    businessId: business.id,
    productId: body.productId,
    variantId: body.variantId ?? null,
    sku: body.sku ?? '',
    stock: body.stock ?? 0,
    cost: String(body.cost ?? 0),
    price: String(body.price),
  }).returning();

  return c.json(bp, 201);
});

// Update stock/price
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
