import { Hono } from 'hono';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, and, sql } from 'drizzle-orm';
import { requireAuth, isModerator } from '../middleware/user';

export const duplicatesRouter = new Hono();

function asRows(r: any): any[] {
  return Array.isArray(r) ? r : (r?.rows ?? []);
}

// Merge `removeId` INTO `keepId`: move inventory / aliases / votes to the kept
// product, then delete the removed one. Runs inside the given transaction.
async function mergeInto(tx: any, removeId: string, keepId: string) {
  const bps = await tx.select().from(schema.businessProducts)
    .where(eq(schema.businessProducts.productId, removeId));
  for (const bp of bps) {
    await tx.insert(schema.businessProducts).values({
      businessId: bp.businessId,
      productId: keepId,
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
    .where(eq(schema.businessProducts.productId, removeId));

  await tx.update(schema.productAliases)
    .set({ productId: keepId })
    .where(eq(schema.productAliases.productId, removeId));

  const votes = await tx.select().from(schema.productVotes)
    .where(eq(schema.productVotes.productId, removeId));
  for (const v of votes) {
    await tx.insert(schema.productVotes).values({
      userId: v.userId,
      productId: keepId,
      vote: v.vote,
    }).onConflictDoNothing({ target: [schema.productVotes.userId, schema.productVotes.productId] });
  }
  await tx.delete(schema.productVotes)
    .where(eq(schema.productVotes.productId, removeId));

  // Clear FK refs in duplicate_reports before deleting the product.
  await tx.delete(schema.duplicateReports)
    .where(eq(schema.duplicateReports.reportedId, removeId));
  await tx.update(schema.duplicateReports)
    .set({ targetId: keepId })
    .where(eq(schema.duplicateReports.targetId, removeId));

  await tx.delete(schema.productVariants)
    .where(eq(schema.productVariants.productId, removeId));
  await tx.delete(schema.products)
    .where(eq(schema.products.id, removeId));
}

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
  const auth = requireAuth(c);
  if (!auth) return c.json({ error: 'auth_required' }, 401);
  if (!(await isModerator(auth.userId))) return c.json({ error: 'forbidden_moderator_only' }, 403);

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
  if (!(await isModerator(payload.userId))) return c.json({ error: 'forbidden_moderator_only' }, 403);

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
  if (!(await isModerator(payload.userId))) return c.json({ error: 'forbidden_moderator_only' }, 403);

  const { id } = c.req.param();
  const report = await db.query.duplicateReports.findFirst({
    where: and(eq(schema.duplicateReports.id, id), eq(schema.duplicateReports.status, 'pending')),
  });
  if (!report) return c.json({ error: 'not_found_or_already_resolved' }, 404);

  const { reportedId, targetId } = report;

  try {
    await db.transaction(async (tx) => { await mergeInto(tx, reportedId, targetId); });
  } catch (err: any) {
    return c.json({ error: 'merge_failed', message: err?.message ?? 'unknown' }, 500);
  }

  return c.json({ success: true, keptId: targetId, removedId: reportedId });
});

// Direct merge for the moderator dedupe panel — no report needed.
duplicatesRouter.post('/merge', async (c) => {
  const auth = requireAuth(c);
  if (!auth) return c.json({ error: 'unauthorized' }, 401);
  if (!(await isModerator(auth.userId))) return c.json({ error: 'forbidden_moderator_only' }, 403);

  const parsed = z.object({
    keepId: z.string().uuid(),
    removeId: z.string().uuid(),
  }).safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'validation_error', details: parsed.error.flatten() }, 400);

  const { keepId, removeId } = parsed.data;
  if (keepId === removeId) return c.json({ error: 'cannot_merge_self' }, 400);

  try {
    await db.transaction(async (tx) => { await mergeInto(tx, removeId, keepId); });
  } catch (err: any) {
    return c.json({ error: 'merge_failed', message: err?.message ?? 'unknown' }, 500);
  }
  return c.json({ success: true, keptId: keepId, removedId: removeId });
});

