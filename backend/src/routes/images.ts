import { Hono } from 'hono';
import { requireAuth } from '../middleware/user';

const CF_API = 'https://api.cloudflare.com/client/v4';

export const imagesRouter = new Hono();

imagesRouter.post('/upload-token', async (c) => {
  const payload = requireAuth(c);
  if (!payload) return c.json({ error: 'unauthorized' }, 401);

  const accountId = process.env.CF_ACCOUNT_ID;
  const token = process.env.CF_IMAGES_TOKEN;
  if (!accountId || !token) return c.json({ error: 'cloudflare_not_configured' }, 500);

  try {
    const res = await fetch(`${CF_API}/accounts/${accountId}/images/v2/direct_upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json();
      return c.json({ error: 'cloudflare_error', details: err }, 502);
    }
    const data: any = await res.json();
    return c.json(data.result);
  } catch (e: any) {
    return c.json({ error: 'cloudflare_error', message: e.message }, 502);
  }
});
