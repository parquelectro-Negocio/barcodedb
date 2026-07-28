import { Hono } from 'hono';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, sql } from 'drizzle-orm';

export const productsRouter = new Hono();

const createSchema = z.object({
  barcode: z.string().min(1),
  name: z.string().min(1),
  brand: z.string().optional().default(''),
  sku: z.string().optional().default(''),
  color: z.string().optional().default(''),
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
    sku: body.sku,
    color: body.color,
    description: body.description,
    categoryId: body.categoryId ?? null,
    imageUrl: body.imageUrl,
    unit: body.unit,
    attributes: body.attributes,
  }).returning();

  // Generate aliases for matching
  const aliases: { productId: string; alias: string; source: string }[] = [
    { productId: product.id, alias: product.name, source: 'manual' },
  ];
  if (body.brand) {
    // Brand + rest without leading type keyword
    const typeKeywords = ['auricular','parlante','cable','notebook','monitor','mouse','teclado','celular','tablet','impresora','router','alfajor','galletita','bebida','cargador','funda','memoria','disco','protector'];
    const tokens = product.name.split(/\s+/);
    const withoutType = tokens.filter(t => !typeKeywords.includes(t.toLowerCase())).join(' ');
    if (withoutType && withoutType !== product.name) {
      aliases.push({ productId: product.id, alias: withoutType, source: 'ai' });
    }
  }
  if (aliases.length > 0) {
    await db.insert(schema.productAliases).values(aliases);
  }

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

const bulkSchema = z.object({
  name: z.string().min(1),
  barcode: z.string().optional().default(''),
  brand: z.string().optional().default(''),
  sku: z.string().optional().default(''),
  price: z.number().optional().default(0),
  stock: z.number().int().min(0).optional().default(0),
  cost: z.number().optional().default(0),
});

productsRouter.post('/bulk', async (c) => {
  const raw = await c.req.json();
  const parsed = z.object({
    products: z.array(bulkSchema).min(1).max(500),
    businessSlug: z.string().optional(),
  }).safeParse(raw);

  if (!parsed.success) {
    return c.json({ error: 'validation_error', details: parsed.error.flatten() }, 400);
  }

  const { products, businessSlug } = parsed.data;
  let business: any = null;

  if (businessSlug) {
    business = await db.query.businesses.findFirst({
      where: eq(schema.businesses.slug, businessSlug),
    });
    if (!business) return c.json({ error: 'business_not_found' }, 404);
  }

  const created: any[] = [];
  const errors: { index: number; name: string; error: string }[] = [];

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    try {
      const [product] = await db.insert(schema.products).values({
        barcode: p.barcode || 'unknown',
        name: p.name,
        brand: p.brand,
        sku: p.sku,
      }).returning();

      const aliases: { productId: string; alias: string; source: string }[] = [
        { productId: product.id, alias: product.name, source: 'manual' },
      ];
      if (p.brand) {
        const typeKeywords = ['auricular','parlante','cable','notebook','monitor','mouse','teclado','celular','tablet','impresora','router','alfajor','galletita','bebida','cargador','funda','memoria','disco','protector'];
        const tokens = product.name.split(/\s+/);
        const withoutType = tokens.filter(t => !typeKeywords.includes(t.toLowerCase())).join(' ');
        if (withoutType && withoutType !== product.name) {
          aliases.push({ productId: product.id, alias: withoutType, source: 'ai' });
        }
      }
      await db.insert(schema.productAliases).values(aliases);

      if (business && (p.price > 0 || p.stock > 0)) {
        await db.insert(schema.businessProducts).values({
          businessId: business.id,
          productId: product.id,
          stock: p.stock,
          price: String(p.price),
          cost: String(p.cost),
        }).onConflictDoUpdate({
          target: [schema.businessProducts.businessId, schema.businessProducts.productId],
          set: { stock: p.stock, price: String(p.price), cost: String(p.cost) },
        });
      }

      created.push(product);
    } catch (err: any) {
      errors.push({ index: i, name: p.name, error: err?.message ?? 'unknown error' });
    }
  }

  return c.json({ created, errors, total: products.length }, 201);
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
