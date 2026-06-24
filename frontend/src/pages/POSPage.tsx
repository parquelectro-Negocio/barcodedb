import { useState, useCallback } from 'react';
import { apiHeaders } from '../lib/user';
import { Scanner } from '../components/Scanner';

const API = '/api';

type CartItem = {
  id: string;
  productName: string;
  barcode: string;
  price: number;
  quantity: number;
  total: number;
  stock: number;
};

export function POSPage() {
  const [scanning, setScanning] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [businessSlug, setBusinessSlug] = useState('');
  const [business, setBusiness] = useState<any>(null);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [checkingOut, setCheckingOut] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);
  const [manualBarcode, setManualBarcode] = useState('');

  const loadBusiness = async (slug: string) => {
    if (!slug.trim()) return;
    try {
      const res = await fetch(`${API}/businesses/${slug}`);
      if (!res.ok) return;
      const b = await res.json();
      setBusiness(b);

      const bpRes = await fetch(`${API}/businesses/${slug}/products`);
      if (bpRes.ok) {
        const bpData = await bpRes.json();
        setCatalog(Array.isArray(bpData) ? bpData : []);
      }
    } catch {}
  };

  const addToCart = useCallback(async (barcode: string) => {
    const existing = cart.find(i => i.barcode === barcode);
    if (existing) {
      setCart(prev => prev.map(i =>
        i.barcode === barcode ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.price } : i,
      ));
      return;
    }

    try {
      const res = await fetch(`${API}/products/${barcode}`);
      if (!res.ok) return;

      const data = await res.json();
      const product = data.products?.[0];
      if (!product) return;

      // Find in business catalog by productId
      const bp = catalog.find((c: any) => c.productId === product.id);
      const price = bp ? parseFloat(bp.price) : 0;
      const stock = bp ? bp.stock : 0;

      setCart(prev => [...prev, {
        id: bp?.id ?? product.id,
        productName: product.name,
        barcode: product.barcode,
        price,
        quantity: 1,
        total: price,
        stock,
      }]);
    } catch {}
  }, [cart, catalog]);

  const handleScan = (barcode: string) => {
    setScanning(false);
    addToCart(barcode);
  };

  const handleManualAdd = () => {
    if (manualBarcode.trim()) {
      addToCart(manualBarcode.trim());
      setManualBarcode('');
    }
  };

  const removeItem = (barcode: string) => {
    setCart(prev => prev.filter(i => i.barcode !== barcode));
  };

  const updateQty = (barcode: string, qty: number) => {
    if (qty <= 0) { removeItem(barcode); return; }
    setCart(prev => prev.map(i =>
      i.barcode === barcode ? { ...i, quantity: qty, total: qty * i.price } : i,
    ));
  };

  const total = cart.reduce((sum, i) => sum + i.total, 0);

  const handleCheckout = async () => {
    if (!business || cart.length === 0) return;
    setCheckingOut(true);

    try {
      const res = await fetch(`${API}/sales`, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({
          businessId: business.id,
          items: cart.map(i => ({
            businessProductId: i.id,
            quantity: i.quantity,
          })),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error === 'insufficient_stock'
          ? `Stock insuficiente: ${err.product} (disponible: ${err.stock})`
          : 'Error al procesar la venta');
        return;
      }

      const data = await res.json();
      setReceipt(data);
      setCart([]);
    } catch {
      alert('Error al procesar la venta');
    } finally {
      setCheckingOut(false);
    }
  };

  if (receipt) {
    return (
      <div className="max-w-md mx-auto text-center py-8">
        <div className="text-emerald-400 text-5xl mb-4">✓</div>
        <h2 className="text-2xl font-bold mb-2">Venta registrada</h2>
        <p className="text-slate-400 mb-6 font-mono text-sm">{receipt.sale.id.slice(0, 8)}...</p>
        <div className="bg-slate-900 rounded-xl p-6 mb-6 text-left">
          {receipt.items.map((item: any, i: number) => (
            <div key={i} className="flex justify-between text-sm py-1">
              <span>{item.quantity}x</span>
              <span className="text-slate-300">${parseFloat(item.total).toFixed(2)}</span>
            </div>
          ))}
          <div className="border-t border-slate-700 mt-3 pt-3 flex justify-between font-bold">
            <span>Total</span>
            <span>${parseFloat(receipt.sale.total).toFixed(2)}</span>
          </div>
        </div>
        <button
          onClick={() => setReceipt(null)}
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-medium"
        >
          Nueva venta
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Punto de Venta</h2>

      {/* Business selector */}
      <div className="mb-6">
        <div className="flex gap-3">
          <input
            type="text"
            value={businessSlug}
            onChange={e => setBusinessSlug(e.target.value)}
            onBlur={() => loadBusiness(businessSlug)}
            onKeyDown={e => e.key === 'Enter' && loadBusiness(businessSlug)}
            placeholder="Slug del comercio (ej: electromundo)"
            className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm w-80 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            onClick={() => loadBusiness(businessSlug)}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm"
          >
            Cargar
          </button>
        </div>
        {business && (
          <p className="text-sm text-emerald-400 mt-2">{business.name} — {catalog.length} productos</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Scanner + manual input */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={manualBarcode}
              onChange={e => setManualBarcode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleManualAdd()}
              placeholder="Código de barras manual..."
              className="flex-1 px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-lg font-mono
                         focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              onClick={handleManualAdd}
              className="px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl"
            >
              +
            </button>
          </div>

          <button
            onClick={() => setScanning(true)}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-lg font-medium"
          >
            Escanear código
          </button>

          {scanning && (
            <Scanner onDetect={handleScan} onClose={() => setScanning(false)} />
          )}
        </div>

        {/* Right: Cart */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h3 className="text-lg font-semibold mb-4 flex justify-between">
            <span>Carrito</span>
            <span className="text-slate-400 text-sm">{cart.length} items</span>
          </h3>

          {cart.length === 0 ? (
            <p className="text-slate-600 text-sm text-center py-8">
              Escaneá o ingresá un código de barras
            </p>
          ) : (
            <div className="space-y-3 mb-4">
              {cart.map(item => (
                <div key={item.barcode} className="bg-slate-800 rounded-lg p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0 mr-2">
                      <p className="text-sm font-medium truncate">{item.productName}</p>
                      <p className="text-xs text-slate-500 font-mono">{item.barcode}</p>
                    </div>
                    <button
                      onClick={() => removeItem(item.barcode)}
                      className="text-slate-600 hover:text-red-400 text-sm"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQty(item.barcode, item.quantity - 1)}
                        className="w-7 h-7 bg-slate-700 rounded flex items-center justify-center hover:bg-slate-600"
                      >
                        -
                      </button>
                      <span className="w-6 text-center font-mono">{item.quantity}</span>
                      <button
                        onClick={() => updateQty(item.barcode, item.quantity + 1)}
                        className="w-7 h-7 bg-slate-700 rounded flex items-center justify-center hover:bg-slate-600"
                      >
                        +
                      </button>
                    </div>
                    <span className="font-mono">${item.total.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {cart.length > 0 && (
            <>
              <div className="border-t border-slate-700 pt-3 mb-4 flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>
              <button
                onClick={handleCheckout}
                disabled={checkingOut || !business}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-xl font-medium"
              >
                {checkingOut ? 'Procesando...' : `Cobrar $${total.toFixed(2)}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
