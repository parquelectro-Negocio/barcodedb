import { pgTable, uuid, text, integer, numeric, jsonb, boolean, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').default('').notNull(),
  avatarUrl: text('avatar_url').default('').notNull(),
  passwordHash: text('password_hash').notNull(),
  isModerator: boolean('is_moderator').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const categories = pgTable('categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  parentId: uuid('parent_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const categoryAttributes = pgTable('category_attributes', {
  id: uuid('id').defaultRandom().primaryKey(),
  categoryId: uuid('category_id').notNull().references(() => categories.id),
  name: text('name').notNull(),
  label: text('label').notNull(),
  type: text('type').default('text').notNull(),
  options: jsonb('options'),
  required: boolean('required').default(false).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
});

export const products = pgTable('products', {
  id: uuid('id').defaultRandom().primaryKey(),
  barcode: text('barcode').notNull(),
  name: text('name').notNull(),
  slug: text('slug').notNull().default(''),
  brand: text('brand').default('').notNull(),
  sku: text('sku').default('').notNull(),
  color: text('color').default('').notNull(),
  description: text('description').default('').notNull(),
  categoryId: uuid('category_id').references(() => categories.id),
  imageUrl: text('image_url').default('').notNull(),
  unit: text('unit').default('unidad').notNull(),
  attributes: jsonb('attributes').default({}).notNull(),
  status: text('status').default('pending').notNull(),
  verificationScore: integer('verification_score').default(0).notNull(),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const productVariants = pgTable('product_variants', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: uuid('product_id').notNull().references(() => products.id),
  name: text('name').notNull(),
  barcode: text('barcode'),
  attributes: jsonb('attributes').default({}).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
});

export const businesses = pgTable('businesses', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  plan: text('plan').default('free').notNull(),
  sectors: text('sectors').array(),
  logoUrl: text('logo_url').default('').notNull(),
  // Default markup % used to auto-suggest a sale price from cost when adding
  // NEW products. Never applied retroactively to already-priced inventory.
  defaultMargin: numeric('default_margin', { precision: 6, scale: 2 }).default('0').notNull(),
  ownerId: uuid('owner_id').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const businessProducts = pgTable('business_products', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id').notNull().references(() => businesses.id),
  productId: uuid('product_id').notNull().references(() => products.id),
  variantId: uuid('variant_id').references(() => productVariants.id),
  sku: text('sku').default('').notNull(),
  stock: integer('stock').default(0).notNull(),
  cost: numeric('cost', { precision: 12, scale: 2 }).default('0').notNull(),
  price: numeric('price', { precision: 12, scale: 2 }).default('0').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueIdx: uniqueIndex('business_product_unique').on(table.businessId, table.productId),
}));

export const productVotes = pgTable('product_votes', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  productId: uuid('product_id').references(() => products.id),
  vote: text('vote').default('confirm').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueIdx: uniqueIndex('product_votes_unique').on(table.userId, table.productId),
}));

// Reclamos y sugerencias — go straight to the owner (moderator) to read.
export const feedback = pgTable('feedback', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id),
  kind: text('kind').default('sugerencia').notNull(), // reclamo | sugerencia
  message: text('message').notNull(),
  contact: text('contact').default('').notNull(),
  status: text('status').default('open').notNull(), // open | done
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const productAliases = pgTable('product_aliases', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: uuid('product_id').notNull().references(() => products.id),
  alias: text('alias').notNull(),
  source: text('source').default('manual').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const sales = pgTable('sales', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id').notNull().references(() => businesses.id),
  total: numeric('total', { precision: 12, scale: 2 }).notNull(),
  paymentMethod: text('payment_method'),
  amountTendered: numeric('amount_tendered', { precision: 12, scale: 2 }),
  change: numeric('change', { precision: 12, scale: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const saleItems = pgTable('sale_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  saleId: uuid('sale_id').notNull().references(() => sales.id),
  businessProductId: uuid('business_product_id').notNull().references(() => businessProducts.id),
  quantity: integer('quantity').default(1).notNull(),
  unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull(),
  total: numeric('total', { precision: 12, scale: 2 }).notNull(),
});

export const duplicateReports = pgTable('duplicate_reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  reportedId: uuid('reported_id').notNull().references(() => products.id),
  targetId: uuid('target_id').notNull().references(() => products.id),
  reportedBy: uuid('reported_by').notNull().references(() => users.id),
  status: text('status').default('pending').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolvedBy: uuid('resolved_by').references(() => users.id),
});
