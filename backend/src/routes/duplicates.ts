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

// Detect likely duplicate groups by three high-precision signals: a near-identical
// name (same word set), a RARE model token shared within a brand (platform/spec
// tokens shared by many products are skipped), or an exact SKU. Heuristic — the
// moderator confirms before merging, so any stray grouping is just ignored.
duplicatesRouter.get('/candidates', async (c) => {
  const auth = requireAuth(c);
  if (!auth) return c.json({ error: 'auth_required' }, 401);
  if (!(await isModerator(auth.userId))) return c.json({ error: 'forbidden_moderator_only' }, 403);

  const r: any = await db.execute(sql`SELECT id, name, brand, barcode, sku, image_url FROM products`);
  const products = asRows(r);

  const norm = (s: string) => (s || '').toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const brandOf = (p: any) => norm(p.brand) || '_';

  // Colours make a variant a DIFFERENT product, so they must not be merged. The
  // model-token grouping keys on colour too, keeping "M280 Negro" and "M280 Azul" apart.
  const COLORS = new Set(['negro', 'negra', 'blanco', 'blanca', 'gris', 'azul', 'rojo', 'roja',
    'verde', 'amarillo', 'amarilla', 'rosa', 'rosado', 'rosada', 'violeta', 'celeste', 'naranja',
    'dorado', 'dorada', 'plateado', 'plateada', 'plata', 'marron', 'beige', 'turquesa', 'fucsia',
    'lila', 'bordo', 'camo', 'camuflado', 'transparente', 'multicolor', 'cian', 'magenta', 'purpura', 'morado']);
  const colorOf = (name: string) =>
    [...new Set(norm(name).split(' ').filter(t => COLORS.has(t)))].sort().join('-');

  // Capacity/measurement (16GB vs 32GB, 500ml vs 1L, 600W…) also makes a variant a
  // DIFFERENT product — same model in another size is not a duplicate.
  const specSig = (name: string) => {
    const m = norm(name).match(/\d+\s?(gb|tb|mb|kb|w|kw|kv|v|a|ma|mah|ah|wh|kwh|hz|khz|mhz|ghz|ml|l|cl|mm|cm|km|va|dpi|rpm|fps|pulg|in|nm|lm|db)\b/g) || [];
    return [...new Set(m.map(s => s.replace(/\s+/g, '')))].sort().join('-');
  };

  // Spec/platform tokens look like model codes (letter+digit) but describe an
  // attribute or compatibility, not the product itself.
  const isSpec = (t: string): boolean => {
    if (/^\d+(gb|tb|mb|kb|g|kg|mg|w|kw|v|kv|a|ma|mah|ah|wh|kwh|hz|khz|mhz|ghz|p|i|k|mm|cm|m|km|ml|l|nm|lm|lux|rpm|dpi|fps|bit|bits|pin|pines|awg|ohm|db|psi|mp)$/.test(t)) return true;
    if (/^(ddr\d|lpddr\d|usb\d|usbc|typec|cat\d|wifi\d|bt\d|hdmi\d|dp\d|pcie\d|pci|sata\d|nvme|gen\d|m2|rj\d+|awg\d+|lga\d+|am\d|ps\d|s\d{3,})$/.test(t)) return true;
    return false;
  };

  const parent = products.map((_: any, i: number) => i);
  const find = (x: number): number => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const union = (a: number, b: number) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };
  const unionAll = (idxs: number[]) => { for (let j = 1; j < idxs.length; j++) union(idxs[0], idxs[j]); };
  const push = (m: Map<string, number[]>, k: string, i: number) => { if (!m.has(k)) m.set(k, []); m.get(k)!.push(i); };

  // (a) Near-identical name: same set of normalized words → same product.
  const sigBuckets = new Map<string, number[]>();
  for (let i = 0; i < products.length; i++) {
    const words = norm(products[i].name).split(' ').filter(t => t.length >= 2);
    const sig = [...new Set(words)].sort().join(' ');
    if (sig) push(sigBuckets, sig, i);
  }
  for (const idxs of sigBuckets.values()) unionAll(idxs);

  // (b) Same RARE model token (letter+digit, not a spec) within a brand. Skipping
  // buckets shared by many products drops platform tokens (lga1700, ps4, s1700)
  // that would otherwise merge genuinely different products.
  const mtBuckets = new Map<string, number[]>();
  for (let i = 0; i < products.length; i++) {
    const b = brandOf(products[i]);
    const variant = colorOf(products[i].name) + '|' + specSig(products[i].name);
    for (const t of new Set(norm(products[i].name).split(' '))) {
      if (t.length >= 3 && /[a-z]/.test(t) && /\d/.test(t) && !isSpec(t)) push(mtBuckets, b + '|' + t + '|' + variant, i);
    }
  }
  for (const idxs of mtBuckets.values()) if (idxs.length <= 5) unionAll(idxs);

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
