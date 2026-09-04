import { Hono } from 'hono';
import { requireAuth, isModerator } from '../middleware/user';
import { syncElit } from '../lib/elit-sync';

// Admin-only operations on the global catalog. Moderator-gated: these mutate the
// shared base, so they require both a real account and the is_moderator flag.
export const adminRouter = new Hono();

// Trigger an ELIT catalog sync. Runs server-side (where the DB is reachable) and
// uses the ELIT credentials from the environment. Resumable: pass `offset` and
// `maxPages` to page through the full catalog; pass `since` for an incremental
// sync of only recently-changed products.
adminRouter.post('/sync/elit', async (c) => {
  const auth = requireAuth(c);
  if (!auth) return c.json({ error: 'auth_required' }, 401);
  if (!(await isModerator(auth.userId))) return c.json({ error: 'forbidden' }, 403);

  const body = await c.req.json().catch(() => ({} as Record<string, unknown>));
  const num = (v: unknown, def: number) => (Number.isFinite(Number(v)) ? Number(v) : def);

  try {
    const report = await syncElit({
      offset: Math.max(0, num(body.offset, 0)),
      maxPages: Math.min(Math.max(1, num(body.maxPages, 5)), 50),
      limit: Math.min(Math.max(1, num(body.limit, 100)), 100),
      since: typeof body.since === 'string' ? body.since : undefined,
      store: typeof body.store === 'string' ? body.store : undefined,
    });
    return c.json(report);
  } catch (err) {
    console.error('[admin] ELIT sync failed:', err);
    return c.json({ error: 'sync_failed', message: (err as Error)?.message ?? 'unknown' }, 502);
  }
});
