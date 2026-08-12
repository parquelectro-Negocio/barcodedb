import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE } from '../lib/config';
import { SectorPicker } from '../components/SectorPicker';
import { CreateBusinessCard } from '../components/CreateBusinessCard';
import { apiHeaders } from '../lib/user';

// The shop cockpit: onboarding when the account has no shop yet, otherwise the
// dashboard (sales, estimated profit, low stock, quick actions). Lives on its
// own tab so the public home stays a clean, scroll-free landing.
export function PanelPage() {
  const [businessSlug, setBusinessSlug] = useState(localStorage.getItem('biz_slug') || '');
  const [business, setBusiness] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [showBizInput, setShowBizInput] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [initializing, setInitializing] = useState(true);

  const checkMine = async () => {
    const mine = await fetch(`${API_BASE}/businesses/mine`, { headers: apiHeaders() })
      .then(r => (r.ok ? r.json() : null)).catch(() => null);
    if (mine === null) return;                    // not logged in (shouldn't happen behind RequireAuth)
    if (mine.length > 0) await loadStats(mine[0].slug);
    else setNeedsOnboarding(true);
  };

  const loadStats = async (slug: string) => {
    setStatsLoading(true);
    try {
      const bRes = await fetch(`${API_BASE}/businesses/${slug}`, { headers: apiHeaders() });
      if (!bRes.ok) {
        // Remembered shop isn't accessible (e.g. belongs to a previous account).
        localStorage.removeItem('biz_slug');
        setBusinessSlug('');
        await checkMine();
        return;
      }
      const b = await bRes.json();
      setBusiness(b); setBusinessSlug(slug); localStorage.setItem('biz_slug', slug);
      const s = await fetch(`${API_BASE}/businesses/${slug}/stats`, { headers: apiHeaders() }).then(r => (r.ok ? r.json() : null));
      if (s) setStats(s);
    } catch {} finally { setStatsLoading(false); }
  };

  useEffect(() => {
    (async () => {
      if (businessSlug) await loadStats(businessSlug);
      else await checkMine();
      setInitializing(false);
    })();
  }, []);

  if (initializing) {
    return (
      <div className="card p-6">
        <div className="space-y-3">
          <div className="skeleton h-4 w-32" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-24" />)}
          </div>
        </div>
      </div>
    );
  }

  // First run: a logged-in account with no shop yet gets a focused create flow.
  if (needsOnboarding && !business) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center py-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-xs font-medium text-emerald-700 mb-4">
            Bienvenido a BarcodeDB
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight mb-2">
            Empecemos por tu comercio
          </h1>
          <p className="text-stone-500 max-w-md mx-auto">
            Creá tu comercio para cargar inventario, vender y llevar el control de tus ventas.
          </p>
        </div>
        <CreateBusinessCard onCreated={slug => { setNeedsOnboarding(false); loadStats(slug); }} />
      </div>
    );
  }

  return (
    <div>
      {business && stats && (
        <div className="animate-slide-up">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-semibold text-stone-800">{business.name}</h2>
              <p className="text-sm text-stone-400">{stats.totalProducts} productos en catálogo</p>
            </div>
            <button onClick={() => setShowBizInput(!showBizInput)} className="btn-ghost text-xs">
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
              <button onClick={() => loadStats(businessSlug)} className="btn-primary text-sm">Ir</button>
            </div>
          )}

          <SectorPicker
            slug={business.slug}
            sectors={business.sectors ?? []}
            onChange={s => setBusiness({ ...business, sectors: s })}
          />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="card p-4">
              <p className="text-xs text-stone-400 uppercase tracking-wider mb-1">Ventas hoy</p>
              <p className="text-2xl font-bold text-stone-800">${parseFloat(stats.today.total || '0').toFixed(2)}</p>
              <p className="text-xs text-stone-400 mt-0.5">{stats.today.count} ventas</p>
              {stats.profit && <p className="text-xs text-emerald-600 font-medium mt-0.5">Ganancia ${parseFloat(stats.profit.today || '0').toFixed(2)}</p>}
            </div>
            <div className="card p-4">
              <p className="text-xs text-stone-400 uppercase tracking-wider mb-1">Esta semana</p>
              <p className="text-2xl font-bold text-stone-800">${parseFloat(stats.week.total || '0').toFixed(2)}</p>
              <p className="text-xs text-stone-400 mt-0.5">{stats.week.count} ventas</p>
              {stats.profit && <p className="text-xs text-emerald-600 font-medium mt-0.5">Ganancia ${parseFloat(stats.profit.week || '0').toFixed(2)}</p>}
            </div>
            <div className="card p-4">
              <p className="text-xs text-stone-400 uppercase tracking-wider mb-1">Este mes</p>
              <p className="text-2xl font-bold text-stone-800">${parseFloat(stats.month.total || '0').toFixed(2)}</p>
              <p className="text-xs text-stone-400 mt-0.5">{stats.month.count} ventas</p>
              {stats.profit && <p className="text-xs text-emerald-600 font-medium mt-0.5">Ganancia ${parseFloat(stats.profit.month || '0').toFixed(2)}</p>}
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
            <Link to="/pos" className="btn-primary flex-1 text-center text-sm">Vender</Link>
            <Link to="/sales" className="btn-secondary flex-1 text-center text-sm">Ventas</Link>
            <Link to="/add" className="btn-secondary flex-1 text-center text-sm">+ Producto</Link>
          </div>
        </div>
      )}

      {/* Logged in but no shop loaded (e.g. stale slug cleared): let them enter one. */}
      {!business && !statsLoading && (
        <div className="text-center py-12">
          <p className="text-stone-500 mb-4">No hay ningún comercio cargado.</p>
          <button onClick={() => setShowBizInput(true)} className="btn-secondary text-sm">
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
              <button onClick={() => loadStats(businessSlug)} className="btn-primary">Ir</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
