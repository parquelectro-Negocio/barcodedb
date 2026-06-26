import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { API_BASE } from '../lib/config';

export function Home() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  // Dashboard state
  const [businessSlug, setBusinessSlug] = useState(localStorage.getItem('biz_slug') || '');
  const [business, setBusiness] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [showBizInput, setShowBizInput] = useState(false);

  const loadStats = async (slug: string) => {
    setStatsLoading(true);
    try {
      const [b, s] = await Promise.all([
        fetch(`${API_BASE}/businesses/${slug}`).then(r => r.ok ? r.json() : null),
        fetch(`${API_BASE}/businesses/${slug}/stats`).then(r => r.ok ? r.json() : null),
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
    <div className="max-w-2xl mx-auto">
      {/* Dashboard */}
      {business && stats && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-stone-700">
              {business.name}
              <button
                onClick={() => setShowBizInput(!showBizInput)}
                className="ml-2 text-xs text-stone-400 hover:text-stone-600 underline font-normal"
              >
                Cambiar
              </button>
            </h2>
            <Link to="/sales" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
              Ver todas →
            </Link>
          </div>

          {showBizInput && (
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={businessSlug}
                onChange={e => setBusinessSlug(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && loadStats(businessSlug)}
                placeholder="Identificador del comercio"
                className="flex-1 px-3 py-2 bg-white border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                autoFocus
              />
              <button
                onClick={() => loadStats(businessSlug)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium"
              >
                Ir
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm">
              <p className="text-xs text-stone-400 uppercase tracking-wide mb-1">Hoy</p>
              <p className="text-2xl font-bold text-stone-800">${parseFloat(stats.today.total || '0').toFixed(2)}</p>
              <p className="text-xs text-stone-500">{stats.today.count} ventas</p>
            </div>
            <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm">
              <p className="text-xs text-stone-400 uppercase tracking-wide mb-1">Esta semana</p>
              <p className="text-2xl font-bold text-stone-800">${parseFloat(stats.week.total || '0').toFixed(2)}</p>
              <p className="text-xs text-stone-500">{stats.week.count} ventas</p>
            </div>
          </div>

          {stats.lowStock.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
              <p className="text-sm font-semibold text-amber-800 mb-2">
                ⚠️ {stats.lowStock.length} producto{stats.lowStock.length > 1 ? 's' : ''} con stock bajo
              </p>
              <div className="space-y-1">
                {stats.lowStock.map((item: any) => (
                  <div key={item.id} className="flex justify-between text-sm text-amber-700">
                    <Link to={`/product/${item.barcode}`} className="hover:underline truncate mr-2">
                      {item.productName}
                    </Link>
                    <span className="font-mono shrink-0">{item.stock} uds.</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Link to="/pos" className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm font-medium text-center">
              Vender
            </Link>
            <Link to="/sales" className="flex-1 py-3 bg-white border border-stone-200 hover:bg-stone-50 rounded-xl text-sm font-medium text-stone-700 text-center">
              Ventas
            </Link>
            <Link to="/add" className="flex-1 py-3 bg-white border border-stone-200 hover:bg-stone-50 rounded-xl text-sm font-medium text-stone-700 text-center">
              + Producto
            </Link>
          </div>
        </div>
      )}

      {statsLoading && (
        <div className="mb-8 bg-white border border-stone-200 rounded-xl p-6 text-center">
          <p className="text-stone-400 text-sm">Cargando dashboard...</p>
        </div>
      )}

      {!business && !statsLoading && (
        <div className="mb-8">
          <button
            onClick={() => setShowBizInput(true)}
            className="w-full py-3 border-2 border-dashed border-stone-200 rounded-xl text-sm text-stone-400 hover:text-stone-600 hover:border-stone-300 transition-colors"
          >
            + Configurar mi comercio
          </button>
          {showBizInput && (
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={businessSlug}
                onChange={e => setBusinessSlug(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && loadStats(businessSlug)}
                placeholder="Identificador de tu comercio"
                className="flex-1 px-4 py-3 bg-white border border-stone-300 rounded-xl text-lg text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                autoFocus
              />
              <button
                onClick={() => loadStats(businessSlug)}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-medium"
              >
                Ir
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col items-center justify-center gap-8">
        <div className="text-center">
          <h1 className="text-5xl font-bold mb-4 text-stone-800">BarcodeDB</h1>
          <p className="text-stone-500 text-lg">
            Base colaborativa de productos. Buscá por nombre, marca o código de barras.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="w-full max-w-xl">
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscá un producto (ej: Terrabusi, Samsung, 7790040929604)..."
              className="w-full px-5 py-4 bg-white border border-stone-300 rounded-xl text-lg text-stone-900
                         focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent
                         placeholder:text-stone-400"
              autoFocus
            />
          </div>
        </form>
      </div>

      {/* Guía rápida */}
      <div className="mt-8 grid gap-4 text-sm">
        <details className="bg-white border border-stone-200 rounded-xl p-4 open:ring-2 open:ring-emerald-500/30 shadow-sm">
          <summary className="font-semibold text-emerald-600 cursor-pointer select-none">
            📖 ¿Cómo usar BarcodeDB?
          </summary>
          <div className="mt-3 space-y-3 text-stone-600">
            <div>
              <p className="font-medium text-stone-800 mb-1">🔍 1. Buscar un producto</p>
              <p className="text-stone-500">Escribí el nombre, la marca o el código de barras en la barra de búsqueda. Si el código no está registrado, te va a dar la opción de <Link to="/add" className="text-emerald-600 underline">agregarlo</Link>.</p>
            </div>
            <div>
              <p className="font-medium text-stone-800 mb-1">📸 2. Escanear con la cámara</p>
              <p className="text-stone-500">Andá a <Link to="/scan" className="text-emerald-600 underline">Escanear</Link> y apuntá la cámara al código de barras. Te lleva directo al producto.</p>
            </div>
            <div>
              <p className="font-medium text-stone-800 mb-1">➕ 3. Agregar un producto nuevo</p>
              <p className="text-stone-500">Si un producto no existe, toca <Link to="/add" className="text-emerald-600 underline">Agregar producto</Link>. Completá nombre, marca, SKU, categoría y una foto (formato jpg, png, webp o gif).</p>
            </div>
            <div>
              <p className="font-medium text-stone-800 mb-1">💰 4. Armar tu inventario</p>
              <p className="text-stone-500">Cuando ves un producto, podés ponerle tu precio y stock para tener tu catálogo personal. Después usalo en <Link to="/pos" className="text-emerald-600 underline">Vender</Link>.</p>
            </div>
            <div>
              <p className="font-medium text-stone-800 mb-1">📦 5. Importar desde Excel</p>
              <p className="text-stone-500">Andá a <Link to="/import" className="text-emerald-600 underline">Importar</Link> y subí un archivo con tu lista de productos. El sistema busca coincidencias automáticamente.</p>
            </div>
          </div>
        </details>

        <div className="flex flex-wrap gap-3 justify-center text-sm text-stone-400">
          <span>Buscá por marca</span>
          <span>•</span>
          <span>Código de barras</span>
          <span>•</span>
          <span>Categoría</span>
          <span>•</span>
          <span><Link to="/add" className="px-3 py-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors">Agregar producto</Link></span>
          <span>•</span>
          <span><Link to="/import" className="px-3 py-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors">Importar</Link></span>
        </div>
      </div>
    </div>
  );
}
