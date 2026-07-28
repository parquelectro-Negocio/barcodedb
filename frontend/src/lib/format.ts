export function titleCase(s: string): string {
  return s.replace(/\w\S*/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

export function normalizeProduct(form: Record<string, any>): Record<string, any> {
  return {
    ...form,
    name: form.name ? titleCase(form.name.trim()) : '',
    brand: form.brand ? titleCase(form.brand.trim()) : '',
    sku: form.sku ? form.sku.trim().toUpperCase() : '',
    color: form.color ? titleCase(form.color.trim()) : '',
    description: form.description?.trim() ?? '',
  };
}
