import { Hono } from 'hono';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, sql } from 'drizzle-orm';

export const productsRouter = new Hono();

const createSchema = z.object({
  barcode: z.string().min(1),
  name: z.string().min(1),
  brand: z.string().optional().default(''),
  description: z.string().optional().default(''),
  categoryId: z.string().uuid().nullable().optional(),
  imageUrl: z.string().optional().default(''),
  unit: z.string().optional().default('unidad'),
  attributes: z.record(z.any()).optional().default({}),
});

productsRouter.get('/:barcode', async (c) => {
  const { barcode } = c.req.param();
  const results = await db.query.products.findMany({
    where: eq(schema.products.barcode, barcode),
    orderBy: (p, { desc }) => desc(p.verificationScore),
    with: { category: true, variants: true },
  });
  if (results.length === 0) return c.json({ error: 'not_found' }, 404);
  return c.json({ products: results, conflict: results.length > 1 });
});

productsRouter.post('/', async (c) => {
  const raw = await c.req.json();
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: 'validation_error', details: parsed.error.flatten() }, 400);
  }

  const body = parsed.data;
  const [product] = await db.insert(schema.products).values({
    barcode: body.barcode,
    name: body.name,
    brand: body.brand,
    description: body.description,
    categoryId: body.categoryId ?? null,
    imageUrl: body.imageUrl,
    unit: body.unit,
    attributes: body.attributes,
  }).returning();

  return c.json(product, 201);
});

productsRouter.patch('/:id', async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const [updated] = await db.update(schema.products)
    .set({ ...body, updatedAt: sql`now()` })
    .where(eq(schema.products.id, id))
    .returning();
  if (!updated) return c.json({ error: 'not_found' }, 404);
  return c.json(updated);
});

productsRouter.get('/', async (c) => {
  const page = Math.max(1, parseInt(c.req.query('page') ?? '1'));
  const limit = Math.min(Math.max(1, parseInt(c.req.query('limit') ?? '20')), 100);
  const offset = (page - 1) * limit;

  const results = await db.query.products.findMany({
    limit, offset,
    orderBy: (p, { desc }) => desc(p.createdAt),
    with: { category: true },
  });
  return c.json({ data: results, page, limit });
});
