import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE, resolveImageUrl } from '../lib/config';
import { apiHeaders } from '../lib/user';
import { useToast } from '../lib/toast';

type BPItem = {
  id: string;
  productId: string;
  sku: string;
  stock: number;
  price: string;
  cost: string;
  product: { id: string; name: string; barcode: string; imageUrl: string; brand: string; slug: string };
};

export function StockPage() {
  const { toast } = useToast();
  const [businessSlug, setBusinessSlug] = useState(localStorage.getItem('biz_slug') || '');
  const [business, setBusiness] = useState<any>(null);
  const [items, setItems] = useState<BPItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busError, setBusError] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Record<string, { stock: number; price: string; cost: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [filterStock, setFilterStock] = useState<'all' | 'low' | 'out'>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [myShops, setMyShops] = useState<any[]>([]);

  const loadBusiness = async (slug: string) => {
    if (!slug.trim()) return;
    setLoading(true);
    setBusError('');
    try {
      const res = await fetch(`${API_BASE}/businesses/${slug}`, { headers: apiHeaders() });
      if (!res.ok) {
        // Stale pointer to a shop this account doesn't own — forget it so it won't auto-load again.
        if (res.status === 403) { localStorage.removeItem('biz_slug'); setBusinessSlug(''); }
        setBusError(res.status === 403 ? 'Ese comercio no es tuyo' : 'Comercio no encontrado');
        setLoading(false);
        return;
      }
      const b = await res.json();
      setBusiness(b);
      localStorage.setItem('biz_slug', slug);
      const bpRes = await fetch(`${API_BASE}/businesses/${slug}/products`, { headers: apiHeaders() });
      if (bpRes.ok) {
        const data = await bpRes.json();
        setItems(Array.isArray(data) ? data : []);
      }
    } catch { setBusError('Error al cargar'); } finally { setLoading(false); }
  };

  useEffect(() => {
    if (businessSlug) loadBusiness(businessSlug);
    fetch(`${API_BASE}/businesses/mine`, { headers: apiHeaders() })
      .then(r => (r.ok ? r.json() : []))
      .then(d => setMyShops(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const startEdit = (item: BPItem) => {
    setEditing(prev => ({ ...prev, [item.id]: { stock: item.stock, price: item.price, cost: item.cost } }));
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
        headers: apiHeaders(),
        body: JSON.stringify({ stock: edit.stock, price: String(edit.price), cost: String(edit.cost) }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, stock: updated.stock, price: updated.price, cost: updated.cost } : i));
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
  const totalCost = items.reduce((s, i) => s + (parseFloat(i.cost) * i.stock), 0);
  const potentialProfit = totalValue - totalCost;

  if (!business && !loading) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <h2 className="text-2xl font-bold mb-2 text-stone-800">Gestión de stock</h2>
        <p className="text-stone-500 mb-6">Elegí tu comercio para ver y ajustar tu inventario</p>

        {myShops.length > 0 && (
          <div className="space-y-2 mb-6">
            {myShops.map(s => (
              <button
                key={s.slug}
                onClick={() => { setBusinessSlug(s.slug); loadBusiness(s.slug); }}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-lg font-medium"
              >
                {s.name || s.slug}
              </button>
            ))}
          </div>
        )}

        <details className="text-left">
          <summary className="text-sm text-stone-400 cursor-pointer text-center mb-3">Ingresar por identificador</summary>
          <input
            type="text"
            value={businessSlug}
            onChange={e => setBusinessSlug(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && loadBusiness(businessSlug)}
            placeholder="Identificador de tu comercio"
            className="w-full px-4 py-3 bg-white border border-stone-300 rounded-xl text-lg text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            onClick={() => loadBusiness(businessSlug)}
            className="w-full py-3 mt-3 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-lg font-medium"
          >
            Ingresar
          </button>
        </details>
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
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAdd(v => !v)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium text-white"
          >
            {showAdd ? 'Cerrar' : '+ Agregar producto'}
          </button>
          <button
            onClick={() => { setBusiness(null); setBusinessSlug(''); }}
            className="text-xs text-stone-400 hover:text-stone-600 underline"
          >
            Cambiar comercio
          </button>
        </div>
      </div>

      {showAdd && business && (
        <AddToInventory
          business={business}
          existingIds={new Set(items.map(i => i.productId))}
          onAdded={(bp) => setItems(prev => [bp, ...prev.filter(p => p.id !== bp.id)])}
          onClose={() => setShowAdd(false)}
        />
      )}

      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-stone-400 uppercase tracking-wide mb-1">Productos</p>
          <p className="text-2xl font-bold text-stone-800">{items.length}</p>
        </div>
        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-stone-400 uppercase tracking-wide mb-1">Venta total</p>
          <p className="text-2xl font-bold text-stone-800">${totalValue.toFixed(2)}</p>
        </div>
        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-stone-400 uppercase tracking-wide mb-1">Costo total</p>
          <p className="text-2xl font-bold text-stone-800">${totalCost.toFixed(2)}</p>
        </div>
        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-stone-400 uppercase tracking-wide mb-1">Ganancia potencial</p>
          <p className={`text-2xl font-bold ${potentialProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            ${potentialProfit.toFixed(2)}
          </p>
          {lowStockCount > 0 && <p className="text-xs text-amber-600 mt-1">{lowStockCount} prod. stock bajo</p>}
          {outOfStockCount > 0 && <p className="text-xs text-red-500">{outOfStockCount} sin stock</p>}
        </div>
      </div>

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
          <button
            onClick={() => setShowAdd(true)}
            className="mt-3 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium text-white"
          >
            + Agregar producto
          </button>
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
              const price = parseFloat(item.price);
              const cost = parseFloat(item.cost);
              const margin = price > 0 ? ((price - cost) / price * 100) : 0;

              return (
                <div key={item.id} className={`p-4 ${isOut ? 'bg-red-50' : isLow ? 'bg-amber-50' : ''}`}>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <Link to={`/product/${item.product.barcode || item.product.slug}`} className="font-medium text-sm text-stone-800 hover:text-emerald-700 truncate block">
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
                            className="w-14 text-center font-mono text-lg bg-transparent border-none focus:outline-none"
                          />
                          <button
                            onClick={() => setEditing(prev => ({ ...prev, [item.id]: { ...prev[item.id], stock: edit.stock + 1 } }))}
                            className="w-8 h-8 bg-stone-100 hover:bg-stone-200 rounded-lg text-stone-600 font-bold"
                          >+</button>
                        </div>
                        <div className="text-right">
                          <input
                            type="number" min="0" step="0.01"
                            value={edit.price}
                            onChange={e => setEditing(prev => ({ ...prev, [item.id]: { ...prev[item.id], price: e.target.value } }))}
                            className="w-20 text-right font-mono text-sm bg-transparent border border-stone-200 rounded px-1 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            placeholder="Precio"
                          />
                          <input
                            type="number" min="0" step="0.01"
                            value={edit.cost}
                            onChange={e => setEditing(prev => ({ ...prev, [item.id]: { ...prev[item.id], cost: e.target.value } }))}
                            className="w-20 text-right font-mono text-xs text-stone-500 bg-transparent border border-stone-200 rounded px-1 mt-0.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            placeholder="Costo"
                          />
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
                          <p className="text-sm font-mono text-stone-700">${price.toFixed(2)}</p>
                          <p className="text-xs text-stone-400">precio</p>
                        </div>
                        <div className="text-right min-w-[60px]">
                          <p className="text-sm font-mono text-stone-500">${cost.toFixed(2)}</p>
                          <p className="text-xs text-stone-400">costo</p>
                        </div>
                        <div className="text-right min-w-[50px]">
                          <p className={`text-sm font-mono font-medium ${margin >= 30 ? 'text-emerald-600' : margin >= 10 ? 'text-amber-600' : 'text-red-500'}`}>
                            {margin.toFixed(0)}%
                          </p>
                          <p className="text-xs text-stone-400">margen</p>
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

// Direct add-to-inventory: search the shared catalog and add a product to this
// shop with cost / margin-suggested price / stock, without leaving the Stock page.
function AddToInventory({ business, existingIds, onAdded, onClose }: {
  business: any;
  existingIds: Set<string>;
  onAdded: (bp: BPItem) => void;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const marginDefault = String(business.defaultMargin ?? '0');

  const [active, setActive] = useState<any | null>(null);
  const [cost, setCost] = useState('');
  const [margin, setMargin] = useState(marginDefault);
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('1');
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(q)}&limit=8`);
        const d = await res.json();
        setResults(Array.isArray(d.data) ? d.data : []);
      } catch { setResults([]); } finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const compute = (c: string, m: string) => {
    const cn = parseFloat(c), mn = parseFloat(m);
    if (!isFinite(cn) || !isFinite(mn)) return '';
    return (cn * (1 + mn / 100)).toFixed(2);
  };

  const openForm = (product: any) => {
    setActive(product);
    setCost(''); setMargin(marginDefault); setPrice(''); setStock('1'); setTouched(false);
  };

  const save = async (product: any) => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/businesses/${business.slug}/products`, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({ productId: product.id, price: Number(price) || 0, cost: Number(cost) || 0, stock: Number(stock) || 0 }),
      });
      if (!res.ok) throw new Error();
      const bp = await res.json();
      onAdded({
        ...bp,
        product: {
          id: product.id, name: product.name, barcode: product.barcode || '',
          imageUrl: product.imageUrl || '', brand: product.brand || '', slug: product.slug || '',
        },
      });
      setAdded(prev => new Set(prev).add(product.id));
      setActive(null);
      toast(`${product.name} agregado`, 'success');
    } catch {
      toast('No se pudo agregar', 'error');
    } finally { setSaving(false); }
  };

  return (
    <div className="bg-white border border-stone-200 rounded-xl shadow-sm p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-stone-700">Agregar producto al inventario</h3>
        <button onClick={onClose} className="text-xs text-stone-400 hover:text-stone-600">Cerrar</button>
      </div>

      <input
        type="text" value={q} onChange={e => setQ(e.target.value)} autoFocus
        placeholder="Buscá por nombre, marca o código..."
        className="w-full px-4 py-2 bg-white border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-3"
      />

      {searching && <p className="text-xs text-stone-400">Buscando...</p>}

      {!searching && q.trim() && results.length === 0 && (
        <div className="text-sm text-stone-500 py-2">
          No se encontró nada.{' '}
          <Link to="/add" className="text-emerald-600 hover:underline font-medium">Crear producto nuevo →</Link>
        </div>
      )}

      <div className="divide-y divide-stone-100">
        {results.map(product => {
          const inInv = existingIds.has(product.id) || added.has(product.id);
          const isActive = active?.id === product.id;
          return (
            <div key={product.id} className="py-2.5">
              <div className="flex items-center gap-3">
                {product.imageUrl
                  ? <img src={resolveImageUrl(product.imageUrl)} alt="" className="w-10 h-10 object-cover rounded-lg shrink-0" />
                  : <div className="w-10 h-10 bg-stone-100 rounded-lg shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-800 truncate">{product.name}</p>
                  <p className="text-xs text-stone-400 font-mono truncate">{product.barcode || product.brand}</p>
                </div>
                {inInv ? (
                  <span className="text-xs text-emerald-600 font-medium shrink-0">✓ En inventario</span>
                ) : isActive ? (
                  <button onClick={() => setActive(null)} className="text-xs text-stone-400 hover:text-stone-600 shrink-0">Cancelar</button>
                ) : (
                  <button onClick={() => openForm(product)} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-medium text-white shrink-0">Agregar</button>
                )}
              </div>

              {isActive && (
                <div className="mt-3 pl-12 flex flex-wrap items-end gap-2">
                  <label className="text-xs text-stone-500">Costo $
                    <input type="number" min="0" step="0.01" value={cost}
                      onChange={e => { const v = e.target.value; setCost(v); if (!touched) setPrice(compute(v, margin)); }}
                      className="block w-24 mt-0.5 px-2 py-1.5 border border-stone-300 rounded-lg text-sm" />
                  </label>
                  <label className="text-xs text-stone-500">Margen %
                    <input type="number" min="0" step="1" value={margin}
                      onChange={e => { const v = e.target.value; setMargin(v); if (!touched) setPrice(compute(cost, v)); }}
                      className="block w-20 mt-0.5 px-2 py-1.5 border border-stone-300 rounded-lg text-sm" />
                  </label>
                  <label className="text-xs text-stone-500">Precio $
                    <input type="number" min="0" step="0.01" value={price}
                      onChange={e => { setPrice(e.target.value); setTouched(true); }}
                      className="block w-24 mt-0.5 px-2 py-1.5 border border-stone-300 rounded-lg text-sm" />
                  </label>
                  <label className="text-xs text-stone-500">Stock
                    <input type="number" min="0" value={stock}
                      onChange={e => setStock(e.target.value)}
                      className="block w-20 mt-0.5 px-2 py-1.5 border border-stone-300 rounded-lg text-sm" />
                  </label>
                  <button onClick={() => save(product)} disabled={saving || !price}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg text-sm font-medium text-white">
                    {saving ? '...' : 'Guardar'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
