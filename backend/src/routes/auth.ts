import { Hono } from 'hono';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db, schema } from '../db';
import { eq } from 'drizzle-orm';
import { JWT_SECRET, requireAuth, isModerator } from '../middleware/user';

export const authRouter = new Hono();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional().default(''),
});

authRouter.post('/register', async (c) => {
  const raw = await c.req.json();
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: 'validation_error', details: parsed.error.flatten() }, 400);
  }

  const { email, password, name } = parsed.data;

  const existing = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  if (existing) {
    return c.json({ error: 'email_taken' }, 409);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.insert(schema.users).values({ email, name, passwordHash }).returning();

  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });

  return c.json({
    token,
    user: { id: user.id, email: user.email, name: user.name },
  }, 201);
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

authRouter.post('/login', async (c) => {
  const raw = await c.req.json();
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: 'validation_error', details: parsed.error.flatten() }, 400);
  }

  const { email, password } = parsed.data;
  const user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  if (!user) {
    return c.json({ error: 'invalid_credentials' }, 401);
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return c.json({ error: 'invalid_credentials' }, 401);
  }

  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });

  return c.json({
    token,
    user: { id: user.id, email: user.email, name: user.name },
  });
});

authRouter.get('/me', async (c) => {
  const payload = requireAuth(c);
  if (!payload) return c.json({ error: 'unauthorized' }, 401);

  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, payload.userId),
    columns: { id: true, email: true, name: true, avatarUrl: true, isModerator: true, createdAt: true },
  });
  if (!user) return c.json({ error: 'not_found' }, 404);

  return c.json(user);
});

// Update the authenticated user's own profile (name / avatar).
const updateMeSchema = z.object({
  name: z.string().max(120).optional(),
  avatarUrl: z.string().url().or(z.literal('')).optional(),
}).strict();

authRouter.patch('/me', async (c) => {
  const payload = requireAuth(c);
  if (!payload) return c.json({ error: 'unauthorized' }, 401);

  const parsed = updateMeSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'validation_error', details: parsed.error.flatten() }, 400);

  const updates: Record<string, any> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.avatarUrl !== undefined) updates.avatarUrl = parsed.data.avatarUrl;

  if (Object.keys(updates).length === 0) {
    const current = await db.query.users.findFirst({
      where: eq(schema.users.id, payload.userId),
      columns: { id: true, email: true, name: true, avatarUrl: true, createdAt: true },
    });
    return c.json(current);
  }

  const [user] = await db.update(schema.users)
    .set(updates)
    .where(eq(schema.users.id, payload.userId))
    .returning({ id: schema.users.id, email: schema.users.email, name: schema.users.name, avatarUrl: schema.users.avatarUrl, createdAt: schema.users.createdAt });
  return c.json(user);
});

// Change password while logged in (knows the current one).
const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(6),
});

authRouter.post('/change-password', async (c) => {
  const payload = requireAuth(c);
  if (!payload) return c.json({ error: 'unauthorized' }, 401);

  const parsed = changePasswordSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'validation_error', details: parsed.error.flatten() }, 400);

  const user = await db.query.users.findFirst({ where: eq(schema.users.id, payload.userId) });
  if (!user) return c.json({ error: 'not_found' }, 404);

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!valid) return c.json({ error: 'invalid_current_password' }, 401);

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await db.update(schema.users).set({ passwordHash }).where(eq(schema.users.id, user.id));
  return c.json({ ok: true });
});

// Admin-assisted password reset for a locked-out user (moderator only).
// This is the recovery path until email/Telegram self-service is added.
const adminResetSchema = z.object({
  email: z.string().email(),
  newPassword: z.string().min(6),
});

authRouter.post('/admin/reset-password', async (c) => {
  const payload = requireAuth(c);
  if (!payload) return c.json({ error: 'unauthorized' }, 401);
  if (!(await isModerator(payload.userId))) return c.json({ error: 'forbidden' }, 403);

  const parsed = adminResetSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'validation_error', details: parsed.error.flatten() }, 400);

  const target = await db.query.users.findFirst({ where: eq(schema.users.email, parsed.data.email) });
  if (!target) return c.json({ error: 'user_not_found' }, 404);

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await db.update(schema.users).set({ passwordHash }).where(eq(schema.users.id, target.id));
  return c.json({ ok: true, email: target.email });
});
