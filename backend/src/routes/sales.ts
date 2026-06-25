import { Hono } from 'hono';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, inArray, sql } from 'drizzle-orm';

export const salesRouter = new Hono();

const createSaleSchema = z.object({
  businessId: z.string().uuid(),
  items: z.array(z.object({
    businessProductId: z.string().uuid(),
    quantity: z.number().int().min(1),
  })).min(1),
  paymentMethod: z.enum(['efectivo', 'transferencia', 'otro']).optional(),
  amountTendered: z.number().min(0).optional(),
});

// Create a sale (deducts stock)
salesRouter.post('/', async (c) => {
  const raw = await c.req.json();
  const parsed = createSaleSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: 'validation_error', details: parsed.error.flatten() }, 400);
  }

  const { businessId, items, paymentMethod, amountTendered } = parsed.data;

  // Verify business exists
  const business = await db.query.businesses.findFirst({
    where: eq(schema.businesses.id, businessId),
  });
  if (!business) return c.json({ error: 'business_not_found' }, 404);

  // Fetch all business products with prices
  const bpIds = items.map(i => i.businessProductId);
  const bpResults: any[] = await db.query.businessProducts.findMany({
    where: inArray(schema.businessProducts.id, bpIds),
    with: { product: true },
  });

  const bpMap = new Map(bpResults.map(bp => [bp.id, bp]));

  let total = 0;
  const saleItems: { businessProductId: string; quantity: number; unitPrice: string; total: string }[] = [];

  for (const item of items) {
    const bp = bpMap.get(item.businessProductId);
    if (!bp) return c.json({ error: `product_not_found: ${item.businessProductId}` }, 404);
    if (bp.stock < item.quantity) {
      return c.json({
        error: 'insufficient_stock',
        product: bp.product.name,
        stock: bp.stock,
        requested: item.quantity,
      }, 400);
    }

    const itemTotal = parseFloat(bp.price) * item.quantity;
    total += itemTotal;

    saleItems.push({
      businessProductId: bp.id,
      quantity: item.quantity,
      unitPrice: bp.price,
      total: String(itemTotal),
    });
  }

  // Create sale + items in a transaction
  const change = paymentMethod === 'efectivo' && amountTendered ? String(amountTendered - total) : null;
  const [sale] = await db.transaction(async (tx) => {
    const [s] = await tx.insert(schema.sales).values({
      businessId,
      total: String(total),
      paymentMethod: paymentMethod ?? null,
      amountTendered: amountTendered ? String(amountTendered) : null,
      change,
    }).returning();

    for (const si of saleItems) {
      await tx.insert(schema.saleItems).values({
        saleId: s.id,
        businessProductId: si.businessProductId,
        quantity: si.quantity,
        unitPrice: si.unitPrice,
        total: si.total,
      });

      // Deduct stock
      await tx.execute(
        sql`UPDATE business_products SET stock = stock - ${si.quantity}, updated_at = now() WHERE id = ${si.businessProductId}`,
      );
    }

    return [s];
  });

  return c.json({ sale, items: saleItems }, 201);
});

// List sales for a business
salesRouter.get('/', async (c) => {
  const businessId = c.req.query('businessId');
  const limit = Math.min(Math.max(1, parseInt(c.req.query('limit') ?? '20')), 100);
  const offset = Math.max(0, parseInt(c.req.query('offset') ?? '0'));

  const where = businessId ? eq(schema.sales.businessId, businessId!) : undefined;
  const results: any = await db.query.sales.findMany({
    where,
    limit, offset,
    orderBy: (s, { desc }) => desc(s.createdAt),
    with: {
      items: {
        with: {
          businessProduct: {
            with: { product: true },
          },
        },
      },
    },
  });

  return c.json(results);
});

// Get single sale
salesRouter.get('/:id', async (c) => {
  const { id } = c.req.param();
  const sale: any = await db.query.sales.findFirst({
    where: eq(schema.sales.id, id),
    with: {
      items: {
        with: {
          businessProduct: {
            with: { product: true },
          },
        },
      },
    },
  });
  if (!sale) return c.json({ error: 'not_found' }, 404);
  return c.json(sale);
});
