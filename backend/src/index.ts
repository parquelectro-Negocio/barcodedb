import 'dotenv/config';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { createServer as createHttpsServer } from 'https';
import { readFileSync } from 'fs';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { productsRouter } from './routes/products';
import { businessesRouter } from './routes/businesses';
import { searchRouter } from './routes/search';
import { categoriesRouter } from './routes/categories';
import { votesRouter } from './routes/votes';
import { salesRouter } from './routes/sales';
import { authRouter } from './routes/auth';
import { duplicatesRouter } from './routes/duplicates';
import { imagesRouter } from './routes/images';
import { userMiddleware } from './middleware/user';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = new Hono();

// Restrict CORS to an allowlist when CORS_ORIGINS is set (comma-separated).
// Falls back to permissive in dev / until the env is configured in prod.
const corsOrigins = process.env.CORS_ORIGINS?.split(',').map(s => s.trim()).filter(Boolean);
app.use('/*', cors({ origin: corsOrigins && corsOrigins.length > 0 ? corsOrigins : '*' }));
app.use('/api/*', userMiddleware);
app.get('/', (c) => c.json({ ok: true, version: '0.1.2' }));

app.use('/uploads/*', serveStatic({ root: join(__dirname, '..') }));
app.route('/api/auth', authRouter);
app.route('/api/duplicates', duplicatesRouter);
app.route('/api/images', imagesRouter);
app.route('/api/products', productsRouter);
app.route('/api/businesses', businessesRouter);
app.route('/api/search', searchRouter);
app.route('/api/categories', categoriesRouter);
app.route('/api/votes', votesRouter);
app.route('/api/sales', salesRouter);

// Global error handler: log method + path + stack so a 500 in production is
// immediately traceable in the logs (Hono's default logs a context-free error).
app.onError((err, c) => {
  console.error(`[500] ${c.req.method} ${c.req.path} —`, err);
  return c.json({ error: 'internal_error' }, 500);
});

const ssl = process.env.SSL === 'true';
const port = parseInt(process.env.PORT ?? (ssl ? '3443' : '3001'));

if (ssl) {
  const key = readFileSync(join(__dirname, '../../ssl/localhost-key.pem'));
  const cert = readFileSync(join(__dirname, '../../ssl/localhost.pem'));
  serve({
    fetch: app.fetch,
    port,
    createServer: createHttpsServer,
    serverOptions: { key, cert },
  }, () => {
    console.log(`BarcodeDB API running on https://localhost:${port}`);
  });
} else {
  serve({ fetch: app.fetch, port }, () => {
    console.log(`BarcodeDB API running on http://localhost:${port}`);
  });
}

export default app;
