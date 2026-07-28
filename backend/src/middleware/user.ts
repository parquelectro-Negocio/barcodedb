import type { Context, Next } from 'hono';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

export interface JwtPayload {
  userId: string;
  email: string;
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
