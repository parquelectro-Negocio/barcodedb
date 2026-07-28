import { Hono } from 'hono';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, and, inArray } from 'drizzle-orm';
import { requireAuth } from '../middleware/user';

export const duplicatesRouter = new Hono();

duplicatesRouter.post('/report', async (c) => {
  const payload = requireAuth(c);
  if (!payload) return c.json({ error: 'unauthorized' }, 401);

  const raw = await c.req.json();
  const parsed = z.object({
    reportedId: z.string().uuid(),
    targetId: z.string().uuid(),
  }).safeParse(raw);

  if (!parsed.success) return c.json({ error: 'validation_error', details: parsed.error.flatten() }, 400);

  const { reportedId, targetId } = parsed.data;
  if (reportedId === targetId) return c.json({ error: 'cannot_report_self' }, 400);

  const existing = await db.query.duplicateReports.findFirst({
    where: and(
      eq(schema.duplicateReports.reportedId, reportedId),
      eq(schema.duplicateReports.status, 'pending'),
    ),
  });
  if (existing) return c.json({ error: 'already_reported' }, 409);

  const [report] = await db.insert(schema.duplicateReports).values({
    reportedId,
    targetId,
    reportedBy: payload.userId,
  }).returning();

  return c.json(report, 201);
});

duplicatesRouter.get('/', async (c) => {
  const status = c.req.query('status') || 'pending';
  const rows = await db.query.duplicateReports.findMany({
    where: eq(schema.duplicateReports.status, status),
    with: {
      reportedProduct: { columns: { id: true, name: true, barcode: true, brand: true } },
      targetProduct: { columns: { id: true, name: true, barcode: true, brand: true } },
    },
    orderBy: (r, { desc }) => desc(r.createdAt),
    limit: 50,
  });
  return c.json(rows);
});

duplicatesRouter.post('/:id/reject', async (c) => {
  const payload = requireAuth(c);
  if (!payload) return c.json({ error: 'unauthorized' }, 401);

  const { id } = c.req.param();
  const [updated] = await db.update(schema.duplicateReports)
    .set({ status: 'rejected', resolvedBy: payload.userId, resolvedAt: new Date() })
    .where(eq(schema.duplicateReports.id, id))
    .returning();
  if (!updated) return c.json({ error: 'not_found' }, 404);
  return c.json(updated);
});

duplicatesRouter.post('/:id/merge', async (c) => {
  const payload = requireAuth(c);
  if (!payload) return c.json({ error: 'unauthorized' }, 401);

  const { id } = c.req.param();
  const report = await db.query.duplicateReports.findFirst({
    where: and(eq(schema.duplicateReports.id, id), eq(schema.duplicateReports.status, 'pending')),
  });
  if (!report) return c.json({ error: 'not_found_or_already_resolved' }, 404);

  const { reportedId, targetId } = report;

  try {
    await db.transaction(async (tx) => {
      const bps = await tx.select().from(schema.businessProducts)
        .where(eq(schema.businessProducts.productId, reportedId));
      for (const bp of bps) {
        await tx.insert(schema.businessProducts).values({
          businessId: bp.businessId,
          productId: targetId,
          variantId: bp.variantId,
          sku: bp.sku,
          stock: bp.stock,
          cost: bp.cost,
          price: bp.price,
        }).onConflictDoUpdate({
          target: [schema.businessProducts.businessId, schema.businessProducts.productId],
          set: { stock: bp.stock, price: bp.price, cost: bp.cost },
        });
      }
      await tx.delete(schema.businessProducts)
        .where(eq(schema.businessProducts.productId, reportedId));

      await tx.update(schema.productAliases)
        .set({ productId: targetId })
        .where(eq(schema.productAliases.productId, reportedId));

      const votes = await tx.select().from(schema.productVotes)
        .where(eq(schema.productVotes.productId, reportedId));
      for (const v of votes) {
        await tx.insert(schema.productVotes).values({
          userId: v.userId,
          productId: targetId,
          vote: v.vote,
        }).onConflictDoNothing({ target: [schema.productVotes.userId, schema.productVotes.productId] });
      }
      await tx.delete(schema.productVotes)
        .where(eq(schema.productVotes.productId, reportedId));

      // Remove all FK refs to reportedId in duplicate_reports before deleting the product
      await tx.delete(schema.duplicateReports)
        .where(eq(schema.duplicateReports.reportedId, reportedId));

      await tx.update(schema.duplicateReports)
        .set({ targetId })
        .where(eq(schema.duplicateReports.targetId, reportedId));

      await tx.delete(schema.productVariants)
        .where(eq(schema.productVariants.productId, reportedId));
      await tx.delete(schema.products)
        .where(eq(schema.products.id, reportedId));
    });
  } catch (err: any) {
    return c.json({ error: 'merge_failed', message: err?.message ?? 'unknown' }, 500);
  }

  return c.json({ success: true, keptId: targetId, removedId: reportedId });
});
