import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, and, sql } from 'drizzle-orm';
import { requireAuth } from '../middleware/user';
import { slugify } from '../lib/slug';

export const businessesRouter = new Hono();

const addProductSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullable().optional(),
  sku: z.string().optional().default(''),
  stock: z.number().int().min(0).optional().default(0),
  cost: z.number().min(0).optional().default(0),
  price: z.number().min(0),
});

// Whitelisted, typed fields for inventory edits — prevents mass assignment.
const patchProductSchema = z.object({
  sku: z.string().optional(),
  stock: z.number().int().min(0).optional(),
  price: z.union([z.string(), z.number()]).optional(),
  cost: z.union([z.string(), z.number()]).optional(),
}).strict();

const updateBusinessSchema = z.object({
  name: z.string().min(1).optional(),
  sectors: z.array(z.string()).optional(),
  logoUrl: z.string().url().or(z.literal('')).optional(),
  defaultMargin: z.number().min(0).max(100000).optional(),
}).strict();

type OwnedBusiness =
  | { ok: true; business: typeof schema.businesses.$inferSelect; userId: string }
  | { ok: false; status: 401 | 403 | 404; error: string };

// Load a business by slug and assert the authenticated caller owns it.
// The commercial layer (stock, prices, costs, sales) is private per owner.
async function requireOwnedBusiness(c: Context, slug: string): Promise<OwnedBusiness> {
  const auth = requireAuth(c);
  if (!auth) return { ok: false, status: 401, error: 'auth_required' };

  const business = await db.query.businesses.findFirst({
    where: eq(schema.businesses.slug, slug),
  });
  if (!business) return { ok: false, status: 404, error: 'not_found' };
  if (business.ownerId !== auth.userId) return { ok: false, status: 403, error: 'forbidden' };

  return { ok: true, business, userId: auth.userId };
}

// Create a business owned by the authenticated user
businessesRouter.post('/', async (c) => {
  const auth = requireAuth(c);
  if (!auth) return c.json({ error: 'auth_required' }, 401);

  const parsed = z.object({
    name: z.string().min(1),
    slug: z.string().optional(),
    sectors: z.array(z.string()).optional(),
  }).safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'validation_error', details: parsed.error.flatten() }, 400);

  const name = parsed.data.name.trim();
  const slug = slugify(parsed.data.slug || name);
  if (!slug) return c.json({ error: 'slug_required' }, 400);

  const existing = await db.query.businesses.findFirst({ where: eq(schema.businesses.slug, slug) });
  if (existing) return c.json({ error: 'slug_taken' }, 409);

  const [biz] = await db.insert(schema.businesses)
    .values({ slug, name, ownerId: auth.userId, sectors: parsed.data.sectors ?? [] })
    .returning();
  return c.json(biz, 201);
});

// The authenticated user's own businesses (loaded from the account, not localStorage).
// Registered before /:slug so "mine" isn't treated as a slug.
businessesRouter.get('/mine', async (c) => {
  const auth = requireAuth(c);
  if (!auth) return c.json({ error: 'auth_required' }, 401);
  const mine = await db.query.businesses.findMany({
    where: eq(schema.businesses.ownerId, auth.userId),
    orderBy: (b, { asc }) => asc(b.createdAt),
  });
  return c.json(mine);
});

businessesRouter.get('/:slug/stats', async (c) => {
  const owned = await requireOwnedBusiness(c, c.req.param('slug'));
  if (!owned.ok) return c.json({ error: owned.error }, owned.status);
  const bizId = owned.business.id;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(today);
  monthAgo.setMonth(monthAgo.getMonth() - 1);

  const [todayAgg] = await db.execute(
    sql`SELECT COUNT(*)::int as count, COALESCE(SUM(total)::numeric, 0) as total FROM sales WHERE business_id = ${bizId} AND created_at >= ${today.toISOString()}`
  );
  const [weekAgg] = await db.execute(
    sql`SELECT COUNT(*)::int as count, COALESCE(SUM(total)::numeric, 0) as total FROM sales WHERE business_id = ${bizId} AND created_at >= ${weekAgo.toISOString()}`
  );
  const [monthAgg] = await db.execute(
    sql`SELECT COUNT(*)::int as count, COALESCE(SUM(total)::numeric, 0) as total FROM sales WHERE business_id = ${bizId} AND created_at >= ${monthAgo.toISOString()}`
  );

  // Estimated profit per period: (sale price − current product cost) × qty.
  // Uses the product's CURRENT cost (sale-time cost isn't stored), so it's an
  // estimate; it's only meaningful for products that have a cost loaded.
  // Wrapped so a profit-calc failure never breaks the whole dashboard.
  let profit = { today: '0', week: '0', month: '0' };
  try {
    const [profitAgg]: any = await db.execute(
      sql`SELECT
            COALESCE(SUM(CASE WHEN s.created_at >= ${today.toISOString()}    THEN (si.unit_price - bp.cost) * si.quantity END)::numeric, 0) AS today,
            COALESCE(SUM(CASE WHEN s.created_at >= ${weekAgo.toISOString()}  THEN (si.unit_price - bp.cost) * si.quantity END)::numeric, 0) AS week,
            COALESCE(SUM(CASE WHEN s.created_at >= ${monthAgo.toISOString()} THEN (si.unit_price - bp.cost) * si.quantity END)::numeric, 0) AS month
          FROM sales s
          JOIN sale_items si ON si.sale_id = s.id
          JOIN business_products bp ON bp.id = si.business_product_id
          WHERE s.business_id = ${bizId} AND s.created_at >= ${monthAgo.toISOString()}`
    );
    profit = { today: profitAgg.today, week: profitAgg.week, month: profitAgg.month };
  } catch (err) {
    console.error(`[stats] profit query failed for ${bizId}:`, err);
  }

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
    profit,
    lowStock: lowStock.map((bp: any) => ({
      id: bp.id,
      productName: bp.product.name,
      productId: bp.productId,
      barcode: bp.product.barcode,
      slug: bp.product.slug,
      stock: bp.stock,
      price: bp.price,
    })),
    totalProducts: totalProducts.count,
  });
});

