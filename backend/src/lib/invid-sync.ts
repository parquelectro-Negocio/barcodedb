// INVID catalog ingest. Logs in once for a JWT, then pages the articles endpoint
// (100/page, offset-based) and upserts via the shared catalog-sync logic.
// Rate-limited to 50 req/hour by INVID — a 429 stops the run; it's resumable.

import { loginInvid, fetchInvidPage, mapInvidProduct } from './invid';
import { buildCategoryResolver, ingestMapped, emptyReport, type SyncReport } from './catalog-sync';

export interface InvidSyncOptions {
  maxPages?: number;  // pages processed per call (resumable; respects the 50/hour cap)
  offset?: number;    // starting offset
}

export async function syncInvid(opts: InvidSyncOptions = {}): Promise<SyncReport> {
  const maxPages = Math.max(1, opts.maxPages ?? 5);
  let offset = Math.max(0, opts.offset ?? 0);

  const token = await loginInvid();
  const resolveCategory = await buildCategoryResolver();
  const report = emptyReport(offset);

  for (let page = 0; page < maxPages; page++) {
    const { data, hasMore, nextOffset } = await fetchInvidPage(token, offset);
    if (data.length === 0) { report.done = true; break; }

    for (const raw of data) {
      report.fetched++;
      try {
        const mapped = mapInvidProduct(raw);
        if (!mapped) continue;
        const result = await ingestMapped(mapped, resolveCategory);
        if (result === 'skipped') report.skippedNoEan++;
        else report[result]++;
      } catch (err) {
        report.errors++;
        console.error('[invid-sync] product failed:', (err as Error)?.message ?? err);
      }
    }

    offset = nextOffset;
    report.nextOffset = offset;
    if (!hasMore) { report.done = true; break; }
  }

  return report;
}
