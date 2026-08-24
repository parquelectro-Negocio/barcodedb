import { Hono } from 'hono';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, sql } from 'drizzle-orm';
import { requireAuth, isModerator } from '../middleware/user';

export const feedbackRouter = new Hono();

const createSchema = z.object({
  kind: z.enum(['reclamo', 'sugerencia']),
  message: z.string().min(3).max(2000),
  contact: z.string().max(200).optional().default(''),
});

// Anyone logged in can send a reclamo / sugerencia.
feedbackRouter.post('/', async (c) => {
  const auth = requireAuth(c);
  if (!auth) return c.json({ error: 'auth_required' }, 401);
  const parsed = createSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'validation_error', details: parsed.error.flatten() }, 400);
  const [row] = await db.insert(schema.feedback).values({
    userId: auth.userId,
    kind: parsed.data.kind,
    message: parsed.data.message.trim(),
    contact: (parsed.data.contact ?? '').trim(),
  }).returning();
  return c.json(row, 201);
});

// Owner (moderator) reads them.
feedbackRouter.get('/', async (c) => {
  const auth = requireAuth(c);
  if (!auth) return c.json({ error: 'auth_required' }, 401);
  if (!(await isModerator(auth.userId))) return c.json({ error: 'forbidden_moderator_only' }, 403);
  const status = c.req.query('status') === 'done' ? 'done' : 'open';
  const r: any = await db.execute(sql`
    SELECT f.id, f.kind, f.message, f.contact, f.status, f.created_at AS "createdAt",
           u.name AS "userName", u.email AS "userEmail"
    FROM feedback f
    LEFT JOIN users u ON u.id = f.user_id
    WHERE f.status = ${status}
    ORDER BY f.created_at DESC
    LIMIT 100
  `);
  return c.json(Array.isArray(r) ? r : (r?.rows ?? []));
});

feedbackRouter.post('/:id/resolve', async (c) => {
  const auth = requireAuth(c);
  if (!auth) return c.json({ error: 'auth_required' }, 401);
  if (!(await isModerator(auth.userId))) return c.json({ error: 'forbidden_moderator_only' }, 403);
  const [row] = await db.update(schema.feedback)
    .set({ status: 'done' })
    .where(eq(schema.feedback.id, c.req.param('id')))
    .returning();
  if (!row) return c.json({ error: 'not_found' }, 404);
  return c.json(row);
});
