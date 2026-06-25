import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

export function Home() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
        <div className="text-center">
          <h1 className="text-5xl font-bold mb-4">BarcodeDB</h1>
          <p className="text-slate-400 text-lg">
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
              className="w-full px-5 py-4 bg-slate-900 border border-slate-700 rounded-xl text-lg
                         focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent
                         placeholder:text-slate-600"
              autoFocus
            />
          </div>
        </form>
      </div>

      {/* Guía rápida */}
      <div className="mt-8 grid gap-4 text-sm">
        <details className="bg-slate-900 border border-slate-800 rounded-xl p-4 open:ring-2 open:ring-emerald-500/30">
          <summary className="font-semibold text-emerald-400 cursor-pointer select-none">
            📖 ¿Cómo usar BarcodeDB?
          </summary>
          <div className="mt-3 space-y-3 text-slate-300">
            <div>
              <p className="font-medium text-slate-200 mb-1">🔍 1. Buscar un producto</p>
              <p className="text-slate-400">Escribí el nombre, la marca o el código de barras en la barra de búsqueda. Si el código no está registrado, te va a dar la opción de <Link to="/add" className="text-emerald-400 underline">agregarlo</Link>.</p>
            </div>
            <div>
              <p className="font-medium text-slate-200 mb-1">📸 2. Escanear con la cámara</p>
              <p className="text-slate-400">Andá a <Link to="/scan" className="text-emerald-400 underline">Escanear</Link> y apuntá la cámara al código de barras. Te lleva directo al producto.</p>
            </div>
            <div>
              <p className="font-medium text-slate-200 mb-1">➕ 3. Agregar un producto nuevo</p>
              <p className="text-slate-400">Si un producto no existe, toca <Link to="/add" className="text-emerald-400 underline">Agregar producto</Link>. Completá nombre, marca, SKU, categoría y una foto (formato jpg, png, webp o gif).</p>
            </div>
            <div>
              <p className="font-medium text-slate-200 mb-1">💰 4. Armar tu inventario</p>
              <p className="text-slate-400">Cuando ves un producto, podés ponerle tu precio y stock para tener tu catálogo personal. Después usalo en el <Link to="/pos" className="text-emerald-400 underline">Punto de Venta</Link>.</p>
            </div>
            <div>
              <p className="font-medium text-slate-200 mb-1">📦 5. Importar desde Excel</p>
              <p className="text-slate-400">Andá a <Link to="/import" className="text-emerald-400 underline">Importar</Link> y subí un archivo con tu lista de productos. El sistema busca coincidencias automáticamente.</p>
            </div>
          </div>
        </details>

        <div className="flex flex-wrap gap-3 justify-center text-sm text-slate-500">
          <span>Buscá por marca</span>
          <span>•</span>
          <span>Código de barras</span>
          <span>•</span>
          <span>Categoría</span>
          <span>•</span>
          <span><Link to="/add" className="text-emerald-400 hover:underline">Agregar producto</Link></span>
          <span>•</span>
          <span><Link to="/import" className="text-emerald-400 hover:underline">Importar</Link></span>
        </div>
      </div>
    </div>
  );
}
