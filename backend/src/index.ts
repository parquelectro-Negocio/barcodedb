import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { productsRouter } from './routes/products';
import { businessesRouter } from './routes/businesses';
import { searchRouter } from './routes/search';
import { categoriesRouter } from './routes/categories';

const app = new Hono();

app.use('/*', cors());
app.get('/', (c) => c.json({ ok: true, version: '0.1.0' }));

app.route('/api/products', productsRouter);
app.route('/api/businesses', businessesRouter);
app.route('/api/search', searchRouter);
app.route('/api/categories', categoriesRouter);

const port = parseInt(process.env.PORT ?? '3001');

serve({ fetch: app.fetch, port }, () => {
  console.log(`BarcodeDB API running on http://localhost:${port}`);
});

export default app;
