import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { normalizeProduct } from '../lib/format';
import { useToast } from '../lib/toast';
import { API_BASE, uploadImage, resolveImageUrl } from '../lib/config';
import { apiHeaders } from '../lib/user';
import { Autocomplete } from '../components/Autocomplete';

type Attribute = { id: string; name: string; label: string; type: string; options: any; required: boolean };

export function EditProduct() {
  const { barcode } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [attrs, setAttrs] = useState<Attribute[]>([]);
  const [productId, setProductId] = useState('');
  const [existingImage, setExistingImage] = useState('');
  const [form, setForm] = useState<Record<string, any>>({
    barcode: '', name: '', brand: '', color: '', sku: '', description: '', unit: 'unidad', categoryId: '',
  });

  const set = (field: string, value: any) => setForm((f: any) => ({ ...f, [field]: value }));

  useEffect(() => {
    fetch(`${API_BASE}/categories`).then(r => r.json()).then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    if (!barcode) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/products/${barcode}`);
        if (!res.ok) { toast('Producto no encontrado', 'error'); navigate('/'); return; }
        const data = await res.json();
        const p = data.products?.[0];
        if (!p) { toast('Producto no encontrado', 'error'); navigate('/'); return; }

        setProductId(p.id);
        setExistingImage(p.imageUrl);
        setForm({
          barcode: p.barcode,
          name: p.name,
          brand: p.brand,
          color: p.color,
          sku: p.sku,
          description: p.description,
          unit: p.unit,
          categoryId: p.categoryId ?? '',
        });
      } catch {
        toast('Error al cargar producto', 'error');
        navigate('/');
      } finally {
        setLoading(false);
      }
    })();
  }, [barcode]);

  useEffect(() => {
    if (!form.categoryId) { setAttrs([]); return; }
    fetch(`${API_BASE}/categories/${form.categoryId}/attributes`)
      .then(r => r.json())
      .then(setAttrs)
      .catch(() => setAttrs([]));
  }, [form.categoryId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const normalized = normalizeProduct(form);

    let imageUrl = normalized.imageUrl || existingImage;
    const fileInput = document.getElementById('edit-product-image') as HTMLInputElement;
    const file = fileInput?.files?.[0];

    try {
      if (file) imageUrl = await uploadImage(file);

      const res = await fetch(`${API_BASE}/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...apiHeaders() },
        body: JSON.stringify({
          barcode: normalized.barcode,
          name: normalized.name?.toUpperCase() ?? '',
          brand: normalized.brand?.toUpperCase() ?? '',
          sku: normalized.sku?.toUpperCase() ?? '',
          color: normalized.color?.toUpperCase() ?? '',
          description: normalized.description,
          unit: normalized.unit?.toUpperCase() ?? '',
          categoryId: normalized.categoryId || null,
          imageUrl,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: 'Error al guardar' }));
        throw new Error(errBody.error || 'Error al guardar');
      }
      queryClient.invalidateQueries({ queryKey: ['product', barcode] });
      toast('Producto actualizado', 'success');
      navigate(`/product/${normalized.slug || normalized.barcode}`);
    } catch (err: any) {
      toast(err?.message || 'Error al actualizar el producto', 'error');
    } finally {
      setSaving(false);
    }
  };

  const searchBrands = async (q: string) => {
    const res = await fetch(`${API_BASE}/search/brands?q=${encodeURIComponent(q)}&limit=10`);
    if (!res.ok) return [];
    const list: string[] = await res.json();
    return list.map(b => ({ value: b, label: b }));
  };

  const searchCategories = async (q: string) => {
    const res = await fetch(`${API_BASE}/categories?q=${encodeURIComponent(q)}`);
    if (!res.ok) return [];
    const list: any[] = await res.json();
    return list.map(c => ({ value: c.id, label: c.name }));
  };

  if (loading) {
    return <div className="max-w-2xl mx-auto text-center py-16"><p className="text-stone-500">Cargando producto...</p></div>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-stone-800">Editar producto</h2>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm text-stone-500 mb-1">Nombre *</label>
          <input
            type="text" value={form.name} required
            onChange={e => set('name', e.target.value.toUpperCase())}
            className="w-full px-4 py-2 bg-white border border-stone-300 rounded-lg text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="Ej: CABLE HDMI 2M"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-stone-500 mb-1">Marca</label>
            <Autocomplete
              value={form.brand}
              onChange={(val, opt) => set('brand', (opt?.value ?? val).toUpperCase())}
              onSearch={searchBrands}
              placeholder="Ej: SAMSUNG"
            />
          </div>
          <div>
            <label className="block text-sm text-stone-500 mb-1">SKU</label>
            <input
              type="text" value={form.sku}
              onChange={e => set('sku', e.target.value.toUpperCase())}
              className="w-full px-4 py-2 bg-white border border-stone-300 rounded-lg font-mono text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Ej: MON-27-4K"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-stone-500 mb-1">Código de barras</label>
            <input
              type="text" value={form.barcode}
              onChange={e => set('barcode', e.target.value.replace(/\D/g, ''))}
              className="w-full px-4 py-2 bg-white border border-stone-300 rounded-lg font-mono text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Ej: 7790040929604"
            />
          </div>
          <div>
            <label className="block text-sm text-stone-500 mb-1">Color</label>
            <input
              type="text" value={form.color}
              onChange={e => set('color', e.target.value.toUpperCase())}
              className="w-full px-4 py-2 bg-white border border-stone-300 rounded-lg text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Ej: NEGRO, BLANCO, ROJO"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-stone-500 mb-1">Categoría</label>
          <Autocomplete
            value={categories.find((c: any) => c.id === form.categoryId)?.name ?? ''}
            onChange={(val, opt) => set('categoryId', opt?.value ?? '')}
            onSearch={searchCategories}
            placeholder="Buscá una categoría..."
          />
        </div>

        {attrs.map((a: Attribute) => (
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
          {existingImage && (
            <div className="mb-2">
              <img
                src={resolveImageUrl(existingImage)}
                alt="Actual"
                className="w-24 h-24 object-cover rounded-lg border border-stone-200"
              />
              <p className="text-xs text-stone-400 mt-1">Imagen actual</p>
            </div>
          )}
          <input
            id="edit-product-image"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="w-full text-sm text-stone-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg
                       file:border-0 file:bg-stone-100 file:text-stone-700 hover:file:bg-stone-200"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-stone-500 mb-1">Unidad</label>
            <input
              type="text" value={form.unit}
              onChange={e => set('unit', e.target.value.toUpperCase())}
              className="w-full px-4 py-2 bg-white border border-stone-300 rounded-lg text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Ej: UNIDAD, METRO, CAJA"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex-1 py-3 bg-stone-100 hover:bg-stone-200 rounded-xl font-medium text-stone-700"
          >
            Cancelar
          </button>
          <button
            type="submit" disabled={saving}
            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-xl font-medium text-lg text-white"
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  );
}
