// ELIT catalog ingest. Pulls pages from the ELIT API, maps each product to
// identity-only (see elit.ts), and upserts into the global base keyed by EAN.
//
// Safety rules baked in:
//  - EAN is the merge key. A product with no EAN is SKIPPED, never merged by name.
//  - Merge is fill-empty-only: an existing non-empty field is NEVER overwritten
//    (protects names/images a human curated). Conflicts are left to moderation.
//  - New products land as status 'pending' (staging), not auto-verified.
//  - Prices/stock never touched — mapElitProduct already dropped them.

import { db, schema } from '../db';
import { eq, and } from 'drizzle-orm';
import { slugify } from './slug';
import { categorize } from './categorize';
import { fetchElitPage, mapElitProduct, type MappedProduct } from './elit';

export interface ElitSyncOptions {
  limit?: number;     // page size, max 100
  maxPages?: number;  // how many pages this call processes (resumable)
  offset?: number;    // starting offset
  since?: string;     // 'YYYY-MM-DD HH:MM' incremental sync
  store?: string;
}

export interface ElitSyncReport {
  fetched: number;
  inserted: number;
  updated: number;
  skippedNoEan: number;
  errors: number;
  total: number;      // total products ELIT reports for this query
  nextOffset: number; // pass back as `offset` to continue
  done: boolean;
}

type CategoryResolver = (name: string) => string | null;

async function buildCategoryResolver(): Promise<CategoryResolver> {
  const cats = await db.query.categories.findMany({ columns: { id: true, name: true, slug: true } });
  const byKey = new Map<string, string>();
  for (const c of cats) {
    byKey.set(c.name.toLowerCase().trim(), c.id);
    byKey.set(c.slug.toLowerCase().trim(), c.id);
  }
  return (name: string) => byKey.get(categorize(name) ?? '') ?? null;
}

const PRODUCT_COLS = { id: true, name: true, brand: true, sku: true, imageUrl: true, attributes: true, categoryId: true } as const;

// Find a product this source already created, keyed by (source, source_id). Used
// for barcode-less products: ELIT's own id is a safe within-provider key, so they
// stay idempotent without ever name-merging.
async function findBySource(m: MappedProduct) {
  if (!m.sourceId) return undefined;
  const src = await db.query.productSources.findFirst({
    where: and(eq(schema.productSources.source, m.source), eq(schema.productSources.sourceId, m.sourceId)),
    columns: { productId: true },
  });
  if (!src) return undefined;
  return db.query.products.findFirst({ where: eq(schema.products.id, src.productId), columns: PRODUCT_COLS });
}

// Upsert one mapped product. Products WITH an EAN are matched by barcode (cross-
// provider dedup); barcode-less products are matched by (source, source_id).
async function upsertProduct(m: MappedProduct, resolveCategory: CategoryResolver): Promise<'inserted' | 'updated'> {
  const existing = m.barcode
    ? await db.query.products.findFirst({ where: eq(schema.products.barcode, m.barcode), columns: PRODUCT_COLS })
    : await findBySource(m);

  if (!existing) {
    const slug = slugify([m.name, m.brand].filter(Boolean).join('-'));
    const [created] = await db.insert(schema.products).values({
      barcode: m.barcode,
      slug,
      name: m.name,
      brand: m.brand,
      sku: m.sku,
      imageUrl: m.imageUrl,
      attributes: m.attributes,
      categoryId: resolveCategory(m.name),
      status: 'pending',
    }).returning({ id: schema.products.id });

    await db.insert(schema.productAliases).values({ productId: created.id, alias: m.name, source: 'elit' });
    await upsertSource(created.id, m);
    return 'inserted';
  }

  // Fill-empty-only merge: never clobber an existing non-empty value.
  const updates: Record<string, unknown> = {};
  if (!existing.brand && m.brand) updates.brand = m.brand;
  if (!existing.sku && m.sku) updates.sku = m.sku;
  if (!existing.imageUrl && m.imageUrl) updates.imageUrl = m.imageUrl;
  if (existing.categoryId == null) {
    const cat = resolveCategory(existing.name || m.name);
    if (cat) updates.categoryId = cat;
  }
  const current = (existing.attributes ?? {}) as Record<string, string>;
  const merged = { ...current };
  let attrsChanged = false;
  for (const [k, v] of Object.entries(m.attributes)) {
    if (merged[k] == null || merged[k] === '') { merged[k] = v; attrsChanged = true; }
  }
  if (attrsChanged) updates.attributes = merged;

  if (Object.keys(updates).length > 0) {
    updates.updatedAt = new Date();
    await db.update(schema.products).set(updates).where(eq(schema.products.id, existing.id));
  }
  await upsertSource(existing.id, m);
  return 'updated';
}

// Record/refresh provenance, idempotent on (source, source_id).
async function upsertSource(productId: string, m: MappedProduct): Promise<void> {
  await db.insert(schema.productSources).values({
    productId,
    source: m.source,
    sourceId: m.sourceId,
    sourceSku: m.sourceSku,
    sourceUrl: m.sourceUrl,
    sourceUpdatedAt: m.sourceUpdatedAt,
    fetchedAt: new Date(),
  }).onConflictDoUpdate({
    target: [schema.productSources.source, schema.productSources.sourceId],
    targetWhere: eq(schema.productSources.sourceId, m.sourceId),
    set: {
      productId,
      sourceSku: m.sourceSku,
      sourceUrl: m.sourceUrl,
      sourceUpdatedAt: m.sourceUpdatedAt,
      fetchedAt: new Date(),
    },
  });
}

export async function syncElit(opts: ElitSyncOptions = {}): Promise<ElitSyncReport> {
  const limit = Math.min(Math.max(1, opts.limit ?? 100), 100);
  const maxPages = Math.max(1, opts.maxPages ?? 5);
  let offset = Math.max(0, opts.offset ?? 0);

  const resolveCategory = await buildCategoryResolver();
  const report: ElitSyncReport = {
    fetched: 0, inserted: 0, updated: 0, skippedNoEan: 0, errors: 0,
    total: 0, nextOffset: offset, done: false,
  };

  for (let page = 0; page < maxPages; page++) {
    const { total, resultado } = await fetchElitPage({ limit, offset, since: opts.since, store: opts.store });
    report.total = total;
    if (resultado.length === 0) { report.done = true; break; }

    for (const raw of resultado) {
      report.fetched++;
      try {
        const mapped = mapElitProduct(raw);
        if (!mapped) continue;
        // Need at least one stable key: an EAN, or ELIT's own id for barcode-less
        // items. Without either we can't dedup, so skip (never name-merge).
        if (!mapped.barcode && !mapped.sourceId) { report.skippedNoEan++; continue; }
        const result = await upsertProduct(mapped, resolveCategory);
        report[result]++;
      } catch (err) {
        report.errors++;
        console.error('[elit-sync] product failed:', (err as Error)?.message ?? err);
      }
    }

    offset += resultado.length;
    report.nextOffset = offset;
    if (offset >= total || resultado.length < limit) { report.done = true; break; }
  }

  return report;
}
