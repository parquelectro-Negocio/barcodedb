import { Hono } from 'hono';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, or, sql, and, ne } from 'drizzle-orm';
import { requireAuth } from '../middleware/user';
import { slugify } from '../lib/slug';

export const productsRouter = new Hono();

const createSchema = z.object({
  barcode: z.string().optional().default(''),
  name: z.string().min(1),
  brand: z.string().optional().default(''),
  sku: z.string().optional().default(''),
  color: z.string().optional().default(''),
  capacidad: z.string().optional().default(''),
  largo: z.string().optional().default(''),
  peso: z.string().optional().default(''),
  description: z.string().optional().default(''),
  categoryId: z.string().uuid().nullable().optional(),
  imageUrl: z.string().optional().default(''),
  unit: z.string().optional().default('unidad'),
  attributes: z.record(z.any()).optional().default({}),
});

productsRouter.get('/:identifier', async (c) => {
  const { identifier } = c.req.param();
  const results = await db.query.products.findMany({
    where: or(eq(schema.products.barcode, identifier), eq(schema.products.slug, identifier)),
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

  const auth = requireAuth(c);
  if (!auth) return c.json({ error: 'auth_required' }, 401);

  const body = parsed.data;
  const userId = auth.userId;

  const slugParts = [body.name, body.brand, body.color, body.capacidad, body.largo, body.peso].filter(Boolean);
  const slug = slugify(slugParts.join('-'));

  // If barcode exists, check if same product (slug match) or different product
  if (body.barcode) {
    const existing = await db.query.products.findMany({
      where: eq(schema.products.barcode, body.barcode),
      columns: { id: true, name: true, slug: true, brand: true },
    });
    if (existing.length > 0) {
      const same = existing.find(p => p.slug === slug);
      if (same) {
        return c.json({ existing: same, message: 'Este producto ya existe con ese código de barras.' }, 200);
      }
    }
  }

  const mergedAttrs = { ...body.attributes };
  if (body.capacidad) mergedAttrs.capacidad = body.capacidad;
  if (body.largo) mergedAttrs.largo = body.largo;
  if (body.peso) mergedAttrs.peso = body.peso;

  const [product] = await db.insert(schema.products).values({
    barcode: body.barcode,
    slug,
    name: body.name,
    brand: body.brand,
    sku: body.sku,
    color: body.color,
    description: body.description,
    categoryId: body.categoryId ?? null,
    imageUrl: body.imageUrl,
    unit: body.unit,
    attributes: mergedAttrs,
    createdBy: userId,
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
  const auth = requireAuth(c);
  if (!auth) return c.json({ error: 'auth_required' }, 401);

  const { capacidad, largo, peso, ...rest } = await c.req.json();

  // Fetch current product for auth check
  const current = await db.query.products.findFirst({
    where: eq(schema.products.id, id),
    columns: { id: true, createdBy: true, status: true, barcode: true },
  });
  if (!current) return c.json({ error: 'not_found' }, 404);

  const isCreator = current.createdBy === auth.userId;

  // Verified products: only the creator can edit
  if (current.status === 'verified' && !isCreator) {
    return c.json({ error: 'Producto verificado — solo el creador puede editarlo. Si encontraste un error, usa el botón Reportar.' }, 403);
  }

  // Check barcode uniqueness if changing it
  if (rest.barcode !== undefined && rest.barcode !== current.barcode) {
    const existing = await db.query.products.findFirst({
      where: and(eq(schema.products.barcode, rest.barcode), ne(schema.products.id, id)),
    });
    if (existing) return c.json({ error: 'Ese código de barras ya está registrado en otro producto.' }, 409);
  }

  const updates: Record<string, any> = { updatedAt: new Date() };

  for (const [k, v] of Object.entries(rest)) {
    if (v !== undefined) updates[k] = v;
  }

  if (rest.name) {
    const slugParts = [rest.name, rest.brand, rest.color, capacidad, largo, peso].filter(Boolean);
    updates.slug = slugify(slugParts.join('-'));
  }

  if (capacidad || largo || peso) {
    const existing = await db.query.products.findFirst({
      where: eq(schema.products.id, id),
      columns: { attributes: true },
    });
    const attrs = { ...((existing?.attributes || {}) as Record<string, string>) };
    if (capacidad) attrs.capacidad = capacidad;
    if (largo) attrs.largo = largo;
    if (peso) attrs.peso = peso;
    updates.attributes = attrs;
  }

  // Non-creator editing a pending product: reset verification, transfer ownership
  if (!isCreator) {
    updates.verificationScore = 0;
    updates.status = 'pending';
    updates.createdBy = auth.userId;
  }

  const [updated] = await db.update(schema.products)
    .set(updates)
    .where(eq(schema.products.id, id))
    .returning();
  if (!updated) return c.json({ error: 'not_found' }, 404);
  return c.json(updated);
});

const bulkSchema = z.object({
  name: z.string().min(1),
  barcode: z.string().optional().default(''),
  brand: z.string().optional().default(''),
  category: z.string().optional().default(''),
  sku: z.string().optional().default(''),
  color: z.string().optional().default(''),
  capacidad: z.string().optional().default(''),
  largo: z.string().optional().default(''),
  peso: z.string().optional().default(''),
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

  const auth = requireAuth(c);
  if (!auth) return c.json({ error: 'auth_required' }, 401);

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

  const userId = auth.userId;

  // Resolve import category text -> category_id against the existing tree.
  // No match means no category (we never auto-create categories from imports).
  const allCats = await db.query.categories.findMany({ columns: { id: true, name: true, slug: true } });
  const catByKey = new Map<string, string>();
  for (const cat of allCats) {
    catByKey.set(cat.name.toLowerCase().trim(), cat.id);
    catByKey.set(cat.slug.toLowerCase().trim(), cat.id);
  }
  const resolveCategory = (text?: string): string | null =>
    text ? (catByKey.get(text.toLowerCase().trim()) ?? null) : null;

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    try {
      const slugParts = [p.name, p.brand, p.color, p.capacidad, p.largo, p.peso].filter(Boolean);
      const slug = slugify(slugParts.join('-'));

      let product: any = null;

      if (p.barcode) {
        const withBc = await db.query.products.findMany({
          where: eq(schema.products.barcode, p.barcode),
          columns: { id: true, slug: true },
        });
        const match = withBc.find((e: any) => e.slug === slug);
        if (match) {
          product = await db.query.products.findFirst({ where: eq(schema.products.id, match.id) });
        }
      } else {
        product = await db.query.products.findFirst({ where: eq(schema.products.slug, slug) });
      }

      if (product) {
      } else {
        const attrs: Record<string, string> = {};
        if (p.capacidad) attrs.capacidad = p.capacidad;
        if (p.largo) attrs.largo = p.largo;
        if (p.peso) attrs.peso = p.peso;

        const [created] = await db.insert(schema.products).values({
          barcode: p.barcode || '',
          slug,
          name: p.name,
          brand: p.brand,
          sku: p.sku,
          color: p.color,
          categoryId: resolveCategory(p.category),
          attributes: attrs,
          createdBy: userId,
        }).returning();
        product = created;

        const aliasList: { productId: string; alias: string; source: string }[] = [
          { productId: product.id, alias: product.name, source: 'manual' },
        ];
        if (p.brand) {
          const typeKeywords = ['auricular','parlante','cable','notebook','monitor','mouse','teclado','celular','tablet','impresora','router','alfajor','galletita','bebida','cargador','funda','memoria','disco','protector'];
          const tokens = product.name.split(/\s+/);
          const withoutType = tokens.filter((t: string) => !typeKeywords.includes(t.toLowerCase())).join(' ');
          if (withoutType && withoutType !== product.name) {
            aliasList.push({ productId: product.id, alias: withoutType, source: 'ai' });
          }
        }
        await db.insert(schema.productAliases).values(aliasList);
      }

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
    orderBy: (p, { asc }) => asc(p.name),
    with: { category: true },
  });
  return c.json({ data: results, page, limit });
});
