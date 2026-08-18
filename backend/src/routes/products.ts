import { Hono } from 'hono';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, or, sql, and, ne } from 'drizzle-orm';
import { requireAuth } from '../middleware/user';
import { slugify } from '../lib/slug';
import { categorize } from '../lib/categorize';

export const productsRouter = new Hono();

const createSchema = z.object({
  barcode: z.string().optional().default(''),
  name: z.string().min(1),
  brand: z.string().optional().default(''),
  sku: z.string().optional().default(''),
  color: z.string().optional().default(''),
  capacidad: z.string().optional().default(''),
  largo: z.string().optional().default(''),
  peso: z.string().optional().default(''),
  description: z.string().optional().default(''),
  categoryId: z.string().uuid().nullable().optional(),
  imageUrl: z.string().optional().default(''),
  unit: z.string().optional().default('unidad'),
  attributes: z.record(z.any()).optional().default({}),
});

productsRouter.get('/:identifier', async (c) => {
  const { identifier } = c.req.param();
  const results = await db.query.products.findMany({
    where: or(eq(schema.products.barcode, identifier), eq(schema.products.slug, identifier)),
    orderBy: (p, { desc }) => desc(p.verificationScore),
    with: { category: true, variants: true },
  });
  if (results.length === 0) return c.json({ error: 'not_found' }, 404);
  return c.json({ products: results, conflict: results.length > 1 });
});

// Google's ListModels lists models that aren't actually callable via
// generateContent for new keys (they 404), so we build an ordered candidate
// list and TRY them at call time, caching the first that truly responds.
let cachedGeminiModel: string | null = null;
let cachedCandidates: string[] | null = null;

