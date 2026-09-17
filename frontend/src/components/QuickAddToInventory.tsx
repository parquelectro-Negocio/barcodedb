import { useState } from 'react';
import { API_BASE } from '../lib/config';
import { apiHeaders } from '../lib/user';
import { useToast } from '../lib/toast';

// A product that already exists in the shared base by identity but isn't in this
// shop's catalog yet. Lets the owner set cost / margin / price / stock and add it
// on the spot — reused wherever a sellable product needs a price without leaving
// the current screen (e.g. mid-sale in the POS). The margin math mirrors the
// AddToInventory flow in StockPage.
export function QuickAddToInventory({ business, product, onAdded, onClose, ctaLabel = 'Agregar' }: {
  business: any;
  product: any;
  onAdded: (bp: any) => void;
  onClose: () => void;
  ctaLabel?: string;
}) {
  const { toast } = useToast();
  const marginDefault = String(business.defaultMargin ?? '0');
  const [cost, setCost] = useState('');
  const [margin, setMargin] = useState(marginDefault);
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('1');
  const [touched, setTouched] = useState(false); // once the price is edited by hand, stop auto-computing it
  const [saving, setSaving] = useState(false);

  const compute = (c: string, m: string) => {
    const cn = parseFloat(c), mn = parseFloat(m);
    if (!isFinite(cn) || !isFinite(mn)) return '';
    return (cn * (1 + mn / 100)).toFixed(2);
  };

  const save = async () => {
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
      toast(`${product.name} agregado al inventario`, 'success');
    } catch {
      toast('No se pudo agregar', 'error');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl p-5 shadow-xl max-w-sm w-full">
        <h3 className="text-lg font-semibold text-stone-800 mb-1">Agregar al inventario</h3>
        <p className="text-sm text-stone-500 mb-4 truncate">{product.name}</p>

        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-stone-500">Costo $
            <input type="number" min="0" step="0.01" value={cost} autoFocus
              onChange={e => { const v = e.target.value; setCost(v); if (!touched) setPrice(compute(v, margin)); }}
              className="block w-full mt-0.5 px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </label>
          <label className="text-xs text-stone-500">Margen %
            <input type="number" min="0" step="1" value={margin}
              onChange={e => { const v = e.target.value; setMargin(v); if (!touched) setPrice(compute(cost, v)); }}
              className="block w-full mt-0.5 px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </label>
          <label className="text-xs text-stone-500">Precio $
            <input type="number" min="0" step="0.01" value={price}
              onChange={e => { setPrice(e.target.value); setTouched(true); }}
              className="block w-full mt-0.5 px-3 py-2 border border-stone-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </label>
          <label className="text-xs text-stone-500">Stock
            <input type="number" min="0" value={stock}
              onChange={e => setStock(e.target.value)}
              className="block w-full mt-0.5 px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </label>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 rounded-lg text-sm text-stone-700">
            Cancelar
          </button>
          <button onClick={save} disabled={saving || !price}
            className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg text-sm font-medium text-white">
            {saving ? '...' : ctaLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
