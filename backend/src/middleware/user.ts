import type { Context, Next } from 'hono';
import jwt from 'jsonwebtoken';
import { db, schema } from '../db';
import { eq } from 'drizzle-orm';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

export interface JwtPayload {
  userId: string;
  email: string;
}

async function ensureUser(userId: string) {
  const exists = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: { id: true },
  });
  if (!exists) {
    await db.insert(schema.users).values({
      id: userId,
      email: `${userId}@anon.local`,
      passwordHash: 'anon',
      name: '',
    }).onConflictDoNothing();
  }
}

export async function userMiddleware(c: Context, next: Next) {
  const auth = c.req.header('authorization');
  if (auth?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(auth.slice(7), JWT_SECRET) as JwtPayload;
      c.set('userId', payload.userId);
      c.set('userEmail', payload.email);
    } catch {
      // token invalid or expired — continue as anonymous
    }
  }

  const legacyId = c.req.header('x-user-id');
  if (legacyId && !c.get('userId')) {
    c.set('userId', legacyId);
  }

  const userId = c.get('userId') as string | undefined;
  if (userId) {
    try { await ensureUser(userId); } catch { /* best-effort */ }
  }

  await next();
}

export function getUserId(c: Context): string | null {
  return c.get('userId') ?? null;
}

export function requireAuth(c: Context): JwtPayload | null {
  const userId = c.get('userId');
  const email = c.get('userEmail');
  if (!userId) return null;
  return { userId, email };
}

export { JWT_SECRET };
