import { Hono } from 'hono';
import { db, schema } from '../db';
import { eq } from 'drizzle-orm';

export const categoriesRouter = new Hono();

categoriesRouter.get('/', async (c) => {
  const cats = await db.query.categories.findMany({
    orderBy: (c, { asc }) => asc(c.name),
  });
  return c.json(cats);
});

categoriesRouter.get('/:id/attributes', async (c) => {
  const { id } = c.req.param();
  const attrs = await db.query.categoryAttributes.findMany({
    where: eq(schema.categoryAttributes.categoryId, id),
    orderBy: (a, { asc }) => asc(a.sortOrder),
  });
  return c.json(attrs);
});
