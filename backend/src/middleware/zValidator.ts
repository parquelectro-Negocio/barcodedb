import { z } from 'zod';

type ValidationTargets = {
  json: any;
  query: any;
  param: any;
};

export function zValidator<T extends z.ZodType>(
  target: keyof ValidationTargets,
  schema: T,
) {
  return async (c: any, next: () => Promise<void>) => {
    const raw = target === 'json' ? await c.req.json() : c.req[target]();
    const result = schema.safeParse(raw);
    if (!result.success) {
      return c.json({ error: 'validation_error', details: result.error.flatten() }, 400);
    }
    c.req.valid = (t: string) => t === target ? result.data : undefined;
    await next();
  };
}