businessesRouter.get('/:slug', async (c) => {
  const owned = await requireOwnedBusiness(c, c.req.param('slug'));
  if (!owned.ok) return c.json({ error: owned.error }, owned.status);
  return c.json(owned.business);
});

// Update the business (name / sectors) — owner only.
businessesRouter.patch('/:slug', async (c) => {
  const owned = await requireOwnedBusiness(c, c.req.param('slug'));
  if (!owned.ok) return c.json({ error: owned.error }, owned.status);

  const parsed = updateBusinessSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'validation_error', details: parsed.error.flatten() }, 400);
  }

  const updates: Record<string, any> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.sectors !== undefined) updates.sectors = parsed.data.sectors;
  if (parsed.data.logoUrl !== undefined) updates.logoUrl = parsed.data.logoUrl;
  if (parsed.data.defaultMargin !== undefined) updates.defaultMargin = String(parsed.data.defaultMargin);
  if (Object.keys(updates).length === 0) return c.json(owned.business);

  const [updated] = await db.update(schema.businesses)
    .set(updates)
    .where(eq(schema.businesses.id, owned.business.id))
    .returning();
  return c.json(updated);
});

businessesRouter.get('/:slug/products', async (c) => {
  const owned = await requireOwnedBusiness(c, c.req.param('slug'));
  if (!owned.ok) return c.json({ error: owned.error }, owned.status);

  const products = await db.query.businessProducts.findMany({
    where: eq(schema.businessProducts.businessId, owned.business.id),
    with: { product: { with: { category: true } } },
  });
  return c.json(products);
});

businessesRouter.post('/:slug/products', async (c) => {
  const owned = await requireOwnedBusiness(c, c.req.param('slug'));
  if (!owned.ok) return c.json({ error: owned.error }, owned.status);

  const parsed = addProductSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'validation_error', details: parsed.error.flatten() }, 400);
  }
  const body = parsed.data;

  // Upsert: if product already exists for this business, update price/stock
  const existing = await db.query.businessProducts.findFirst({
    where: and(
      eq(schema.businessProducts.businessId, owned.business.id),
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
    businessId: owned.business.id,
    productId: body.productId,
    variantId: body.variantId ?? null,
    sku: body.sku,
    stock: body.stock,
    cost: String(body.cost),
    price: String(body.price),
  }).returning();

  return c.json(bp, 201);
});

const applyMarginSchema = z.object({ margin: z.number().min(0).max(100000) });

// Opt-in bulk repricing: recompute price = cost × (1 + margin%) for EVERY product
// in this shop that has a cost loaded. Explicit, owner-triggered, and destructive
// to current prices — the UI must confirm before calling. Products without a cost
// (cost = 0) are left untouched, since there's nothing to derive a price from.
businessesRouter.post('/:slug/products/apply-margin', async (c) => {
  const owned = await requireOwnedBusiness(c, c.req.param('slug'));
  if (!owned.ok) return c.json({ error: owned.error }, owned.status);

  const parsed = applyMarginSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'validation_error', details: parsed.error.flatten() }, 400);
  }
  const factor = 1 + parsed.data.margin / 100;

  const rows: any = await db.execute(sql`
    UPDATE business_products
    SET price = ROUND(cost * ${factor}, 2), updated_at = now()
    WHERE business_id = ${owned.business.id} AND cost > 0
    RETURNING id
  `);
  const arr = Array.isArray(rows) ? rows : (rows?.rows ?? []);
  return c.json({ updated: arr.length });
});

businessesRouter.patch('/:slug/products/:id', async (c) => {
  const { slug, id } = c.req.param();
  const owned = await requireOwnedBusiness(c, slug);
  if (!owned.ok) return c.json({ error: owned.error }, owned.status);

  const parsed = patchProductSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'validation_error', details: parsed.error.flatten() }, 400);
  }

  const updates: Record<string, any> = { updatedAt: new Date() };
  if (parsed.data.sku !== undefined) updates.sku = parsed.data.sku;
  if (parsed.data.stock !== undefined) updates.stock = parsed.data.stock;
  if (parsed.data.price !== undefined) updates.price = String(parsed.data.price);
  if (parsed.data.cost !== undefined) updates.cost = String(parsed.data.cost);

  const [updated] = await db.update(schema.businessProducts)
    .set(updates)
    .where(
      and(
        eq(schema.businessProducts.id, id),
        eq(schema.businessProducts.businessId, owned.business.id),
      ),
    )
    .returning();
  if (!updated) return c.json({ error: 'not_found' }, 404);
  return c.json(updated);
});
