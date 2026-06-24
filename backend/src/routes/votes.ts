import { Hono } from 'hono';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, and, sql } from 'drizzle-orm';
import { getUserId } from '../middleware/user';

export const votesRouter = new Hono();

// Get current user's vote for a product
votesRouter.get('/:productId', async (c) => {
  const userId = getUserId(c);
  if (!userId) return c.json({ vote: null });

  const vote = await db.query.productVotes.findFirst({
    where: and(
      eq(schema.productVotes.productId, c.req.param('productId')),
      eq(schema.productVotes.userId, userId),
    ),
  });
  return c.json({ vote: vote?.vote ?? null });
});

// Confirm or flag a product
const voteSchema = z.object({
  vote: z.enum(['confirm', 'flag']),
});

votesRouter.post('/:productId', async (c) => {
  const userId = getUserId(c);
  if (!userId) return c.json({ error: 'user_required' }, 400);

  const productId = c.req.param('productId');
  const raw = await c.req.json();
  const parsed = voteSchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_vote' }, 400);

  const { vote } = parsed.data;

  // Upsert vote
  await db.insert(schema.productVotes)
    .values({ userId, productId, vote })
    .onConflictDoUpdate({
      target: [schema.productVotes.userId, schema.productVotes.productId],
      set: { vote },
    });

  // Recalculate verification_score (count of 'confirm' votes)
  const [confirmResult]: any = await db.execute(
    sql`SELECT COUNT(*) as count FROM product_votes WHERE product_id = ${productId} AND vote = 'confirm'`,
  );
  const confirmCount = parseInt(confirmResult.count ?? '0');

  const [flagResult]: any = await db.execute(
    sql`SELECT COUNT(*) as count FROM product_votes WHERE product_id = ${productId} AND vote = 'flag'`,
  );
  const flagCount = parseInt(flagResult.count ?? '0');

  // Status logic:
  // 3+ confirms → verified
  // 3+ flags → flagged for review
  let status = 'pending';
  if (confirmCount >= 3 && confirmCount > flagCount * 2) {
    status = 'verified';
  } else if (flagCount >= 3) {
    status = 'flagged';
  }

  await db.update(schema.products)
    .set({
      verificationScore: confirmCount,
      status,
      updatedAt: sql`now()`,
    })
    .where(eq(schema.products.id, productId));

  return c.json({
    vote,
    verificationScore: confirmCount,
    status,
    confirmCount,
    flagCount,
  });
});
