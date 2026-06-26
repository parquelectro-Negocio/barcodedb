import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE } from '../lib/config';
import { useToast } from '../lib/toast';

type BPItem = {
  id: string;
  productId: string;
  sku: string;
  stock: number;
  price: string;
  cost: string;
  product: { id: string; name: string; barcode: string; imageUrl: string; brand: string };
};

export function StockPage() {
  const { toast } = useToast();
  const [businessSlug, setBusinessSlug] = useState(localStorage.getItem('biz_slug') || '');
  const [business, setBusiness] = useState<any>(null);
  const [items, setItems] = useState<BPItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busError, setBusError] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Record<string, { stock: number; price: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [filterStock, setFilterStock] = useState<'all' | 'low' | 'out'>('all');

  const loadBusiness = async (slug: string) => {
    if (!slug.trim()) return;
    setLoading(true);
    setBusError('');
    try {
      const res = await fetch(`${API_BASE}/businesses/${slug}`);
      if (!res.ok) { setBusError('Comercio no encontrado'); setLoading(false); return; }
      const b = await res.json();
      setBusiness(b);
      localStorage.setItem('biz_slug', slug);
      const bpRes = await fetch(`${API_BASE}/businesses/${slug}/products`);
      if (bpRes.ok) {
        const data = await bpRes.json();
        setItems(Array.isArray(data) ? data : []);
      }
    } catch { setBusError('Error al cargar'); } finally { setLoading(false); }
  };

  useEffect(() => {
    if (businessSlug) loadBusiness(businessSlug);
  }, []);

  const startEdit = (item: BPItem) => {
    setEditing(prev => ({ ...prev, [item.id]: { stock: item.stock, price: item.price } }));
  };

  const cancelEdit = (id: string) => {
    setEditing(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  const saveItem = async (item: BPItem) => {
    const edit = editing[item.id];
    if (!edit) return;
    setSaving(item.id);
    try {
      const res = await fetch(`${API_BASE}/businesses/${business!.slug}/products/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: edit.stock, price: String(edit.price) }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, stock: updated.stock, price: updated.price } : i));
      cancelEdit(item.id);
      toast('Stock actualizado', 'success');
    } catch {
      toast('Error al guardar', 'error');
    } finally {
      setSaving(null);
    }
  };

  const filtered = items.filter(i => {
    if (filterStock === 'low') return i.stock > 0 && i.stock <= 5;
    if (filterStock === 'out') return i.stock === 0;
    return true;
  }).filter(i => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return i.product.name.toLowerCase().includes(q)
      || i.product.barcode.includes(q)
      || i.product.brand.toLowerCase().includes(q)
      || i.sku.toLowerCase().includes(q);
  });

  const lowStockCount = items.filter(i => i.stock > 0 && i.stock <= 5).length;
  const outOfStockCount = items.filter(i => i.stock === 0).length;
  const totalValue = items.reduce((s, i) => s + (parseFloat(i.price) * i.stock), 0);

  if (!business && !loading) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <h2 className="text-2xl font-bold mb-2 text-stone-800">Gestión de stock</h2>
        <p className="text-stone-500 mb-8">Ingresá tu comercio para ver y ajustar tu inventario</p>
        <input
          type="text"
          value={businessSlug}
          onChange={e => setBusinessSlug(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && loadBusiness(businessSlug)}
          placeholder="Identificador de tu comercio"
          className="w-full px-4 py-3 bg-white border border-stone-300 rounded-xl text-lg text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
          autoFocus
        />
        <button
          onClick={() => loadBusiness(businessSlug)}
          className="w-full py-3 mt-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-lg font-medium"
        >
          Ingresar
        </button>
        {busError && <p className="text-sm text-red-600 mt-2">{busError}</p>}
      </div>
    );
  }

  if (loading) {
    return <div className="max-w-4xl mx-auto text-center py-16"><p className="text-stone-500 text-lg">Cargando inventario...</p></div>;
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-stone-800">Stock</h2>
          <p className="text-sm text-emerald-600 font-medium">{business?.name}</p>
        </div>
        <button
          onClick={() => { setBusiness(null); setBusinessSlug(''); }}
          className="text-xs text-stone-400 hover:text-stone-600 underline"
        >
          Cambiar comercio
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-stone-400 uppercase tracking-wide mb-1">Productos</p>
          <p className="text-2xl font-bold text-stone-800">{items.length}</p>
        </div>
        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-stone-400 uppercase tracking-wide mb-1">Valor inventario</p>
          <p className="text-2xl font-bold text-stone-800">${totalValue.toFixed(2)}</p>
        </div>
        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-stone-400 uppercase tracking-wide mb-1">Stock bajo</p>
          <p className="text-2xl font-bold text-amber-600">{lowStockCount}</p>
          {outOfStockCount > 0 && <p className="text-xs text-red-500">{outOfStockCount} sin stock</p>}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar en inventario..."
          className="flex-1 min-w-[200px] px-4 py-2 bg-white border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <div className="flex gap-1">
          {(['all', 'low', 'out'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterStock(f)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                filterStock === f
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
              }`}
            >
              {f === 'all' ? 'Todos' : f === 'low' ? 'Stock bajo' : 'Sin stock'}
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-stone-300 text-lg">Tu inventario está vacío</p>
          <p className="text-stone-400 text-sm mt-1">Agregá productos desde el detalle de cada producto</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-stone-300 text-lg">No hay resultados para esta búsqueda</p>
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
          <div className="divide-y divide-stone-100">
            {filtered.map(item => {
              const edit = editing[item.id];
              const isEditing = edit !== undefined;
              const isLow = item.stock > 0 && item.stock <= 5;
              const isOut = item.stock === 0;

              return (
                <div key={item.id} className={`p-4 ${isOut ? 'bg-red-50' : isLow ? 'bg-amber-50' : ''}`}>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <Link to={`/product/${item.product.barcode}`} className="font-medium text-sm text-stone-800 hover:text-emerald-700 truncate block">
                        {item.product.name}
                      </Link>
                      <div className="flex gap-3 text-xs text-stone-400 mt-0.5">
                        <span className="font-mono">{item.product.barcode}</span>
                        {item.sku && <span>SKU: {item.sku}</span>}
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center">
                          <button
                            onClick={() => setEditing(prev => ({ ...prev, [item.id]: { ...prev[item.id], stock: Math.max(0, edit.stock - 1) } }))}
                            className="w-8 h-8 bg-stone-100 hover:bg-stone-200 rounded-lg text-stone-600 font-bold"
                          >-</button>
                          <input
                            type="number"
                            min="0"
                            value={edit.stock}
                            onChange={e => setEditing(prev => ({ ...prev, [item.id]: { ...prev[item.id], stock: Math.max(0, parseInt(e.target.value) || 0) } }))}
                            className="w-16 text-center font-mono text-lg bg-transparent border-none focus:outline-none"
                          />
                          <button
                            onClick={() => setEditing(prev => ({ ...prev, [item.id]: { ...prev[item.id], stock: edit.stock + 1 } }))}
                            className="w-8 h-8 bg-stone-100 hover:bg-stone-200 rounded-lg text-stone-600 font-bold"
                          >+</button>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => saveItem(item)}
                            disabled={saving === item.id}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg text-xs font-medium text-white"
                          >
                            {saving === item.id ? '...' : 'Guardar'}
                          </button>
                          <button
                            onClick={() => cancelEdit(item.id)}
                            className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 rounded-lg text-xs text-stone-600"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                          <p className={`text-lg font-bold font-mono ${isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-stone-800'}`}>
                            {item.stock}
                          </p>
                          <p className="text-xs text-stone-400">uds.</p>
                        </div>
                        <div className="text-right min-w-[70px]">
                          <p className="text-sm font-mono text-stone-700">${parseFloat(item.price).toFixed(2)}</p>
                          <p className="text-xs text-stone-400">precio</p>
                        </div>
                        <button
                          onClick={() => startEdit(item)}
                          className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 rounded-lg text-xs text-stone-600"
                        >
                          Ajustar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
