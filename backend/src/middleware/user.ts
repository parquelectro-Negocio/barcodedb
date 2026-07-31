import type { Context, Next } from 'hono';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db';

const secret = process.env.JWT_SECRET;
if (!secret) {
  throw new Error('JWT_SECRET is not set. The server refuses to start without a signing secret.');
}
export const JWT_SECRET: string = secret;

export interface JwtPayload {
  userId: string;
  email: string;
}

// Identity comes ONLY from a valid JWT. There is no anonymous / header-based
// identity: reads are public, writes require a real authenticated account.
export async function userMiddleware(c: Context, next: Next) {
  const auth = c.req.header('authorization');
  if (auth?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(auth.slice(7), JWT_SECRET) as JwtPayload;
      c.set('userId', payload.userId);
      c.set('userEmail', payload.email);
    } catch {
      // token invalid or expired — continue as anonymous (read-only)
    }
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

// Moderator check for destructive global-catalog actions (merge/delete).
// Reads the flag from the DB, not the token, so revoking access is immediate.
export async function isModerator(userId: string): Promise<boolean> {
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: { isModerator: true },
  });
  return !!user?.isModerator;
}
