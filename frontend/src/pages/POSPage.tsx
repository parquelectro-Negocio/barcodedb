import { useState, useCallback, useEffect } from 'react';
import { apiHeaders } from '../lib/user';
import { matchesQuery } from '../lib/match';
import { useToast } from '../lib/toast';
import { API_BASE, resolveImageUrl } from '../lib/config';
import { Link } from 'react-router-dom';
import { Scanner } from '../components/Scanner';
import { generateDocumentPDF, sharePDF } from '../lib/pdf';

type CartItem = {
  id: string;
  productName: string;
  barcode: string;
  price: number;
  quantity: number;
  total: number;
  stock: number;
};

type PaymentMethod = 'efectivo' | 'transferencia' | 'otro';

// Distinguishing attributes for products that share a name (e.g. cable 2.5 vs 4mm)
function variantLabel(product: any): string {
  const attrs = product?.attributes || {};
  return [product?.brand, product?.color, attrs.capacidad, attrs.largo, attrs.peso]
    .filter(Boolean)
    .join(' · ');
}

export function POSPage() {
  const { toast } = useToast();
  const [scanning, setScanning] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [businessSlug, setBusinessSlug] = useState(localStorage.getItem('biz_slug') || '');
  const [business, setBusiness] = useState<any>(null);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [checkingOut, setCheckingOut] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);
  const [manualBarcode, setManualBarcode] = useState('');
  const [showPayment, setShowPayment] = useState(false);
  const [loadingBusiness, setLoadingBusiness] = useState(false);
  const [businessError, setBusinessError] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('efectivo');
  const [amountTendered, setAmountTendered] = useState('');
  const [search, setSearch] = useState('');

  const loadBusiness = async (slug: string) => {
    if (!slug.trim()) return;
    setLoadingBusiness(true);
    setBusinessError('');
    try {
      const res = await fetch(`${API_BASE}/businesses/${slug}`, { headers: apiHeaders() });
      if (!res.ok) {
        // Stale pointer to a shop this account doesn't own — forget it so it won't auto-load again.
        if (res.status === 403) { localStorage.removeItem('biz_slug'); setBusinessSlug(''); }
        setBusinessError(res.status === 403 ? 'Ese comercio no es tuyo' : 'Comercio no encontrado');
        setLoadingBusiness(false);
        return;
      }
      const b = await res.json();
      setBusiness(b);
      localStorage.setItem('biz_slug', slug);
      await loadProducts(slug);
    } catch { setBusinessError('Error al cargar el comercio'); } finally { setLoadingBusiness(false); }
  };

  const loadProducts = async (slug: string) => {
    const bpRes = await fetch(`${API_BASE}/businesses/${slug}/products`, { headers: apiHeaders() });
    if (bpRes.ok) {
      const bpData = await bpRes.json();
      setCatalog(Array.isArray(bpData) ? bpData : []);
    }
  };

  // Core add. Dedup by businessProduct id, NOT barcode — bulk/electro items
  // often have no barcode ('') and would otherwise collide into one cart line.
  const addBpToCart = useCallback((bp: any) => {
    const price = parseFloat(bp.price) || 0;
    if (price <= 0) {
      toast(`"${bp.product.name}" está sin precio. Cargalo en Stock antes de venderlo.`, 'error');
      return;
    }
    setCart(prev => {
      const existing = prev.find(i => i.id === bp.id);
      if (existing) {
        return prev.map(i =>
          i.id === bp.id ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.price } : i,
        );
      }
      return [...prev, {
        id: bp.id,
        productName: bp.product.name,
        barcode: bp.product.barcode ?? '',
        price,
        quantity: 1,
        total: price,
        stock: bp.stock,
      }];
    });
  }, [toast]);

  // Barcode path (scanner / manual code): the item must be in this shop's catalog.
  const addByBarcode = useCallback(async (barcode: string) => {
    try {
      const res = await fetch(`${API_BASE}/products/${barcode}`);
      if (!res.ok) { toast(`Código ${barcode} no encontrado en la base`, 'error'); return; }
      const data = await res.json();
      const product = data.products?.[0];
      if (!product) { toast(`Código ${barcode} no encontrado en la base`, 'error'); return; }
      const bp = catalog.find((c: any) => c.productId === product.id);
      if (!bp) {
        toast(`"${product.name}" no está en tu inventario. Agregalo con precio antes de venderlo.`, 'error');
        return;
      }
      addBpToCart(bp);
    } catch {
      toast('Error al agregar el producto', 'error');
    }
  }, [catalog, toast, addBpToCart]);

  const handleScan = (barcode: string) => {
    setScanning(false);
    addByBarcode(barcode);
  };

  const handleManualAdd = () => {
    if (manualBarcode.trim()) {
      addByBarcode(manualBarcode.trim());
      setManualBarcode('');
    }
  };

  const removeItem = (id: string) => {
    setCart(prev => prev.filter(i => i.id !== id));
  };

  const updateQty = (id: string, qty: number) => {
    if (qty <= 0) { removeItem(id); return; }
    setCart(prev => prev.map(i =>
      i.id === id ? { ...i, quantity: qty, total: qty * i.price } : i,
    ));
  };

  const total = cart.reduce((sum, i) => sum + i.total, 0);
  const tendered = parseFloat(amountTendered) || 0;
  const change = paymentMethod === 'efectivo' && tendered >= total ? tendered - total : 0;

  // Search the shop's own catalog by name/brand/attributes — the way to add
  // products that have no barcode.
  const q = search.trim();
  const searchResults = q.length >= 2
    ? catalog.filter((bp: any) => {
        const p = bp.product || {};
        const a = p.attributes || {};
        const hay = [p.name, p.brand, p.sku, p.color, p.barcode, a.capacidad, a.largo, a.peso]
          .filter(Boolean).join(' ');
        return matchesQuery(q, hay);
      }).slice(0, 8)
    : [];

  const openPayment = () => {
    setPaymentMethod('efectivo');
    setAmountTendered('');
    setShowPayment(true);
  };

  const confirmSale = async () => {
    if (!business || cart.length === 0) return;
    if (paymentMethod === 'efectivo' && (!amountTendered || tendered < total)) {
      toast('El monto debe cubrir el total', 'error');
      return;
    }
    setCheckingOut(true);

    try {
      const res = await fetch(`${API_BASE}/sales`, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({
          businessId: business.id,
          items: cart.map(i => ({
            businessProductId: i.id,
            quantity: i.quantity,
          })),
          paymentMethod,
          amountTendered: paymentMethod === 'efectivo' ? tendered : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast(err.error === 'insufficient_stock'
          ? `Stock insuficiente: ${err.product} (disponible: ${err.stock})`
          : 'Error al procesar la venta', 'error');
        return;
      }

      const data = await res.json();
      // Snapshot the cart (with product names) before clearing it, so the
      // receipt and the shareable ticket can list what was actually sold.
      setReceipt({ ...data, lines: cart.map(i => ({ name: i.productName, quantity: i.quantity, total: i.price * i.quantity })) });
      setCart([]);
      setShowPayment(false);
    } catch {
      toast('Error al procesar la venta', 'error');
    } finally {
      setCheckingOut(false);
    }
  };

  const [sharingPdf, setSharingPdf] = useState(false);

  const shareReceipt = async () => {
    const r = receipt;
    const pay = r.sale.paymentMethod === 'efectivo' ? 'Efectivo'
      : r.sale.paymentMethod === 'transferencia' ? 'Transferencia'
      : r.sale.paymentMethod ? 'Otro' : undefined;
    setSharingPdf(true);
    try {
      const blob = await generateDocumentPDF({
        kind: 'recibo',
        businessName: business?.name ?? 'Comercio',
        docNumber: r.sale.id.slice(0, 8),
        dateISO: r.sale.createdAt,
        lines: (r.lines ?? []).map((l: any) => ({
          name: l.name,
          quantity: l.quantity,
          unitPrice: l.quantity ? l.total / l.quantity : l.total,
          total: l.total,
        })),
        total: parseFloat(r.sale.total),
        payment: pay,
        amountTendered: r.sale.amountTendered ? parseFloat(r.sale.amountTendered) : undefined,
        change: r.sale.change ? parseFloat(r.sale.change) : undefined,
      });
      const res = await sharePDF(blob, `recibo-${r.sale.id.slice(0, 8)}.pdf`, `Recibo ${business?.name ?? ''}`.trim());
      if (res === 'downloaded') toast('Recibo PDF descargado', 'success');
    } catch {
      toast('No se pudo generar el PDF', 'error');
    } finally {
      setSharingPdf(false);
    }
  };

  const makeQuote = async () => {
    if (!business || cart.length === 0) return;
    const customer = window.prompt('Nombre del cliente (opcional):');
    if (customer === null) return; // cancelled
    setSharingPdf(true);
    try {
      const blob = await generateDocumentPDF({
        kind: 'presupuesto',
        businessName: business.name,
        dateISO: new Date().toISOString(),
        customer: customer.trim() || undefined,
        lines: cart.map(i => ({ name: i.productName, quantity: i.quantity, unitPrice: i.price, total: i.total })),
        total,
        validityDays: 7,
      });
      const res = await sharePDF(blob, 'presupuesto.pdf', `Presupuesto ${business.name}`);
      if (res === 'downloaded') toast('Presupuesto PDF descargado', 'success');
    } catch {
      toast('No se pudo generar el presupuesto', 'error');
    } finally {
      setSharingPdf(false);
    }
  };

  if (receipt) {
    return (
      <div className="max-w-md mx-auto text-center py-8">
        {business?.logoUrl && (
          <img src={resolveImageUrl(business.logoUrl)} alt="" className="w-16 h-16 rounded-xl object-cover mx-auto mb-2" />
        )}
        {business?.name && <p className="font-semibold text-stone-800 mb-3">{business.name}</p>}
        <div className="text-emerald-600 text-5xl mb-4">✓</div>
        <h2 className="text-2xl font-bold mb-2">Venta registrada</h2>
        <p className="text-stone-500 mb-6 font-mono text-sm">{receipt.sale.id.slice(0, 8)}...</p>
        <div className="bg-white border border-stone-200 rounded-xl p-6 mb-6 text-left shadow-sm">
          {(receipt.lines ?? receipt.items).map((item: any, i: number) => (
            <div key={i} className="flex justify-between text-sm py-1 gap-3">
              <span className="text-stone-700">{item.quantity}x {item.name ?? ''}</span>
              <span className="text-stone-700 shrink-0">${parseFloat(item.total).toFixed(2)}</span>
            </div>
          ))}
          <div className="border-t border-stone-200 mt-3 pt-3 flex justify-between font-bold">
            <span>Total</span>
            <span>${parseFloat(receipt.sale.total).toFixed(2)}</span>
          </div>
          {receipt.sale.paymentMethod && (
            <div className="border-t border-stone-200 mt-3 pt-3 text-sm text-stone-500 space-y-1">
              <p>Pago: {receipt.sale.paymentMethod === 'efectivo' ? 'Efectivo' : receipt.sale.paymentMethod === 'transferencia' ? 'Transferencia' : 'Otro'}</p>
              {receipt.sale.amountTendered && <p>Con ${parseFloat(receipt.sale.amountTendered).toFixed(2)}</p>}
              {receipt.sale.change && <p className="text-emerald-600 font-medium">Vuelto: ${parseFloat(receipt.sale.change).toFixed(2)}</p>}
            </div>
          )}
        </div>
        <div className="flex gap-3 justify-center">
          <button
            onClick={shareReceipt}
            disabled={sharingPdf}
            className="px-5 py-3 bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 rounded-xl font-medium flex items-center gap-2 disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            {sharingPdf ? 'Generando...' : 'Compartir PDF'}
          </button>
          <button
            onClick={() => setReceipt(null)}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium"
          >
            Nueva venta
          </button>
        </div>
      </div>
    );
  }

  // Gate: no business loaded yet
  if (!business && !loadingBusiness && !receipt) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <h2 className="text-2xl font-bold mb-2 text-stone-800">Vender</h2>
        <p className="text-stone-500 mb-8">Primero ingresá tu comercio para empezar a vender</p>
        <div className="space-y-3">
          <input
            type="text"
            value={businessSlug}
            onChange={e => setBusinessSlug(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && loadBusiness(businessSlug)}
            placeholder="Identificador de tu comercio"
            className="w-full px-4 py-3 bg-white border border-stone-300 rounded-xl text-lg text-stone-900 text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
            autoFocus
          />
          <button
            onClick={() => loadBusiness(businessSlug)}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-lg font-medium"
          >
            Ingresar
          </button>
          {businessError && <p className="text-sm text-red-600">{businessError}</p>}
        </div>
      </div>
    );
  }

  if (loadingBusiness && !business) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <p className="text-stone-500 text-lg">Cargando comercio...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4 text-stone-800">Vender</h2>

      {showPayment && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 shadow-xl max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold mb-4 text-stone-800">Completar venta</h3>
            <p className="text-3xl font-bold text-center text-stone-900 mb-6">${total.toFixed(2)}</p>
            <label className="block text-sm text-stone-500 mb-2">Forma de pago</label>
            <div className="flex gap-2 mb-4">
              {(['efectivo', 'transferencia', 'otro'] as PaymentMethod[]).map(m => (
                <button
                  key={m}
                  onClick={() => setPaymentMethod(m)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    paymentMethod === m
                      ? 'bg-emerald-600 text-white'
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  {m === 'efectivo' ? 'Efectivo' : m === 'transferencia' ? 'Transferencia' : 'Otro'}
                </button>
              ))}
            </div>
            {paymentMethod === 'efectivo' && (
              <>
                <label className="block text-sm text-stone-500 mb-1">Con cuánto paga</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amountTendered}
                  onChange={e => setAmountTendered(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-3 bg-white border border-stone-300 rounded-lg text-xl font-mono text-stone-900 text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  autoFocus
                />
                {tendered >= total && (
                  <p className="text-emerald-600 text-lg font-semibold text-center mt-2">
                    Vuelto: ${(tendered - total).toFixed(2)}
                  </p>
                )}
                {tendered > 0 && tendered < total && (
                  <p className="text-amber-600 text-sm text-center mt-1">Faltan ${(total - tendered).toFixed(2)}</p>
                )}
              </>
            )}
            {paymentMethod !== 'efectivo' && (
              <p className="text-sm text-stone-400 text-center py-4">Registrando venta sin efectivo</p>
            )}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowPayment(false)}
                className="flex-1 px-4 py-3 bg-stone-100 hover:bg-stone-200 rounded-lg text-sm text-stone-700"
              >
                Cancelar
              </button>
              <button
                onClick={confirmSale}
                disabled={checkingOut}
                className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg text-sm font-medium"
              >
                {checkingOut ? 'Procesando...' : 'Confirmar venta'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6">
        <div className="flex gap-3 items-center">
          {business?.logoUrl && (
            <img src={resolveImageUrl(business.logoUrl)} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
          )}
          <p className="text-sm text-emerald-600 font-medium">{business?.name}</p>
          <button
            onClick={() => { setBusiness(null); setCatalog([]); setCart([]); setBusinessSlug(''); }}
            className="text-xs text-stone-400 hover:text-stone-600 underline"
          >
            Cambiar comercio
          </button>
        </div>
        <p className="text-xs text-stone-400 mt-1">{catalog.length} productos en catálogo</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-4">
          {/* Search the catalog by name/attributes — for products without a barcode */}
          <div>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre, marca o medida..."
              className="w-full px-4 py-3 bg-white border border-stone-300 rounded-xl text-base text-stone-900
                         focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {q.length >= 2 && (
              <div className="mt-2 border border-stone-200 rounded-xl bg-white shadow-sm divide-y divide-stone-100 max-h-72 overflow-y-auto">
                {searchResults.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-stone-400">
                    No está en tu inventario. <Link to="/search" className="text-emerald-600 underline">Agregalo</Link>.
                  </p>
                ) : searchResults.map((bp: any) => {
                  const label = variantLabel(bp.product);
                  return (
                    <button
                      key={bp.id}
                      onClick={() => { addBpToCart(bp); setSearch(''); }}
                      className="w-full text-left px-4 py-2.5 hover:bg-emerald-50 flex items-center justify-between gap-3"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-stone-800 truncate">{bp.product.name}</span>
                        {label && <span className="block text-xs text-stone-400 truncate">{label}</span>}
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-sm font-mono text-stone-700">${parseFloat(bp.price).toFixed(2)}</span>
                        <span className="block text-xs text-stone-400">{bp.stock} uds.</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <input
              type="text"
              value={manualBarcode}
              onChange={e => setManualBarcode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleManualAdd()}
              placeholder="Código de barras..."
              className="flex-1 px-4 py-3 bg-white border border-stone-300 rounded-xl text-lg font-mono text-stone-900
                         focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              onClick={handleManualAdd}
              className="px-4 py-3 bg-stone-100 hover:bg-stone-200 rounded-xl text-stone-700"
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

        <div className="lg:col-span-2 bg-white border border-stone-200 rounded-xl p-4 shadow-sm">
          <h3 className="text-lg font-semibold mb-4 flex justify-between">
            <span>Carrito</span>
            <span className="text-stone-400 text-sm">{cart.length} items</span>
          </h3>
          {cart.length === 0 ? (
            <p className="text-stone-300 text-sm text-center py-8">
              Buscá por nombre, escaneá o ingresá un código
            </p>
          ) : (
            <div className="space-y-3 mb-4">
              {cart.map(item => (
                <div key={item.id} className="bg-stone-50 rounded-lg p-3 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0 mr-2">
                      <p className="text-sm font-medium truncate">{item.productName}</p>
                      {item.barcode && <p className="text-xs text-stone-400 font-mono">{item.barcode}</p>}
                    </div>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-stone-400 hover:text-red-600 text-sm"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQty(item.id, item.quantity - 1)}
                        className="w-7 h-7 bg-stone-200 rounded flex items-center justify-center hover:bg-stone-300 text-stone-700"
                      >
                        -
                      </button>
                      <span className="w-6 text-center font-mono">{item.quantity}</span>
                      <button
                        onClick={() => updateQty(item.id, item.quantity + 1)}
                        className="w-7 h-7 bg-stone-200 rounded flex items-center justify-center hover:bg-stone-300 text-stone-700"
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
              <div className="border-t border-stone-200 pt-3 mb-4 flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>
              <button
                onClick={openPayment}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-medium"
              >
                Cobrar ${total.toFixed(2)}
              </button>
              <button
                onClick={makeQuote}
                disabled={sharingPdf}
                className="w-full py-2.5 mt-2 bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 rounded-xl font-medium disabled:opacity-50"
              >
                {sharingPdf ? 'Generando...' : 'Generar presupuesto (PDF)'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
