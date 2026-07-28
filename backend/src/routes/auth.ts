import { Hono } from 'hono';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db, schema } from '../db';
import { eq } from 'drizzle-orm';
import { JWT_SECRET, requireAuth } from '../middleware/user';

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
    columns: { id: true, email: true, name: true, avatarUrl: true, createdAt: true },
  });
  if (!user) return c.json({ error: 'not_found' }, 404);

  return c.json(user);
});
