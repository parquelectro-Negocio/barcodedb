import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { normalizeName } from '../lib/normalizeName';
import { useToast } from '../lib/toast';
import { API_BASE } from '../lib/config';

type Category = { id: string; name: string; slug: string };
type Attribute = { id: string; name: string; label: string; type: string; options: any; required: boolean };

export function AddProduct() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const barcode = params.get('barcode') ?? '';
  const prefillName = params.get('name') ?? '';

  const [categories, setCategories] = useState<Category[]>([]);
  const [attrs, setAttrs] = useState<Attribute[]>([]);
  const [form, setForm] = useState<Record<string, any>>({
    barcode, name: prefillName, brand: '', color: '', sku: '', description: '', unit: 'unidad', categoryId: '',
  });
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [brands, setBrands] = useState<string[]>([]);
  const [normalized, setNormalized] = useState<{ name: string; brand: string | null } | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/categories`)
      .then(r => r.json())
      .then(setCategories)
      .catch(() => {});
    fetch(`${API_BASE}/search/brands?q=`)
      .then(r => r.json())
      .then(setBrands)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!form.categoryId) { setAttrs([]); return; }
    fetch(`${API_BASE}/categories/${form.categoryId}/attributes`)
      .then(r => r.json())
      .then(setAttrs)
      .catch(() => setAttrs([]));
  }, [form.categoryId]);

  const set = (field: string, value: any) => setForm(f => ({ ...f, [field]: value }));

  // Normalize name whenever name or category changes
  useEffect(() => {
    if (!form.name?.trim()) { setNormalized(null); return; }
    const timer = setTimeout(async () => {
      const result = await normalizeName(form.name, form.categoryId || undefined);
      if (result.name !== form.name || (result.brand && result.brand !== form.brand)) {
        setNormalized({ name: result.name, brand: result.brand });
      } else {
        setNormalized(null);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [form.name, form.categoryId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const categoryAttrs: Record<string, any> = {};
    for (const a of attrs) {
      const v = form[`attr_${a.name}`];
      if (v !== undefined && v !== '') categoryAttrs[a.name] = v;
    }

    let imageUrl = form.imageUrl ?? '';
    // Upload image first if selected
    const fileInput = document.getElementById('product-image') as HTMLInputElement;
    const file = fileInput?.files?.[0];
    if (file) {
      const fd = new FormData();
      fd.append('file', file);
      try {
        const upRes = await fetch(`${API_BASE}/upload`, { method: 'POST', body: fd });
        if (upRes.ok) {
          const upData = await upRes.json();
          imageUrl = upData.url;
        }
      } catch {}
    }

    try {
      const res = await fetch(`${API_BASE}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barcode: form.barcode,
          name: form.name,
          brand: form.brand,
          sku: form.sku,
          color: form.color,
          description: form.description,
          unit: form.unit,
          categoryId: form.categoryId || null,
          imageUrl,
          attributes: categoryAttrs,
        }),
      });
      if (!res.ok) throw new Error('Error al guardar');
      const product = await res.json();
      toast('Producto guardado', 'success');
      setDone(true);
      setTimeout(() => navigate(`/product/${product.barcode}`), 1500);
    } catch {
      toast('Error al guardar el producto', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <div className="text-center py-16">
        <div className="text-emerald-600 text-5xl mb-4">✓</div>
        <p className="text-lg">Producto guardado. Redirigiendo...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-stone-800">Agregar producto</h2>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm text-stone-500 mb-1">Código de barras</label>
            <input
              type="text" value={form.barcode}
              onChange={e => set('barcode', e.target.value)}
              className="w-full px-4 py-2 bg-white border border-stone-300 rounded-lg font-mono text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Ej: 7790040929604"
            />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-stone-500 mb-1">SKU</label>
            <input
              type="text" value={form.sku}
              onChange={e => set('sku', e.target.value)}
              className="w-full px-4 py-2 bg-white border border-stone-300 rounded-lg font-mono text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Ej: MON-27-4K"
            />
          </div>
          <div>
            <label className="block text-sm text-stone-500 mb-1">Color</label>
            <input
              type="text" value={form.color}
              onChange={e => set('color', e.target.value)}
              className="w-full px-4 py-2 bg-white border border-stone-300 rounded-lg text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Ej: Negro, Blanco, Rojo"
            />
          </div>
          <div>
            <label className="block text-sm text-stone-500 mb-1">Nombre *</label>
            <input
              type="text" value={form.name} required
              onChange={e => set('name', e.target.value)}
              className="w-full px-4 py-2 bg-white border border-stone-300 rounded-lg text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Ej: Cable HDMI 2m"
            />
            {normalized && (
              <button
                type="button"
                onClick={() => {
                  set('name', normalized.name);
                  if (normalized.brand && !form.brand) set('brand', normalized.brand);
                  setNormalized(null);
                }}
                className="mt-1 text-xs text-emerald-600 hover:text-emerald-500 underline text-left"
              >
                Sugerencia: {normalized.name}{normalized.brand ? ` · ${normalized.brand}` : ''} (click para aplicar)
              </button>
            )}
          </div>
          <div>
            <label className="block text-sm text-stone-500 mb-1">Marca</label>
            <input
              type="text" value={form.brand}
              onChange={e => set('brand', e.target.value)}
              className="w-full px-4 py-2 bg-white border border-stone-300 rounded-lg text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Ej: Samsung"
              list="brand-suggestions"
            />
            <datalist id="brand-suggestions">
              {brands.map(b => <option key={b} value={b} />)}
            </datalist>
          </div>
        </div>

        <div>
          <label className="block text-sm text-stone-500 mb-1">Categoría</label>
          <select
            value={form.categoryId}
            onChange={e => set('categoryId', e.target.value)}
            className="w-full px-4 py-2 bg-white border border-stone-300 rounded-lg text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Sin categoría</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {attrs.map(a => (
          <div key={a.id}>
            <label className="block text-sm text-stone-500 mb-1">
              {a.label} {a.required && <span className="text-red-500">*</span>}
            </label>
            {a.type === 'select' ? (
              <select
                value={form[`attr_${a.name}`] ?? ''}
                required={a.required}
                onChange={e => set(`attr_${a.name}`, e.target.value)}
                className="w-full px-4 py-2 bg-white border border-stone-300 rounded-lg text-stone-900"
              >
                <option value="">Seleccionar...</option>
                {(a.options as string[] ?? []).map((o: string) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            ) : (
              <input
                type={a.type === 'number' ? 'number' : 'text'}
                value={form[`attr_${a.name}`] ?? ''}
                required={a.required}
                onChange={e => set(`attr_${a.name}`, e.target.value)}
                className="w-full px-4 py-2 bg-white border border-stone-300 rounded-lg text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            )}
          </div>
        ))}

        <div>
          <label className="block text-sm text-stone-500 mb-1">Descripción</label>
          <textarea
            value={form.description}
            onChange={e => set('description', e.target.value)}
            rows={3}
            className="w-full px-4 py-2 bg-white border border-stone-300 rounded-lg text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
          />
        </div>

        <div>
          <label className="block text-sm text-stone-500 mb-1">Imagen</label>
          <input
            id="product-image"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="w-full text-sm text-stone-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg
                       file:border-0 file:bg-stone-100 file:text-stone-700 hover:file:bg-stone-200"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-stone-500 mb-1">Unidad</label>
            <select
              value={form.unit}
              onChange={e => set('unit', e.target.value)}
              className="w-full px-4 py-2 bg-white border border-stone-300 rounded-lg text-stone-900"
            >
              <option value="unidad">Unidad</option>
              <option value="kg">Kilogramo</option>
              <option value="g">Gramo</option>
              <option value="l">Litro</option>
              <option value="ml">Mililitro</option>
              <option value="m">Metro</option>
            </select>
          </div>
        </div>

        <button
          type="submit" disabled={saving}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-xl font-medium text-lg text-white"
        >
          {saving ? 'Guardando...' : 'Guardar producto'}
        </button>
      </form>
    </div>
  );
}