async function getCandidateModels(key: string): Promise<string[]> {
  if (cachedCandidates) return cachedCandidates;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}&pageSize=200`);
    if (!res.ok) {
      console.error(`[ai-enrich] ListModels HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`);
      return [];
    }
    const data: any = await res.json();
    const models: string[] = (data.models ?? [])
      .filter((m: any) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
      .map((m: any) => String(m.name).replace(/^models\//, ''))
      .filter((n: string) => !/vision|thinking|image|tts|audio|live|embedding|aqa/i.test(n));
    // Prefer "-latest" aliases and flash/lite (fast, free-tier friendly).
    const rank = (n: string) => (/latest/i.test(n) ? 0 : 1) + (/flash|lite/i.test(n) ? 0 : 2);
    models.sort((a, b) => rank(a) - rank(b));
    cachedCandidates = models;
    console.log(`[ai-enrich] ${models.length} candidate models: ${models.slice(0, 15).join(', ')}`);
    return models;
  } catch (err) {
    console.error('[ai-enrich] ListModels failed:', err);
    return [];
  }
}

// AI-assisted enrichment: given a product name (+ optional barcode), ask Gemini
// to fill brand/category/description/color. Optional feature — returns 503 when
// GEMINI_API_KEY isn't set, so the app works fine without it.
productsRouter.post('/ai-enrich', async (c) => {
  const auth = requireAuth(c);
  if (!auth) return c.json({ error: 'auth_required' }, 401);

  const key = process.env.GEMINI_API_KEY;
  if (!key) return c.json({ error: 'ai_not_configured' }, 503);

  const body = await c.req.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const barcode = typeof body.barcode === 'string' ? body.barcode.trim() : '';
  const image = typeof body.image === 'string' ? body.image : '';       // base64, no data: prefix
  const mimeType = typeof body.mimeType === 'string' ? body.mimeType : 'image/jpeg';
  if (!name && !image) return c.json({ error: 'name_or_image_required' }, 400);

  const cats = await db.query.categories.findMany({ columns: { name: true } });
  const catNames = [...new Set(cats.map(x => x.name))];

  const prompt =
    `Sos un asistente para un catálogo de productos en Argentina. ` +
    (image
      ? `Identificá el producto de la FOTO adjunta${name ? ` (referencia opcional: "${name}")` : ''}. `
      : `A partir del nombre del producto${barcode ? ' y su código de barras' : ''}, `) +
    `devolvé SOLO un objeto JSON con esta forma exacta:\n` +
    `{"name": "", "brand": "", "category": "", "description": "", "color": "", "capacidad": "", "largo": "", "peso": ""}\n` +
    `- "name": nombre corto y claro del producto (marca + modelo si se distingue).\n` +
    `- "category": elegí EXACTAMENTE UNA de esta lista, o "" si ninguna encaja: ${catNames.join(', ')}\n` +
    `- "description": una frase corta en español.\n` +
    `- "capacidad": capacidad/volumen/memoria si aplica (ej: "128GB", "500ml"), sino "".\n` +
    `- "largo": longitud/medida si aplica (ej: "2m", "50cm"), sino "".\n` +
    `- "peso": peso si aplica (ej: "1kg", "500g"), sino "".\n` +
    `- Completá SOLO los campos que correspondan; el resto dejalo como "".\n` +
    (name ? `Nombre: ${name}\n` : '') + (barcode ? `Código de barras: ${barcode}\n` : '');

  const candidates = cachedGeminiModel ? [cachedGeminiModel] : await getCandidateModels(key);
  if (candidates.length === 0) return c.json({ error: 'ai_no_model' }, 502);

  const parts: any[] = [{ text: prompt }];
  if (image) parts.push({ inlineData: { mimeType, data: image } });
  const reqBody = JSON.stringify({
    contents: [{ parts }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
  });

  let lastStatus = 0;
  let lastBody = '';
  // Try candidates until one actually returns a response; cache the winner.
  for (const model of candidates.slice(0, 12)) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: reqBody },
    ).catch(() => null);
    if (!res) continue;

    if (res.ok) {
      cachedGeminiModel = model;
      console.log(`[ai-enrich] model OK: ${model}`);
      try {
        const data: any = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
        const f = JSON.parse(text);
        const category = catNames.find(n => n.toLowerCase() === String(f.category ?? '').toLowerCase()) ?? '';
        return c.json({
          name: f.name ?? '',
          brand: f.brand ?? '',
          category,
          description: f.description ?? '',
          color: f.color ?? '',
          capacidad: f.capacidad ?? '',
          largo: f.largo ?? '',
          peso: f.peso ?? '',
        });
      } catch (err) {
        console.error('[ai-enrich] parse failed:', err);
        return c.json({ error: 'ai_error' }, 502);
      }
    }

    lastStatus = res.status;
    lastBody = (await res.text().catch(() => '')).slice(0, 300);
    if (res.status !== 404) break; // auth/quota/etc — another model won't help
    // 404 → this model isn't callable for this key, try the next candidate
  }

  cachedGeminiModel = null;
  console.error(`[ai-enrich] no working model. last HTTP ${lastStatus}: ${lastBody}`);
  return c.json({ error: 'ai_error', status: lastStatus }, 502);
});

productsRouter.post('/', async (c) => {
  const raw = await c.req.json();
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: 'validation_error', details: parsed.error.flatten() }, 400);
  }

  const auth = requireAuth(c);
  if (!auth) return c.json({ error: 'auth_required' }, 401);

  const body = parsed.data;
  const userId = auth.userId;

  const slugParts = [body.name, body.brand, body.color, body.capacidad, body.largo, body.peso].filter(Boolean);
  const slug = slugify(slugParts.join('-'));

  // If barcode exists, check if same product (slug match) or different product
  if (body.barcode) {
    const existing = await db.query.products.findMany({
      where: eq(schema.products.barcode, body.barcode),
      columns: { id: true, name: true, slug: true, brand: true },
    });
    if (existing.length > 0) {
      const same = existing.find(p => p.slug === slug);
      if (same) {
        return c.json({ existing: same, message: 'Este producto ya existe con ese código de barras.' }, 200);
      }
    }
  }

  const mergedAttrs = { ...body.attributes };
  if (body.capacidad) mergedAttrs.capacidad = body.capacidad;
  if (body.largo) mergedAttrs.largo = body.largo;
  if (body.peso) mergedAttrs.peso = body.peso;

  // Auto-categorize by name when the user didn't pick a category.
  let categoryId = body.categoryId ?? null;
  if (!categoryId) {
    const slugGuess = categorize(body.name);
    if (slugGuess) {
      const cat = await db.query.categories.findFirst({
        where: eq(schema.categories.slug, slugGuess),
        columns: { id: true },
      });
      categoryId = cat?.id ?? null;
    }
  }

  const [product] = await db.insert(schema.products).values({
    barcode: body.barcode,
    slug,
    name: body.name,
    brand: body.brand,
    sku: body.sku,
    color: body.color,
    description: body.description,
    categoryId,
    imageUrl: body.imageUrl,
    unit: body.unit,
    attributes: mergedAttrs,
    createdBy: userId,
  }).returning();

  // Generate aliases for matching
  const aliases: { productId: string; alias: string; source: string }[] = [
    { productId: product.id, alias: product.name, source: 'manual' },
  ];
  if (body.brand) {
    // Brand + rest without leading type keyword
    const typeKeywords = ['auricular','parlante','cable','notebook','monitor','mouse','teclado','celular','tablet','impresora','router','alfajor','galletita','bebida','cargador','funda','memoria','disco','protector'];
    const tokens = product.name.split(/\s+/);
    const withoutType = tokens.filter(t => !typeKeywords.includes(t.toLowerCase())).join(' ');
    if (withoutType && withoutType !== product.name) {
      aliases.push({ productId: product.id, alias: withoutType, source: 'ai' });
    }
  }
  if (aliases.length > 0) {
    await db.insert(schema.productAliases).values(aliases);
  }

  return c.json(product, 201);
});

productsRouter.patch('/:id', async (c) => {
  const { id } = c.req.param();
  const auth = requireAuth(c);
  if (!auth) return c.json({ error: 'auth_required' }, 401);

  const { capacidad, largo, peso, ...rest } = await c.req.json();

  // Fetch current product for auth check
  const current = await db.query.products.findFirst({
    where: eq(schema.products.id, id),
    columns: { id: true, createdBy: true, status: true, barcode: true },
  });
  if (!current) return c.json({ error: 'not_found' }, 404);

  const isCreator = current.createdBy === auth.userId;

  // Verified products: only the creator can edit
  if (current.status === 'verified' && !isCreator) {
    return c.json({ error: 'Producto verificado — solo el creador puede editarlo. Si encontraste un error, usa el botón Reportar.' }, 403);
  }

  // Check barcode uniqueness if changing it
  if (rest.barcode !== undefined && rest.barcode !== current.barcode) {
    const existing = await db.query.products.findFirst({
      where: and(eq(schema.products.barcode, rest.barcode), ne(schema.products.id, id)),
    });
    if (existing) return c.json({ error: 'Ese código de barras ya está registrado en otro producto.' }, 409);
  }

  const updates: Record<string, any> = { updatedAt: new Date() };

  for (const [k, v] of Object.entries(rest)) {
    if (v !== undefined) updates[k] = v;
  }

  if (rest.name) {
    const slugParts = [rest.name, rest.brand, rest.color, capacidad, largo, peso].filter(Boolean);
    updates.slug = slugify(slugParts.join('-'));
  }

  if (capacidad || largo || peso) {
    const existing = await db.query.products.findFirst({
      where: eq(schema.products.id, id),
      columns: { attributes: true },
    });
    const attrs = { ...((existing?.attributes || {}) as Record<string, string>) };
    if (capacidad) attrs.capacidad = capacidad;
    if (largo) attrs.largo = largo;
    if (peso) attrs.peso = peso;
    updates.attributes = attrs;
  }

  // Non-creator editing a pending product: reset verification, transfer ownership
  if (!isCreator) {
    updates.verificationScore = 0;
    updates.status = 'pending';
    updates.createdBy = auth.userId;
  }

  const [updated] = await db.update(schema.products)
    .set(updates)
    .where(eq(schema.products.id, id))
    .returning();
  if (!updated) return c.json({ error: 'not_found' }, 404);
  return c.json(updated);
});

const bulkSchema = z.object({
  name: z.string().min(1),
  barcode: z.string().optional().default(''),
  brand: z.string().optional().default(''),
  category: z.string().optional().default(''),
  sku: z.string().optional().default(''),
  color: z.string().optional().default(''),
  capacidad: z.string().optional().default(''),
  largo: z.string().optional().default(''),
  peso: z.string().optional().default(''),
  price: z.number().optional().default(0),
  stock: z.number().int().min(0).optional().default(0),
  cost: z.number().optional().default(0),
});

productsRouter.post('/bulk', async (c) => {
  const raw = await c.req.json();
  const parsed = z.object({
    products: z.array(bulkSchema).min(1).max(500),
    businessSlug: z.string().optional(),
  }).safeParse(raw);

  if (!parsed.success) {
    return c.json({ error: 'validation_error', details: parsed.error.flatten() }, 400);
  }

  const auth = requireAuth(c);
  if (!auth) return c.json({ error: 'auth_required' }, 401);

  const { products, businessSlug } = parsed.data;
  let business: any = null;

  if (businessSlug) {
    business = await db.query.businesses.findFirst({
      where: eq(schema.businesses.slug, businessSlug),
    });
    if (!business) return c.json({ error: 'business_not_found' }, 404);
  }

  const created: any[] = [];
  const errors: { index: number; name: string; error: string }[] = [];

  const userId = auth.userId;

  // Resolve import category text -> category_id against the existing tree.
  // No match means no category (we never auto-create categories from imports).
  const allCats = await db.query.categories.findMany({ columns: { id: true, name: true, slug: true } });
  const catByKey = new Map<string, string>();
  for (const cat of allCats) {
    catByKey.set(cat.name.toLowerCase().trim(), cat.id);
    catByKey.set(cat.slug.toLowerCase().trim(), cat.id);
  }
  const resolveCategory = (text?: string): string | null =>
    text ? (catByKey.get(text.toLowerCase().trim()) ?? null) : null;
  // Fallback: auto-categorize by product name when no category was given/matched.
  const autoCategory = (name: string): string | null =>
    catByKey.get(categorize(name) ?? '') ?? null;

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    try {
      const slugParts = [p.name, p.brand, p.color, p.capacidad, p.largo, p.peso].filter(Boolean);
      const slug = slugify(slugParts.join('-'));

      let product: any = null;

      if (p.barcode) {
        const withBc = await db.query.products.findMany({
          where: eq(schema.products.barcode, p.barcode),
          columns: { id: true, slug: true },
        });
        const match = withBc.find((e: any) => e.slug === slug);
        if (match) {
          product = await db.query.products.findFirst({ where: eq(schema.products.id, match.id) });
        }
      } else {
        product = await db.query.products.findFirst({ where: eq(schema.products.slug, slug) });
      }

      if (product) {
      } else {
        const attrs: Record<string, string> = {};
        if (p.capacidad) attrs.capacidad = p.capacidad;
        if (p.largo) attrs.largo = p.largo;
        if (p.peso) attrs.peso = p.peso;

        const [created] = await db.insert(schema.products).values({
          barcode: p.barcode || '',
          slug,
          name: p.name,
          brand: p.brand,
          sku: p.sku,
          color: p.color,
          categoryId: resolveCategory(p.category) ?? autoCategory(p.name),
          attributes: attrs,
          createdBy: userId,
        }).returning();
        product = created;

        const aliasList: { productId: string; alias: string; source: string }[] = [
          { productId: product.id, alias: product.name, source: 'manual' },
        ];
        if (p.brand) {
          const typeKeywords = ['auricular','parlante','cable','notebook','monitor','mouse','teclado','celular','tablet','impresora','router','alfajor','galletita','bebida','cargador','funda','memoria','disco','protector'];
          const tokens = product.name.split(/\s+/);
          const withoutType = tokens.filter((t: string) => !typeKeywords.includes(t.toLowerCase())).join(' ');
          if (withoutType && withoutType !== product.name) {
            aliasList.push({ productId: product.id, alias: withoutType, source: 'ai' });
          }
        }
        await db.insert(schema.productAliases).values(aliasList);
      }

      if (business && (p.price > 0 || p.stock > 0 || p.cost > 0)) {
        await db.insert(schema.businessProducts).values({
          businessId: business.id,
          productId: product.id,
          stock: p.stock,
          price: String(p.price),
          cost: String(p.cost),
        }).onConflictDoUpdate({
          target: [schema.businessProducts.businessId, schema.businessProducts.productId],
          set: { stock: p.stock, price: String(p.price), cost: String(p.cost) },
        });
      }

      created.push(product);
    } catch (err: any) {
      errors.push({ index: i, name: p.name, error: err?.message ?? 'unknown error' });
    }
  }

  return c.json({ created, errors, total: products.length }, 201);
});

productsRouter.get('/', async (c) => {
  const page = Math.max(1, parseInt(c.req.query('page') ?? '1'));
  const limit = Math.min(Math.max(1, parseInt(c.req.query('limit') ?? '20')), 100);
  const offset = (page - 1) * limit;

  const results = await db.query.products.findMany({
    limit, offset,
    orderBy: (p, { asc }) => asc(p.name),
    with: { category: true },
  });
  return c.json({ data: results, page, limit });
});
