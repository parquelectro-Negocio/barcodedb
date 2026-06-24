import { Hono } from 'hono';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = join(__dirname, '..', '..', 'uploads');

export const uploadRouter = new Hono();

uploadRouter.post('/', async (c) => {
  const body = await c.req.parseBody();
  const file = body['file'] as File | undefined;
  if (!file) return c.json({ error: 'no_file' }, 400);

  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext ?? '')) {
    return c.json({ error: 'invalid_format. Solo jpg, png, webp, gif' }, 400);
  }

  if (!existsSync(UPLOADS_DIR)) await mkdir(UPLOADS_DIR, { recursive: true });

  const filename = `${crypto.randomUUID()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(join(UPLOADS_DIR, filename), buf);

  const url = `/uploads/${filename}`;
  return c.json({ url });
});