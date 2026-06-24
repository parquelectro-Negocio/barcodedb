import type { Context, Next } from 'hono';

export async function userMiddleware(c: Context, next: Next) {
  const userId = c.req.header('x-user-id');
  if (userId) {
    c.set('userId', userId);
  }
  await next();
}

export function getUserId(c: Context): string | null {
  return c.get('userId') ?? null;
}
