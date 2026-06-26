import { useState, useEffect } from 'react';
import { API_BASE } from '../lib/config';

type SaleItem = {
  id: string;
  quantity: number;
  unitPrice: string;
  total: string;
  businessProduct: {
    id: string;
    cost: string;
    product: { id: string; name: string; barcode: string };
  };
};

type Sale = {
  id: string;
  total: string;
  paymentMethod: string | null;
  amountTendered: string | null;
  change: string | null;
  createdAt: string;
  items: SaleItem[];
};

type Period = 'today' | 'week' | 'month' | 'all';

function exportCSV(sales: Sale[], businessName: string) {
  const rows = [['Fecha', 'Producto', 'Cantidad', 'Precio Unit.', 'Costo', 'Ganancia', 'Total Venta', 'Método Pago']];
  for (const sale of sales) {
    const date = new Date(sale.createdAt).toLocaleDateString('es-AR');
    for (const item of sale.items) {
      const cost = parseFloat(item.businessProduct.cost || '0') * item.quantity;
      const profit = parseFloat(item.total) - cost;
      rows.push([
        date,
        item.businessProduct.product.name,
        String(item.quantity),
        `$${parseFloat(item.unitPrice).toFixed(2)}`,
        `$${cost.toFixed(2)}`,
        `$${profit.toFixed(2)}`,
        `$${sale.total}`,
        sale.paymentMethod === 'efectivo' ? 'Efectivo' : sale.paymentMethod === 'transferencia' ? 'Transferencia' : 'Otro',
      ]);
    }
  }
  const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ventas-${businessName}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function SalesPage() {
  const [businessSlug, setBusinessSlug] = useState(localStorage.getItem('biz_slug') || '');
  const [business, setBusiness] = useState<any>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState<Period>('today');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busError, setBusError] = useState('');

  const loadBusiness = async (slug: string) => {
    if (!slug.trim()) return;
    setLoading(true);
    setBusError('');
    const res = await fetch(`${API_BASE}/businesses/${slug}`);
    if (!res.ok) { setBusError('Comercio no encontrado'); setLoading(false); return; }
    const b = await res.json();
    setBusiness(b);
    localStorage.setItem('biz_slug', slug);
    setLoading(false);
  };

  useEffect(() => {
    if (businessSlug) loadBusiness(businessSlug);
  }, []);

  useEffect(() => {
    if (!business) return;
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ limit: '50', offset: '0' });
        if (period !== 'all') {
          const d = new Date();
          if (period === 'today') d.setHours(0, 0, 0, 0);
          else if (period === 'week') d.setDate(d.getDate() - 7);
          else if (period === 'month') d.setMonth(d.getMonth() - 1);
          params.set('since', d.toISOString());
        }
        const res = await fetch(`${API_BASE}/sales?businessId=${business.id}&${params}`);
        if (res.ok) setSales(await res.json());
      } catch { setError('Error al cargar ventas'); } finally { setLoading(false); }
    })();
  }, [business, period]);

  const periodLabel: Record<Period, string> = {
    today: 'Hoy',
    week: 'Esta semana',
    month: 'Este mes',
    all: 'Todas',
  };

  if (!business && !loading) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <h2 className="text-2xl font-bold mb-2 text-stone-800">Historial de ventas</h2>
        <p className="text-stone-500 mb-8">Ingresá tu comercio para ver las ventas</p>
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

  if (loading && sales.length === 0) {
    return <div className="max-w-lg mx-auto text-center py-16"><p className="text-stone-500 text-lg">Cargando ventas...</p></div>;
  }

  const totalPeriod = sales.reduce((s, sale) => s + parseFloat(sale.total), 0);
  const totalProfit = sales.reduce((s, sale) => {
    const cost = sale.items.reduce((c, item) => c + (parseFloat(item.businessProduct.cost || '0') * item.quantity), 0);
    return s + parseFloat(sale.total) - cost;
  }, 0);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-stone-800">Ventas</h2>
          <p className="text-sm text-emerald-600 font-medium">{business?.name}</p>
        </div>
        <div className="flex items-center gap-3">
          {sales.length > 0 && (
            <button
              onClick={() => exportCSV(sales, business?.name || 'export')}
              className="px-3 py-1.5 bg-white border border-stone-200 hover:bg-stone-50 rounded-lg text-xs font-medium text-stone-600"
            >
              Exportar CSV
            </button>
          )}
          <button
            onClick={() => { setBusiness(null); setBusinessSlug(''); }}
            className="text-xs text-stone-400 hover:text-stone-600 underline"
          >
            Cambiar comercio
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {(Object.entries(periodLabel) as [Period, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setPeriod(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              period === key
                ? 'bg-emerald-600 text-white'
                : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {sales.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex justify-between items-center">
            <span className="text-sm text-emerald-800 font-medium">Total ventas</span>
            <span className="text-xl font-bold text-emerald-700">${totalPeriod.toFixed(2)}</span>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex justify-between items-center">
            <span className="text-sm text-blue-800 font-medium">Ganancia neta</span>
            <span className={`text-xl font-bold ${totalProfit >= 0 ? 'text-blue-700' : 'text-red-600'}`}>
              ${totalProfit.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      {sales.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-stone-300 text-lg">Sin ventas en este período</p>
          <p className="text-stone-400 text-sm mt-1">Usá <span className="font-medium">Vender</span> para registrar una venta</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sales.map(sale => (
            <div key={sale.id} className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
              <button
                onClick={() => setExpanded(expanded === sale.id ? null : sale.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-stone-50 transition-colors text-left"
              >
                <div className="flex items-center gap-4">
                  <div className="text-xs text-stone-400 font-mono">
                    {new Date(sale.createdAt).toLocaleDateString('es-AR', {
                      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                    })}
                  </div>
                  <div className="text-xs font-medium text-stone-500">
                    {sale.paymentMethod === 'efectivo' ? 'Efectivo' : sale.paymentMethod === 'transferencia' ? 'Transfer.' : 'Otro'}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-bold text-stone-800">${parseFloat(sale.total).toFixed(2)}</p>
                    <p className="text-xs text-blue-600 font-medium">
                      ${(() => {
                        const cost = sale.items.reduce((c, item) => c + (parseFloat(item.businessProduct.cost || '0') * item.quantity), 0);
                        return (parseFloat(sale.total) - cost).toFixed(2);
                      })()} gan.
                      ({(() => {
                        const cost = sale.items.reduce((c, item) => c + (parseFloat(item.businessProduct.cost || '0') * item.quantity), 0);
                        const t = parseFloat(sale.total);
                        return t > 0 ? ((t - cost) / t * 100).toFixed(0) : '0';
                      })()}%)
                    </p>
                  </div>
                  <span className={`text-xs transition-transform ${expanded === sale.id ? 'rotate-180' : ''}`}>▼</span>
                </div>
              </button>
              {expanded === sale.id && (
                <div className="border-t border-stone-100 px-4 py-3 space-y-2 text-sm">
                  {sale.items.map((item, i) => {
                    const cost = parseFloat(item.businessProduct.cost || '0') * item.quantity;
                    const profit = parseFloat(item.total) - cost;
                    return (
                      <div key={i} className="flex justify-between text-stone-600 items-center">
                        <span className="flex-1">{item.quantity}x {item.businessProduct.product.name}</span>
                        <span className="font-mono text-stone-400 mr-3">${cost.toFixed(2)} cost</span>
                        <span className={`font-mono font-medium ${profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          ${profit.toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                  {sale.change && parseFloat(sale.change) > 0 && (
                    <div className="border-t border-stone-100 pt-2 text-emerald-600 font-medium flex justify-between">
                      <span>Vuelto</span>
                      <span>${parseFloat(sale.change).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
