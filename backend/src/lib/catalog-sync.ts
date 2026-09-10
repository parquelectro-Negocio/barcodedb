// Shared supplier-catalog ingest logic, used by every provider connector (ELIT,
// INVID, ...). Providers differ only in how they fetch + map; once a product is a
// MappedProduct, the upsert rules are identical:
//
//  - EAN is the cross-provider merge key (canonicalized upstream in the mapper).
//  - No EAN -> match by (source, source_id); never name-merge.
//  - Merge is fill-empty-only: an existing non-empty field is NEVER overwritten.
//  - New products land as status 'pending' (staging).
//  - Prices/stock are never present (the mapper dropped them).

import { db, schema } from '../db';
import { eq, and } from 'drizzle-orm';
import { slugify } from './slug';
import { categorize } from './categorize';
import type { MappedProduct } from './elit';

export interface SyncReport {
  fetched: number;
  inserted: number;
  updated: number;
  skippedNoEan: number;
  errors: number;
  total: number;      // total the provider reports, when known (0 if unknown)
  nextOffset: number; // pass back as `offset` to continue
  done: boolean;
}

export function emptyReport(offset = 0): SyncReport {
  return { fetched: 0, inserted: 0, updated: 0, skippedNoEan: 0, errors: 0, total: 0, nextOffset: offset, done: false };
}

export type CategoryResolver = (name: string) => string | null;

export async function buildCategoryResolver(): Promise<CategoryResolver> {
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
// for barcode-less products: a provider's own id is a safe within-provider key,
// so they stay idempotent without ever name-merging.
async function findBySource(m: MappedProduct) {
  if (!m.sourceId) return undefined;
  const src = await db.query.productSources.findFirst({
    where: and(eq(schema.productSources.source, m.source), eq(schema.productSources.sourceId, m.sourceId)),
    columns: { productId: true },
  });
  if (!src) return undefined;
  return db.query.products.findFirst({ where: eq(schema.products.id, src.productId), columns: PRODUCT_COLS });
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
    set: { productId, sourceSku: m.sourceSku, sourceUrl: m.sourceUrl, sourceUpdatedAt: m.sourceUpdatedAt, fetchedAt: new Date() },
  });
}

// Ingest one mapped product. Returns what happened so the caller can tally it.
export async function ingestMapped(m: MappedProduct, resolveCategory: CategoryResolver): Promise<'inserted' | 'updated' | 'skipped'> {
  // Need at least one stable key: an EAN, or the provider's own id for
  // barcode-less items. Without either we can't dedup, so skip (never name-merge).
  if (!m.barcode && !m.sourceId) return 'skipped';

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

    await db.insert(schema.productAliases).values({ productId: created.id, alias: m.name, source: m.source });
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
