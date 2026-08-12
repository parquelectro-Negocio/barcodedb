import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { BarcodeStrip } from '../components/BarcodeStrip';
import { HelpDrawer } from '../components/HelpDrawer';

// The public landing: collaborative search, kept clean and scroll-free. The
// shop dashboard lives on its own /panel tab.
export function Home() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <div>
      {/* Hero */}
      <div className="flex flex-col items-center justify-center py-2 sm:py-5">
        <div className="text-center mb-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-xs font-medium text-emerald-700 mb-4">
            Base colaborativa de productos
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold text-stone-900 tracking-tight mb-3">
            BarcodeDB
          </h1>
          <BarcodeStrip />
          <p className="text-stone-500 text-base sm:text-lg max-w-lg mx-auto">
            Busca, escanea y comparte información de productos. Tu catálogo colaborativo de códigos de barras.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="w-full max-w-xl mb-4">
          <div className="relative group">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscá por nombre, marca o código de barras..."
              className="w-full pl-12 pr-5 py-3 bg-white border-2 border-stone-200 rounded-2xl text-lg text-stone-900
                         placeholder:text-stone-400 shadow-soft
                         focus:outline-none focus:border-emerald-500 focus:shadow-card-hover
                         transition-all duration-200"
              autoFocus
            />
          </div>
        </form>

        <div className="flex flex-wrap gap-2 justify-center text-sm">
          {['Motherboard', 'RTX 5060', 'Logitech'].map(ej => (
            <button
              key={ej}
              onClick={() => navigate(`/search?q=${encodeURIComponent(ej)}`)}
              className="px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-stone-500 hover:border-emerald-300 hover:text-emerald-700 transition-colors"
            >
              {ej}
            </button>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <Link to="/scan" className="card p-4 hover:border-emerald-300 group">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center mb-2 group-hover:bg-emerald-200 transition-colors">
            <svg className="w-5 h-5 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <h3 className="font-semibold text-stone-800 mb-1">Escanear código</h3>
          <p className="text-sm text-stone-400">Usá la cámara para identificar productos al instante</p>
        </Link>
        <Link to="/import" className="card p-4 hover:border-emerald-300 group">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center mb-2 group-hover:bg-emerald-200 transition-colors">
            <svg className="w-5 h-5 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
            </svg>
          </div>
          <h3 className="font-semibold text-stone-800 mb-1">Importar Excel</h3>
          <p className="text-sm text-stone-400">Cargá tu lista de precios y creá productos en lote</p>
        </Link>
        <Link to="/pos" className="card p-4 hover:border-emerald-300 group">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center mb-2 group-hover:bg-emerald-200 transition-colors">
            <svg className="w-5 h-5 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="font-semibold text-stone-800 mb-1">Punto de venta</h3>
          <p className="text-sm text-stone-400">Vendé productos con escáner y carrito</p>
        </Link>
      </div>

      <HelpDrawer />
    </div>
  );
}
