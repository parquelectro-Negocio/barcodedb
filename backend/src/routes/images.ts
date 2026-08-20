import { Hono } from 'hono';
import { requireAuth } from '../middleware/user';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

export const imagesRouter = new Hono();

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.R2_BUCKET;
const R2_PUBLIC_BASE = process.env.R2_PUBLIC_BASE; // e.g. https://pub-xxxx.r2.dev

const s3 = R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY
  ? new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    })
  : null;

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
};

// Proxy a public R2 image through our own origin so the browser can read its
// bytes (R2's public r2.dev domain sends no CORS headers). Restricted to our
// bucket's public base to avoid being an open proxy / SSRF vector. Used to embed
// the shop logo into client-generated PDFs.
imagesRouter.get('/proxy', async (c) => {
  const url = c.req.query('url');
  if (!url || !R2_PUBLIC_BASE || !url.startsWith(R2_PUBLIC_BASE.replace(/\/$/, ''))) {
    return c.json({ error: 'bad_url' }, 400);
  }
  try {
    const r = await fetch(url);
    if (!r.ok) return c.json({ error: 'not_found' }, 404);
    const ct = r.headers.get('content-type') || 'image/jpeg';
    const buf = await r.arrayBuffer();
    return c.body(buf, 200, { 'Content-Type': ct, 'Cache-Control': 'public, max-age=86400' });
  } catch {
    return c.json({ error: 'proxy_failed' }, 502);
  }
});

// Upload an image to Cloudflare R2 (free tier) and return its public URL.
// The browser sends the file here; the backend stores it server-side (no R2 CORS needed).
imagesRouter.post('/upload', async (c) => {
  const payload = requireAuth(c);
  if (!payload) return c.json({ error: 'unauthorized' }, 401);
  if (!s3 || !R2_BUCKET || !R2_PUBLIC_BASE) return c.json({ error: 'r2_not_configured' }, 500);

  const body = await c.req.parseBody();
  const file: any = body['file'];
  // Duck-type instead of `instanceof File` — File isn't a global in this Node runtime.
  if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') {
    return c.json({ error: 'no_file' }, 400);
  }
  if (file.size > 10 * 1024 * 1024) return c.json({ error: 'file_too_large' }, 400);

  const ext = EXT[file.type] ?? 'jpg';
  const key = `products/${randomUUID()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());

  try {
    await s3.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: buf,
      ContentType: file.type || 'image/jpeg',
    }));
    return c.json({ url: `${R2_PUBLIC_BASE.replace(/\/$/, '')}/${key}` });
  } catch (e: any) {
    console.error('[images] R2 upload failed:', e?.message ?? e);
    return c.json({ error: 'upload_failed' }, 502);
  }
});
