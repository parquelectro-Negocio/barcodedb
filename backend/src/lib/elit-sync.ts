// ELIT catalog ingest. Pulls pages from the ELIT API, maps each product to
// identity-only (see elit.ts), and upserts via the shared catalog-sync logic.

import { fetchElitPage, mapElitProduct } from './elit';
import { buildCategoryResolver, ingestMapped, emptyReport, type SyncReport } from './catalog-sync';

export interface ElitSyncOptions {
  limit?: number;     // page size, max 100
  maxPages?: number;  // how many pages this call processes (resumable)
  offset?: number;    // starting offset
  since?: string;     // 'YYYY-MM-DD HH:MM' incremental sync
  store?: string;
}

export async function syncElit(opts: ElitSyncOptions = {}): Promise<SyncReport> {
  const limit = Math.min(Math.max(1, opts.limit ?? 100), 100);
  const maxPages = Math.max(1, opts.maxPages ?? 5);
  let offset = Math.max(0, opts.offset ?? 0);

  const resolveCategory = await buildCategoryResolver();
  const report = emptyReport(offset);

  for (let page = 0; page < maxPages; page++) {
    const { total, resultado } = await fetchElitPage({ limit, offset, since: opts.since, store: opts.store });
    report.total = total;
    if (resultado.length === 0) { report.done = true; break; }

    for (const raw of resultado) {
      report.fetched++;
      try {
        const mapped = mapElitProduct(raw);
        if (!mapped) continue;
        const result = await ingestMapped(mapped, resolveCategory);
        if (result === 'skipped') report.skippedNoEan++;
        else report[result]++;
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
