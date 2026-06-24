import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

const API = '/api';

type Category = { id: string; name: string; slug: string };
type Attribute = { id: string; name: string; label: string; type: string; options: any; required: boolean };

export function AddProduct() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const barcode = params.get('barcode') ?? '';

  const [categories, setCategories] = useState<Category[]>([]);
  const [attrs, setAttrs] = useState<Attribute[]>([]);
  const [form, setForm] = useState<Record<string, any>>({
    barcode, name: '', brand: '', description: '', unit: 'unidad', categoryId: '',
  });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`${API}/categories`)
      .then(r => r.json())
      .then(setCategories)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!form.categoryId) { setAttrs([]); return; }
    fetch(`${API}/categories/${form.categoryId}/attributes`)
      .then(r => r.json())
      .then(setAttrs)
      .catch(() => setAttrs([]));
  }, [form.categoryId]);

  const set = (field: string, value: any) => setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const categoryAttrs: Record<string, any> = {};
    for (const a of attrs) {
      const v = form[`attr_${a.name}`];
      if (v !== undefined && v !== '') categoryAttrs[a.name] = v;
    }

    try {
      const res = await fetch(`${API}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barcode: form.barcode,
          name: form.name,
          brand: form.brand,
          description: form.description,
          unit: form.unit,
          categoryId: form.categoryId || null,
          attributes: categoryAttrs,
        }),
      });
      if (!res.ok) throw new Error('Error al guardar');
      const product = await res.json();
      setDone(true);
      setTimeout(() => navigate(`/product/${product.barcode}`), 1500);
    } catch {
      alert('Error al guardar el producto');
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <div className="text-center py-16">
        <div className="text-emerald-400 text-5xl mb-4">✓</div>
        <p className="text-lg">Producto guardado. Redirigiendo...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Agregar producto</h2>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm text-slate-400 mb-1">Código de barras</label>
          <input
            type="text" value={form.barcode} readOnly
            className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg font-mono text-sm opacity-60 cursor-not-allowed"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Nombre *</label>
            <input
              type="text" value={form.name} required
              onChange={e => set('name', e.target.value)}
              className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Ej: Cable HDMI 2m"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Marca</label>
            <input
              type="text" value={form.brand}
              onChange={e => set('brand', e.target.value)}
              className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Ej: Samsung"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1">Categoría</label>
          <select
            value={form.categoryId}
            onChange={e => set('categoryId', e.target.value)}
            className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Sin categoría</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {attrs.map(a => (
          <div key={a.id}>
            <label className="block text-sm text-slate-400 mb-1">
              {a.label} {a.required && <span className="text-red-400">*</span>}
            </label>
            {a.type === 'select' ? (
              <select
                value={form[`attr_${a.name}`] ?? ''}
                required={a.required}
                onChange={e => set(`attr_${a.name}`, e.target.value)}
                className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg"
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
                className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            )}
          </div>
        ))}

        <div>
          <label className="block text-sm text-slate-400 mb-1">Descripción</label>
          <textarea
            value={form.description}
            onChange={e => set('description', e.target.value)}
            rows={3}
            className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Unidad</label>
            <select
              value={form.unit}
              onChange={e => set('unit', e.target.value)}
              className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg"
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
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-xl font-medium text-lg"
        >
          {saving ? 'Guardando...' : 'Guardar producto'}
        </button>
      </form>
    </div>
  );
}