// Detect likely duplicate groups by three HIGH-PRECISION signals only: a
// near-identical name (identical set of words), the same EAN ignoring leading
// zeros (UPC vs EAN-13 of one product), or an exact SKU. Deliberately NO fuzzy /
// shared-token grouping: in this catalog one token distinguishes real products,
// so similarity grouping produced mass false positives. The moderator still
// confirms before merging.
duplicatesRouter.get('/candidates', async (c) => {
  const auth = requireAuth(c);
  if (!auth) return c.json({ error: 'auth_required' }, 401);
  if (!(await isModerator(auth.userId))) return c.json({ error: 'forbidden_moderator_only' }, 403);

  const r: any = await db.execute(sql`SELECT id, name, brand, barcode, sku, image_url FROM products`);
  const products = asRows(r);

  const norm = (s: string) => (s || '').toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const parent = products.map((_: any, i: number) => i);
  const find = (x: number): number => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const union = (a: number, b: number) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };
  const unionAll = (idxs: number[]) => { for (let j = 1; j < idxs.length; j++) union(idxs[0], idxs[j]); };
  const push = (m: Map<string, number[]>, k: string, i: number) => { if (!m.has(k)) m.set(k, []); m.get(k)!.push(i); };

  // (a) Same word set AND same SKU. Word set alone over-groups variants that share
  // a name but differ only in SKU (RTX5060TI 8G vs 16G, "1 pack" vs "3 pack"), so
  // key on the SKU too. Keep single-digit tokens (the 1/2/3 in "N pack") that a
  // length>=2 filter would drop and merge distinct packs.
  const normSku = (s: string) => norm(s).replace(/\s+/g, '');
  const sigBuckets = new Map<string, number[]>();
  for (let i = 0; i < products.length; i++) {
    const words = norm(products[i].name).split(' ').filter(t => t.length >= 2 || /^\d+$/.test(t));
    const sig = [...new Set(words)].sort().join(' ');
    if (sig) push(sigBuckets, sig + '|' + normSku(products[i].sku), i);
  }
  for (const idxs of sigBuckets.values()) unionAll(idxs);

  // (b) Same EAN ignoring leading zeros — a UPC-11/12 and the EAN-13 of the SAME
  // product (suppliers pad differently). High precision: identical GTIN.
  // A model-token heuristic used to live here but was REMOVED: in this domain a
  // single token distinguishes real products (X870E vs B760M, DDR4 vs DDR5,
  // 1TB vs 2TB), so token similarity grouped distinct products as duplicates.
  const eanBuckets = new Map<string, number[]>();
  for (let i = 0; i < products.length; i++) {
    const ean = String(products[i].barcode || '').replace(/\D/g, '').replace(/^0+/, '');
    if (ean.length >= 8) push(eanBuckets, ean, i);
  }
  for (const idxs of eanBuckets.values()) unionAll(idxs);

  // (c) Exact SKU.
  const skuBuckets = new Map<string, number[]>();
  for (let i = 0; i < products.length; i++) {
    const sku = norm(products[i].sku).replace(/\s+/g, '');
    if (sku.length >= 4) push(skuBuckets, sku, i);
  }
  for (const idxs of skuBuckets.values()) unionAll(idxs);

  const byRoot = new Map<number, any[]>();
  for (let i = 0; i < products.length; i++) {
    const root = find(i);
    if (!byRoot.has(root)) byRoot.set(root, []);
    byRoot.get(root)!.push(products[i]);
  }

  const groups = [...byRoot.values()]
    .filter(g => g.length >= 2 && g.length <= 15) // huge groups are almost always false
    .map(g => g.map(p => ({ id: p.id, name: p.name, brand: p.brand, barcode: p.barcode, sku: p.sku, imageUrl: p.image_url })))
    .sort((a, b) => b.length - a.length)
    .slice(0, 100);

  return c.json({ groups });
});
