import { relations } from 'drizzle-orm';
import * as s from './schema';

export const categoriesRelations = relations(s.categories, ({ one, many }) => ({
  parent: one(s.categories, { fields: [s.categories.parentId], references: [s.categories.id] }),
  children: many(s.categories),
  products: many(s.products),
}));

export const productsRelations = relations(s.products, ({ one, many }) => ({
  category: one(s.categories, { fields: [s.products.categoryId], references: [s.categories.id] }),
  variants: many(s.productVariants),
  aliases: many(s.productAliases),
  votes: many(s.productVotes),
}));

export const productVariantsRelations = relations(s.productVariants, ({ one }) => ({
  product: one(s.products, { fields: [s.productVariants.productId], references: [s.products.id] }),
}));

export const businessProductsRelations = relations(s.businessProducts, ({ one, many }) => ({
  business: one(s.businesses, { fields: [s.businessProducts.businessId], references: [s.businesses.id] }),
  product: one(s.products, { fields: [s.businessProducts.productId], references: [s.products.id] }),
  variant: one(s.productVariants, { fields: [s.businessProducts.variantId], references: [s.productVariants.id] }),
  saleItems: many(s.saleItems),
}));

export const salesRelations = relations(s.sales, ({ one, many }) => ({
  business: one(s.businesses, { fields: [s.sales.businessId], references: [s.businesses.id] }),
  items: many(s.saleItems),
}));

export const saleItemsRelations = relations(s.saleItems, ({ one }) => ({
  sale: one(s.sales, { fields: [s.saleItems.saleId], references: [s.sales.id] }),
  businessProduct: one(s.businessProducts, { fields: [s.saleItems.businessProductId], references: [s.businessProducts.id] }),
}));
