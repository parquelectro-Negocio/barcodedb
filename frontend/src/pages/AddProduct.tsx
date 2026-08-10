import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { normalizeName } from '../lib/normalizeName';
import { normalizeProduct } from '../lib/format';
import { useToast } from '../lib/toast';
import { API_BASE, uploadImage } from '../lib/config';
import { apiHeaders } from '../lib/user';
import { Autocomplete } from '../components/Autocomplete';

type Category = { id: string; name: string; slug: string; parentId?: string | null };
type Attribute = { id: string; name: string; label: string; type: string; options: any; required: boolean };

export function AddProduct() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const barcode = params.get('barcode') ?? '';
  const prefillName = params.get('name') ?? '';

  const [categories, setCategories] = useState<Category[]>([]);
  const [attrs, setAttrs] = useState<Attribute[]>([]);
  const [form, setForm] = useState<Record<string, any>>({
    barcode, name: prefillName, brand: '', color: '', capacidad: '', largo: '', peso: '', sku: '', description: '', unit: 'unidad', categoryId: '',
  });
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [normalized, setNormalized] = useState<{ name: string; brand: string | null } | null>(null);
  const [brandInput, setBrandInput] = useState('');
  const [existingWithBc, setExistingWithBc] = useState<any[]>([]);
  const [imageName, setImageName] = useState('');
  const [bizSectors, setBizSectors] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiUsed, setAiUsed] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/categories`)
      .then(r => r.json())
      .then(setCategories)
      .catch(() => {});
  }, []);

  // Load the current shop's sectors so its categories surface as quick picks.
  useEffect(() => {
    const slug = localStorage.getItem('biz_slug');
    if (!slug) return;
    fetch(`${API_BASE}/businesses/${slug}`, { headers: apiHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(b => { if (Array.isArray(b?.sectors)) setBizSectors(b.sectors); })
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

  // Ask the backend (Gemini) to fill brand/category/description/color from the
  // name. Only fills fields the user left empty — never overwrites their input.
  const enrichWithAI = async () => {
    if (!form.name?.trim()) { toast('Escribí un nombre primero', 'error'); return; }
    setAiLoading(true);
    try {
      const res = await fetch(`${API_BASE}/products/ai-enrich`, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({ name: form.name, barcode: form.barcode }),
      });
      if (res.status === 503) { toast('La IA todavía no está configurada', 'info'); return; }
      if (!res.ok) { toast('La IA no pudo completar los datos', 'error'); return; }
      const d = await res.json();
      setForm(f => {
        const next = { ...f };
        if (d.brand && !f.brand) next.brand = d.brand.toUpperCase();
        if (d.color && !f.color) next.color = d.color.toUpperCase();
        if (d.capacidad && !f.capacidad) next.capacidad = d.capacidad.toUpperCase();
        if (d.description && !f.description) next.description = d.description;
        if (d.category && !f.categoryId) {
          const cat = categories.find(c => c.name.toLowerCase() === String(d.category).toLowerCase());
          if (cat) next.categoryId = cat.id;
        }
        return next;
      });
      if (d.brand && !form.brand) setBrandInput(d.brand.toUpperCase());
      setAiUsed(true);
      toast('Datos sugeridos por IA — revisalos antes de guardar', 'success');
    } catch { toast('Error al conectar con la IA', 'error'); }
    finally { setAiLoading(false); }
  };

  // When barcode changes, check for existing products
  useEffect(() => {
    if (!form.barcode?.trim()) { setExistingWithBc([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/products/${form.barcode}`);
        if (res.ok) {
          const data = await res.json();
          const list: any[] = data?.products ?? [];
          setExistingWithBc(list.filter((p: any) => p.barcode === form.barcode));
        }
      } catch {}
    }, 500);
    return () => clearTimeout(timer);
  }, [form.barcode]);

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

    const normalized = normalizeProduct(form);
    const categoryAttrs: Record<string, any> = {};
    for (const a of attrs) {
      const v = normalized[`attr_${a.name}`];
      if (v !== undefined && v !== '') categoryAttrs[a.name] = v;
    }

    let imageUrl = normalized.imageUrl ?? '';
    const fileInput = document.getElementById('product-image') as HTMLInputElement;
    const file = fileInput?.files?.[0];

    // The image is optional metadata — a failed upload must not block cataloging.
    let imageFailed = false;
    if (file) {
      try { imageUrl = await uploadImage(file); }
      catch { imageFailed = true; }
    }

    try {
      const res = await fetch(`${API_BASE}/products`, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({
          barcode: normalized.barcode,
          name: normalized.name?.toUpperCase() ?? '',
          brand: normalized.brand?.toUpperCase() ?? '',
          sku: normalized.sku?.toUpperCase() ?? '',
          color: normalized.color?.toUpperCase() ?? '',
          capacidad: normalized.capacidad ?? '',
          largo: normalized.largo ?? '',
          peso: normalized.peso ?? '',
          description: normalized.description,
          unit: normalized.unit?.toUpperCase() ?? '',
          categoryId: normalized.categoryId || null,
          imageUrl,
          attributes: categoryAttrs,
        }),
      });
      const product = await res.json();
      if (product.existing) {
        toast('Este producto ya existe', 'info');
        setTimeout(() => navigate(`/product/${product.existing.slug || product.existing.id}`), 1000);
        return;
      }
      if (!res.ok) throw new Error('Error al guardar');
      toast(
        imageFailed ? 'Producto guardado (la imagen no se pudo subir — agregala después)' : 'Producto guardado',
        imageFailed ? 'info' : 'success',
      );
      setDone(true);
      setTimeout(() => navigate(`/product/${product.slug || product.barcode}`), 1500);
    } catch {
      toast('Error al guardar el producto', 'error');
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
    const list: Category[] = await res.json();
    return list.map(c => ({ value: c.id, label: c.name }));
  };

  const catName = (id: string) => categories.find(c => c.id === id)?.name ?? '';

  // Categories that belong to the shop's sectors — shown as one-tap chips.
  const relevantCats = bizSectors.length > 0
    ? categories.filter(c => {
        const parent = categories.find(p => p.id === c.parentId);
        return parent && bizSectors.includes(parent.slug);
      })
    : [];

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
          <label className="block text-sm text-stone-500 mb-1">Nombre *</label>
          <input
            type="text" value={form.name} required
            onChange={e => set('name', e.target.value.toUpperCase())}
            className="w-full px-4 py-2 bg-white border border-stone-300 rounded-lg text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="Ej: CABLE HDMI 2M"
          />
          {normalized && (
            <button
              type="button"
              onClick={() => {
                set('name', normalized.name?.toUpperCase() ?? '');
                if (normalized.brand && !form.brand) { set('brand', normalized.brand.toUpperCase()); setBrandInput(normalized.brand.toUpperCase()); }
                setNormalized(null);
              }}
              className="mt-1 text-xs text-emerald-600 hover:text-emerald-500 underline text-left"
            >
              Sugerencia: {normalized.name?.toUpperCase()}{normalized.brand ? ` · ${normalized.brand?.toUpperCase()}` : ''} (click para aplicar)
            </button>
          )}
          <div className="mt-2">
            <button
              type="button"
              onClick={enrichWithAI}
              disabled={aiLoading}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg px-3 py-1.5 disabled:opacity-50 transition-colors"
            >
              ✨ {aiLoading ? 'Completando...' : 'Autocompletar con IA'}
            </button>
            <span className="ml-2 text-xs text-stone-400">Escribí el nombre y la IA completa el resto</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-stone-500 mb-1">Marca</label>
            <Autocomplete
              value={brandInput}
              onChange={(val, opt) => { const v = (opt?.value ?? val).toUpperCase(); setBrandInput(v); set('brand', v); }}
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
            <label className="block text-sm text-stone-500 mb-1">Código de barras <span className="text-stone-300">(opcional)</span></label>
            <input
              type="text" value={form.barcode}
              onChange={e => set('barcode', e.target.value.replace(/\D/g, ''))}
              className="w-full px-4 py-2 bg-white border border-stone-300 rounded-lg font-mono text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Ej: 7790040929604. Sin código va por slug."
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
          <div>
            <label className="block text-sm text-stone-500 mb-1">Capacidad</label>
            <input
              type="text" value={form.capacidad}
              onChange={e => set('capacidad', e.target.value.toUpperCase())}
              className="w-full px-4 py-2 bg-white border border-stone-300 rounded-lg text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Ej: 1L, 500ML, 2KG"
            />
          </div>
          <div>
            <label className="block text-sm text-stone-500 mb-1">Largo</label>
            <input
              type="text" value={form.largo}
              onChange={e => set('largo', e.target.value.toUpperCase())}
              className="w-full px-4 py-2 bg-white border border-stone-300 rounded-lg text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Ej: 1M, 2M, 50CM"
            />
          </div>
          <div>
            <label className="block text-sm text-stone-500 mb-1">Peso</label>
            <input
              type="text" value={form.peso}
              onChange={e => set('peso', e.target.value.toUpperCase())}
              className="w-full px-4 py-2 bg-white border border-stone-300 rounded-lg text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Ej: 1KG, 500G, 2.5KG"
            />
          </div>
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

        <div>
          <label className="block text-sm text-stone-500 mb-1">Categoría</label>
          {relevantCats.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {relevantCats.map(c => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => set('categoryId', c.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    form.categoryId === c.id ? 'bg-emerald-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-emerald-50'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
          <Autocomplete
            value={catName(form.categoryId)}
            onChange={(val, opt) => set('categoryId', opt?.value ?? '')}
            onSearch={searchCategories}
            placeholder="Buscá otra categoría..."
          />
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
            onChange={e => setImageName(e.target.files?.[0]?.name ?? '')}
            className="w-full text-sm text-stone-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg
                       file:border-0 file:bg-stone-100 file:text-stone-700 hover:file:bg-stone-200"
          />
          {imageName && (
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('product-image') as HTMLInputElement;
                if (el) el.value = '';
                setImageName('');
              }}
              className="mt-2 text-xs text-red-500 hover:text-red-600 underline"
            >
              Quitar imagen ({imageName})
            </button>
          )}
        </div>

        {existingWithBc.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm font-semibold text-amber-800 mb-2">
              {existingWithBc.length} producto{existingWithBc.length > 1 ? 's' : ''} con este código de barras
            </p>
            <div className="space-y-2">
              {existingWithBc.map(p => (
                <Link
                  key={p.id}
                  to={`/product/${p.barcode || p.slug}`}
                  className="block text-sm text-amber-700 hover:text-amber-900 underline"
                >
                  {p.name} {p.brand ? `· ${p.brand}` : ''}
                </Link>
              ))}
            </div>
            <p className="text-xs text-amber-600 mt-2">
              Si es un producto diferente, completá los campos y guardá igual.
            </p>
          </div>
        )}

        {aiUsed && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            <span className="shrink-0">⚠️</span>
            <p>Algunos datos los completó la IA. <strong>Verificá que sean correctos</strong> (marca, categoría, descripción) antes de guardar — a veces se equivoca.</p>
          </div>
        )}

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
