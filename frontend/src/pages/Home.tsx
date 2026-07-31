import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { API_BASE } from '../lib/config';
import { apiHeaders } from '../lib/user';

export function Home() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const [businessSlug, setBusinessSlug] = useState(localStorage.getItem('biz_slug') || '');
  const [business, setBusiness] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [showBizInput, setShowBizInput] = useState(false);

  const loadStats = async (slug: string) => {
    setStatsLoading(true);
    try {
      const [b, s] = await Promise.all([
        fetch(`${API_BASE}/businesses/${slug}`, { headers: apiHeaders() }).then(r => r.ok ? r.json() : null),
        fetch(`${API_BASE}/businesses/${slug}/stats`, { headers: apiHeaders() }).then(r => r.ok ? r.json() : null),
      ]);
      if (b) { setBusiness(b); setBusinessSlug(slug); localStorage.setItem('biz_slug', slug); }
      if (s) setStats(s);
    } catch {} finally { setStatsLoading(false); }
  };

  useEffect(() => {
    if (businessSlug) loadStats(businessSlug);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <div>
      {/* Business dashboard */}
      {business && stats && (
        <div className="mb-10 animate-slide-up">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-semibold text-stone-800">{business.name}</h2>
              <p className="text-sm text-stone-400">{stats.totalProducts} productos en catálogo</p>
            </div>
            <button
              onClick={() => setShowBizInput(!showBizInput)}
              className="btn-ghost text-xs"
            >
              Cambiar comercio
            </button>
          </div>

          {showBizInput && (
            <div className="flex gap-2 mb-5">
              <input
                type="text"
                value={businessSlug}
                onChange={e => setBusinessSlug(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && loadStats(businessSlug)}
                placeholder="Identificador del comercio"
                className="input max-w-xs"
                autoFocus
              />
              <button onClick={() => loadStats(businessSlug)} className="btn-primary text-sm">
                Ir
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="card p-4">
              <p className="text-xs text-stone-400 uppercase tracking-wider mb-1">Ventas hoy</p>
              <p className="text-2xl font-bold text-stone-800">${parseFloat(stats.today.total || '0').toFixed(2)}</p>
              <p className="text-xs text-stone-400 mt-0.5">{stats.today.count} ventas</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-stone-400 uppercase tracking-wider mb-1">Esta semana</p>
              <p className="text-2xl font-bold text-stone-800">${parseFloat(stats.week.total || '0').toFixed(2)}</p>
              <p className="text-xs text-stone-400 mt-0.5">{stats.week.count} ventas</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-stone-400 uppercase tracking-wider mb-1">Este mes</p>
              <p className="text-2xl font-bold text-stone-800">${parseFloat(stats.month.total || '0').toFixed(2)}</p>
              <p className="text-xs text-stone-400 mt-0.5">{stats.month.count} ventas</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-stone-400 uppercase tracking-wider mb-1">Productos</p>
              <p className="text-2xl font-bold text-stone-800">{stats.totalProducts}</p>
              {stats.lowStock.length > 0 && (
                <p className="text-xs text-amber-600 mt-0.5">{stats.lowStock.length} con stock bajo</p>
              )}
            </div>
          </div>

          {stats.lowStock.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
              <p className="text-sm font-semibold text-amber-800 mb-2">
                {stats.lowStock.length} producto{stats.lowStock.length > 1 ? 's' : ''} con stock bajo
              </p>
              <div className="space-y-1">
                {stats.lowStock.map((item: any) => (
                  <div key={item.id} className="flex justify-between text-sm text-amber-700">
                    <Link to={`/product/${item.barcode || item.slug}`} className="hover:underline truncate mr-2">
                      {item.productName}
                    </Link>
                    <span className="font-mono shrink-0">{item.stock} uds.</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Link to="/pos" className="btn-primary flex-1 text-center text-sm">
              Vender
            </Link>
            <Link to="/sales" className="btn-secondary flex-1 text-center text-sm">
              Ventas
            </Link>
            <Link to="/add" className="btn-secondary flex-1 text-center text-sm">
              + Producto
            </Link>
          </div>
        </div>
      )}

      {statsLoading && (
        <div className="mb-10 card p-6">
          <div className="space-y-3">
            <div className="skeleton h-4 w-32" />
            <div className="grid grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-24" />)}
            </div>
          </div>
        </div>
      )}

      {/* Hero */}
      <div className="flex flex-col items-center justify-center py-8 sm:py-16">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-xs font-medium text-emerald-700 mb-5">
            Base colaborativa de productos
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold text-stone-900 tracking-tight mb-3">
            BarcodeDB
          </h1>
          <p className="text-stone-500 text-lg sm:text-xl max-w-lg mx-auto">
            Busca, escanea y comparte información de productos. Tu catálogo colaborativo de códigos de barras.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="w-full max-w-xl mb-6">
          <div className="relative group">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscá por nombre, marca o código de barras..."
              className="w-full pl-12 pr-5 py-4 bg-white border-2 border-stone-200 rounded-2xl text-lg text-stone-900
                         placeholder:text-stone-400 shadow-soft
                         focus:outline-none focus:border-emerald-500 focus:shadow-card-hover
                         transition-all duration-200"
              autoFocus
            />
          </div>
        </form>

        <div className="flex flex-wrap gap-2 justify-center mb-8 text-sm text-stone-400">
          <span className="px-3 py-1.5 bg-white border border-stone-200 rounded-lg">Ej: 7790040929604</span>
          <span className="px-3 py-1.5 bg-white border border-stone-200 rounded-lg">Samsung Galaxy</span>
          <span className="px-3 py-1.5 bg-white border border-stone-200 rounded-lg">Terrabusi</span>
        </div>

        <div className="flex gap-3">
          <Link to="/add" className="btn-primary">
            Agregar producto
          </Link>
          <Link to="/import" className="btn-secondary">
            Importar lista
          </Link>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Link to="/scan" className="card p-5 hover:border-emerald-300 group">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center mb-3 group-hover:bg-emerald-200 transition-colors">
            <svg className="w-5 h-5 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <h3 className="font-semibold text-stone-800 mb-1">Escanear código</h3>
          <p className="text-sm text-stone-400">Usá la cámara para identificar productos al instante</p>
        </Link>
        <Link to="/import" className="card p-5 hover:border-emerald-300 group">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center mb-3 group-hover:bg-emerald-200 transition-colors">
            <svg className="w-5 h-5 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
            </svg>
          </div>
          <h3 className="font-semibold text-stone-800 mb-1">Importar Excel</h3>
          <p className="text-sm text-stone-400">Cargá tu lista de precios y creá productos en lote</p>
        </Link>
        <Link to="/pos" className="card p-5 hover:border-emerald-300 group">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center mb-3 group-hover:bg-emerald-200 transition-colors">
            <svg className="w-5 h-5 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="font-semibold text-stone-800 mb-1">Punto de venta</h3>
          <p className="text-sm text-stone-400">Vendé productos con escáner y carrito</p>
        </Link>
      </div>

      {/* Guide */}
      <details className="card overflow-hidden open:ring-1 open:ring-emerald-500/30 mb-8">
        <summary className="px-5 py-4 font-semibold text-emerald-700 cursor-pointer select-none hover:bg-stone-50 transition-colors">
          Como usar BarcodeDB
        </summary>
        <div className="px-5 pb-5 space-y-4 text-sm text-stone-600 border-t border-stone-100 pt-4">
          <div>
            <p className="font-medium text-stone-800 mb-1">1. Buscar un producto</p>
            <p>Escribí el nombre, la marca o el código de barras en la barra de búsqueda. Si el código no está registrado, te da la opción de agregarlo.</p>
          </div>
          <div>
            <p className="font-medium text-stone-800 mb-1">2. Escanear con la cámara</p>
            <p>Andá a <Link to="/scan" className="text-emerald-600 underline">Escanear</Link> y apuntá la cámara al código de barras. Te lleva directo al producto.</p>
          </div>
          <div>
            <p className="font-medium text-stone-800 mb-1">3. Agregar un producto nuevo</p>
            <p>Si un producto no existe, toca <Link to="/add" className="text-emerald-600 underline">Agregar producto</Link>. Completá nombre, marca, SKU, categoría y una foto.</p>
          </div>
          <div>
            <p className="font-medium text-stone-800 mb-1">4. Armar tu inventario</p>
            <p>Cuando ves un producto, podés ponerle tu precio y stock para tener tu catálogo personal. Después usalo en <Link to="/pos" className="text-emerald-600 underline">Vender</Link>.</p>
          </div>
          <div>
            <p className="font-medium text-stone-800 mb-1">5. Importar desde Excel</p>
            <p>Andá a <Link to="/import" className="text-emerald-600 underline">Importar</Link> y subí un archivo con tu lista de productos. El sistema busca coincidencias y crea los que falten.</p>
          </div>
        </div>
      </details>

      {/* Not configured state */}
      {!business && !statsLoading && (
        <div className="text-center">
          <button
            onClick={() => setShowBizInput(true)}
            className="btn-secondary text-sm"
          >
            Configurar mi comercio
          </button>
          {showBizInput && (
            <div className="mt-4 max-w-xs mx-auto flex gap-2">
              <input
                type="text"
                value={businessSlug}
                onChange={e => setBusinessSlug(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && loadStats(businessSlug)}
                placeholder="Identificador de tu comercio"
                className="input"
                autoFocus
              />
              <button onClick={() => loadStats(businessSlug)} className="btn-primary">
                Ir
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
