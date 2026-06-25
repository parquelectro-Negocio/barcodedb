import { useState, useCallback } from 'react';
import { apiHeaders } from '../lib/user';
import { useToast } from '../lib/toast';
import { API_BASE } from '../lib/config';
import { Scanner } from '../components/Scanner';

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

export function POSPage() {
  const { toast } = useToast();
  const [scanning, setScanning] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [businessSlug, setBusinessSlug] = useState('');
  const [business, setBusiness] = useState<any>(null);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [checkingOut, setCheckingOut] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);
  const [manualBarcode, setManualBarcode] = useState('');
  const [pin, setPin] = useState('');
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [pinError, setPinError] = useState('');
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('efectivo');
  const [amountTendered, setAmountTendered] = useState('');

  const loadBusiness = async (slug: string) => {
    if (!slug.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/businesses/${slug}`);
      if (!res.ok) return;
      const b = await res.json();
      setBusiness(b);
      if (b.pin) {
        setShowPinPrompt(true);
        setPinError('');
        return;
      }
      await loadProducts(slug);
    } catch {}
  };

  const verifyPin = async () => {
    if (!business) return;
    try {
      const res = await fetch(`${API_BASE}/businesses/${business.slug}/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      if (!res.ok) {
        const data = await res.json();
        setPinError(data.hint ? `PIN incorrecto. Pista: ${data.hint}` : 'PIN incorrecto');
        return;
      }
      setShowPinPrompt(false);
      loadProducts(business.slug);
    } catch {
      setPinError('Error al verificar PIN');
    }
  };

  const loadProducts = async (slug: string) => {
    const bpRes = await fetch(`${API_BASE}/businesses/${slug}/products`);
    if (bpRes.ok) {
      const bpData = await bpRes.json();
      setCatalog(Array.isArray(bpData) ? bpData : []);
    }
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
      const res = await fetch(`${API_BASE}/products/${barcode}`);
      if (!res.ok) return;

      const data = await res.json();
      const product = data.products?.[0];
      if (!product) return;

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
  const tendered = parseFloat(amountTendered) || 0;
  const change = paymentMethod === 'efectivo' && tendered >= total ? tendered - total : 0;

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
      setReceipt(data);
      setCart([]);
      setShowPayment(false);
    } catch {
      toast('Error al procesar la venta', 'error');
    } finally {
      setCheckingOut(false);
    }
  };

  if (receipt) {
    return (
      <div className="max-w-md mx-auto text-center py-8">
        <div className="text-emerald-600 text-5xl mb-4">✓</div>
        <h2 className="text-2xl font-bold mb-2">Venta registrada</h2>
        <p className="text-stone-500 mb-6 font-mono text-sm">{receipt.sale.id.slice(0, 8)}...</p>
        <div className="bg-white border border-stone-200 rounded-xl p-6 mb-6 text-left shadow-sm">
          {receipt.items.map((item: any, i: number) => (
            <div key={i} className="flex justify-between text-sm py-1">
              <span>{item.quantity}x</span>
              <span className="text-stone-700">${parseFloat(item.total).toFixed(2)}</span>
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
      <h2 className="text-2xl font-bold mb-4 text-stone-800">Punto de Venta</h2>

      {showPinPrompt && business && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 shadow-xl max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold mb-2 text-stone-800">Ingresá el PIN de {business.name}</h3>
            <p className="text-sm text-stone-500 mb-4">Este comercio tiene un PIN de protección.</p>
            <input
              type="password"
              value={pin}
              onChange={e => setPin(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && verifyPin()}
              placeholder="PIN de 4 dígitos"
              maxLength={4}
              className="w-full px-4 py-3 bg-white border border-stone-300 rounded-lg text-lg font-mono text-stone-900 text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-emerald-500"
              autoFocus
            />
            {pinError && (
              <p className="mt-2 text-sm text-red-600">{pinError}</p>
            )}
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setShowPinPrompt(false); setPin(''); setPinError(''); }}
                className="flex-1 px-4 py-2 bg-stone-100 hover:bg-stone-200 rounded-lg text-sm text-stone-700"
              >
                Cancelar
              </button>
              <button
                onClick={verifyPin}
                className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm text-white"
              >
                Ingresar
              </button>
            </div>
          </div>
        </div>
      )}

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
        <div className="flex gap-3">
          <input
            type="text"
            value={businessSlug}
            onChange={e => setBusinessSlug(e.target.value)}
            onBlur={() => loadBusiness(businessSlug)}
            onKeyDown={e => e.key === 'Enter' && loadBusiness(businessSlug)}
            placeholder="Slug del comercio (ej: electromundo)"
            className="px-4 py-2 bg-white border border-stone-300 rounded-lg text-sm text-stone-900 w-80 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            onClick={() => loadBusiness(businessSlug)}
            className="px-4 py-2 bg-stone-100 hover:bg-stone-200 rounded-lg text-sm text-stone-700"
          >
            Cargar
          </button>
        </div>
        {business && (
          <p className="text-sm text-emerald-600 mt-2">{business.name} — {catalog.length} productos</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={manualBarcode}
              onChange={e => setManualBarcode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleManualAdd()}
              placeholder="Código de barras manual..."
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
              Escaneá o ingresá un código de barras
            </p>
          ) : (
            <div className="space-y-3 mb-4">
              {cart.map(item => (
                <div key={item.barcode} className="bg-stone-50 rounded-lg p-3 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0 mr-2">
                      <p className="text-sm font-medium truncate">{item.productName}</p>
                      <p className="text-xs text-stone-400 font-mono">{item.barcode}</p>
                    </div>
                    <button
                      onClick={() => removeItem(item.barcode)}
                      className="text-stone-400 hover:text-red-600 text-sm"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQty(item.barcode, item.quantity - 1)}
                        className="w-7 h-7 bg-stone-200 rounded flex items-center justify-center hover:bg-stone-300 text-stone-700"
                      >
                        -
                      </button>
                      <span className="w-6 text-center font-mono">{item.quantity}</span>
                      <button
                        onClick={() => updateQty(item.barcode, item.quantity + 1)}
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
