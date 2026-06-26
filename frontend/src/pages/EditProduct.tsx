import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_BASE } from '../lib/config';
import { useToast } from '../lib/toast';

type Category = { id: string; name: string; slug: string };
type Attribute = { id: string; name: string; label: string; type: string; options: any; required: boolean };

export function EditProduct() {
  const { barcode } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [attrs, setAttrs] = useState<Attribute[]>([]);
  const [productId, setProductId] = useState('');
  const [existingImage, setExistingImage] = useState('');
  const [form, setForm] = useState<Record<string, any>>({
    barcode: '', name: '', brand: '', color: '', sku: '', description: '', unit: 'unidad', categoryId: '',
  });

  const set = (field: string, value: any) => setForm((f: any) => ({ ...f, [field]: value }));

  useEffect(() => {
    fetch(`${API_BASE}/categories`)
      .then(r => r.json())
      .then(setCategories)
      .catch(() => {});
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

    let imageUrl = form.imageUrl || existingImage;
    const fileInput = document.getElementById('edit-product-image') as HTMLInputElement;
    const file = fileInput?.files?.[0];
    if (file) {
      const reader = new FileReader();
      imageUrl = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    }

    try {
      const res = await fetch(`${API_BASE}/products/${productId}`, {
        method: 'PATCH',
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
        }),
      });
      if (!res.ok) throw new Error('Error al guardar');
      toast('Producto actualizado', 'success');
      navigate(`/product/${form.barcode}`);
    } catch {
      toast('Error al actualizar el producto', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="max-w-2xl mx-auto text-center py-16"><p className="text-stone-500">Cargando producto...</p></div>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-stone-800">Editar producto</h2>

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
          </div>
          <div>
            <label className="block text-sm text-stone-500 mb-1">Marca</label>
            <input
              type="text" value={form.brand}
              onChange={e => set('brand', e.target.value)}
              className="w-full px-4 py-2 bg-white border border-stone-300 rounded-lg text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Ej: Samsung"
            />
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
            {categories.map((c: Category) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

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
                src={existingImage.startsWith('/') ? `${API_BASE.replace('/api', '')}${existingImage}` : existingImage}
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
